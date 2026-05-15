// ── Auth ──────────────────────────────────────────────────────────────────────
// Handles session management and user profile loading.
// Login / registration lives in login.html + js/login.js.
// Unauthenticated users are redirected to login.html.

let currentUser    = null;
let currentProfile = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function initAuth() {
  // Check for an existing session (e.g. user refreshed the page)
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  await onAuthSuccess(session.user);

  // React to sign-out events (sign-in is handled by login.html redirecting here)
  sbClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'login.html';
  });
}

// ── After successful login ────────────────────────────────────────────────────
async function onAuthSuccess(user) {
  currentUser = user;
  window.currentUser = user;

  // Load profile
  const { data: profile, error } = await sbClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('Profile load error:', error);
    await sbClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  currentProfile = profile;
  window.currentProfile = profile;

  // First-time login: if name not set yet, ask for it before showing the app
  if (!profile.full_name || !profile.full_name.trim()) {
    showProfileSetup();
    return;
  }

  // Fetch projects assigned to this user
  window.userProjects = await loadUserProjects();

  // Update header
  updateHeaderForUser(profile);

  // Start the main app
  showApp();
  initializeApp();   // defined in app.js
}

// ── Project loading ───────────────────────────────────────────────────────────
async function loadUserProjects() {
  try {
    if (currentProfile.role === 'admin') {
      // Admins see every active project
      const { data } = await sbClient
        .from('projects')
        .select('name')
        .eq('status', 'active')
        .order('name');
      return data?.map(p => p.name) ?? [];
    } else {
      // Foremans see only their assigned projects
      const { data } = await sbClient
        .from('foreman_projects')
        .select('projects(name, status)')
        .eq('foreman_id', currentUser.id);
      return data
        ?.map(r => r.projects)
        .filter(p => p && p.status === 'active')
        .map(p => p.name) ?? [];
    }
  } catch (err) {
    console.warn('Could not load projects from Supabase:', err);
    return [];
  }
}

// ── Load documents for a project ─────────────────────────────────────────────
async function loadProjectDocuments(projectName) {
  const { data: project } = await sbClient
    .from('projects').select('id').eq('name', projectName).single();
  if (!project) return [];

  const { data } = await sbClient
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function handleLogout() {
  await sbClient.auth.signOut();
  currentUser    = null;
  currentProfile = null;
  window.currentUser    = null;
  window.currentProfile = null;
  window.userProjects   = null;
}

// ── Header updates ────────────────────────────────────────────────────────────
function updateHeaderForUser(profile) {
  // Show logged-in user name in header
  const sub = document.getElementById('headerSubtitle');
  if (sub) sub.textContent = profile.full_name || currentUser.email;

  // Show admin button only for admins
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) adminBtn.style.display = profile.role === 'admin' ? 'flex' : 'none';

  // Always show logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'flex';
}

// ── Profile setup (first login — name missing) ────────────────────────────────
function showProfileSetup() {
  document.getElementById('profileSetupScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display            = 'none';
  const nb = document.querySelector('.nav-bar');
  const pw = document.querySelector('.progress-wrap');
  if (nb) nb.style.display = 'none';
  if (pw) pw.style.display = 'none';
  setTimeout(() => document.getElementById('profileNameInput')?.focus(), 100);
}

async function saveProfileName() {
  const input = document.getElementById('profileNameInput');
  const errEl = document.getElementById('profileSetupError');
  const btn   = document.getElementById('profileSetupBtn');
  const name  = (input?.value || '').trim();

  if (!name) { if (errEl) errEl.textContent = 'Please enter your name.'; return; }
  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await sbClient
    .from('profiles')
    .update({ full_name: name })
    .eq('id', currentUser.id);

  if (error) {
    if (errEl) errEl.textContent = 'Could not save. Try again.';
    if (btn) { btn.disabled = false; btn.textContent = 'Continue →'; }
    return;
  }

  // Update local profile and proceed to app
  currentProfile.full_name = name;
  document.getElementById('profileSetupScreen').style.display = 'none';
  window.userProjects = await loadUserProjects();
  updateHeaderForUser(currentProfile);
  showApp();
  initializeApp();
}

// ── Show app (after successful auth) ─────────────────────────────────────────
function showApp() {
  document.getElementById('mainApp').style.display = 'block';
  const nb = document.querySelector('.nav-bar');
  const pw = document.querySelector('.progress-wrap');
  if (nb) nb.style.display = '';
  if (pw) pw.style.display = '';
}

// ── Documents drawer (shown per project in the app) ───────────────────────────
async function showDocumentsDrawer(projectName) {
  if (!projectName) return;

  let drawer = document.getElementById('docsDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'docsDrawer';
    drawer.className = 'docs-drawer';
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = `
    <div class="docs-drawer-inner">
      <div class="docs-drawer-header">
        <span>📄 Documents</span>
        <button class="docs-drawer-close" onclick="document.getElementById('docsDrawer').classList.remove('open')">✕</button>
      </div>
      <div class="docs-drawer-project">${projectName}</div>
      <div class="docs-drawer-list" id="docsDrawerList">
        <div class="docs-loading">Loading…</div>
      </div>
    </div>`;

  drawer.classList.add('open');

  const docs = await loadProjectDocuments(projectName);
  const list = document.getElementById('docsDrawerList');
  if (!list) return;

  if (!docs.length) {
    list.innerHTML = '<div class="docs-empty">No documents uploaded for this project yet.</div>';
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

  list.innerHTML = docs.map(d => `
    <a class="doc-item" href="${d.file_url}" target="_blank" rel="noopener">
      <span class="doc-icon">${typeIcon[d.type] || '📄'}</span>
      <span class="doc-info">
        <span class="doc-title">${d.title}</span>
        <span class="doc-meta">${typeLabel[d.type] || 'Document'} · ${new Date(d.created_at).toLocaleDateString()}</span>
      </span>
      <span class="doc-open">↗</span>
    </a>`).join('');
}
