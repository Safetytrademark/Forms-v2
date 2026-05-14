// ── Admin Panel Logic ─────────────────────────────────────────────────────────
// Requires: supabase-client.js (sbClient must be defined)
// Auth guard: checks session + admin role on load; redirects if not admin.

let adminCurrentUser    = null;
let adminAllProjects    = [];     // full list for assign modal
let assignTarget        = null;   // { id, name } of the foreman being assigned

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  adminCurrentUser = session.user;

  const { data: profile } = await sbClient
    .from('profiles').select('role, full_name').eq('id', adminCurrentUser.id).single();

  if (!profile || profile.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }

  // Show user label
  const lbl = document.getElementById('adminUserLabel');
  if (lbl) lbl.textContent = profile.full_name || adminCurrentUser.email;

  // Load all tabs
  await Promise.all([loadForemans(), loadProjects(), loadDocuments(), loadDeliveries(), loadByProject(), loadSubmissions(), loadTMEquipment(), loadRentalEquipment()]);
});

// ── Sign out ──────────────────────────────────────────────────────────────────
async function adminLogout() {
  await sbClient.auth.signOut();
  window.location.href = 'index.html';
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.admin-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tab}`);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  FOREMANS TAB
// ═════════════════════════════════════════════════════════════════════════════
async function loadForemans() {
  const wrap = document.getElementById('foremansList');
  if (!wrap) return;

  const { data: foremans, error } = await sbClient
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('full_name');

  if (error || !foremans?.length) {
    wrap.innerHTML = '<div class="admin-empty">No accounts yet. Create them in the Supabase Dashboard → Authentication → Users.</div>';
    return;
  }

  // Count project assignments per user
  const { data: assignments } = await sbClient
    .from('foreman_projects')
    .select('foreman_id');

  const counts = {};
  assignments?.forEach(a => { counts[a.foreman_id] = (counts[a.foreman_id] || 0) + 1; });

  wrap.innerHTML = foremans.map(f => `
    <div class="admin-table-row">
      <div class="admin-table-cell">
        <div class="admin-cell-name">
          ${esc(f.full_name) || '(no name)'}
          ${f.role === 'admin' ? '<span class="admin-role-badge">Admin</span>' : ''}
        </div>
        <div class="admin-cell-meta">${counts[f.id] || 0} project(s) assigned</div>
      </div>
      <button class="admin-btn-icon" onclick="openAssignModal('${f.id}', '${esc(f.full_name)}')">
        Assign Projects
      </button>
    </div>
  `).join('');
}

// ── Assign Projects modal ─────────────────────────────────────────────────────
async function openAssignModal(foremanId, foremanName) {
  assignTarget = { id: foremanId, name: foremanName };
  document.getElementById('assignModalTitle').textContent = `Projects for ${foremanName}`;
  document.getElementById('assignModal').style.display = 'flex';

  const body = document.getElementById('assignModalBody');
  body.innerHTML = '<div class="admin-loading">Loading…</div>';

  // All active projects
  const { data: projects } = await sbClient
    .from('projects')
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  // Currently assigned projects for this foreman
  const { data: assigned } = await sbClient
    .from('foreman_projects')
    .select('project_id')
    .eq('foreman_id', foremanId);

  const assignedIds = new Set(assigned?.map(a => a.project_id) || []);

  if (!projects?.length) {
    body.innerHTML = '<div class="admin-empty">No active projects. Add some in the Projects tab.</div>';
    return;
  }

  body.innerHTML = projects.map(p => `
    <label class="assign-project-item">
      <input type="checkbox" value="${p.id}" ${assignedIds.has(p.id) ? 'checked' : ''}>
      <span class="assign-project-label">${esc(p.name)}</span>
    </label>
  `).join('');
}

function closeAssignModal(evt) {
  if (evt && evt.target !== document.getElementById('assignModal')) return;
  document.getElementById('assignModal').style.display = 'none';
  assignTarget = null;
}

async function saveAssignments() {
  if (!assignTarget) return;

  const checked = [...document.querySelectorAll('#assignModalBody input[type=checkbox]:checked')]
    .map(cb => cb.value);

  // Delete existing then re-insert
  await sbClient.from('foreman_projects').delete().eq('foreman_id', assignTarget.id);

  if (checked.length) {
    const rows = checked.map(pid => ({ foreman_id: assignTarget.id, project_id: pid }));
    await sbClient.from('foreman_projects').insert(rows);
  }

  document.getElementById('assignModal').style.display = 'none';
  assignTarget = null;
  await loadForemans();   // refresh counts
}

// ═════════════════════════════════════════════════════════════════════════════
//  PROJECTS TAB
// ═════════════════════════════════════════════════════════════════════════════
async function loadProjects() {
  const wrap = document.getElementById('projectsList');
  if (!wrap) return;

  const { data: projects, error } = await sbClient
    .from('projects')
    .select('id, name, status, created_at')
    .order('name');

  // Cache for other tabs
  adminAllProjects = projects || [];
  populateProjectSelects(adminAllProjects);

  if (error || !adminAllProjects.length) {
    wrap.innerHTML = '<div class="admin-empty">No projects yet. Add one above.</div>';
    return;
  }

  wrap.innerHTML = adminAllProjects.map(p => `
    <div class="admin-table-row" id="proj-row-${p.id}">
      <div class="admin-table-cell">
        <div class="admin-cell-name">${esc(p.name)}</div>
        <div class="admin-cell-meta">Added ${formatDate(p.created_at)}</div>
      </div>
      <span class="admin-badge ${p.status === 'active' ? 'admin-badge-active' : 'admin-badge-inactive'}">
        ${p.status}
      </span>
      <label class="admin-toggle" title="Toggle active/inactive">
        <input type="checkbox" ${p.status === 'active' ? 'checked' : ''}
          onchange="toggleProject('${p.id}', this.checked)">
        <span class="admin-toggle-track"></span>
      </label>
    </div>
  `).join('');
}

function populateProjectSelects(projects) {
  // Upload form selector
  const docSel = document.getElementById('docProjectSelect');
  if (docSel) {
    docSel.innerHTML = '<option value="">Select project…</option>' +
      projects.filter(p => p.status === 'active').map(p =>
        `<option value="${p.id}">${esc(p.name)}</option>`
      ).join('');
  }
  // Filter selector in documents tab
  const filterSel = document.getElementById('docFilterSelect');
  if (filterSel) {
    filterSel.innerHTML = '<option value="">All projects</option>' +
      projects.map(p =>
        `<option value="${p.id}">${esc(p.name)}</option>`
      ).join('');
  }
}

async function addProject() {
  const input = document.getElementById('newProjectName');
  const errEl = document.getElementById('projectAddError');
  const name  = (input?.value || '').trim();
  if (!name) { if (errEl) errEl.textContent = 'Enter a project name.'; return; }
  if (errEl) errEl.textContent = '';

  const { error } = await sbClient.from('projects').insert({ name });
  if (error) {
    if (errEl) errEl.textContent = error.message.includes('unique')
      ? 'A project with that name already exists.'
      : error.message;
    return;
  }

  input.value = '';
  await loadProjects();
}

async function toggleProject(projectId, active) {
  const status = active ? 'active' : 'inactive';
  await sbClient.from('projects').update({ status }).eq('id', projectId);
  await loadProjects();
}

// ═════════════════════════════════════════════════════════════════════════════
//  DOCUMENTS TAB
// ═════════════════════════════════════════════════════════════════════════════
async function loadDocuments() {
  const wrap     = document.getElementById('documentsList');
  const filterSel = document.getElementById('docFilterSelect');
  if (!wrap) return;

  wrap.innerHTML = '<div class="admin-loading">Loading…</div>';

  let query = sbClient
    .from('documents')
    .select('id, title, type, file_name, file_url, created_at, project_id, projects(name)')
    .order('created_at', { ascending: false });

  if (filterSel?.value) {
    query = query.eq('project_id', filterSel.value);
  }

  const { data: docs, error } = await query;

  if (error || !docs?.length) {
    wrap.innerHTML = '<div class="admin-empty">No documents uploaded yet.</div>';
    return;
  }

  // Define sections in display order
  const SECTIONS = [
    { key: 'site_photo',    label: 'Site Photos',    icon: '📸', isPhotos: true  },
    { key: 'change_order',  label: 'Change Orders',  icon: '📋', isPhotos: false },
    { key: 'rfi',           label: 'RFIs',           icon: '🔄', isPhotos: false },
    { key: 'drawing',       label: 'Drawings',       icon: '📐', isPhotos: false },
    { key: 'submittal',     label: 'Submittals',     icon: '📩', isPhotos: false },
    { key: 'specification', label: 'Specifications', icon: '📑', isPhotos: false },
    { key: 'general',       label: 'General',        icon: '📄', isPhotos: false },
  ];

  // Group docs by type
  const byType = {};
  for (const d of docs) {
    const k = d.type || 'general';
    if (!byType[k]) byType[k] = [];
    byType[k].push(d);
  }

  let html = '';
  for (const sec of SECTIONS) {
    const items = byType[sec.key];
    if (!items?.length) continue;

    html += `<div class="doc-section">
      <div class="doc-section-hdr">
        <span class="doc-section-icon">${sec.icon}</span>
        <span class="doc-section-title">${sec.label}</span>
        <span class="doc-section-count">${items.length}</span>
      </div>`;

    if (sec.isPhotos) {
      // Photo grid
      html += `<div class="doc-photo-grid">`;
      for (const d of items) {
        html += `
          <div class="doc-photo-card">
            <a href="${d.file_url}" target="_blank" rel="noopener" class="doc-photo-thumb-wrap">
              <img class="doc-photo-thumb" src="${d.file_url}" alt="${esc(d.title)}" loading="lazy">
            </a>
            <div class="doc-photo-info">
              <div class="doc-photo-title" title="${esc(d.title)}">${esc(d.title)}</div>
              <div class="doc-photo-meta">${esc(d.projects?.name || '')} · ${formatDate(d.created_at)}</div>
            </div>
            <button class="doc-photo-del" onclick="deleteDocument('${d.id}','${esc(d.file_name||'')}')" title="Delete">🗑</button>
          </div>`;
      }
      html += `</div>`;
    } else {
      // List rows
      for (const d of items) {
        html += `
          <div class="doc-row">
            <div class="doc-row-info">
              <div class="doc-row-title">${esc(d.title)}</div>
              <div class="doc-row-meta">${esc(d.projects?.name || '')} · ${formatDate(d.created_at)}</div>
            </div>
            <a class="admin-btn-icon" href="${d.file_url}" target="_blank" rel="noopener" style="text-decoration:none">↗ Open</a>
            <button class="admin-btn-danger" onclick="deleteDocument('${d.id}','${esc(d.file_name||'')}')">🗑</button>
          </div>`;
      }
    }

    html += `</div>`; // .doc-section
  }

  wrap.innerHTML = html || '<div class="admin-empty">No documents uploaded yet.</div>';
}

async function uploadDocument() {
  const btn      = document.getElementById('docUploadBtn');
  const errEl    = document.getElementById('docUploadError');
  const projectId = document.getElementById('docProjectSelect').value;
  const title    = (document.getElementById('docTitle').value || '').trim();
  const type     = document.getElementById('docType').value;
  const fileInput = document.getElementById('docFile');
  const file     = fileInput?.files?.[0];

  if (errEl) errEl.textContent = '';

  if (!projectId) { if (errEl) errEl.textContent = 'Select a project.'; return; }
  if (!title)     { if (errEl) errEl.textContent = 'Enter a title.'; return; }
  if (!file)      { if (errEl) errEl.textContent = 'Choose a file.'; return; }

  btn.disabled = true;
  btn.textContent = 'Uploading…';

  try {
    // 1. Upload file to Supabase Storage
    const ext      = file.name.split('.').pop();
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path     = `${projectId}/${safeName}`;

    const { error: storageErr } = await sbClient.storage
      .from('project-documents')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (storageErr) throw storageErr;

    // 2. Get public URL
    const { data: { publicUrl } } = sbClient.storage
      .from('project-documents')
      .getPublicUrl(path);

    // 3. Insert row via RPC (bypasses RLS — security enforced inside the function)
    const { error: dbErr } = await sbClient.rpc('insert_document', {
      p_project_id: projectId,
      p_title:      title,
      p_type:       type,
      p_file_name:  path,
      p_file_url:   publicUrl
    });

    if (dbErr) throw dbErr;

    // Reset form
    document.getElementById('docTitle').value = '';
    fileInput.value = '';
    await loadDocuments();

  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Upload failed.';
  } finally {
    btn.disabled = false;
    btn.textContent = '⬆️ Upload';
  }
}

async function deleteDocument(docId, filePath) {
  if (!confirm('Delete this document? This cannot be undone.')) return;

  // Remove from storage
  if (filePath) {
    await sbClient.storage.from('project-documents').remove([filePath]);
  }

  // Remove from DB
  await sbClient.from('documents').delete().eq('id', docId);
  await loadDocuments();
}

// ═════════════════════════════════════════════════════════════════════════════
//  DELIVERIES TAB
// ═════════════════════════════════════════════════════════════════════════════

// Project code → site abbreviation (shared with equipment.js logic)
const PROJ_TO_SITE = {
  '19TM019': 'CENTRA',  '23TM001': 'DRAKE',   '23TM007': 'WLAND',
  '23TM009': 'ALBERNI', '24TM002': 'B-5/6',   '24TM010': 'COLUMBIA',
  '25TM001': 'B-7',     '25TM004': 'IPL33',   '25TM006': 'ARBUTUS',
  '25TM007': 'REIGN',   '25TM009': 'B-P3',    '25TM010': 'FHALL',
  '25TM011': 'FRASER'
};

function projNameToAbbr(name) {
  const code = (name || '').trim().split(/[\s-]+/)[0].toUpperCase();
  return PROJ_TO_SITE[code] || code || '—';
}

async function loadDeliveries() {
  const pendingWrap = document.getElementById('deliveriesPending');
  const historyWrap = document.getElementById('deliveriesHistory');
  if (!pendingWrap) return;

  const { data: reqs, error } = await sbClient
    .from('delivery_requests')
    .select('*, projects(name), profiles(full_name), po_number')
    .order('requested_at', { ascending: false });

  if (error) {
    pendingWrap.innerHTML = '<div class="admin-empty">Could not load deliveries.</div>';
    return;
  }

  const pending = (reqs || []).filter(r => ['requested','on_schedule','pending','in_transit'].includes(r.status));
  const history = (reqs || []).filter(r => ['delivered','cancelled'].includes(r.status));

  pendingWrap.innerHTML = pending.length
    ? pending.map(renderDeliveryCard).join('')
    : '<div class="admin-empty">No pending delivery requests. 🎉</div>';

  historyWrap.innerHTML = history.length
    ? history.map(r => renderDeliveryCard(r, true)).join('')
    : '<div class="admin-empty">No delivery history yet.</div>';
}

function renderDeliveryCard(req, compact = false) {
  const statusColors = {
    requested:   '#f59e0b',
    on_schedule: '#3b82f6',
    delivered:   '#22c55e'
  };
  const statusLabels = {
    requested:   '📋 Requested',
    on_schedule: '🚛 On Schedule',
    delivered:   '✅ Delivered'
  };
  const color = statusColors[req.status] || 'var(--text-muted)';

  const projFull  = req.projects?.name || '';
  const jobCode   = projFull.trim().split(/\s+/)[0];          // "24TM010"
  const siteAbbr  = projNameToAbbr(projFull);                 // "COLUMBIA"
  const poLabel   = jobCode ? ` · <span style="opacity:.65;font-weight:500">PO: ${esc(jobCode)}</span>` : '';
  const suppPO    = req.po_number ? ` · <span style="opacity:.65;font-weight:500">Supplier PO: ${esc(req.po_number)}</span>` : '';
  const itemsList = formatDeliveryItems(req.items);
  const timeStr   = req.needed_by_time ? ` at <strong>${esc(req.needed_by_time)}</strong>` : '';
  const neededBy  = req.needed_by
    ? `Needed by: <strong>${formatDate(req.needed_by)}</strong>${timeStr}`
    : '';

  const actions = `
    <div class="delivery-card-actions">
      <select class="delivery-status-select" onchange="updateDeliveryStatus('${req.id}', this.value)">
        <option value="requested"   ${req.status==='requested'   ? 'selected':''}>📋 Requested</option>
        <option value="on_schedule" ${req.status==='on_schedule' ? 'selected':''}>🚛 On Schedule</option>
        <option value="delivered"   ${req.status==='delivered'   ? 'selected':''}>✅ Delivered</option>
      </select>
      <button class="admin-btn-danger" onclick="deleteDelivery('${req.id}')">🗑 Delete</button>
    </div>`;

  return `
    <div class="delivery-card" style="border-left-color:${color}">
      <div class="delivery-card-header">
        <div>
          <div class="admin-cell-name">${siteAbbr}${poLabel}${suppPO}</div>
          <div class="admin-cell-meta">${esc(req.profiles?.full_name || 'Unknown foreman')} · ${formatDate(req.requested_at)}${neededBy ? ' · ' + neededBy : ''}</div>
        </div>
        <span class="delivery-status-pill" style="background:${color}20;color:${color}">${statusLabels[req.status] || req.status}</span>
      </div>
      <div class="delivery-item-list">${itemsList || '<em>No items specified</em>'}</div>
      ${req.notes ? `<div class="delivery-card-notes">📝 ${esc(req.notes)}</div>` : ''}
      ${actions}
    </div>`;
}

function formatDeliveryItems(items) {
  if (!items) return '';

  // Other Materials tab submission
  if (items.other_materials) {
    return `<div class="delivery-item-other">📋 <span>${esc(items.other_materials)}</span></div>`;
  }

  const lines = [];
  const blockSizes = ['15cm', '20cm', '25cm', '30cm'];
  const blockTypes = {
    standards_2h: 'Standards 2H',
    bondbeams:    'Bondbeams',
    halves:       'Halves',
    multiblock:   'Multiblock',
    squints:      'Squints',
    block_lock:   'Block Lock Bundle',
    wall_mesh:    'Wall Mesh'
  };

  blockSizes.forEach(size => {
    if (!items[size]) return;
    Object.entries(items[size]).forEach(([type, qty]) => {
      if (qty > 0) lines.push(
        `<div class="delivery-item-row"><span class="delivery-item-label">${size} ${blockTypes[type] || type}</span><strong>${qty} pallets</strong></div>`
      );
    });
  });
  if (items.mortar_tek > 0) lines.push(`<div class="delivery-item-row"><span class="delivery-item-label">Mortar Tek</span><strong>${items.mortar_tek} pallets</strong></div>`);
  if (items.blockfill   > 0) lines.push(`<div class="delivery-item-row"><span class="delivery-item-label">Blockfill</span><strong>${items.blockfill} pallets</strong></div>`);
  return lines.join('');
}

async function updateDeliveryStatus(id, status) {
  await sbClient.from('delivery_requests').update({ status }).eq('id', id);
  await loadDeliveries();
}

async function deleteDelivery(id) {
  if (!confirm('Delete this delivery request? This cannot be undone.')) return;
  const { error } = await sbClient.from('delivery_requests').delete().eq('id', id);
  if (error) { alert('Could not delete. Try again.'); return; }
  await loadDeliveries();
}

// ═════════════════════════════════════════════════════════════════════════════
//  BY PROJECT TAB — aggregate summary report
// ═════════════════════════════════════════════════════════════════════════════
async function loadByProject() {
  const wrap      = document.getElementById('byProjectList');
  const filterSel = document.getElementById('byProjectFilter');
  if (!wrap) return;

  // Populate project dropdown on first call
  if (filterSel && filterSel.options.length <= 1) {
    const { data: projects } = await sbClient
      .from('projects').select('id, name').order('name');
    if (projects?.length) {
      filterSel.innerHTML = '<option value="">— Select a project —</option>' +
        projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    }
  }

  const projectId = filterSel?.value;
  if (!projectId) {
    wrap.innerHTML = '<div class="proj-report-prompt">👆 Select a project above to see the materials summary.</div>';
    return;
  }

  wrap.innerHTML = '<div class="admin-loading">Loading…</div>';

  const { data: reqs, error } = await sbClient
    .from('delivery_requests')
    .select('items, status')
    .eq('project_id', projectId);

  if (error) { wrap.innerHTML = '<div class="admin-empty">Error loading data.</div>'; return; }
  if (!reqs?.length) { wrap.innerHTML = '<div class="admin-empty">No delivery requests for this project yet.</div>'; return; }

  // ── Aggregate totals across all requests ──────────────────────────────────
  const blockTypes = {
    standards_2h: 'Standards 2H', bondbeams: 'Bondbeams',
    halves: 'Halves', multiblock: 'Multiblock', squints: 'Squints',
    block_lock: 'Block Lock Bundle', wall_mesh: 'Wall Mesh'
  };
  const sizes = ['15cm', '20cm', '25cm', '30cm'];
  const totals = { '15cm': {}, '20cm': {}, '25cm': {}, '30cm': {}, mortar_tek: 0, blockfill: 0 };
  const otherTexts = [];
  const statusCounts = { requested: 0, on_schedule: 0, delivered: 0 };

  reqs.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    const items = r.items;
    if (!items) return;
    if (items.other_materials) { otherTexts.push(items.other_materials); return; }
    sizes.forEach(size => {
      if (!items[size]) return;
      Object.entries(items[size]).forEach(([type, qty]) => {
        if (qty > 0) totals[size][type] = (totals[size][type] || 0) + qty;
      });
    });
    if (items.mortar_tek > 0) totals.mortar_tek += items.mortar_tek;
    if (items.blockfill  > 0) totals.blockfill  += items.blockfill;
  });

  // ── Status summary line ───────────────────────────────────────────────────
  const statusParts = [
    statusCounts.delivered   ? `✅ ${statusCounts.delivered} delivered`    : '',
    statusCounts.on_schedule ? `🚛 ${statusCounts.on_schedule} in transit` : '',
    statusCounts.requested   ? `📋 ${statusCounts.requested} pending`      : ''
  ].filter(Boolean).join(' · ');

  // ── Render block sections ─────────────────────────────────────────────────
  const renderSize = size => {
    const entries = Object.entries(totals[size]).filter(([, v]) => v > 0);
    if (!entries.length) return '';
    return `
      <div class="proj-report-section">
        <div class="proj-report-section-title">🧱 ${size} Blocks</div>
        ${entries.map(([type, qty]) => `
          <div class="proj-report-row">
            <span>${blockTypes[type] || type}</span>
            <strong>${qty} pallets</strong>
          </div>`).join('')}
      </div>`;
  };

  const hasMaterials = totals.mortar_tek > 0 || totals.blockfill > 0;
  const materialsSection = hasMaterials ? `
    <div class="proj-report-section">
      <div class="proj-report-section-title">🪣 Materials</div>
      ${totals.mortar_tek > 0 ? `<div class="proj-report-row"><span>Mortar Tek</span><strong>${totals.mortar_tek} pallets</strong></div>` : ''}
      ${totals.blockfill  > 0 ? `<div class="proj-report-row"><span>Blockfill</span><strong>${totals.blockfill} pallets</strong></div>` : ''}
    </div>` : '';

  const otherSection = otherTexts.length ? `
    <div class="proj-report-section">
      <div class="proj-report-section-title">📋 Other Material Requests</div>
      ${otherTexts.map((t, i) => `<div class="proj-report-other">${i + 1}. ${esc(t)}</div>`).join('')}
    </div>` : '';

  const hasAny = sizes.some(s => Object.values(totals[s]).some(v => v > 0)) || hasMaterials || otherTexts.length;
  const projName = filterSel.options[filterSel.selectedIndex]?.text || '';

  wrap.innerHTML = `
    <div class="proj-report-card">
      <div class="proj-report-header">
        <div class="proj-report-title">${esc(projName)}</div>
        <div class="proj-report-meta">${reqs.length} request${reqs.length !== 1 ? 's' : ''} total · ${statusParts}</div>
      </div>
      <div class="proj-report-body">
        ${hasAny
          ? renderSize('15cm') + renderSize('20cm') + renderSize('25cm') + renderSize('30cm') + materialsSection + otherSection
          : '<div class="admin-empty" style="padding:20px 0">No items specified in these requests.</div>'
        }
      </div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SUBMISSIONS TAB
