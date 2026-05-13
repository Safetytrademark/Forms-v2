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
  await Promise.all([loadForemans(), loadProjects(), loadDocuments(), loadDeliveries(), loadByProject(), loadSubmissions()]);
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
    .select('id, full_name, created_at')
    .eq('role', 'foreman')
    .order('full_name');

  if (error || !foremans?.length) {
    wrap.innerHTML = '<div class="admin-empty">No foreman accounts yet. Create them in the Supabase Dashboard → Authentication → Users.</div>';
    return;
  }

  // Count project assignments per foreman
  const { data: assignments } = await sbClient
    .from('foreman_projects')
    .select('foreman_id');

  const counts = {};
  assignments?.forEach(a => { counts[a.foreman_id] = (counts[a.foreman_id] || 0) + 1; });

  wrap.innerHTML = foremans.map(f => `
    <div class="admin-table-row">
      <div class="admin-table-cell">
        <div class="admin-cell-name">${esc(f.full_name) || '(no name)'}</div>
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

  const typeLabel = {
    change_order: 'Change Order', drawing: 'Drawing',
    rfi: 'RFI', submittal: 'Submittal', specification: 'Specification', general: 'Document'
  };
  const typeIcon = {
    change_order: '📋', drawing: '📐',
    rfi: '🔄', submittal: '📩', specification: '📑', general: '📄'
  };

  wrap.innerHTML = docs.map(d => `
    <div class="admin-table-row">
      <span class="doc-icon" style="font-size:22px;flex-shrink:0">${typeIcon[d.type] || '📄'}</span>
      <div class="admin-table-cell">
        <div class="admin-cell-name">${esc(d.title)}</div>
        <div class="admin-cell-meta">
          ${esc(d.projects?.name || '')} · ${typeLabel[d.type] || 'Document'} · ${formatDate(d.created_at)}
        </div>
      </div>
      <a class="admin-btn-icon" href="${d.file_url}" target="_blank" rel="noopener" style="text-decoration:none">↗ Open</a>
      <button class="admin-btn-danger" onclick="deleteDocument('${d.id}', '${esc(d.file_name || '')}')">🗑</button>
    </div>
  `).join('');
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
async function loadDeliveries() {
  const pendingWrap = document.getElementById('deliveriesPending');
  const historyWrap = document.getElementById('deliveriesHistory');
  if (!pendingWrap) return;

  const { data: reqs, error } = await sbClient
    .from('delivery_requests')
    .select('*, projects(name), profiles(full_name)')
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
          <div class="admin-cell-name">${esc(req.projects?.name || 'Unknown project')}</div>
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
        : `<span class="sub-no-pdf">No PDF</span>`
      }
    </div>`).join('');
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
