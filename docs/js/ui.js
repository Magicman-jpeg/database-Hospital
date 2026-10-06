// =============================================================
//  Shared UI helpers: head assets, nav bar, aurora, toast.
//  Each page imports this and calls UI.mountChrome('dashboard').
// =============================================================
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PAGES = [
  { id: 'home',       label: 'Home',       href: 'index.html',      icon: 'ri-home-5-line' },
  { id: 'dashboard',  label: 'Dashboard',  href: 'dashboard.html',  icon: 'ri-dashboard-line' },
  { id: 'patients',   label: 'Patients',   href: 'patients.html',   icon: 'ri-team-line' },
  { id: 'admissions', label: 'Admissions', href: 'admissions.html', icon: 'ri-file-list-3-line' },
];

function mountChrome(active) {
  // Aurora backdrop
  const aurora = document.createElement('div');
  aurora.className = 'aurora';
  aurora.setAttribute('aria-hidden', 'true');
  document.body.prepend(aurora);

  // Nav bar
  const nav = document.createElement('header');
  nav.className = 'relative z-20 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-md';
  nav.innerHTML = `
    <nav class="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
      <a href="index.html" class="font-display text-2xl font-bold">Medi<span class="text-brand-sky">Cap</span></a>
      <ul class="hidden sm:flex items-center gap-7 text-sm font-medium">
        ${PAGES.map(p => `
          <li><a href="${p.href}" class="nav-link flex items-center gap-1.5 hover:text-brand-sky transition-colors ${p.id === active ? 'active' : 'text-slate-300'}">
            <i class="${p.icon}"></i> ${p.label}
          </a></li>`).join('')}
      </ul>
      <button id="nav-menu-btn" class="sm:hidden w-10 h-10 grid place-items-center rounded-lg border border-slate-700" aria-label="Menu">
        <i class="ri-menu-line text-lg"></i>
      </button>
    </nav>
    <ul id="nav-mobile" class="sm:hidden hidden border-t border-slate-800 px-4 py-2">
      ${PAGES.map(p => `
        <li><a href="${p.href}" class="flex items-center gap-2 py-2.5 ${p.id === active ? 'text-brand-sky' : 'text-slate-300'}">
          <i class="${p.icon}"></i> ${p.label}
        </a></li>`).join('')}
    </ul>`;
  document.body.insertBefore(nav, document.body.children[1]);

  const btn = $('#nav-menu-btn');
  btn?.addEventListener('click', () => $('#nav-mobile').classList.toggle('hidden'));

  // Toast element
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] hidden px-5 py-3 rounded-xl text-sm font-medium shadow-xl';
  document.body.appendChild(toast);
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
    kind === 'ok' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

// Shared status styling used by multiple pages.
export function statusStyle(status, beds) {
  if (status === 'Maintenance') return { ring: 'border-slate-600', badge: 'bg-slate-700 text-slate-200', bar: 'bg-slate-500', label: 'Maintenance', icon: 'ri-tools-line' };
  if (status === 'Full' || beds <= 0) return { ring: 'border-red-500/40', badge: 'bg-red-500/15 text-red-300 border border-red-500/30', bar: 'bg-red-500', label: 'Full', icon: 'ri-close-circle-line' };
  if (beds === 1) return { ring: 'border-amber-500/40', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30', bar: 'bg-amber-400', label: 'Near Full', icon: 'ri-alert-line' };
  return { ring: 'border-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', bar: 'bg-emerald-400', label: 'Available', icon: 'ri-checkbox-circle-line' };
}

export const UI = { mountChrome, toast, statusStyle, $, $$ };