// ═════════════════════════════════════════════════════════════════════════════
async function loadSubmissions() {
  const wrap       = document.getElementById('submissionsList');
  const projFilter = document.getElementById('subFilterProject');
  const typeFilter = document.getElementById('subFilterType');
  if (!wrap) return;

  // Populate project dropdown on first call
  if (projFilter && projFilter.options.length <= 1) {
    const { data: projects } = await sbClient
      .from('projects').select('name').order('name');
    if (projects?.length) {
      projFilter.innerHTML = '<option value="">All Projects</option>' +
        projects.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
    }
  }

  wrap.innerHTML = '<div class="admin-loading">Loading…</div>';

  let query = sbClient
    .from('submissions')
    .select('id, foreman_name, project_name, submission_type, submitted_at, pdf_url')
    .order('submitted_at', { ascending: false })
    .limit(200);

  if (projFilter?.value) query = query.eq('project_name', projFilter.value);
  if (typeFilter?.value) query = query.eq('submission_type', typeFilter.value);

  const { data, error } = await query;

  if (error) {
    wrap.innerHTML = '<div class="admin-empty">Could not load submissions.</div>';
    return;
  }
  if (!data?.length) {
    wrap.innerHTML = '<div class="admin-empty">No submissions found.</div>';
    return;
  }

  const typeIcons = {
    'Daily Tailgate':          '☀️',
    'Weekly Toolbox Talk':     '🛠️',
    'Incident Report':         '🚨',
    'Hazard Observation':      '⚠️',
    'QAQC-Foreman':            '✅',
    'Site Photos Only':        '📷',
    'Weekly Timesheet':        '🕐',
    'Production Report':       '📊',
    'Telehandler Inspection':  '🏗️',
    'Forklift Inspection':     '🚜',
    'E-Pallet Jack Inspection':'⚡',
    'Scaffolding Inspection':  '🪜',
  };

  wrap.innerHTML = data.map(s => `
    <div class="admin-table-row">
      <span class="sub-type-icon">${typeIcons[s.submission_type] || '📋'}</span>
      <div class="admin-table-cell">
        <div class="admin-cell-name">${esc(s.submission_type)}</div>
        <div class="admin-cell-meta">
          ${esc(s.foreman_name || '—')} &nbsp;·&nbsp; ${esc(s.project_name || '—')} &nbsp;·&nbsp; ${formatDate(s.submitted_at)}
        </div>
      </div>
      ${s.pdf_url
        ? `<a class="admin-btn-icon" href="${s.pdf_url}" target="_blank" rel="noopener">⬇ PDF</a>`
        : ''
      }
    </div>`).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
//  EQUIPMENT
// ═════════════════════════════════════════════════════════════════════════════
const EQ_SITES = ['CENTRA','DRAKE','WLAND','ALBERNI','B-5/6','COLUMBIA','B-7','IPL33','ARBUTUS','REIGN','B-P3','FHALL','FRASER','YARD'];
let _eqTransferItem = null;
let _eqManageItem   = null;
const _eqItemsCache = {};   // id → full item object (with equipment_locations)

// ── Shared category block renderer ────────────────────────────────────────────
// Single-site → qty display + Manage + Transfer buttons
// Multi-site  → site badges + Manage + Transfer buttons
function _buildEqCatBlock(cat, catItems, activeSites) {
  const single = activeSites.length === 1;
  const site   = single ? activeSites[0] : null;

  const rows = catItems.map(item => {
    const locs = {};
    (item.equipment_locations || []).forEach(l => { locs[l.site_name] = l.quantity; });

    const actions = `
      <div class="eq-row-actions">
        <button class="eq-manage-btn" onclick="openManageModal('${esc(item.id)}')">✏ Edit</button>
        <button class="eq-transfer-btn" onclick='openTransferModal(${JSON.stringify({id:item.id,name:item.name,category:item.category,section:item.section||'TM Equipment'})})'>⇄ Move</button>
      </div>`;

    if (single) {
      const qty = locs[site] || 0;
      return `
        <div class="eq-list-row ${qty === 0 ? 'eq-row-empty' : ''}">
          <div class="eq-list-name">${esc(item.name)}</div>
          <div class="eq-list-qty">${qty > 0 ? `<strong>${qty}</strong>` : '<span class="eq-zero">—</span>'}</div>
          ${actions}
        </div>`;
    } else {
      const nonZero = activeSites.filter(s => (locs[s] || 0) > 0);
      return `
        <div class="eq-list-row ${nonZero.length === 0 ? 'eq-row-empty' : ''}">
          <div class="eq-list-name">${esc(item.name)}</div>
          <div class="eq-list-chips">
            ${nonZero.map(s => `<span class="eq-site-chip">${esc(s)} ×${locs[s]}</span>`).join('') || ''}
          </div>
          ${actions}
        </div>`;
    }
  }).join('');

  return `
    <div class="eq-category-block">
      <div class="eq-category-header">${cat}</div>
      <div class="eq-list">${rows}</div>
    </div>`;
}

// ── Shared history renderer ────────────────────────────────────────────────────
async function _renderTransferHistory(histId) {
  const histWrap = document.getElementById(histId);
  if (!histWrap) return;
  histWrap.innerHTML = '<div class="admin-loading">Loading…</div>';
  const { data: hist } = await sbClient.from('equipment_transfers')
    .select('*').order('created_at', { ascending: false }).limit(30);
  histWrap.innerHTML = hist?.length
    ? hist.map(t => `
        <div class="admin-table-row">
          <div class="admin-table-cell">
            <div class="admin-cell-name">${esc(t.equipment_name)}</div>
            <div class="admin-cell-meta">
              ${esc(t.from_site)} → ${esc(t.to_site)} &nbsp;·&nbsp; qty: <strong>${t.quantity}</strong>
              &nbsp;·&nbsp; ${esc(t.foreman_name || 'Admin')} &nbsp;·&nbsp; ${formatDate(t.created_at)}
              ${t.notes ? `&nbsp;·&nbsp; <em>${esc(t.notes)}</em>` : ''}
            </div>
          </div>
        </div>`).join('')
    : '<div class="admin-empty">No transfers yet.</div>';
}

// ── Site chip filter helpers ──────────────────────────────────────────────────
function getActiveSites(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return EQ_SITES;
  const selected = [...container.querySelectorAll('.eq-chip-site.active')]
    .map(el => el.dataset.site);
  return selected.length > 0 ? selected : EQ_SITES;
}

function toggleSiteChip(chip, containerId, reloadFn) {
  chip.classList.toggle('active');
  // Deactivate "All" whenever any site is selected
  const container = document.getElementById(containerId);
  const anyActive = container.querySelectorAll('.eq-chip-site.active').length > 0;
  container.querySelector('.eq-chip-all')?.classList.toggle('active', !anyActive);
  reloadFn();
}

function toggleAllSites(containerId, reloadFn) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.eq-chip-site').forEach(c => c.classList.remove('active'));
  container.querySelector('.eq-chip-all')?.classList.add('active');
  reloadFn();
}

