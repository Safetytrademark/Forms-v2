// ── State ────────────────────────────────────────────────────────────────────
const state = {
  currentStep: 1,
  foremanName: '',
  date: '',
  workersOnSite: '',
  project: '',
  submissionType: '',
  fields: {},
  photos: [],
  signature: null,
  allowedTypes: null
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// DOMContentLoaded just hands off to auth — initializeApp() is called by
// auth.js after a successful login (or valid existing session).
document.addEventListener('DOMContentLoaded', () => initAuth());

// ── initializeApp ─────────────────────────────────────────────────────────────
// Called by auth.js once the user is authenticated and their profile is loaded.
function initializeApp() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('foremanDate').value = today;
  state.date = today;

  // Pre-fill name from the logged-in profile so foreman doesn't have to type it
  if (window.currentProfile?.full_name) {
    state.foremanName = window.currentProfile.full_name;
    const nameEl = document.getElementById('foremanName');
    if (nameEl) nameEl.value = state.foremanName;
  }

  checkBackendHealth().then(online => {
    const dot = document.getElementById('backendStatus');
    if (dot) {
      dot.className = online ? 'status-dot online' : 'status-dot offline';
      dot.title = online ? 'Connected — submissions go to email' : 'Server offline — will download ZIP';
    }
  });

  attachNavListeners();

  document.getElementById('foremanName').addEventListener('input', e => { state.foremanName = e.target.value.trim(); });
  document.getElementById('foremanDate').addEventListener('input', e => { state.date = e.target.value; });

  showHomeDashboard();
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function openAdminPanel() {
  window.location.href = 'admin.html';
}

// ── Home Dashboard 2.0 ─────────────────────────────────────────────────────────
const DASH_INSPECTION_TYPES = ['Telehandler Inspection','Forklift Inspection','E-Pallet Jack Inspection','Scaffolding Inspection'];
const DASH_REPORT_TYPES     = ['Incident Report','Hazard Observation','QAQC - Foreman','Site Photos Only'];
const DASH_TAILGATE_TYPES   = ['Daily Tailgate','Weekly Toolbox Talk'];
const DASH_TIME_TYPES       = ['Weekly Timesheet','Production Report'];

async function showHomeDashboard() {
  const homeScreen   = document.getElementById('homeScreen');
  const appDiv       = document.querySelector('#mainApp .app');
  const progressWrap = document.querySelector('.progress-wrap');
  const navBar       = document.querySelector('.nav-bar');

  if (homeScreen)   homeScreen.style.display  = 'block';
  if (appDiv)       appDiv.style.display      = 'none';
  if (progressWrap) progressWrap.style.display = 'none';
  if (navBar)       navBar.style.display      = 'none';

  state.allowedTypes = null;

  // Greeting
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = window.currentProfile?.full_name?.split(' ')[0] || '';
  const greetEl = document.getElementById('dashGreeting');
  if (greetEl) greetEl.textContent = `${greet}${first ? ', ' + first : ''} 👋`;

  // Avatar initial
  const av = document.getElementById('dashAvatarBtn');
  if (av) av.textContent = (first[0] || '?').toUpperCase();

  // Admin section toggle
  const adminSection = document.getElementById('dashAdminSection');
  if (adminSection) adminSection.hidden = window.currentProfile?.role !== 'admin';

  // Wire card clicks (re-bind every time — replaces previous handlers)
  document.querySelectorAll('.dash-card[data-action]').forEach(el => {
    el.onclick = () => handleDashAction(el.dataset.action);
  });

  // Skeletons in place of metrics, then load stats + weather in parallel
  setDashSkeletons();
  const [stats, weather] = await Promise.allSettled([
    loadDashboardStats(),
    loadWeather()
  ]);
  try { renderDashStats(stats.value ?? null); }
  catch (err) {
    console.error('Dashboard stats failed:', err);
    const sumEl = document.getElementById('dashSummary');
    if (sumEl) sumEl.textContent = 'Could not load operational status';
  }
  renderWeather(weather.value ?? null);
}

async function loadDashboardStats() {
  const uid = window.currentUser?.id;
  if (!uid) return null;

  // Monday 00:00 of current week (ISO — Mon-Sun)
  const now = new Date();
  const day = now.getDay() || 7; // Sun=0 → 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0,0,0,0);

  const todayStr = now.toISOString().slice(0,10);
  const weekAgo  = new Date(now.getTime() - 7*24*3600*1000).toISOString();

  const [tailgate, weekSubs, deliveries, weekInsp] = await Promise.all([
    sbClient.from('submissions')
      .select('created_at')
      .eq('foreman_id', uid)
      .eq('submission_type', 'Daily Tailgate')
      .gte('created_at', todayStr + 'T00:00:00')
      .lte('created_at', todayStr + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(1),
    sbClient.from('submissions')
      .select('submission_type, created_at')
      .eq('foreman_id', uid)
      .gte('created_at', monday.toISOString()),
    sbClient.from('delivery_requests')
      .select('id, needed_by_time, status, project_id')
      .eq('foreman_id', uid)
      .eq('needed_by', todayStr)
      .neq('status', 'delivered')
      .order('needed_by_time', { ascending: true }),
    sbClient.from('submissions')
      .select('submission_type')
      .eq('foreman_id', uid)
      .in('submission_type', DASH_INSPECTION_TYPES)
      .gte('created_at', weekAgo)
  ]);

  const weekRows  = weekSubs.data || [];
  const inspWeek  = weekRows.filter(r => DASH_INSPECTION_TYPES.includes(r.submission_type)).length;
  const repWeek   = weekRows.filter(r => DASH_REPORT_TYPES.includes(r.submission_type)).length;
  const timesheet = weekRows.find(r => r.submission_type === 'Weekly Timesheet');
  const inspectedTypes = new Set((weekInsp.data || []).map(r => r.submission_type));
  const overdue   = Math.max(0, DASH_INSPECTION_TYPES.length - inspectedTypes.size);

  return {
    tailgateDoneAt: tailgate.data?.[0]?.created_at || null,
    inspWeek, repWeek, overdue,
    timesheet: timesheet ? 'Submitted' : 'Pending',
    deliveries: deliveries.data || []
  };
}

function renderDashStats(s) {
  if (!s) return;

  // Inspections
  const im = document.getElementById('inspMetric');
  if (im) im.textContent = `${s.inspWeek} this week`;
  const ob = document.getElementById('inspOverdueBadge');
  if (ob) {
    if (s.overdue > 0) { ob.textContent = `${s.overdue} overdue`; ob.hidden = false; }
    else ob.hidden = true;
  }

  // Reports
  const rm = document.getElementById('reportsMetric');
  if (rm) rm.textContent = `${s.repWeek} this week`;

  // Tailgate (urgency-driven)
  const tg = document.getElementById('tailgateCard');
  const tgStatus = document.getElementById('tailgateStatus');
  if (tg && tgStatus) {
    if (s.tailgateDoneAt) {
      tg.classList.remove('is-pending');
      tg.classList.add('is-done');
      const t = new Date(s.tailgateDoneAt);
      tgStatus.textContent = `✅ Completed at ${t.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    } else {
      tg.classList.remove('is-done');
      tg.classList.add('is-pending');
      tgStatus.innerHTML = '⚠️ <strong>Pending today</strong>';
    }
  }

  // Timesheet
  const tsEl = document.getElementById('timesheetStatus');
  if (tsEl) tsEl.textContent = s.timesheet === 'Submitted' ? '✅ Submitted this week' : '○ Not submitted yet';

  // Delivery
  const dStat = document.getElementById('deliveryStatus');
  if (dStat) {
    if (s.deliveries.length === 0) {
      dStat.textContent = '○ No deliveries today';
    } else {
      const next = s.deliveries[0];
      const time = next.needed_by_time ? ` at ${next.needed_by_time}` : '';
      dStat.innerHTML = `📦 <strong>${s.deliveries.length} today</strong>${time}`;
    }
  }

  // Operational summary line in header
  const parts = [];
  if (!s.tailgateDoneAt)    parts.push('🦺 Tailgate pending');
  if (s.deliveries.length)  parts.push(`📦 ${s.deliveries.length} delivery today`);
  if (s.overdue)            parts.push(`🔍 ${s.overdue} inspection${s.overdue > 1 ? 's' : ''} overdue`);
  const sumEl = document.getElementById('dashSummary');
  if (sumEl) sumEl.textContent = parts.length ? parts.join(' · ') : 'All clear — no pending items today';

  // Notification badge
  const badge = document.getElementById('dashNotifBadge');
  if (badge) {
    const pendCount = (s.tailgateDoneAt ? 0 : 1) + s.overdue;
    if (pendCount > 0) { badge.textContent = pendCount; badge.hidden = false; }
    else badge.hidden = true;
  }
}

function setDashSkeletons() {
  ['inspMetric','reportsMetric','tailgateStatus','timesheetStatus','deliveryStatus','dashSummary']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<span class="dash-skel"></span>'; });
}

function handleDashAction(action) {
  switch (action) {
    case 'inspections': return startFormFlow(DASH_INSPECTION_TYPES);
    case 'reports':     return startFormFlow(DASH_REPORT_TYPES);
    case 'tailgate':    return startFormFlow(DASH_TAILGATE_TYPES);
    case 'timesheet':   return startFormFlow(DASH_TIME_TYPES);
    case 'delivery':    return openDeliveryModal();
    case 'documents':   return openDocumentPicker();
    case 'admin':       return openAdminPanel();
  }
}

// ── Weather (Open-Meteo — free, no API key) ──────────────────────────────────
async function loadWeather() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
            `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
            `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`
          );
          const json = await res.json();
          const c = json.current;
          resolve({
            temp:       Math.round(c.temperature_2m),
            feelsLike:  Math.round(c.apparent_temperature),
            wind:       Math.round(c.wind_speed_10m),
            icon:       weatherIcon(c.weather_code),
            condition:  weatherLabel(c.weather_code),
            code:       c.weather_code
          });
        } catch { resolve(null); }
      },
      () => resolve(null),
      { timeout: 6000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

function weatherIcon(code) {
  if (code === 0)           return '☀️';
  if (code === 1)           return '🌤️';
  if (code === 2)           return '⛅';
  if (code === 3)           return '☁️';
  if (code <= 48)           return '🌫️';
  if (code <= 55)           return '🌦️';
  if (code <= 67)           return '🌧️';
  if (code <= 77)           return '🌨️';
  if (code <= 82)           return '🌦️';
  if (code <= 99)           return '⛈️';
  return '🌡️';
}

function weatherLabel(code) {
  if (code === 0)  return 'Clear sky';
  if (code === 1)  return 'Mainly clear';
  if (code === 2)  return 'Partly cloudy';
  if (code === 3)  return 'Overcast';
  if (code <= 48)  return 'Foggy';
  if (code <= 55)  return 'Drizzle';
  if (code <= 67)  return 'Rain';
  if (code <= 77)  return 'Snow';
  if (code <= 82)  return 'Showers';
  return 'Thunderstorm';
}

function renderWeather(w) {
  const el = document.getElementById('dashWeather');
  if (!el || !w) return;
  el.hidden = false;
  el.innerHTML =
    `<span class="dash-weather-icon">${w.icon}</span>` +
    `<span class="dash-weather-temp">${w.temp}°C</span>` +
    `<span class="dash-weather-sep">·</span>` +
    `<span class="dash-weather-label">${w.condition}</span>` +
    `<span class="dash-weather-sep">·</span>` +
    `<span class="dash-weather-wind">💨 ${w.wind} km/h</span>` +
    (w.feelsLike !== w.temp
      ? `<span class="dash-weather-sep">·</span><span class="dash-weather-feels">Feels ${w.feelsLike}°</span>`
      : '');
}

function startFormFlow(allowedTypes) {
  state.allowedTypes = allowedTypes || null;

  const homeScreen   = document.getElementById('homeScreen');
  const appDiv       = document.querySelector('#mainApp .app');
  const progressWrap = document.querySelector('.progress-wrap');
  const navBar       = document.querySelector('.nav-bar');

  if (homeScreen)   homeScreen.style.display  = 'none';
  if (appDiv)       appDiv.style.display      = '';
  if (progressWrap) progressWrap.style.display = '';
  if (navBar)       navBar.style.display      = '';

  // Reset submission type if it's no longer in the allowed set
  if (allowedTypes && state.submissionType && !allowedTypes.includes(state.submissionType)) {
    state.submissionType = '';
  }
  // Clear the type grid so it re-renders with the correct filtered set
  const typeGrid = document.getElementById('typeGrid');
  if (typeGrid) typeGrid.innerHTML = '';

  state.currentStep = 1;
  renderStep(1);
  updateProgressBar(1);
  updateNavButtons(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDocumentPicker() {
  const projects = window.userProjects || [];
  if (projects.length === 0) { showToast('No projects assigned to you', 'warning'); return; }
  if (projects.length === 1) { showDocumentsDrawer(projects[0]); return; }

  // Multiple projects — show a simple picker overlay
  const overlay = document.createElement('div');
  overlay.className = 'doc-picker-overlay';
  overlay.innerHTML = `
    <div class="doc-picker-modal">
      <div class="doc-picker-title">📄 Select Project</div>
      <div class="doc-picker-list" id="docPickerList"></div>
      <button class="btn btn-back doc-picker-cancel" style="margin-top:4px">Cancel</button>
    </div>`;

  const list = overlay.querySelector('#docPickerList');
  projects.forEach(proj => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-picker-item';
    btn.textContent = proj;
    btn.addEventListener('click', () => { overlay.remove(); showDocumentsDrawer(proj); });
    list.appendChild(btn);
  });

  overlay.querySelector('.doc-picker-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Navigation ───────────────────────────────────────────────────────────────
function attachNavListeners() {
  document.getElementById('btnBack').addEventListener('click', () => {
    if (state.currentStep > 1) goToStep(state.currentStep - 1);
    else showHomeDashboard();
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    if (validateStep(state.currentStep)) {
      if (state.currentStep < 4) goToStep(state.currentStep + 1);
      else handleSubmit();
    }
  });
}

function goToStep(n) {
  state.currentStep = n;
  renderStep(n);
  updateProgressBar(n);
  updateNavButtons(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgressBar(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`stepDot${i}`);
    if (!el) continue;
    el.className = 'step-dot' + (i < step ? ' done' : i === step ? ' active' : '');
  }
  const bar = document.getElementById('progressFill');
  if (bar) bar.style.width = `${((step - 1) / 3) * 100}%`;
}

function updateNavButtons(step) {
  const back = document.getElementById('btnBack');
  const next = document.getElementById('btnNext');
  back.style.visibility = 'visible';
  back.textContent = step === 1 ? '← Home' : '← Back';
  next.textContent = step === 4 ? '✓ Submit' : 'Next →';
  next.className = step === 4 ? 'btn btn-submit' : 'btn btn-next';
}

// ── Step Rendering ───────────────────────────────────────────────────────────
function renderStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step${n}`);
  if (panel) panel.classList.add('active');
  if (n === 2) renderStep2();
  if (n === 3) renderStep3();
  if (n === 4) renderStep4();
}

// ── Step 2 ───────────────────────────────────────────────────────────────────
function renderStep2() {
  const sel = document.getElementById('projectSelect');
  if (sel) {
    // Projects come from Supabase (loaded at login into window.userProjects)
    const userProjects = window.userProjects || [];
    sel.innerHTML = '<option value="">Select project...</option>';
    userProjects.forEach(p => {
      const o = document.createElement('option');
      o.value = p; o.textContent = p;
      if (p === state.project) o.selected = true;
      sel.appendChild(o);
    });
    // Reset project if it's no longer in the list
    if (state.project && !userProjects.includes(state.project)) {
      state.project = '';
    }
    sel.value = state.project || '';
    sel.onchange = e => { state.project = e.target.value; };

    // Documents button — opens drawer with docs for the selected project
    const docsHintId = 'projectDocsHint';
    let docsHint = document.getElementById(docsHintId);
    if (!docsHint) {
      docsHint = document.createElement('button');
      docsHint.id = docsHintId;
      docsHint.type = 'button';
      docsHint.className = 'docs-trigger-btn';
      docsHint.innerHTML = '📄 View Project Documents';
      docsHint.addEventListener('click', () => {
        const proj = document.getElementById('projectSelect').value;
        if (proj) showDocumentsDrawer(proj);
        else showToast('Select a project first', 'warning');
      });
      sel.parentNode.appendChild(docsHint);
    }
  }

  const grid = document.getElementById('typeGrid');
  if (grid && grid.children.length === 0) {
    const typesToShow = state.allowedTypes
      ? SUBMISSION_TYPES.filter(t => state.allowedTypes.includes(t.id))
      : SUBMISSION_TYPES;
    typesToShow.forEach(t => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'type-card' + (state.submissionType === t.id ? ' selected' : '');
      card.innerHTML = `<span class="type-icon">${t.icon}</span><span class="type-name">${t.id}</span><span class="type-desc">${t.desc}</span>`;
      card.addEventListener('click', () => {
        document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.submissionType = t.id;
      });
      grid.appendChild(card);
    });
  }
}

// ── Step 3: Form ──────────────────────────────────────────────────────────────
function renderStep3() {
  const titleEl = document.getElementById('formTypeTitle');
  const typeInfo = SUBMISSION_TYPES.find(t => t.id === state.submissionType);
  if (titleEl) titleEl.textContent = `${typeInfo?.icon || ''} ${state.submissionType}`;

  const container = document.getElementById('dynamicFields');
  if (!container) return;
  container.innerHTML = '';
  state.fields    = {};        // ← clear stale field data on every form switch
  state.signature = null;
  window._signaturePad = null;

  // Pre-fill defaults for Daily Tailgate
  if (state.submissionType === 'Daily Tailgate') applyDailyTailgateDefaults();

  const fields = FORM_FIELDS[state.submissionType] || [];
  fields.forEach(field => renderField(field, container));

  setupPhotoUpload();
}

// ── Daily Tailgate — pre-fill defaults ───────────────────────────────────────
function applyDailyTailgateDefaults() {
  // Checkboxes: standard items already checked based on daily masonry operations
  state.fields.items_reviewed = { ...DEFAULT_TAILGATE_CHECKED };

  // FLRA: pre-select the first N core tasks (rest stay unchecked)
  state.fields.flra = DEFAULT_FLRA_TASKS.map((t, i) => ({
    ...t,
    hazards: [...t.hazards],
    included: i < DEFAULT_FLRA_INCLUDED_COUNT
  }));
}

function renderField(field, container) {
  if (field.type === 'tailgate-items')  { renderTailgateItems(field, container); return; }
  if (field.type === 'flra-table')      { renderFLRATable(field, container); return; }
  if (field.type === 'closeout')        { renderCloseout(field, container); return; }
  if (field.type === 'crew-signin')     { renderCrewSignin(field, container); return; }
  if (field.type === 'signature')       { renderSignaturePad(field, container); return; }
  if (field.type === 'timesheet-table')   { renderTimesheetTable(field, container); return; }
  if (field.type === 'production-table')  { renderProductionTable(field, container); return; }
  if (field.type === 'weekly-inspection') { renderWeeklyInspection(field, container); return; }
  if (field.type === 'daily-inspection')  { renderDailyInspection(field, container);  return; }
  if (field.type === 'qaqc-table')        { renderQAQCTable(field, container);         return; }
  if (field.type === 'section') {
    const div = document.createElement('div');
    div.className = 'section-header';
    div.style.marginTop = '20px';
    div.textContent = field.label;
    container.appendChild(div);
    return;
  }
  if (field.type === 'toolbox-hazards') { renderToolboxHazards(field, container); return; }

  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';
  const label = document.createElement('label');
  label.className = 'field-label';
  label.htmlFor = `field_${field.id}`;
  label.textContent = field.label + (field.required ? ' *' : '');
  wrapper.appendChild(label);

  let input;

  if (field.type === 'textarea') {
    input = document.createElement('textarea');
    input.className = 'field-input field-textarea';
    input.rows = 3;
    input.placeholder = field.placeholder || '';
    input.value = state.fields[field.id] || '';
    input.addEventListener('input', e => { state.fields[field.id] = e.target.value; });

  } else if (field.type === 'checkbox-group') {
    const grid = document.createElement('div');
    grid.className = 'checkbox-grid';
    const selected = state.fields[field.id] || [];
    field.options.forEach(opt => {
      const item = document.createElement('label');
      item.className = 'checkbox-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = opt; cb.checked = selected.includes(opt);
      cb.addEventListener('change', () => {
        const cur = state.fields[field.id] || [];
        state.fields[field.id] = cb.checked ? [...cur, opt] : cur.filter(v => v !== opt);
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode(' ' + opt));
      grid.appendChild(item);
    });
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
    return;

  } else if (field.type === 'radio') {
    const group = document.createElement('div');
    group.className = 'radio-group';
    field.options.forEach(opt => {
      const item = document.createElement('label');
      item.className = 'radio-item';
      const rb = document.createElement('input');
      rb.type = 'radio'; rb.name = `field_${field.id}`; rb.value = opt;
      rb.checked = state.fields[field.id] === opt;
      rb.addEventListener('change', () => { state.fields[field.id] = opt; });
      item.appendChild(rb);
      item.appendChild(document.createTextNode(' ' + opt));
      group.appendChild(item);
    });
    wrapper.appendChild(group);
    container.appendChild(wrapper);
    return;

  } else if (field.type === 'select') {
    input = document.createElement('select');
    input.className = 'field-input field-select';
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = 'Select...';
    input.appendChild(blank);
    field.options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (state.fields[field.id] === opt) o.selected = true;
      input.appendChild(o);
    });
    input.addEventListener('change', e => { state.fields[field.id] = e.target.value; });

  } else {
    input = document.createElement('input');
    input.className = 'field-input';
    input.type = field.type || 'text';
    input.placeholder = field.placeholder || '';
    input.value = state.fields[field.id] || '';
    input.addEventListener('input', e => { state.fields[field.id] = e.target.value; });
  }

  if (input) { input.id = `field_${field.id}`; wrapper.appendChild(input); }
  container.appendChild(wrapper);
}

// ── Tailgate Items Reviewed ───────────────────────────────────────────────────
function renderTailgateItems(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  if (!state.fields[field.id]) state.fields[field.id] = {};

  Object.entries(TAILGATE_ITEMS).forEach(([section, items]) => {
    const secTitle = document.createElement('div');
    secTitle.className = 'tailgate-section-title';
    secTitle.textContent = section;
    body.appendChild(secTitle);

    const list = document.createElement('div');
    list.className = 'tailgate-checkbox-list';

    items.forEach(item => {
      const lbl = document.createElement('label');
      lbl.className = 'tailgate-checkbox-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!(state.fields[field.id][item]);
      cb.addEventListener('change', () => {
        state.fields[field.id][item] = cb.checked;
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + item));
      list.appendChild(lbl);
    });

    body.appendChild(list);
  });

  container.appendChild(body);
}

// ── FLRA Table ────────────────────────────────────────────────────────────────
function renderFLRATable(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  // Initialize: presets start unchecked — foreman selects what applies today
  if (!state.fields[field.id] || state.fields[field.id].length === 0) {
    state.fields[field.id] = DEFAULT_FLRA_TASKS.map(t => ({
      ...t, hazards: [...t.hazards], included: false
    }));
  }

  const presetCount = DEFAULT_FLRA_TASKS.length;

  // ── Preset task selector ──
  const presetLabel = document.createElement('p');
  presetLabel.className = 'flra-section-label';
  presetLabel.textContent = 'Tap to select tasks for today:';
  body.appendChild(presetLabel);

  const presetList = document.createElement('div');
  presetList.className = 'flra-preset-list';
  presetList.id = 'flraPresetList';
  body.appendChild(presetList);

  for (let i = 0; i < presetCount; i++) {
    renderFLRAPresetItem(presetList, i);
  }

  // ── Custom tasks ──
  const customLabel = document.createElement('p');
  customLabel.className = 'flra-section-label';
  customLabel.style.marginTop = '16px';
  customLabel.textContent = 'Additional tasks (if needed):';
  body.appendChild(customLabel);

  const customRowsDiv = document.createElement('div');
  customRowsDiv.id = 'flraRows';
  body.appendChild(customRowsDiv);

  for (let i = presetCount; i < state.fields[field.id].length; i++) {
    renderFLRARow(customRowsDiv, i);
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-flra-btn';
  addBtn.textContent = '+ Add Custom Task';
  addBtn.addEventListener('click', () => {
    state.fields[field.id].push({ task: '', hazards: [], riskLevel: 'Low', controls: '', included: true });
    renderFLRARow(customRowsDiv, state.fields[field.id].length - 1);
  });
  body.appendChild(addBtn);
  container.appendChild(body);
}

// ── Compact preset item (tap to include) ─────────────────────────────────────
function renderFLRAPresetItem(container, index) {
  const row = state.fields.flra[index];
  if (row.included === undefined) row.included = false;

  const item = document.createElement('div');
  item.className = 'flra-preset-item' + (row.included ? ' included' : '');
  item.id = `flraPreset${index}`;

  // Header: checkbox + task name + risk pill
  const headerLabel = document.createElement('label');
  headerLabel.className = 'flra-preset-header';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'flra-preset-cb';
  cb.checked = !!row.included;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'flra-preset-name';
  nameSpan.textContent = row.task;

  const riskPill = document.createElement('span');
  riskPill.className = `flra-risk-pill ${(row.riskLevel || 'low').toLowerCase()}`;
  riskPill.textContent = row.riskLevel || 'Low';

  headerLabel.appendChild(cb);
  headerLabel.appendChild(nameSpan);
  headerLabel.appendChild(riskPill);
  item.appendChild(headerLabel);

  // Detail block — visible only when included
  const detail = document.createElement('div');
  detail.className = 'flra-preset-detail';

  if (row.hazards && row.hazards.length > 0) {
    const chips = document.createElement('div');
    chips.className = 'flra-hazard-chips';
    row.hazards.forEach(h => {
      const chip = document.createElement('span');
      chip.className = 'flra-hazard-chip';
      chip.textContent = h;
      chips.appendChild(chip);
    });
    detail.appendChild(chips);
  }

  if (row.controls) {
    const ctrl = document.createElement('div');
    ctrl.className = 'flra-preset-ctrl-text';
    ctrl.textContent = row.controls;
    detail.appendChild(ctrl);
  }

  item.appendChild(detail);
  container.appendChild(item);

  cb.addEventListener('change', () => {
    state.fields.flra[index].included = cb.checked;
    item.classList.toggle('included', cb.checked);
  });
}

// ── Custom task row (full form) ───────────────────────────────────────────────
function renderFLRARow(container, index) {
  const row = state.fields.flra[index];
  const customNum = index - DEFAULT_FLRA_TASKS.length + 1;

  const div = document.createElement('div');
  div.className = 'flra-row';
  div.id = `flraRow${index}`;

  div.innerHTML = `
    <div class="flra-row-header">
      <span class="flra-row-num">Custom Task ${customNum}</span>
      <button type="button" class="flra-remove" data-idx="${index}">×</button>
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label class="field-label">Task Description</label>
      <input class="field-input" type="text" placeholder="Describe the work task..." value="${row.task || ''}" data-flra-task="${index}">
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label class="field-label">Hazards Present</label>
      <div class="checkbox-grid" id="flraHazards${index}"></div>
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label class="field-label">Hazard Level</label>
      <div class="flra-risk-btns">
        <button type="button" class="risk-btn ${row.riskLevel === 'High' ? 'high' : ''}" data-risk="High" data-flra-risk="${index}">High</button>
        <button type="button" class="risk-btn ${row.riskLevel === 'Medium' ? 'medium' : ''}" data-risk="Medium" data-flra-risk="${index}">Medium</button>
        <button type="button" class="risk-btn ${row.riskLevel === 'Low' ? 'low' : ''}" data-risk="Low" data-flra-risk="${index}">Low</button>
      </div>
    </div>
    <div class="field-group" style="margin-bottom:0">
      <label class="field-label">Controls in Place</label>
      <textarea class="field-input field-textarea" rows="2" placeholder="Controls applied to reduce risk..." data-flra-controls="${index}">${row.controls || ''}</textarea>
    </div>`;

  container.appendChild(div);

  // Hazard checkboxes
  const hazardGrid = div.querySelector(`#flraHazards${index}`);
  FLRA_HAZARDS.forEach(h => {
    const lbl = document.createElement('label');
    lbl.className = 'checkbox-item';
    const hcb = document.createElement('input');
    hcb.type = 'checkbox';
    hcb.checked = (row.hazards || []).includes(h);
    hcb.addEventListener('change', () => {
      const cur = state.fields.flra[index].hazards || [];
      state.fields.flra[index].hazards = hcb.checked ? [...cur, h] : cur.filter(v => v !== h);
    });
    lbl.appendChild(hcb);
    lbl.appendChild(document.createTextNode(' ' + h));
    hazardGrid.appendChild(lbl);
  });

  div.querySelector(`[data-flra-task="${index}"]`).addEventListener('input', e => {
    state.fields.flra[index].task = e.target.value;
  });

  div.querySelector(`[data-flra-controls="${index}"]`).addEventListener('input', e => {
    state.fields.flra[index].controls = e.target.value;
  });

  div.querySelectorAll(`[data-flra-risk="${index}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll(`[data-flra-risk="${index}"]`).forEach(b => b.className = 'risk-btn');
      btn.classList.add(btn.dataset.risk.toLowerCase());
      state.fields.flra[index].riskLevel = btn.dataset.risk;
    });
  });

  // Remove button — only re-renders custom rows
  const removeBtn = div.querySelector(`[data-idx="${index}"]`);
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      state.fields.flra.splice(index, 1);
      const rowsContainer = document.getElementById('flraRows');
      rowsContainer.innerHTML = '';
      const presetCount = DEFAULT_FLRA_TASKS.length;
      for (let i = presetCount; i < state.fields.flra.length; i++) {
        renderFLRARow(rowsContainer, i);
      }
    });
  }
}

// ── Close Out ─────────────────────────────────────────────────────────────────
function renderCloseout(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  if (!state.fields[field.id]) state.fields[field.id] = {};

  CLOSEOUT_QUESTIONS.forEach(q => {
    const row = document.createElement('div');
    row.className = 'closeout-row';

    const qText = document.createElement('span');
    qText.className = 'closeout-question';
    qText.textContent = q;

    const btns = document.createElement('div');
    btns.className = 'closeout-btns';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'yn-btn' + (state.fields[field.id][q] === 'Yes' ? ' selected-yes' : '');
    yesBtn.textContent = 'Yes';

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'yn-btn' + (state.fields[field.id][q] === 'No' ? ' selected-no' : '');
    noBtn.textContent = 'No';

    yesBtn.addEventListener('click', () => {
      state.fields[field.id][q] = 'Yes';
      yesBtn.className = 'yn-btn selected-yes';
      noBtn.className = 'yn-btn';
    });
    noBtn.addEventListener('click', () => {
      state.fields[field.id][q] = 'No';
      noBtn.className = 'yn-btn selected-no';
      yesBtn.className = 'yn-btn';
    });

    btns.appendChild(yesBtn);
    btns.appendChild(noBtn);
    row.appendChild(qText);
    row.appendChild(btns);
    body.appendChild(row);
  });

  container.appendChild(body);
}

// ── Toolbox Hazard Review ─────────────────────────────────────────────────────
function renderToolboxHazards(field, container) {
  if (!state.fields.hazard_review) {
    state.fields.hazard_review = TOOLBOX_HAZARDS.map(h => ({ hazard: h, risk: '', control: '', included: false }));
    // add one blank custom row
    state.fields.hazard_review.push({ hazard: '', risk: '', control: '', included: false, custom: true });
  }
  const rows = state.fields.hazard_review;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  function rebuild() { wrap.innerHTML = ''; buildRows(); }

  function buildRows() {
    rows.forEach((row, i) => {
      const card = document.createElement('div');
      card.className = `flra-preset-item${row.included ? ' included' : ''}`;

      // Header row: checkbox + hazard name + risk pill
      const hdr = document.createElement('div');
      hdr.className = 'flra-preset-header';
      hdr.style.gap = '10px';

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'flra-preset-cb';
      cb.checked = !!row.included;
      cb.addEventListener('change', () => { rows[i].included = cb.checked; rebuild(); });

      let nameEl;
      if (row.custom) {
        nameEl = document.createElement('input');
        nameEl.type = 'text'; nameEl.className = 'field-input';
        nameEl.style.cssText = 'flex:1;padding:6px 10px;font-size:13px;';
        nameEl.placeholder = 'Other hazard / task...';
        nameEl.value = row.hazard || '';
        nameEl.addEventListener('input', e => { rows[i].hazard = e.target.value; });
      } else {
        nameEl = document.createElement('span');
        nameEl.className = 'flra-preset-name';
        nameEl.textContent = row.hazard;
      }

      // Risk buttons H / M / L
      const riskWrap = document.createElement('div');
      riskWrap.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
      ['H', 'M', 'L'].forEach(level => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = level;
        const cls = level === 'H' ? 'high' : level === 'M' ? 'medium' : 'low';
        btn.className = `risk-btn${row.risk === level ? ' ' + cls : ''}`;
        btn.style.cssText = 'flex:none;width:32px;padding:5px 0;font-size:11px;';
        btn.addEventListener('click', () => { rows[i].risk = level; rebuild(); });
        riskWrap.appendChild(btn);
      });

      hdr.append(cb, nameEl, riskWrap);
      card.appendChild(hdr);

      // Detail block (controls) — visible when included
      if (row.included) {
        const detail = document.createElement('div');
        detail.className = 'flra-preset-detail';
        detail.style.display = 'block';
        const ctrl = document.createElement('textarea');
        ctrl.className = 'field-input field-textarea';
        ctrl.style.cssText = 'min-height:56px;font-size:13px;';
        ctrl.placeholder = 'Control / action to mitigate this hazard...';
        ctrl.value = row.control || '';
        ctrl.addEventListener('input', e => { rows[i].control = e.target.value; });
        detail.appendChild(ctrl);
        card.appendChild(detail);
      }

      wrap.appendChild(card);
    });
  }

  buildRows();
  container.appendChild(wrap);
}

// ── Crew Sign-In ──────────────────────────────────────────────────────────────
function renderCrewSignin(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  if (!state.fields[field.id] || state.fields[field.id].length === 0) {
    state.fields[field.id] = [{ name: '', sig: null }];
  }

  const rowsWrap = document.createElement('div');
  rowsWrap.id = 'crewRows';
  body.appendChild(rowsWrap);

  state.fields[field.id].forEach((_, i) => renderCrewRow(rowsWrap, i));

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-crew-btn';
  addBtn.textContent = '+ Add Worker';
  addBtn.addEventListener('click', () => {
    state.fields[field.id].push({ name: '', sig: null });
    renderCrewRow(rowsWrap, state.fields[field.id].length - 1);
  });
  body.appendChild(addBtn);
  container.appendChild(body);
}

function renderCrewRow(container, index) {
  const member = state.fields.crew[index];
  const card = document.createElement('div');
  card.className = 'crew-card';

  // ── Name row ─────────────────────────────────────────────
  const nameRow = document.createElement('div');
  nameRow.className = 'crew-card-header';

  const num = document.createElement('span');
  num.className = 'crew-num';
  num.textContent = index + 1;

  const nameInput = document.createElement('input');
  nameInput.className = 'field-input crew-name';
  nameInput.type = 'text';
  nameInput.placeholder = 'Full name';
  nameInput.value = member.name || '';
  nameInput.addEventListener('input', e => { state.fields.crew[index].name = e.target.value; });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'crew-remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    if (state.fields.crew.length <= 1) return;
    state.fields.crew.splice(index, 1);
    const wrap = document.getElementById('crewRows');
    wrap.innerHTML = '';
    state.fields.crew.forEach((_, i) => renderCrewRow(wrap, i));
  });

  nameRow.append(num, nameInput, removeBtn);
  card.appendChild(nameRow);

  // ── Signature area ────────────────────────────────────────
  const sigLabel = document.createElement('div');
  sigLabel.className = 'crew-sig-label';
  sigLabel.textContent = 'Signature';
  card.appendChild(sigLabel);

  const sigWrap = document.createElement('div');
  sigWrap.className = 'crew-sig-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'crew-sig-canvas';
  // Set pixel resolution after mount (rAF gives layout time to settle)
  sigWrap.appendChild(canvas);

  const sigActions = document.createElement('div');
  sigActions.className = 'crew-sig-actions';

  const hint = document.createElement('span');
  hint.className = 'crew-sig-hint';
  hint.textContent = 'Sign with finger';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'crew-sig-clear';
  clearBtn.textContent = 'Clear';

  sigActions.append(hint, clearBtn);
  sigWrap.appendChild(sigActions);
  card.appendChild(sigWrap);
  container.appendChild(card);

  // Init SignaturePad after the canvas is in the DOM
  requestAnimationFrame(() => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      penColor: '#1a1a2e',
      backgroundColor: 'rgba(255,255,255,0)',
      minWidth: 1,
      maxWidth: 2.5,
    });

    // Restore saved signature
    if (member.sig) {
      pad.fromDataURL(member.sig, { ratio: 1, width: canvas.offsetWidth, height: canvas.offsetHeight });
    }

    pad.addEventListener('endStroke', () => {
      state.fields.crew[index].sig = pad.toDataURL('image/png');
    });

    clearBtn.addEventListener('click', () => {
      pad.clear();
      state.fields.crew[index].sig = null;
    });
  });
}

// ── Signature Pad ─────────────────────────────────────────────────────────────
function renderSignaturePad(field, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = field.label + ' *';
  wrapper.appendChild(label);

  const disclaimer = document.createElement('p');
  disclaimer.className = 'signature-disclaimer';
  disclaimer.textContent = 'I certify that I have reviewed this questionnaire with each crew member and am complying with the guidelines outlined by Trade Mark and the Ministry of Health.';
  wrapper.appendChild(disclaimer);

  const wrap = document.createElement('div');
  wrap.className = 'signature-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'signature-canvas';
  canvas.id = 'signatureCanvas';

  const actions = document.createElement('div');
  actions.className = 'signature-actions';
  actions.innerHTML = '<span class="signature-hint">Sign with your finger</span>';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'signature-clear-btn';
  clearBtn.textContent = 'Clear';
  actions.appendChild(clearBtn);

  wrap.appendChild(canvas);
  wrap.appendChild(actions);
  wrapper.appendChild(wrap);
  container.appendChild(wrapper);

  // Init after element is in DOM
  setTimeout(() => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const canvasW = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 320;
    canvas.width = canvasW * ratio;
    canvas.height = 180 * ratio;
    canvas.style.height = '180px';
    canvas.getContext('2d').scale(ratio, ratio);

    if (!window.SignaturePad) {
      canvas.parentElement.insertAdjacentHTML('afterend', '<p style="color:#ef4444;font-size:12px;margin-top:6px">Signature pad failed to load. Check internet connection.</p>');
      return;
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: '#1E3A6E',
      minWidth: 1.5,
      maxWidth: 3
    });

    if (state.signature) pad.fromDataURL(state.signature);

    pad.addEventListener('endStroke', () => { state.signature = pad.toDataURL('image/png'); });
    clearBtn.addEventListener('click', () => { pad.clear(); state.signature = null; });
    window._signaturePad = pad;
  }, 150);
}

// ── Timesheet Table ───────────────────────────────────────────────────────────
const TS_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function emptyTsEmployee() {
  const days = {};
  TS_DAYS.forEach(d => { days[d.toLowerCase()] = { r: '', ot: '' }; });
  return { name: '', days, notes: '' };
}

function renderTimesheetTable(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  if (!state.fields[field.id] || state.fields[field.id].length === 0) {
    state.fields[field.id] = [emptyTsEmployee()];
  }

  const rowsWrap = document.createElement('div');
  rowsWrap.id = 'tsRows';
  body.appendChild(rowsWrap);
  state.fields[field.id].forEach((_, i) => renderTsEmployee(rowsWrap, i));

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-crew-btn';
  addBtn.textContent = '+ Add Employee';
  addBtn.addEventListener('click', () => {
    state.fields.timesheet.push(emptyTsEmployee());
    renderTsEmployee(rowsWrap, state.fields.timesheet.length - 1);
  });
  body.appendChild(addBtn);
  container.appendChild(body);
}

function renderTsEmployee(container, index) {
  const emp = state.fields.timesheet[index];
  const card = document.createElement('div');
  card.className = 'ts-employee-card';
  card.id = `tsEmp${index}`;

  // ── Name row ──
  const nameRow = document.createElement('div');
  nameRow.className = 'ts-name-row';

  const nameInput = document.createElement('input');
  nameInput.className = 'field-input ts-name-input';
  nameInput.type = 'text';
  nameInput.placeholder = `Employee ${index + 1} name`;
  nameInput.value = emp.name || '';
  nameInput.addEventListener('input', e => { state.fields.timesheet[index].name = e.target.value; updateTsTotals(card, index); });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'crew-remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    if (state.fields.timesheet.length <= 1) return;
    state.fields.timesheet.splice(index, 1);
    const wrap = document.getElementById('tsRows');
    wrap.innerHTML = '';
    state.fields.timesheet.forEach((_, i) => renderTsEmployee(wrap, i));
  });

  nameRow.appendChild(nameInput);
  nameRow.appendChild(removeBtn);
  card.appendChild(nameRow);

  // ── Days grid — 4 cols first row, 3 cols second row ──
  const grid = document.createElement('div');
  grid.className = 'ts-days-grid';

  TS_DAYS.forEach(day => {
    const dayCol = document.createElement('div');
    dayCol.className = 'ts-day-col';

    const dayKey = day.toLowerCase();
    const dayLabel = document.createElement('div');
    dayLabel.className = 'ts-day-label';
    dayLabel.textContent = day.toUpperCase();

    const regInput = document.createElement('input');
    regInput.className = 'field-input ts-hours-input';
    regInput.type = 'number';
    regInput.min = '0'; regInput.max = '24'; regInput.step = '0.5';
    regInput.placeholder = 'R';
    regInput.value = emp.days[dayKey]?.r || '';
    regInput.title = `${day} Regular`;
    regInput.addEventListener('input', e => {
      state.fields.timesheet[index].days[dayKey].r = e.target.value;
      updateTsTotals(card, index);
    });

    const otInput = document.createElement('input');
    otInput.className = 'field-input ts-hours-input ts-ot-input';
    otInput.type = 'number';
    otInput.min = '0'; otInput.max = '24'; otInput.step = '0.5';
    otInput.placeholder = 'OT';
    otInput.value = emp.days[dayKey]?.ot || '';
    otInput.title = `${day} Overtime`;
    otInput.addEventListener('input', e => {
      state.fields.timesheet[index].days[dayKey].ot = e.target.value;
      updateTsTotals(card, index);
    });

    dayCol.appendChild(dayLabel);
    dayCol.appendChild(regInput);
    dayCol.appendChild(otInput);
    grid.appendChild(dayCol);
  });

  card.appendChild(grid);

  // ── Totals bar ──
  const totalsBar = document.createElement('div');
  totalsBar.className = 'ts-totals-bar';
  totalsBar.id = `tsTotals${index}`;
  card.appendChild(totalsBar);
  container.appendChild(card);
  updateTsTotals(card, index);
}

function updateTsTotals(card, index) {
  const emp = state.fields.timesheet[index];
  if (!emp) return;
  let totalR = 0, totalOT = 0;
  TS_DAYS.forEach(d => {
    totalR  += parseFloat(emp.days[d.toLowerCase()].r  || 0);
    totalOT += parseFloat(emp.days[d.toLowerCase()].ot || 0);
  });
  const totalAll = totalR + totalOT;
  const bar = card.querySelector(`#tsTotals${index}`);
  if (bar) {
    bar.innerHTML = `
      <span class="ts-total-chip reg">REG <strong>${totalR % 1 === 0 ? totalR : totalR.toFixed(1)}</strong></span>
      <span class="ts-total-chip ot">O/T <strong>${totalOT % 1 === 0 ? totalOT : totalOT.toFixed(1)}</strong></span>
      <span class="ts-total-chip total">TOTAL <strong>${totalAll % 1 === 0 ? totalAll : totalAll.toFixed(1)}</strong></span>`;
  }
}

// ── Weekly Inspection Checklist ───────────────────────────────────────────────
function renderWeeklyInspection(field, container) {
  const config = INSPECTION_CONFIGS[state.submissionType];
  if (!config) return;

  // Initialise state: each item gets 6 slots [null|'ok'|'x'] for MON–SAT
  if (!state.fields[field.id]) {
    const s = {};
    Object.entries(config.sections).forEach(([sec, items]) => {
      s[sec] = {};
      items.forEach(item => { s[sec][item] = new Array(6).fill(null); });
    });
    state.fields[field.id] = s;
  }

  // Legend notice
  const notice = document.createElement('div');
  notice.className = 'insp-notice';
  notice.innerHTML = '<strong>Tap each day to cycle:</strong>&nbsp; <span class="insp-ok-eg">✓</span> OK &nbsp;·&nbsp; <span class="insp-x-eg">✗</span> Fix needed &nbsp;·&nbsp; tap again to clear';
  container.appendChild(notice);

  Object.entries(config.sections).forEach(([secName, items]) => {
    // Section header
    const secHdr = document.createElement('div');
    secHdr.className = 'insp-section-header';
    secHdr.textContent = secName;
    container.appendChild(secHdr);

    const secBody = document.createElement('div');
    secBody.className = 'insp-section-body';

    // Day labels row
    const dayHdrRow = document.createElement('div');
    dayHdrRow.className = 'insp-day-hdr-row';
    const spacer = document.createElement('div');
    spacer.className = 'insp-item-spacer';
    dayHdrRow.appendChild(spacer);
    const dayHdrs = document.createElement('div');
    dayHdrs.className = 'insp-day-cells';
    INSP_DAYS.forEach(d => {
      const lbl = document.createElement('div');
      lbl.className = 'insp-day-lbl';
      lbl.textContent = d.substring(0, 3);
      dayHdrs.appendChild(lbl);
    });
    dayHdrRow.appendChild(dayHdrs);
    secBody.appendChild(dayHdrRow);

    items.forEach((item, itemIdx) => {
      const row = document.createElement('div');
      row.className = 'insp-item-row' + (itemIdx % 2 === 0 ? '' : ' insp-row-alt');

      const textDiv = document.createElement('div');
      textDiv.className = 'insp-item-text';
      textDiv.textContent = item;

      const cellsDiv = document.createElement('div');
      cellsDiv.className = 'insp-day-cells';

      INSP_DAYS.forEach((_, di) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const val = state.fields[field.id][secName][item][di];
        btn.className = 'insp-toggle' + (val === 'ok' ? ' ok' : val === 'x' ? ' x' : '');
        btn.textContent = val === 'ok' ? '✓' : val === 'x' ? '✗' : '';
        btn.setAttribute('aria-label', `${INSP_DAYS[di]}: ${val || 'not checked'}`);

        btn.addEventListener('click', () => {
          const cur = state.fields[field.id][secName][item][di];
          const next = cur === null ? 'ok' : cur === 'ok' ? 'x' : null;
          state.fields[field.id][secName][item][di] = next;
          btn.className = 'insp-toggle' + (next === 'ok' ? ' ok' : next === 'x' ? ' x' : '');
          btn.textContent = next === 'ok' ? '✓' : next === 'x' ? '✗' : '';
        });

        cellsDiv.appendChild(btn);
      });

      row.appendChild(textDiv);
      row.appendChild(cellsDiv);
      secBody.appendChild(row);
    });

    container.appendChild(secBody);
  });
}

// ── Daily Inspection Checklist (single date — no day columns) ────────────────
function renderDailyInspection(field, container) {
  const config = INSPECTION_CONFIGS[state.submissionType];
  if (!config) return;

  // Initialise state: each item gets a single value (null | 'ok' | 'x')
  // Always rebuild if structure doesn't match this form's sections (guards against stale state)
  const expectedSecs = Object.keys(config.sections);
  const existing = state.fields[field.id];
  if (!existing || !expectedSecs.every(k => k in existing)) {
    const s = {};
    Object.entries(config.sections).forEach(([sec, items]) => {
      s[sec] = {};
      items.forEach(item => { s[sec][item] = null; });
    });
    state.fields[field.id] = s;
  }

  // Legend notice
  const notice = document.createElement('div');
  notice.className = 'insp-notice';
  notice.innerHTML = '<strong>Tap to cycle:</strong>&nbsp; <span class="insp-ok-eg">✓</span> OK &nbsp;·&nbsp; <span class="insp-x-eg">✗</span> Fix needed &nbsp;·&nbsp; tap again to clear';
  container.appendChild(notice);

  Object.entries(config.sections).forEach(([secName, items]) => {
    const secHdr = document.createElement('div');
    secHdr.className = 'insp-section-header';
    secHdr.textContent = secName;
    container.appendChild(secHdr);

    const secBody = document.createElement('div');
    secBody.className = 'insp-section-body dinsp-body';

    items.forEach((item, itemIdx) => {
      const row = document.createElement('div');
      row.className = 'dinsp-item-row' + (itemIdx % 2 === 0 ? '' : ' insp-row-alt');

      const textDiv = document.createElement('div');
      textDiv.className = 'insp-item-text';
      textDiv.textContent = item;

      const val = (state.fields[field.id][secName] || {})[item] || null;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'insp-toggle dinsp-toggle' + (val === 'ok' ? ' ok' : val === 'x' ? ' x' : '');
      btn.textContent = val === 'ok' ? '✓' : val === 'x' ? '✗' : '';
      btn.setAttribute('aria-label', item + ': ' + (val || 'not checked'));

      btn.addEventListener('click', () => {
        const cur = state.fields[field.id][secName][item];
        const next = cur === null ? 'ok' : cur === 'ok' ? 'x' : null;
        state.fields[field.id][secName][item] = next;
        btn.className = 'insp-toggle dinsp-toggle' + (next === 'ok' ? ' ok' : next === 'x' ? ' x' : '');
        btn.textContent = next === 'ok' ? '✓' : next === 'x' ? '✗' : '';
      });

      row.appendChild(textDiv);
      row.appendChild(btn);
      secBody.appendChild(row);
    });

    container.appendChild(secBody);
  });
}

// ── QAQC Table ────────────────────────────────────────────────────────────────
function renderQAQCTable(field, container) {
  // Initialise state: array of { result: null|'pass'|'fail'|'na', comment: '' }
  // Also reinitialise if stale state from another form type is sitting there
  if (!Array.isArray(state.fields[field.id]) || state.fields[field.id].length !== QAQC_ITEMS.length) {
    state.fields[field.id] = QAQC_ITEMS.map(() => ({ result: null, comment: '' }));
  }

  const notice = document.createElement('div');
  notice.className = 'qaqc-notice';
  notice.innerHTML = 'Inspect each item during the walkthrough. Mark <strong>PASS</strong>, <strong>FAIL</strong>, or <strong>N/A</strong>. Add notes in the comment field if needed.';
  container.appendChild(notice);

  QAQC_ITEMS.forEach((itemText, idx) => {
    const row = document.createElement('div');
    row.className = 'qaqc-row' + (idx % 2 === 0 ? '' : ' qaqc-row-alt');

    // Row number + text
    const header = document.createElement('div');
    header.className = 'qaqc-row-header';
    header.innerHTML = `<span class="qaqc-num">${idx + 1}</span><span class="qaqc-item-text">${itemText}</span>`;
    row.appendChild(header);

    // PASS / FAIL / N/A buttons
    const btns = document.createElement('div');
    btns.className = 'qaqc-btns';

    ['pass', 'fail', 'na'].forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = val === 'na' ? 'N/A' : val.toUpperCase();
      btn.className = 'qaqc-btn qaqc-' + val + (state.fields[field.id][idx].result === val ? ' active' : '');
      btn.addEventListener('click', () => {
        const cur = state.fields[field.id][idx].result;
        state.fields[field.id][idx].result = (cur === val) ? null : val;
        // Refresh all three buttons
        btns.querySelectorAll('.qaqc-btn').forEach((b, bi) => {
          const bval = ['pass','fail','na'][bi];
          b.className = 'qaqc-btn qaqc-' + bval + (state.fields[field.id][idx].result === bval ? ' active' : '');
        });
      });
      btns.appendChild(btn);
    });
    row.appendChild(btns);

    // Comment input
    const commentWrap = document.createElement('div');
    commentWrap.className = 'qaqc-comment-wrap';
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'qaqc-comment-input';
    commentInput.placeholder = 'Comments / deficiency notes…';
    commentInput.value = state.fields[field.id][idx].comment;
    commentInput.addEventListener('input', e => {
      state.fields[field.id][idx].comment = e.target.value;
    });
    commentWrap.appendChild(commentInput);
    row.appendChild(commentWrap);

    container.appendChild(row);
  });
}

// ── Production Report Table ───────────────────────────────────────────────────
const PROD_DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const BLOCK_TYPES = ['8"', '4"', '6"', '10"', '12"'];

function emptyProdDays() {
  const d = {};
  PROD_DAYS.forEach(day => { d[day.toLowerCase()] = ''; });
  return d;
}

function renderProductionTable(field, container) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = field.label;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'section-body';

  // Initialise state
  if (!state.fields[field.id]) {
    state.fields[field.id] = {
      blocks: Object.fromEntries(BLOCK_TYPES.map(t => [t, emptyProdDays()])),
      crew: {
        masons:   emptyProdDays(),
        laborers: emptyProdDays()
      }
    };
  }

  // ── Block Placement ──
  const blockTitle = document.createElement('p');
  blockTitle.className = 'flra-section-label';
  blockTitle.textContent = 'Block Placement — enter blocks placed per day:';
  body.appendChild(blockTitle);

  BLOCK_TYPES.forEach(type => {
    const key = type;
    const card = document.createElement('div');
    card.className = 'prod-block-card';

    const labelRow = document.createElement('div');
    labelRow.className = 'prod-block-label-row';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'prod-block-type';
    typeLabel.textContent = type + ' Block';
    if (type === '8"') {
      const badge = document.createElement('span');
      badge.className = 'prod-common-badge';
      badge.textContent = 'most common';
      typeLabel.appendChild(badge);
    }

    const weekTotal = document.createElement('span');
    weekTotal.className = 'prod-week-total';
    weekTotal.id = `prodTotal_${type.replace('"','in')}`;
    weekTotal.textContent = 'Total: 0';

    labelRow.appendChild(typeLabel);
    labelRow.appendChild(weekTotal);
    card.appendChild(labelRow);

    const grid = document.createElement('div');
    grid.className = 'ts-days-grid';

    PROD_DAYS.forEach(day => {
      const dayKey = day.toLowerCase();
      const col = document.createElement('div');
      col.className = 'ts-day-col';

      const dayLabel = document.createElement('div');
      dayLabel.className = 'ts-day-label';
      dayLabel.textContent = day.toUpperCase();

      const inp = document.createElement('input');
      inp.className = 'field-input ts-hours-input prod-block-input';
      inp.type = 'number';
      inp.min = '0'; inp.step = '1';
      inp.placeholder = '0';
      inp.value = state.fields.production.blocks[key][dayKey] || '';
      inp.addEventListener('input', e => {
        state.fields.production.blocks[key][dayKey] = e.target.value;
        updateProdBlockTotal(type);
      });

      col.appendChild(dayLabel);
      col.appendChild(inp);
      grid.appendChild(col);
    });

    card.appendChild(grid);
    body.appendChild(card);
    updateProdBlockTotal(type);
  });

  // ── Crew Section ──
  const crewTitle = document.createElement('p');
  crewTitle.className = 'flra-section-label';
  crewTitle.style.marginTop = '18px';
  crewTitle.textContent = 'Crew — workers on site each day:';
  body.appendChild(crewTitle);

  [['masons', 'Masons'], ['laborers', 'Laborers']].forEach(([key, label]) => {
    const card = document.createElement('div');
    card.className = 'prod-block-card';

    const labelRow = document.createElement('div');
    labelRow.className = 'prod-block-label-row';
    const lbl = document.createElement('span');
    lbl.className = 'prod-block-type';
    lbl.textContent = label;
    labelRow.appendChild(lbl);
    card.appendChild(labelRow);

    const grid = document.createElement('div');
    grid.className = 'ts-days-grid';

    PROD_DAYS.forEach(day => {
      const dayKey = day.toLowerCase();
      const col = document.createElement('div');
      col.className = 'ts-day-col';

      const dayLabel = document.createElement('div');
      dayLabel.className = 'ts-day-label';
      dayLabel.textContent = day.toUpperCase();

      const inp = document.createElement('input');
      inp.className = 'field-input ts-hours-input';
      inp.type = 'number';
      inp.min = '0'; inp.step = '1';
      inp.placeholder = '0';
      inp.value = state.fields.production.crew[key][dayKey] || '';
      inp.addEventListener('input', e => {
        state.fields.production.crew[key][dayKey] = e.target.value;
      });

      col.appendChild(dayLabel);
      col.appendChild(inp);
      grid.appendChild(col);
    });

    card.appendChild(grid);
    body.appendChild(card);
  });

  container.appendChild(body);
}

function updateProdBlockTotal(type) {
  const data = state.fields.production?.blocks?.[type];
  if (!data) return;
  const total = PROD_DAYS.reduce((sum, d) => sum + (parseInt(data[d.toLowerCase()]) || 0), 0);
  const el = document.getElementById(`prodTotal_${type.replace('"','in')}`);
  if (el) el.textContent = `Total: ${total.toLocaleString()}`;
}

// ── Photo Upload ──────────────────────────────────────────────────────────────
function setupPhotoUpload() {
  const zone = document.getElementById('photoZone');
  const input = document.getElementById('photoInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); addPhotos(Array.from(e.dataTransfer.files)); });
  input.addEventListener('change', () => { addPhotos(Array.from(input.files)); input.value = ''; });
  renderPhotoPreview();
}

function addPhotos(files) {
  state.photos = [...state.photos, ...files.filter(f => f.type.startsWith('image/'))].slice(0, 15);
  renderPhotoPreview();
}

function renderPhotoPreview() {
  const preview = document.getElementById('photoPreview');
  const countEl = document.getElementById('photoCount');
  if (!preview) return;
  preview.innerHTML = '';
  if (countEl) countEl.textContent = state.photos.length > 0 ? `${state.photos.length} photo${state.photos.length !== 1 ? 's' : ''} selected` : '';
  state.photos.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const remove = document.createElement('button');
    remove.className = 'photo-remove';
    remove.textContent = '×';
    remove.addEventListener('click', e => { e.stopPropagation(); state.photos.splice(i, 1); renderPhotoPreview(); });
    item.appendChild(img);
    item.appendChild(remove);
    preview.appendChild(item);
  });
}

// ── Step 4: Review ────────────────────────────────────────────────────────────
function renderStep4() {
  const typeInfo = SUBMISSION_TYPES.find(t => t.id === state.submissionType);
  document.getElementById('reviewForeman').textContent = state.foremanName;
  document.getElementById('reviewDate').textContent = state.date;
  document.getElementById('reviewProject').textContent = state.project;
  document.getElementById('reviewType').textContent = `${typeInfo?.icon || ''} ${state.submissionType}`;
  document.getElementById('reviewPhotos').textContent = state.photos.length > 0 ? `${state.photos.length} photo(s)` : 'No photos';
  const safeName  = (state.submissionType || '').replace(/\s+/g, '-');
  const safeProj  = (state.project || '').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim().replace(/\s+/g, '-');
  const pdfName   = `${state.date}_${safeName}_${safeProj}.pdf`;
  const pathEl    = document.getElementById('reviewOneDrivePath');
  if (pathEl) { pathEl.textContent = pdfName; pathEl.style.opacity = '1'; }
  const pathLabel = pathEl ? pathEl.previousElementSibling : null;
  if (pathLabel) pathLabel.textContent = '⬇️ Will download as';

  const sigPreview = document.getElementById('reviewSignature');
  if (sigPreview) {
    if (state.signature) {
      sigPreview.innerHTML = `<img src="${state.signature}" style="max-width:200px;border:1px solid #333;border-radius:6px;background:#fff;padding:4px">`;
    } else {
      sigPreview.textContent = 'No signature';
    }
  }

  const summary = document.getElementById('reviewFieldSummary');
  if (!summary) return;
  summary.innerHTML = '';
  const fields = FORM_FIELDS[state.submissionType] || [];
  const skipTypes = ['tailgate-items','flra-table','closeout','crew-signin','signature'];
  fields.filter(f => !skipTypes.includes(f.type)).forEach(f => {
    const val = state.fields[f.id];
    if (!val || (Array.isArray(val) && val.length === 0) || val === '') return;
    const row = document.createElement('div');
    row.className = 'review-row';
    row.innerHTML = `<span class="review-label">${f.label}</span><span class="review-value">${Array.isArray(val) ? val.join(', ') : val}</span>`;
    summary.appendChild(row);
  });
  if (summary.children.length === 0) summary.innerHTML = '<p class="muted">Form ready to submit.</p>';
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateStep(step) {
  clearErrors();

  if (step === 1) {
    const name = document.getElementById('foremanName').value.trim();
    const date = document.getElementById('foremanDate').value;
    if (!name) { showError('foremanName', 'Your name is required.'); return false; }
    if (!date) { showError('foremanDate', 'Please select a date.'); return false; }
    state.foremanName = name;
    state.date = date;
    return true;
  }

  if (step === 2) {
    if (!state.project) { showError('projectSelect', 'Please select a project.'); return false; }
    if (!state.submissionType) { showGlobalError('Please select a submission type.'); return false; }
    return true;
  }

  if (step === 3) {
    const fields = FORM_FIELDS[state.submissionType] || [];
    for (const field of fields) {
      if (!field.required) continue;
      if (field.type === 'signature') {
        // Capture from pad at this exact moment (most reliable)
        if (window._signaturePad && !window._signaturePad.isEmpty()) {
          state.signature = window._signaturePad.toDataURL('image/png');
        }
        if (!state.signature) {
          showGlobalError('Please sign the document before continuing.');
          document.getElementById('signatureCanvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        }
        continue;
      }
      const val = state.fields[field.id];
      if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
        showGlobalError(`Please fill in: ${field.label}`);
        return false;
      }
    }
    return true;
  }

  return true;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('field-error');
    const err = document.createElement('span');
    err.className = 'error-msg';
    err.textContent = msg;
    el.parentNode.appendChild(err);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function showGlobalError(msg) {
  const toast = document.getElementById('errorToast');
  if (toast) {
    toast.textContent = msg;
    toast.className = 'toast toast-error visible';
    setTimeout(() => toast.classList.remove('visible'), 4000);
  }
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.error-msg').forEach(el => el.remove());
}

// ── Auto-download helper ──────────────────────────────────────────────────────
function buildPDFFilename() {
  const type = (state.submissionType || 'Report').replace(/\s+/g, '-');
  const proj = (state.project || '').replace(/[^a-zA-Z0-9\- ]/g, '').trim().replace(/\s+/g, '-');
  return proj ? `${state.date}_${type}_${proj}.pdf` : `${state.date}_${type}.pdf`;
}

function triggerDownload(buffer, filename) {
  try {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    console.warn('Auto-download failed:', e);
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  const btn = document.getElementById('btnNext');
  btn.disabled = true;
  btn.textContent = 'Generating PDF...';
  showToast('Generating PDF report...', 'info');

  try {
    // Capture signature from pad at submit time (in case endStroke didn't fire)
    if (window._signaturePad && !window._signaturePad.isEmpty()) {
      state.signature = window._signaturePad.toDataURL('image/png');
    }

    const pdfBuffer  = await generatePDF(state, state.photos);
    const pdfFilename = buildPDFFilename();

    // ── Auto-download PDF immediately on every device ──────────────────────
    triggerDownload(pdfBuffer, pdfFilename);
    showToast(`⬇️ ${pdfFilename}`, 'success');

    btn.textContent = 'Sending email...';
    showToast('Sending email...', 'info');

    const online = await checkBackendHealth();
    let result;
    if (online) {
      result = await submitToOneDrive(state, pdfBuffer, state.photos);
    } else {
      showToast('Server offline — downloading ZIP...', 'warning');
      result = await downloadFallbackZip(state, pdfBuffer, state.photos);
    }

    showSuccessScreen(result, pdfFilename);

    // ── Log submission to Supabase ────────────────────────────────────────────
    try {
      if (window.currentUser) {
        await sbClient.from('submissions').insert({
          foreman_id:      window.currentUser.id,
          project_name:    state.project,
          submission_type: state.submissionType
        });
      }
    } catch (logErr) {
      console.warn('Could not log submission to Supabase:', logErr);
    }

  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = '✓ Submit';
    showGlobalError(`Submission failed: ${err.message}`);
  }
}

function showSuccessScreen(result, pdfFilename) {
  const panel = document.getElementById('step4');
  if (!panel) return;
  const isOffline = result.offline;
  panel.innerHTML = `
    <div class="success-screen">
      <div class="success-icon">${isOffline ? '📦' : '✅'}</div>
      <h2 class="success-title">${isOffline ? 'Downloaded!' : 'Submitted!'}</h2>
      <p class="success-msg">${isOffline
        ? `ZIP downloaded.<br><code>${result.message?.split('\n').pop() || ''}</code>`
        : `Email sent successfully!<br><code>${result.message || ''}</code>`
      }</p>
      <p class="success-meta">${result.filesAttached ? `${result.filesAttached} file(s) attached` : ''}</p>
      ${pdfFilename ? `<div class="success-saved-path"><span class="success-saved-icon">⬇️</span><span class="success-saved-text">${pdfFilename}</span></div>` : ''}
      <button class="btn btn-next" onclick="resetApp()" style="margin-top:24px;width:100%">+ New Submission</button>
    </div>`;
}

function resetApp() {
  state.currentStep = 1;
  state.foremanName = '';
  state.project = '';
  state.submissionType = '';
  state.allowedTypes = null;
  state.fields = {};
  state.photos = [];
  state.signature = null;
  window._signaturePad = null;

  document.getElementById('typeGrid').innerHTML = '';
  document.getElementById('projectSelect').innerHTML = '<option value="">Select project...</option>';
  document.getElementById('foremanDate').value = new Date().toISOString().split('T')[0];

  // Re-fill foreman name from logged-in profile (foreman shouldn't re-type each time)
  const profileName = window.currentProfile?.full_name || '';
  state.foremanName = profileName;
  const nameEl = document.getElementById('foremanName');
  if (nameEl) nameEl.value = profileName;

  // Re-enable nav buttons (disabled during submission)
  const btnNext = document.getElementById('btnNext');
  if (btnNext) { btnNext.disabled = false; btnNext.textContent = 'Next →'; }
  const btnBack = document.getElementById('btnBack');
  if (btnBack) { btnBack.disabled = false; }

  showToast('Ready for next submission', 'success');
  showHomeDashboard();
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('errorToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type} visible`;
  if (type !== 'info') setTimeout(() => toast.classList.remove('visible'), 4000);
}
