const fs = require('node:fs');
const data = require('./sampleData');

const bootstrapCss = fs.readFileSync(require.resolve('bootstrap/dist/css/bootstrap.min.css'), 'utf8');
const bootstrapBundle = fs.readFileSync(require.resolve('bootstrap/dist/js/bootstrap.bundle.min.js'), 'utf8');
const jqueryBundle = fs.readFileSync(require.resolve('jquery/dist/jquery.min.js'), 'utf8');
const dataTablesBundle = fs.readFileSync(require.resolve('datatables.net/js/jquery.dataTables.min.js'), 'utf8');
const dataTablesBootstrapBundle = fs.readFileSync(require.resolve('datatables.net-bs5/js/dataTables.bootstrap5.min.js'), 'utf8');
const dataTablesBootstrapCss = fs.readFileSync(require.resolve('datatables.net-bs5/css/dataTables.bootstrap5.min.css'), 'utf8');

const chartStub = `
(() => {
  window.__chartConfigs = [];
  window.Chart = class Chart {
    constructor(element, config) {
      this.element = element;
      this.config = config;
      window.__chartConfigs.push(config);
    }
    destroy() {}
  };
})();`;

const html2pdfStub = `
window.html2pdf = () => ({
  set() { return this; },
  from() { return this; },
  save() { return Promise.resolve(); }
});`;

