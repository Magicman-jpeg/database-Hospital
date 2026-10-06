// =============================================================
//  Dashboard page logic — uses shared Store + UI modules.
// =============================================================
import { UI, $, $$, toast, statusStyle } from './ui.js';
import { Store } from './store.js';

UI.mountChrome('dashboard');

const filters = { department: '', type: '', status: '' };

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
      <div class="flex items-center justify-between"><span class="text-xs text-slate-400">${t.label}</span><i class="${t.icon} ${t.color} text-lg"></i></div>
      <div class="heading-grotesk text-4xl mt-1 ${t.color}">${t.value}</div>
    </div>`).join('') + `
    <div class="col-span-2 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4">
      <div class="flex items-center justify-between text-xs text-slate-400 mb-2"><span>Hospital-wide occupancy</span><span>${pct}%</span></div>
      <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <div class="gauge-fill h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function renderRooms() {
  const rooms = Store.roomsView(filters);
  const admissions = Store.admissionsView({ activeOnly: true });
  renderStats(Store.roomsView());

  const byRoom = {};
  admissions.forEach(a => (byRoom[a.room_id] ||= []).push(a));

  $('#rooms-empty').classList.toggle('hidden', rooms.length > 0);
  $('#rooms').innerHTML = rooms.map((r, i) => {
    const beds = r.beds_available;
    const s = statusStyle(r.status, beds);
    const disabled = r.status === 'Full' || r.status === 'Maintenance' || beds <= 0;
    const patients = byRoom[r.room_id] || [];
    return `
    <article class="card-enter rounded-2xl border ${s.ring} bg-slate-900/60 backdrop-blur p-5" style="animation-delay:${i * 40}ms">
      <div class="flex items-start justify-between mb-3">
        <div><h3 class="font-mono font-semibold text-lg">${r.room_number}</h3>
          <p class="text-xs text-slate-400">${r.room_type} · ${r.department_name}</p></div>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.badge}"><i class="${s.icon}"></i> ${s.label}</span>
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
            <button data-discharge="${p.admission_id}" class="text-xs px-2.5 py-1 rounded-md bg-brand-sky/15 text-brand-sky hover:bg-brand-sky hover:text-white transition-colors">Discharge</button>
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
function openModal(presetRoomId = '') {
  const rooms = Store.roomsView({ status: 'Available' });
  const select = $('#room_id');
  select.innerHTML = '<option value="">Select a room…</option>' +
    rooms.map(r => `<option value="${r.room_id}">${r.room_number} — ${r.room_type} (${r.beds_available} free)</option>`).join('');
  $('#modal-error').classList.add('hidden');
  $('#admit-form').reset();
  if (presetRoomId) select.value = String(presetRoomId);
  modal.classList.remove('hidden'); modal.classList.add('flex');
  $('#first_name').focus();
}
function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); }

// ---- Events ----
$('#admit-btn').addEventListener('click', () => openModal());
$('#reset-btn').addEventListener('click', () => { Store.reset(); renderRooms(); toast('Demo reset'); });
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

$('#rooms').addEventListener('click', (e) => {
  const dischargeBtn = e.target.closest('[data-discharge]');
  const admitBtn = e.target.closest('[data-admit-room]');
  try {
    if (dischargeBtn) { Store.discharge(dischargeBtn.dataset.discharge); toast('Patient discharged'); renderRooms(); }
    else if (admitBtn && !admitBtn.disabled) { openModal(admitBtn.dataset.admitRoom); }
  } catch (err) { toast(err.message, 'err'); }
});

$('#admit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    Store.admit({
      first_name: $('#first_name').value, last_name: $('#last_name').value,
      contact_number: $('#contact_number').value, room_id: $('#room_id').value,
    });
    closeModal(); toast('Patient admitted'); renderRooms();
  } catch (err) {
    const el = $('#modal-error'); el.textContent = err.message; el.classList.remove('hidden');
  }
});

// ---- Boot ----
$('#f-department').innerHTML = '<option value="">All Departments</option>' +
  Store.departments().map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
renderRooms();
