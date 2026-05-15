// ── Delivery Request Logic ────────────────────────────────────────────────────
// Handles the 📦 "Request Delivery" modal for foremans.
// Saves requests to Supabase delivery_requests table.

// ── Tab switcher ──────────────────────────────────────────────────────────────
function switchDelivTab(tab) {
  const isBlock = tab === 'block';
  document.getElementById('delivTabBlock').classList.toggle('active',  isBlock);
  document.getElementById('delivTabOther').classList.toggle('active', !isBlock);
  document.getElementById('delivPanelBlock').style.display = isBlock ? '' : 'none';
  document.getElementById('delivPanelOther').style.display = isBlock ? 'none' : '';
}

// ── Open / Close (now uses full inner page instead of overlay) ────────────────
function openDeliveryModal() {
  // Populate project dropdown and pre-select from active project
  const sel = document.getElementById('delivProjectSelect');
  if (sel) {
    const projects = window.userProjects || [];
    sel.innerHTML = '<option value="">Select project…</option>' +
      projects.map(p => `<option value="${p}">${p}</option>`).join('');
    // Pre-fill from dashboard project selection
    const activeProject = (typeof state !== 'undefined' && state.project) ? state.project : '';
    if (activeProject && projects.includes(activeProject)) sel.value = activeProject;
  }

  // Set default "needed by" to tomorrow
  const neededByEl = document.getElementById('delivNeededBy');
  if (neededByEl && !neededByEl.value) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    neededByEl.value = tomorrow.toISOString().split('T')[0];
  }

  // Reset all qty inputs, textareas, error
  document.querySelectorAll('.delivery-qty').forEach(el => { el.value = ''; });
  const timeEl = document.getElementById('delivNeededByTime');
  if (timeEl) timeEl.value = '';
  const otherEl = document.getElementById('delivOtherDesc');
  if (otherEl) otherEl.value = '';
  const notesEl = document.getElementById('delivNotes');
  if (notesEl) notesEl.value = '';
  const errEl = document.getElementById('deliveryError');
  if (errEl) errEl.textContent = '';

  // Always open on Block tab
  switchDelivTab('block');

  // Navigate to the delivery inner page
  showInnerPage('deliveryPage');
  loadForemanDeliveries();
}

function closeDeliveryModal() {
  goHome();
}

