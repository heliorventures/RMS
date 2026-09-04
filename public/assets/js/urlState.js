window.RMS = window.RMS || {};

window.RMS.urlState = {
  keys: Object.freeze({ search: 'q', city: 'city', sector: 'sector', religion: 'religion', status: 'status', page: 'page', sort: 'sort', tab: 'tab', month: 'month', job: 'job', group: 'group', edit: 'edit' }),
  read(key, fallback = '') { return new URLSearchParams(window.location.search).get(key) || fallback; },
  number(key, fallback = 1, min = 1) { const value = Number.parseInt(this.read(key), 10); return Number.isInteger(value) && value >= min ? value : fallback; },
  set(values, { replace = false } = {}) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => value == null || value === '' ? url.searchParams.delete(key) : url.searchParams.set(key, String(value)));
    history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  },
  onPopState(handler) { window.addEventListener('popstate', handler); }
};