// ── Core section loader ────────────────────────────────────────────────────────
async function _loadEquipSection(section, siteFilterId, listId, histId) {
  const listWrap = document.getElementById(listId);
  if (!listWrap) return;

  listWrap.innerHTML = '<div class="admin-loading">Loading…</div>';

  const { data: items, error } = await sbClient.from('equipment')
    .select('id,section,category,name,sort_order,equipment_locations(site_name,quantity,notes)')
    .eq('section', section)
    .order('category').order('sort_order');

  if (error || !items?.length) {
    listWrap.innerHTML = '<div class="admin-empty">No items found.</div>';
  } else {
    // Cache items so the Manage modal can look them up by ID
    items.forEach(item => { _eqItemsCache[item.id] = item; });
    const activeSites = getActiveSites(siteFilterId);
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    listWrap.innerHTML = Object.entries(grouped)
      .map(([cat, catItems]) => _buildEqCatBlock(cat, catItems, activeSites))
      .join('');
  }

  if (histId) await _renderTransferHistory(histId);
}

async function loadTMEquipment() {
  await _loadEquipSection('TM Equipment', 'tmSiteFilter', 'tmEquipList', 'tmHistory');
}
async function loadRentalEquipment() {
  await _loadEquipSection('Rental', 'rentalSiteFilter', 'rentalEquipList', null);
}

