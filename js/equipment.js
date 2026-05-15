// ── Foreman Equipment Panel ────────────────────────────────────────────────
// Allows foremans to view equipment at their allowed sites and transfer items.

// Maps project code (first token of allowed_projects string) → site abbreviation
const PROJECT_TO_SITE = {
  '19TM019': 'CENTRA',
  '23TM001': 'DRAKE',
  '23TM007': 'WLAND',
  '23TM009': 'ALBERNI',
  '24TM002': 'B-5/6',
  '24TM010': 'COLUMBIA',
  '25TM001': 'B-7',
  '25TM004': 'IPL33',
  '25TM006': 'ARBUTUS',
  '25TM007': 'REIGN',
  '25TM009': 'B-P3',
  '25TM010': 'FHALL',
  '25TM011': 'FRASER'
};

const EQ_ALL_SITES = ['CENTRA','DRAKE','WLAND','ALBERNI','B-5/6','COLUMBIA','B-7','IPL33','ARBUTUS','REIGN','B-P3','FHALL','FRASER','YARD'];
let _fTransferItem = null;

function openEquipmentOverlay() {
  showInnerPage('equipmentPage');
  loadForemanEquipment();
}
function closeEquipmentOverlay() {
  goHome();
}

async function loadForemanEquipment() {
  const listEl  = document.getElementById('fEqList');
  const catFilter = document.getElementById('fEqCat')?.value;
  if (!listEl) return;

  listEl.innerHTML = '<div style="padding:20px;color:#8b8d96;text-align:center">Loading…</div>';

  // Determine which sites this foreman can see
  // allowed_projects entries look like "24TM010 - Axiom - 145 East Columbia St"
  // Extract the project code (first token) and map to site abbreviation
  const allowedProjects = window.currentProfile?.allowed_projects || [];
  const visibleSites = allowedProjects.length > 0
    ? [...new Set(allowedProjects.map(p => {
        const code = p.trim().split(/\s+/)[0].toUpperCase();
        return PROJECT_TO_SITE[code] || null;
      }).filter(Boolean))]
    : EQ_ALL_SITES; // if no projects assigned, show all (graceful fallback)

  const sitesToShow = visibleSites.length > 0 ? visibleSites : EQ_ALL_SITES;

  let q = sbClient.from('equipment')
    .select('id,category,name,sort_order,equipment_locations(site_name,quantity)')
    .order('category').order('sort_order');
  if (catFilter) q = q.eq('category', catFilter);

  const { data: items, error } = await q;
  if (error || !items?.length) {
    listEl.innerHTML = '<div style="padding:20px;color:#8b8d96;text-align:center">No equipment found.</div>';
    return;
  }

  // Group by category, only show items that have qty > 0 at visible sites
  const grouped = {};
  items.forEach(item => {
    const locs = {};
    (item.equipment_locations || []).forEach(l => { locs[l.site_name] = l.quantity; });
    const hasAtSite = sitesToShow.some(s => (locs[s] || 0) > 0);
    if (!hasAtSite) return; // hide items with 0 qty at visible sites
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({ ...item, locs });
  });

  if (!Object.keys(grouped).length) {
    listEl.innerHTML = '<div style="padding:20px;color:#8b8d96;text-align:center">No equipment at your sites.</div>';
    return;
  }

  listEl.innerHTML = Object.entries(grouped).map(([cat, catItems]) => `
    <div class="feq-category">
      <div class="feq-cat-header">${cat}</div>
      ${catItems.map(item => `
        <div class="feq-row">
          <div class="feq-row-top">
            <span class="feq-name">${escEq(item.name)}</span>
            <button class="feq-transfer-btn" onclick='openFTransfer(${JSON.stringify({id:item.id,name:item.name,category:item.category,locs:item.locs})}, ${JSON.stringify(sitesToShow)})'>⇄ Transfer</button>
          </div>
          <div class="feq-sites">
            ${sitesToShow.filter(s => (item.locs[s] || 0) > 0).map(s =>
              `<span class="feq-site-badge"><strong>${item.locs[s]}</strong> @ ${escEq(s)}</span>`
            ).join('')}
          </div>
        </div>`).join('')}
    </div>`).join('');
}

function openFTransfer(item, allowedSites) {
  _fTransferItem = item;
  document.getElementById('fTransferName').textContent = item.name + ' (' + item.category + ')';
  document.getElementById('fTransferError').textContent = '';
  document.getElementById('fTransferQty').value = '';
  document.getElementById('fTransferNotes').value = '';
  document.getElementById('fTransferTo').value = '';

  // Populate "from" with sites where item has qty > 0 (within allowed sites)
  const fromSel = document.getElementById('fTransferFrom');
  fromSel.innerHTML = '<option value="">Select from site…</option>' +
    allowedSites
      .filter(s => (item.locs[s] || 0) > 0)
      .map(s => `<option value="${escEq(s)}">${escEq(s)} (${item.locs[s]})</option>`)
      .join('');

  document.getElementById('fTransferModal').style.display = 'flex';
}
function closeFTransfer() {
  document.getElementById('fTransferModal').style.display = 'none';
}

async function confirmFTransfer() {
  const from  = document.getElementById('fTransferFrom').value;
  const to    = document.getElementById('fTransferTo').value;
  const qty   = parseFloat(document.getElementById('fTransferQty').value);
  const notes = document.getElementById('fTransferNotes').value.trim();
  const errEl = document.getElementById('fTransferError');
  const item  = _fTransferItem;

  if (!from)          { errEl.textContent = 'Select a From site.'; return; }
  if (!to)            { errEl.textContent = 'Select a To site.'; return; }
  if (from === to)    { errEl.textContent = 'From and To cannot be the same.'; return; }
  if (!qty || qty < 1){ errEl.textContent = 'Enter a valid quantity.'; return; }

  const available = item.locs[from] || 0;
  if (qty > available) { errEl.textContent = `Only ${available} available at ${from}.`; return; }

  errEl.textContent = '';

  // Decrease from_site
  await sbClient.from('equipment_locations').upsert(
    { equipment_id: item.id, site_name: from, quantity: available - qty, updated_at: new Date().toISOString() },
    { onConflict: 'equipment_id,site_name' }
  );

  // Increase to_site
  const { data: toLoc } = await sbClient.from('equipment_locations')
    .select('quantity').eq('equipment_id', item.id).eq('site_name', to).maybeSingle();
  await sbClient.from('equipment_locations').upsert(
    { equipment_id: item.id, site_name: to, quantity: (toLoc?.quantity || 0) + qty, updated_at: new Date().toISOString() },
    { onConflict: 'equipment_id,site_name' }
  );

  // Log transfer
  if (window.currentUser) {
    await sbClient.from('equipment_transfers').insert({
      equipment_id:   item.id,
      equipment_name: item.name,
      category:       item.category,
      from_site: from, to_site: to, quantity: qty,
      transferred_by: window.currentUser.id,
      foreman_name:   window.currentProfile?.full_name || '',
      notes
    });
  }

  closeFTransfer();
  loadForemanEquipment();
}

function escEq(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
