// ── Delivery Calendar ─────────────────────────────────────────────────────────
// Renders a monthly calendar with delivery requests color-coded by status.

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_COLOR = {
  requested:   '#f59e0b',
  on_schedule: '#3b82f6',
  delivered:   '#22c55e'
};
const STATUS_LABEL = {
  requested:   '📋 Requested',
  on_schedule: '🚛 On Schedule',
  delivered:   '✅ Delivered'
};

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let allDeliveries = [];
let activePopover = null;

// ── Init ──────────────────────────────────────────────────────────────────────
async function initCalendar() {
  // Auth guard
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: profile } = await sbClient
    .from('profiles').select('role, full_name').eq('id', session.user.id).single();

  if (!profile || profile.role !== 'admin') {
    window.location.href = 'index.html'; return;
  }

  // Show user name if element exists
  const lbl = document.getElementById('calUserLabel');
  if (lbl) lbl.textContent = profile.full_name || session.user.email;

  await loadAndRender();
}

// ── Load deliveries for visible date range ────────────────────────────────────
async function loadAndRender() {
  showLoading();

  // Get first and last day visible in the grid (including prev/next month overflow)
  const firstOfMonth = new Date(calYear, calMonth, 1);
  const lastOfMonth  = new Date(calYear, calMonth + 1, 0);
  const startDate    = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - firstOfMonth.getDay());
  const endDate = new Date(lastOfMonth);
  endDate.setDate(endDate.getDate() + (6 - lastOfMonth.getDay()));

  const from = startDate.toISOString().split('T')[0];
  const to   = endDate.toISOString().split('T')[0];

  const { data, error } = await sbClient
    .from('delivery_requests')
    .select('id, status, needed_by, needed_by_time, notes, projects(name), profiles(full_name)')
    .gte('needed_by', from)
    .lte('needed_by', to)
    .order('needed_by', { ascending: true });

  allDeliveries = error ? [] : (data || []);
  renderCalendar();
}

// ── Render the monthly grid ───────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('calMonthLabel').textContent =
    `${MONTHS[calMonth]} ${calYear}`;

  const container = document.getElementById('calGrid');
  container.innerHTML = '';

  // Day-of-week headers
  DAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header';
    h.textContent = d;
    container.appendChild(h);
  });

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const lastOfMonth  = new Date(calYear, calMonth + 1, 0);
  const today        = new Date().toISOString().split('T')[0];

  // Start from the Sunday before the 1st
  const cursor = new Date(firstOfMonth);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  // 6 weeks × 7 days = 42 cells
  for (let i = 0; i < 42; i++) {
    const dateStr = cursor.toISOString().split('T')[0];
    const isCurrentMonth = cursor.getMonth() === calMonth;
    const isToday = dateStr === today;

    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day' +
      (isCurrentMonth ? '' : ' other-month') +
      (isToday ? ' today' : '');

    const numEl = document.createElement('div');
    numEl.className = 'cal-day-num';
    numEl.textContent = cursor.getDate();
    dayEl.appendChild(numEl);

    // Deliveries for this day
    const dayDeliveries = allDeliveries.filter(d => d.needed_by === dateStr);
    const visible = dayDeliveries.slice(0, 3);
    const overflow = dayDeliveries.length - visible.length;

    visible.forEach(req => {
      const chip = document.createElement('div');
      chip.className = `cal-chip ${req.status}`;
      chip.textContent = req.projects?.name || 'Unknown';
      chip.title = `${req.projects?.name} — ${STATUS_LABEL[req.status]}`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        showPopover(e, req);
      });
      dayEl.appendChild(chip);
    });

    if (overflow > 0) {
      const more = document.createElement('div');
      more.className = 'cal-more';
      more.textContent = `+${overflow} more`;
      dayEl.appendChild(more);
    }

    container.appendChild(dayEl);
    cursor.setDate(cursor.getDate() + 1);
  }

  // Close popover on background click
  document.addEventListener('click', closePopover, { once: true });
}

// ── Popover ───────────────────────────────────────────────────────────────────
function showPopover(e, req) {
  closePopover();

  const color = STATUS_COLOR[req.status] || '#888';
  const timeStr = req.needed_by_time ? ` at ${req.needed_by_time}` : '';
  const dateStr = req.needed_by
    ? new Date(req.needed_by + 'T12:00:00').toLocaleDateString('en-AU', { weekday:'short', month:'short', day:'numeric' })
    : '';

  const pop = document.createElement('div');
  pop.className = 'cal-popover';
  pop.innerHTML = `
    <button class="cal-popover-close" onclick="closePopover()">✕</button>
    <div class="cal-popover-project">${esc(req.projects?.name || 'Unknown project')}</div>
    <div class="cal-popover-row">👷 ${esc(req.profiles?.full_name || 'Unknown foreman')}</div>
    ${dateStr ? `<div class="cal-popover-row">📅 ${dateStr}${timeStr}</div>` : ''}
    ${req.notes ? `<div class="cal-popover-row">📝 ${esc(req.notes)}</div>` : ''}
    <span class="cal-popover-status" style="background:${color}20;color:${color}">${STATUS_LABEL[req.status] || req.status}</span>`;

  document.body.appendChild(pop);
  activePopover = pop;

  // Position near click, keeping inside viewport
  const rect = e.target.getBoundingClientRect();
  let top  = rect.bottom + 8;
  let left = rect.left;
  if (left + 300 > window.innerWidth)  left = window.innerWidth - 316;
  if (top  + 160 > window.innerHeight) top  = rect.top - 170;
  pop.style.top  = `${top}px`;
  pop.style.left = `${left}px`;

  // Prevent click inside popover from closing it
  pop.addEventListener('click', e => e.stopPropagation());
  setTimeout(() => {
    document.addEventListener('click', closePopover, { once: true });
  }, 0);
}

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

// ── Month navigation ──────────────────────────────────────────────────────────
function prevMonth() {
  if (calMonth === 0) { calMonth = 11; calYear--; }
  else calMonth--;
  loadAndRender();
}

function nextMonth() {
  if (calMonth === 11) { calMonth = 0; calYear++; }
  else calMonth++;
  loadAndRender();
}

function goToday() {
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  loadAndRender();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showLoading() {
  const container = document.getElementById('calGrid');
  container.innerHTML = `<div class="cal-loading" style="grid-column:1/-1">Loading…</div>`;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initCalendar);