async function installExternalAssetStubs(page) {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ status: 200, body: '' }));
  await page.route('https://cdn.jsdelivr.net/npm/bootstrap@*/dist/css/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: bootstrapCss }));
  await page.route('https://cdn.jsdelivr.net/npm/bootstrap-icons@*/font/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://cdn.datatables.net/1.13.8/css/dataTables.bootstrap5.min.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: dataTablesBootstrapCss }));
  await page.route('https://cdn.jsdelivr.net/npm/bootstrap@*/dist/js/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: bootstrapBundle }));
  await page.route('https://code.jquery.com/jquery-3.7.1.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jqueryBundle }));
  await page.route('https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: dataTablesBundle }));
  await page.route('https://cdn.datatables.net/1.13.8/js/dataTables.bootstrap5.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: dataTablesBootstrapBundle }));
  await page.route('https://cdn.jsdelivr.net/npm/chart.js@*/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: chartStub }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: html2pdfStub }));
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data)
  };
}

function defaultResponse(method, pathname) {
  if (pathname === '/api/health') return { success: true, message: 'RMS API is running' };
  if (pathname === '/api/auth/login' && method === 'POST') return { success: true, token: 'e2e-token', user: data.user };
  if (pathname === '/api/auth/forgot-password' && method === 'POST') return { success: true, message: 'If the account exists, a reset link was sent.' };
  if (pathname === '/api/auth/reset-password' && method === 'POST') return { success: true, message: 'Password reset successfully. Sign in with your new password.' };
  if (pathname === '/api/auth/profile') return { success: true, data: data.user };
  if (pathname === '/api/auth/change-password' && method === 'PUT') return { success: true, message: 'Password updated successfully.' };
  if (pathname === '/api/notifications') return { success: true, data: [data.notification] };
  if (pathname === '/api/dashboard/stats') return { success: true, data: data.dashboard };
  if (pathname === '/api/contacts/birthdays') return { success: true, data: [data.contact] };
  if (pathname === '/api/contacts/anniversaries') return { success: true, data: [data.contact] };
  if (pathname === '/api/contacts' && method === 'GET') return { success: true, data: [data.contact], pagination: { page: 1, limit: 25, total: 1, pages: 1 } };
  if (pathname === '/api/contacts' && method === 'POST') return { success: true, data: data.contact, message: 'Contact created successfully' };
  if (pathname === `/api/contacts/${data.ids.contact}`) return { success: true, data: data.contact };
  if (pathname === '/api/contacts/bulk-import' && method === 'POST') return { success: true, data: { inserted: 1, skipped: 0, errors: [] } };
  if (pathname === '/api/contacts/bulk-lookup' && method === 'POST') return { success: true, data: [data.contact] };
  if (pathname === '/api/groups') return { success: true, data: [data.group] };
  if (pathname === `/api/groups/${data.ids.group}`) return { success: true, data: { group: data.group, members: [data.contact] } };
  if (pathname === `/api/groups/${data.ids.group}/members`) return { success: true, data: [data.contact], pagination: { page: 1, limit: 100, total: 1, pages: 1 } };
  if (pathname === '/api/exports/contacts' && method === 'POST') return { success: true, data: { id: 'export-job', status: 'ready', downloadUrl: '/api/exports/export-job/download' } };
  if (pathname === '/api/templates') return { success: true, data: [data.template] };
  if (pathname === '/api/campaigns' && method === 'GET') return { success: true, data: [data.campaign] };
  if (pathname === '/api/campaigns' && method === 'POST') return { success: true, data: data.campaign, message: 'Campaign created successfully' };
  if (pathname === '/api/events' && method === 'GET') return { success: true, data: [data.event] };
  if (pathname === '/api/events' && method === 'POST') return { success: true, data: data.event, message: 'Invitation created' };
  if (pathname === `/api/events/${data.ids.event}`) return { success: true, data: data.event };
  if (pathname === '/api/festivals' && method === 'GET') return { success: true, data: [data.festival] };
  if (pathname === '/api/festivals' && method === 'POST') return { success: true, data: data.festival, message: 'Festival created' };
  if (pathname === `/api/festivals/${data.ids.festival}`) return { success: true, data: data.festival };
  if (pathname === '/api/delivery/jobs' && method === 'GET') return { success: true, data: [data.job], pagination: { page: 1, limit: 30, total: 1, pages: 1 } };
  if (pathname === '/api/delivery/capabilities' && method === 'GET') return {
    success: true,
    data: {
      email: { enabled: true },
      whatsapp: { enabled: true },
      sms: { enabled: false, reason: 'SMS provider is not configured' }
    }
  };
  if (pathname === '/api/delivery/jobs' && method === 'POST') return { success: true, data: data.job, message: 'Delivery job queued' };
  if (pathname === `/api/delivery/jobs/${data.ids.job}`) return { success: true, data: data.job };
  if (pathname === `/api/delivery/jobs/${data.ids.job}/messages`) return { success: true, data: [data.message], pagination: { page: 1, limit: 100, total: 1, pages: 1 } };
  if (pathname === `/api/delivery/jobs/${data.ids.job}/retry-failed` && method === 'POST') return { success: true, message: '0 failed messages requeued', data: { requeued: 0 } };
  if (pathname === '/api/delivery/test-email' && method === 'POST') return { success: true, message: 'Test email sent successfully' };
  if (pathname === '/api/communication') return { success: true, data: [] };
  if (pathname === '/api/reports/contacts') return { success: true, data: { total: 1, byCity: { Pune: 1 }, bySector: { Associates: 1 }, byReligion: { Hindu: 1 }, byStatus: { Active: 1 } } };
  if (pathname === '/api/reports/birthdays') return { success: true, data: { total: 1, byMonth: { September: 1 } } };
  if (pathname === '/api/reports/campaigns') return { success: true, data: { total: 1, byType: { email: 1 }, byStatus: { completed: 1 }, campaigns: [data.campaign] } };
  if (pathname === '/api/reports/delivery') return { success: true, data: { total: 1, byType: { email: 1 }, byStatus: { delivered: 1 }, messages: [data.message], pagination: { page: 1, limit: 50, total: 1 } } };
  if (pathname === '/api/settings/users') return { success: true, data: [data.user] };
  if (pathname === '/api/settings') return { success: true, data: data.settings };

  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    return { success: true, data: { ...data.contact }, message: 'Saved successfully' };
  }

  return { success: true, data: [] };
}

async function mockRmsApi(page) {
  const state = {
    requests: [],
    pageErrors: [],
    consoleErrors: [],
    failures: new Map(),
    delays: new Map(),
    activeByPath: new Map(),
    maxConcurrentByPath: new Map(),
    fail(method, pathname, status = 500, message = 'Request failed') {
      this.failures.set(`${method.toUpperCase()} ${pathname}`, { status, message });
    },
    delay(method, pathname, milliseconds) {
      this.delays.set(`${method.toUpperCase()} ${pathname}`, milliseconds);
    }
  };

  page.on('pageerror', error => state.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const key = `${method} ${pathname}`;
    const family = pathname.replace(/[0-9a-f]{24}/g, ':id');
    const active = (state.activeByPath.get(family) || 0) + 1;
    state.activeByPath.set(family, active);
    state.maxConcurrentByPath.set(family, Math.max(state.maxConcurrentByPath.get(family) || 0, active));

    let body = null;
    try { body = request.postDataJSON(); } catch { body = request.postData(); }
    state.requests.push({ method, pathname, search: url.search, body, startedAt: Date.now() });

    const delay = state.delays.get(key) || state.delays.get(`${method} ${family}`) || 0;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));

    const failure = state.failures.get(key) || state.failures.get(`${method} ${family}`);
    state.activeByPath.set(family, active - 1);
    if (failure) {
      return route.fulfill(jsonResponse({ success: false, message: failure.message }, failure.status));
    }

    return route.fulfill(jsonResponse(defaultResponse(method, pathname)));
  });

  return state;
}

async function seedAuthenticatedSession(page, user = data.user) {
  await page.addInitScript(sessionUser => {
    if (localStorage.getItem('rms_e2e_session_seeded') === 'true') return;
    localStorage.setItem('rms_token', 'e2e-token');
    localStorage.setItem('rms_user', JSON.stringify(sessionUser));
    localStorage.setItem('rms_last_activity', String(Date.now()));
    localStorage.setItem('rms_e2e_session_seeded', 'true');
  }, user);
}

async function preparePage(page, { authenticated = true } = {}) {
  await installExternalAssetStubs(page);
  const api = await mockRmsApi(page);
  if (authenticated) await seedAuthenticatedSession(page);
  return api;
}

module.exports = { data, preparePage, seedAuthenticatedSession };
