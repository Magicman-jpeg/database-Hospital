// =============================================================
//  Admissions page logic — chronological admit/discharge log.
// =============================================================
import { UI, $ } from './ui.js';
import { Store } from './store.js';

UI.mountChrome('admissions');

const state = { status: '' };

function render() {
  let rows = Store.admissionsView();
  if (state.status) rows = rows.filter(a => a.status === state.status);

  $('#count').textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  $('#empty').classList.toggle('hidden', rows.length > 0);

  $('#timeline').innerHTML = rows.map(a => {
    const active = a.status === 'Active';
    const dot = active ? 'bg-emerald-500' : 'bg-slate-500';
    const badge = active
      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      : 'bg-slate-700/40 text-slate-300 border border-slate-600/40';
    return `
    <li class="ml-6">
      <span class="absolute -left-[7px] mt-1.5 w-3.5 h-3.5 rounded-full ${dot} ring-4 ring-slate-950"></span>
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 class="font-semibold">${a.first_name} ${a.last_name}
            <span class="text-slate-500 font-normal">→</span>
            <span class="font-mono text-brand-sky">${a.room_number}</span>
          </h3>
          <span class="px-2.5 py-1 rounded-full text-xs font-medium ${badge}">${a.status}</span>
        </div>
        <p class="text-xs text-slate-400">${a.room_type} · ${a.department_name}</p>
        <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 font-mono">
          <span><i class="ri-login-box-line mr-1 text-emerald-400"></i>Admitted: ${a.admission_date}</span>
          ${a.discharge_date ? `<span><i class="ri-logout-box-line mr-1 text-slate-400"></i>Discharged: ${a.discharge_date}</span>` : ''}
        </div>
      </div>
    </li>`;
  }).join('');
}

$('#f-status').addEventListener('change', e => { state.status = e.target.value; render(); });
render();