// ── Manage Item Modal ─────────────────────────────────────────────────────────
function _siteInputId(site) { return 'iqm-' + site.replace(/\//g, '-'); }

function openManageModal(itemId) {
  const item = _eqItemsCache[itemId];
  if (!item) return;
  _eqManageItem = item;

  document.getElementById('manageModalName').value = item.name;
  document.getElementById('manageModalError').textContent = '';

  const locs = {};
  (item.equipment_locations || []).forEach(l => { locs[l.site_name] = l.quantity; });

  document.getElementById('manageModalSites').innerHTML = EQ_SITES.map(site => {
    const qty = locs[site] || 0;
    const sid = _siteInputId(site);
    return `
      <div class="iqm-row">
        <span class="iqm-site">${esc(site)}</span>
        <div class="iqm-controls">
          <button type="button" class="iqm-step" onclick="iqmStep('${esc(site)}',-1)">−</button>
          <input class="iqm-qty" id="${sid}" type="number" min="0" value="${qty}">
          <button type="button" class="iqm-step" onclick="iqmStep('${esc(site)}',1)">+</button>
        </div>
      </div>`;
  }).join('');

  document.getElementById('manageModal').style.display = 'flex';
}

function closeManageModal(e) {
  if (!e || e.target === document.getElementById('manageModal'))
    document.getElementById('manageModal').style.display = 'none';
}

function iqmStep(site, delta) {
  const input = document.getElementById(_siteInputId(site));
  if (!input) return;
  input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
}

async function saveManageQtys() {
  const item = _eqManageItem;
  if (!item) return;
  const btn    = document.getElementById('manageModalSaveBtn');
  const errEl  = document.getElementById('manageModalError');
  const newName = document.getElementById('manageModalName').value.trim();
  if (!newName) { errEl.textContent = 'Item name cannot be empty.'; return; }

  btn.disabled = true; btn.textContent = 'Saving…';

  // Update item name if changed
  if (newName !== item.name) {
    const { error: nameErr } = await sbClient.from('equipment')
      .update({ name: newName }).eq('id', item.id);
    if (nameErr) { errEl.textContent = 'Error: ' + nameErr.message; btn.disabled = false; btn.textContent = 'Save'; return; }
    _eqItemsCache[item.id].name = newName;
  }

  // Upsert all site quantities
  const upserts = EQ_SITES.map(site => ({
    equipment_id: item.id,
    site_name:    site,
    quantity:     Math.max(0, parseInt(document.getElementById(_siteInputId(site))?.value) || 0),
    updated_at:   new Date().toISOString()
  }));

  const { error } = await sbClient.from('equipment_locations')
    .upsert(upserts, { onConflict: 'equipment_id,site_name' });

  btn.disabled = false; btn.textContent = 'Save';
  if (error) { errEl.textContent = 'Error: ' + error.message; return; }

  document.getElementById('manageModal').style.display = 'none';
  if (item.section === 'TM Equipment') loadTMEquipment();
  else loadRentalEquipment();
}

async function deleteEquipmentItem() {
  const item = _eqManageItem;
  if (!item) return;
  if (!confirm(`Permanently delete "${item.name}"?\n\nThis removes all site quantities and cannot be undone.`)) return;

  await sbClient.from('equipment_locations').delete().eq('equipment_id', item.id);
  const { error } = await sbClient.from('equipment').delete().eq('id', item.id);
  if (error) { document.getElementById('manageModalError').textContent = 'Delete failed: ' + error.message; return; }

  delete _eqItemsCache[item.id];
  document.getElementById('manageModal').style.display = 'none';
  if (item.section === 'TM Equipment') loadTMEquipment();
  else loadRentalEquipment();
}

function openTransferModal(item) {
  _eqTransferItem = item;
  document.getElementById('transferItemName').textContent = item.name + ' (' + item.category + ')';
  document.getElementById('transferFrom').value  = '';
  document.getElementById('transferTo').value    = '';
  document.getElementById('transferQty').value   = '';
  document.getElementById('transferNotes').value = '';
  document.getElementById('transferError').textContent = '';
  document.getElementById('transferModal').style.display = 'flex';
}
function closeTransferModal(e) {
  if (!e || e.target === document.getElementById('transferModal'))
    document.getElementById('transferModal').style.display = 'none';
}

async function confirmTransfer() {
  const from  = document.getElementById('transferFrom').value;
  const to    = document.getElementById('transferTo').value;
  const qty   = parseFloat(document.getElementById('transferQty').value);
  const notes = document.getElementById('transferNotes').value.trim();
  const errEl = document.getElementById('transferError');

  if (!from)         { errEl.textContent = 'Select a From site.'; return; }
  if (!to)           { errEl.textContent = 'Select a To site.'; return; }
  if (from === to)   { errEl.textContent = 'From and To cannot be the same site.'; return; }
  if (!qty || qty < 1) { errEl.textContent = 'Enter a valid quantity.'; return; }

  errEl.textContent = '';
  const item = _eqTransferItem;

  // Decrease from_site
  const { data: fromLoc } = await sbClient.from('equipment_locations')
    .select('quantity').eq('equipment_id', item.id).eq('site_name', from).maybeSingle();
  const fromQty = fromLoc?.quantity || 0;
  if (qty > fromQty) { errEl.textContent = `Only ${fromQty} available at ${from}.`; return; }

  const newFromQty = fromQty - qty;
  await sbClient.from('equipment_locations').upsert(
    { equipment_id: item.id, site_name: from, quantity: newFromQty, updated_at: new Date().toISOString() },
    { onConflict: 'equipment_id,site_name' }
  );

  // Increase to_site
  const { data: toLoc } = await sbClient.from('equipment_locations')
    .select('quantity').eq('equipment_id', item.id).eq('site_name', to).maybeSingle();
  const toQty = (toLoc?.quantity || 0) + qty;
  await sbClient.from('equipment_locations').upsert(
    { equipment_id: item.id, site_name: to, quantity: toQty, updated_at: new Date().toISOString() },
    { onConflict: 'equipment_id,site_name' }
  );

  // Log transfer
  const profile = await sbClient.from('profiles').select('full_name').eq('id', adminCurrentUser.id).single();
  await sbClient.from('equipment_transfers').insert({
    equipment_id:   item.id,
    equipment_name: item.name,
    category:       item.category,
    from_site: from, to_site: to, quantity: qty,
    transferred_by: adminCurrentUser.id,
    foreman_name:   profile.data?.full_name || 'Admin',
    notes
  });

  document.getElementById('transferModal').style.display = 'none';
  loadTMEquipment();
  loadRentalEquipment();
}

function openAddEquipmentModal(defaultSection) {
  document.getElementById('newEqName').value = '';
  if (defaultSection) {
    const sel = document.getElementById('newEqSection');
    if (sel) sel.value = defaultSection;
  }
  document.getElementById('addEquipmentModal').style.display = 'flex';
}
function closeAddEquipmentModal(e) {
  if (!e || e.target === document.getElementById('addEquipmentModal'))
    document.getElementById('addEquipmentModal').style.display = 'none';
}
async function confirmAddEquipment() {
  const sec  = document.getElementById('newEqSection')?.value || 'TM Equipment';
  const cat  = document.getElementById('newEqCategory').value;
  const name = document.getElementById('newEqName').value.trim();
  if (!name) { alert('Enter an item name.'); return; }

  const { error } = await sbClient.from('equipment').insert({ section: sec, category: cat, name });
  if (error) { alert('Error: ' + error.message); return; }
  document.getElementById('addEquipmentModal').style.display = 'none';
  if (sec === 'Rental') loadRentalEquipment(); else loadTMEquipment();
}

// ═════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════════════════
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
