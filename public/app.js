// =============================================================
//  MediCap dashboard — client logic (Fetch API)
// =============================================================
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const api = {
  async get(url)            { return handle(await fetch(url)); },
  async post(url, body)     { return handle(await fetch(url, { method: 'POST',  headers: json(), body: JSON.stringify(body) })); },
  async patch(url, body)    { return handle(await fetch(url, { method: 'PATCH', headers: json(), body: body ? JSON.stringify(body) : undefined })); },
};
const json = () => ({ 'Content-Type': 'application/json' });
async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- State / filters ----
const filters = { department: '', type: '', status: '' };

// ---- Status styling map ----
function statusStyle(status, beds) {
  if (status === 'Maintenance') return { ring: 'border-slate-600', badge: 'bg-slate-700 text-slate-200', bar: 'bg-slate-500', label: 'Maintenance', icon: 'ri-tools-line' };
  if (status === 'Full' || beds <= 0) return { ring: 'border-red-500/40', badge: 'bg-red-500/15 text-red-300 border border-red-500/30', bar: 'bg-red-500', label: 'Full', icon: 'ri-close-circle-line' };
  if (beds === 1) return { ring: 'border-amber-500/40', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30', bar: 'bg-amber-400', label: 'Near Full', icon: 'ri-alert-line' };
  return { ring: 'border-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', bar: 'bg-emerald-400', label: 'Available', icon: 'ri-checkbox-circle-line' };
}

// ---- Render stat tiles ----
function renderStats(rooms) {
  const totalBeds = rooms.reduce((s, r) => s + r.max_capacity, 0);
  const occupied  = rooms.reduce((s, r) => s + r.current_occupancy, 0);
  const free      = totalBeds - occupied;
  const fullRooms = rooms.filter(r => r.status === 'Full').length;
  const pct       = totalBeds ? Math.round(occupied / totalBeds * 100) : 0;

  const tiles = [
    { label: 'Total Beds', value: totalBeds, icon: 'ri-hotel-bed-line', color: 'text-brand-sky' },
    { label: 'Occupied',   value: occupied,  icon: 'ri-user-fill',      color: 'text-brand-indigo' },
    { label: 'Available',  value: free,      icon: 'ri-door-open-line', color: 'text-emerald-400' },
    { label: 'Full Rooms', value: fullRooms, icon: 'ri-alarm-warning-line', color: 'text-red-400' },
  ];

  $('#stats').innerHTML = tiles.map(t => `
    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-400">${t.label}</span>
        <i class="${t.icon} ${t.color} text-lg"></i>
      </div>
      <div class="heading-grotesk text-4xl mt-1 ${t.color}">${t.value}</div>
    </div>`).join('') + `
    <div class="col-span-2 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4">
      <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>Hospital-wide occupancy</span><span>${pct}%</span>
      </div>
      <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <div class="gauge-fill h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

// ---- Render room cards ----
async function renderRooms() {
  const qs = new URLSearchParams();
  if (filters.department) qs.set('department', filters.department);
  if (filters.type)       qs.set('type', filters.type);
  if (filters.status)     qs.set('status', filters.status);

  const [rooms, admissions] = await Promise.all([
    api.get('/api/rooms?' + qs.toString()),
    api.get('/api/admissions?active=true'),
  ]);

  // For the stat tiles, use an unfiltered snapshot.
  const allRooms = filters.department || filters.type || filters.status
    ? await api.get('/api/rooms')
    : rooms;
  renderStats(allRooms);

  const byRoom = {};
  admissions.forEach(a => (byRoom[a.room_id] ||= []).push(a));

  const grid = $('#rooms');
  $('#rooms-empty').classList.toggle('hidden', rooms.length > 0);

  grid.innerHTML = rooms.map((r, i) => {
    const beds = r.beds_available;
    const s = statusStyle(r.status, beds);
    const disabled = r.status === 'Full' || r.status === 'Maintenance' || beds <= 0;
    const patients = byRoom[r.room_id] || [];

    return `
    <article class="card-enter rounded-2xl border ${s.ring} bg-slate-900/60 backdrop-blur p-5" style="animation-delay:${i * 40}ms">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="font-mono font-semibold text-lg">${r.room_number}</h3>
          <p class="text-xs text-slate-400">${r.room_type} · ${r.department_name}</p>
        </div>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.badge}">
          <i class="${s.icon}"></i> ${s.label}
        </span>
      </div>

      <div class="flex items-baseline justify-between text-sm mb-1">
        <span class="text-slate-300"><span class="heading-grotesk text-2xl">${r.current_occupancy}</span> / ${r.max_capacity} beds</span>
        <span class="text-slate-400">${r.occupancy_pct}% full</span>
      </div>
      <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden mb-4" role="progressbar" aria-valuenow="${r.occupancy_pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${r.room_number} occupancy">
        <div class="gauge-fill h-full rounded-full ${s.bar}" style="width:${r.occupancy_pct}%"></div>
      </div>

      ${patients.length ? `
      <ul class="space-y-1.5 mb-4">
        ${patients.map(p => `
          <li class="flex items-center justify-between text-sm bg-slate-950/60 rounded-lg px-3 py-2">
            <span><i class="ri-user-line text-slate-500 mr-1"></i>${p.first_name} ${p.last_name}</span>
            <button data-discharge="${p.admission_id}" class="text-xs px-2.5 py-1 rounded-md bg-brand-sky/15 text-brand-sky hover:bg-brand-sky hover:text-white transition-colors">
              Discharge
            </button>
          </li>`).join('')}
      </ul>` : `<p class="text-sm text-slate-500 mb-4"><i class="ri-moon-line mr-1"></i>No active patients</p>`}

      <button data-admit-room="${r.room_id}" ${disabled ? 'disabled' : ''}
        class="w-full py-2 rounded-lg text-sm font-medium transition-colors ${disabled
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
          : 'bg-brand-indigo/90 hover:bg-brand-indigo text-white'}">
        ${disabled ? (r.status === 'Maintenance' ? 'Under Maintenance' : 'No Beds Available') : '+ Admit here'}
      </button>
    </article>`;
  }).join('');
}

// ---- Modal ----
const modal = $('#modal');
async function openModal(presetRoomId = '') {
  // Populate the room dropdown with only admittable rooms.
  const rooms = await api.get('/api/rooms?status=Available');
  const select = $('#room_id');
  select.innerHTML = '<option value="">Select a room…</option>' +
    rooms.map(r => `<option value="${r.room_id}">${r.room_number} — ${r.room_type} (${r.beds_available} free)</option>`).join('');
  if (presetRoomId) select.value = String(presetRoomId);

  $('#modal-error').classList.add('hidden');
  $('#admit-form').reset();
  if (presetRoomId) select.value = String(presetRoomId);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  $('#first_name').focus();
}
function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); }

// ---- Toast ----
function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
    kind === 'ok' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2600);
}

// ---- Load departments into filter ----
async function loadDepartments() {
  const depts = await api.get('/api/departments');
  $('#f-department').innerHTML = '<option value="">All Departments</option>' +
    depts.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
}

// ---- Events ----
$('#admit-btn').addEventListener('click', () => openModal());
$('#refresh-btn').addEventListener('click', () => renderRooms().then(() => toast('Refreshed')));
$$('[data-close]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('#f-department').addEventListener('change', e => { filters.department = e.target.value; renderRooms(); });
$('#f-type').addEventListener('change',       e => { filters.type = e.target.value; renderRooms(); });
$('#f-status').addEventListener('change',     e => { filters.status = e.target.value; renderRooms(); });
$('#f-clear').addEventListener('click', () => {
  filters.department = filters.type = filters.status = '';
  $('#f-department').value = ''; $('#f-type').value = ''; $('#f-status').value = '';
  renderRooms();
});

// Event delegation for dynamically-rendered buttons.
$('#rooms').addEventListener('click', async (e) => {
  const dischargeBtn = e.target.closest('[data-discharge]');
  const admitBtn = e.target.closest('[data-admit-room]');
  try {
    if (dischargeBtn) {
      await api.patch(`/api/admissions/${dischargeBtn.dataset.discharge}/discharge`);
      toast('Patient discharged');
      renderRooms();
    } else if (admitBtn && !admitBtn.disabled) {
      openModal(admitBtn.dataset.admitRoom);
    }
  } catch (err) { toast(err.message, 'err'); }
});

$('#admit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    first_name: $('#first_name').value,
    last_name: $('#last_name').value,
    contact_number: $('#contact_number').value,
    room_id: $('#room_id').value,
  };
  try {
    await api.post('/api/admissions', body);
    closeModal();
    toast('Patient admitted');
    renderRooms();
  } catch (err) {
    const el = $('#modal-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

// ---- Boot ----
(async function init() {
  try {
    await loadDepartments();
    await renderRooms();
  } catch (err) {
    toast('Cannot reach API — is the server + MySQL running?', 'err');
    console.error(err);
  }
})();

// Light auto-refresh every 15s so the grid stays "live".
setInterval(() => renderRooms().catch(() => {}), 15000);