// ── Foreman: load their own delivery history ──────────────────────────────────
async function loadForemanDeliveries() {
  const wrap = document.getElementById('foremanDeliveryHistory');
  if (!wrap || !window.currentUser) return;

  const { data, error } = await sbClient
    .from('delivery_requests')
    .select('id, status, requested_at, needed_by, needed_by_time, projects(name), items')
    .eq('foreman_id', window.currentUser.id)
    .order('requested_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) {
    wrap.innerHTML = '<div style="color:var(--text-muted);font-size:13px">No requests yet.</div>';
    return;
  }

  const statusColors = { requested:'#f59e0b', on_schedule:'#3b82f6', on_hold:'#8b5cf6', delivered:'#22c55e', cancelled:'#6b7280' };
  const statusLabels = { requested:'📋 Requested', on_schedule:'🚛 On Schedule', on_hold:'⏸ On Hold', delivered:'✅ Delivered', cancelled:'Cancelled' };

  wrap.innerHTML = data.map(r => {
    const color      = statusColors[r.status] || 'var(--text-muted)';
    const label      = statusLabels[r.status] || r.status;
    const proj       = r.projects?.name || '—';
    const date       = r.needed_by ? `Needed: ${r.needed_by}${r.needed_by_time ? ' ' + r.needed_by_time : ''}` : '';
    const canDelete  = r.status === 'requested';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${proj}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${date || new Date(r.requested_at).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${color}20;color:${color};font-weight:600;white-space:nowrap">${label}</span>
          ${canDelete ? `<button onclick="deleteForemanDelivery('${r.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:2px 4px;line-height:1" title="Delete">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function deleteForemanDelivery(id) {
  if (!confirm('Delete this delivery request?')) return;
  const { error } = await sbClient.from('delivery_requests').delete().eq('id', id);
  if (error) { alert('Could not delete. Try again.'); return; }
  loadForemanDeliveries();
}

// ── Build items object from form inputs ───────────────────────────────────────
function buildDeliveryItems() {
  const qty = id => Math.max(0, parseInt(document.getElementById(id)?.value || '0', 10) || 0);

  return {
    '15cm': {
      standards_2h: qty('b15_standards_2h'),
      bondbeams:    qty('b15_bondbeams'),
      halves:       qty('b15_halves'),
      block_lock:   qty('b15_block_lock'),
      wall_mesh:    qty('b15_wall_mesh')
    },
    '20cm': {
      standards_2h: qty('b20_standards_2h'),
      bondbeams:    qty('b20_bondbeams'),
      halves:       qty('b20_halves'),
      multiblock:   qty('b20_multiblock'),
      block_lock:   qty('b20_block_lock'),
      wall_mesh:    qty('b20_wall_mesh')
    },
    special: {
      squints:          qty('sp_squints'),
      half_height:      qty('sp_half_height'),
      slabs:            qty('sp_slabs'),
      dbl_bullnose_full: qty('sp_dbl_bullnose_full'),
      dbl_bullnose_half: qty('sp_dbl_bullnose_half'),
      sgl_bullnose_full: qty('sp_sgl_bullnose_full'),
      sgl_bullnose_half: qty('sp_sgl_bullnose_half')
    },
    '25cm': {
      standards_2h: qty('b25_standards_2h'),
      bondbeams:    qty('b25_bondbeams'),
      halves:       qty('b25_halves'),
      block_lock:   qty('b25_block_lock'),
      wall_mesh:    qty('b25_wall_mesh')
    },
    '30cm': {
      standards_2h: qty('b30_standards_2h'),
      bondbeams:    qty('b30_bondbeams'),
      halves:       qty('b30_halves'),
      block_lock:   qty('b30_block_lock'),
      wall_mesh:    qty('b30_wall_mesh')
    },
    mortar_tek: qty('mat_mortar_tek'),
    blockfill:  qty('mat_blockfill')
  };
}

function totalItems(items) {
  let total = 0;
  ['15cm','20cm','25cm','30cm','special'].forEach(size => {
    if (items[size]) Object.values(items[size]).forEach(v => { total += v; });
  });
  total += (items.mortar_tek || 0) + (items.blockfill || 0);
  return total;
}

function getActiveDelivTab() {
  return document.getElementById('delivTabBlock')?.classList.contains('active') ? 'block' : 'other';
}

// ── Submit request ────────────────────────────────────────────────────────────
async function submitDeliveryRequest() {
  const btn      = document.getElementById('deliverySubmitBtn');
  const errEl    = document.getElementById('deliveryError');
  const projSel  = document.getElementById('delivProjectSelect');
  const projName = projSel?.value || '';
  const neededBy     = document.getElementById('delivNeededBy')?.value || null;
  const neededByTime = (document.getElementById('delivNeededByTime')?.value || '').trim() || null;
  const notes        = (document.getElementById('delivNotes')?.value || '').trim();
  const activeTab    = getActiveDelivTab();

  if (errEl) errEl.textContent = '';

  if (!projName) {
    if (errEl) errEl.textContent = 'Please select a project.';
    return;
  }

  let items;

  if (activeTab === 'block') {
    items = buildDeliveryItems();
    if (totalItems(items) === 0) {
      if (errEl) errEl.textContent = 'Enter at least one item quantity.';
      return;
    }
  } else {
    const desc = (document.getElementById('delivOtherDesc')?.value || '').trim();
    if (!desc) {
      if (errEl) errEl.textContent = 'Please describe what you need.';
      return;
    }
    items = { other_materials: desc };
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    // Resolve project_id from name
    const { data: project } = await sbClient
      .from('projects').select('id').eq('name', projName).single();

    if (!project) throw new Error('Project not found.');

    const { error } = await sbClient.from('delivery_requests').insert({
      project_id:     project.id,
      foreman_id:     window.currentUser.id,
      items,
      notes:          notes || null,
      needed_by:      neededBy || null,
      needed_by_time: neededByTime || null
    });

    if (error) throw error;

    closeDeliveryModal();

    // Show success toast (showToast is defined in app.js)
    if (typeof showToast === 'function') {
      showToast('📦 Delivery request sent!', 'success');
    }

    loadForemanDeliveries();

    // ── SMS via Twilio Edge Function ─────────────────────────────────────────
    try {
      const foremanName = window.currentProfile?.full_name || 'Foreman';
      fetch('https://aacrsnljubmmqqxfknzp.supabase.co/functions/v1/send-sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foreman_name:   foremanName,
          project_name:   projName,
          items,
          notes:          notes || null,
          needed_by:      neededBy || null,
          needed_by_time: neededByTime || null
        })
      });
    } catch (_) { /* best-effort — SMS failure never blocks the user */ }

  } catch (err) {
    console.error('Delivery request failed:', err);
    if (errEl) errEl.textContent = err.message || 'Failed to send request. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
  }
}
