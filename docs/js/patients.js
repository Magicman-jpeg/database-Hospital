// =============================================================
//  Patients page logic — searchable patient table.
// =============================================================
import { UI, $, toast } from './ui.js';
import { Store } from './store.js';

UI.mountChrome('patients');

const state = { q: '', status: '' };

function statusBadge(s) {
  if (s === 'Admitted') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  return 'bg-slate-700/40 text-slate-300 border border-slate-600/40';
}

function render() {
  let rows = Store.patientsView();
  const q = state.q.trim().toLowerCase();
  if (q) rows = rows.filter(p => (`${p.first_name} ${p.last_name}`).toLowerCase().includes(q));
  if (state.status) rows = rows.filter(p => p.admission_status === state.status);

  $('#empty').classList.toggle('hidden', rows.length > 0);
  $('#rows').innerHTML = rows.map(p => `
    <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
      <td class="px-4 py-3 text-slate-500 font-mono">${p.patient_id}</td>
      <td class="px-4 py-3 font-medium">${p.first_name} ${p.last_name}</td>
      <td class="px-4 py-3 text-slate-400">${p.contact_number || '—'}</td>
      <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(p.admission_status)}">${p.admission_status}</span></td>
      <td class="px-4 py-3 font-mono">${p.current_room || '—'}</td>
      <td class="px-4 py-3 text-slate-400">${p.total_admissions}</td>
      <td class="px-4 py-3 text-right">
        ${p.current_admission_id
          ? `<button data-discharge="${p.current_admission_id}" class="text-xs px-3 py-1.5 rounded-md bg-brand-sky/15 text-brand-sky hover:bg-brand-sky hover:text-white transition-colors">Discharge</button>`
          : `<span class="text-xs text-slate-600">—</span>`}
      </td>
    </tr>`).join('');
}

$('#search').addEventListener('input', e => { state.q = e.target.value; render(); });
$('#f-status').addEventListener('change', e => { state.status = e.target.value; render(); });
$('#rows').addEventListener('click', e => {
  const btn = e.target.closest('[data-discharge]');
  if (!btn) return;
  try { Store.discharge(btn.dataset.discharge); toast('Patient discharged'); render(); }
  catch (err) { toast(err.message, 'err'); }
});

render();
