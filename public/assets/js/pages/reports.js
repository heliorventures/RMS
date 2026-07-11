RMS.components.initLayout('/pages/reports.html', 'Reports & Analytics', 'Home / Reports');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-outline-primary" onclick="RMS.toast.show('Report exported as PDF')"><i class="bi bi-download me-1"></i> Export PDF</button>`;
document.getElementById('pageBody').innerHTML = `
  <ul class="nav nav-tabs mb-4"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#contacts">Contacts</button></li>
  <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#birthday">Birthday</button></li>
  <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#campaign">Campaign</button></li>
  <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#delivery">Delivery</button></li></ul>
  <div class="tab-content">
    <div class="tab-pane fade show active" id="contacts"><div class="row g-3"><div class="col-md-4"><div class="card"><div class="card-header">City Wise</div><div class="card-body"><div class="chart-container"><canvas id="cityChart"></canvas></div></div></div></div>
    <div class="col-md-4"><div class="card"><div class="card-header">Sector Wise</div><div class="card-body"><div class="chart-container"><canvas id="sectorReportChart"></canvas></div></div></div></div>
    <div class="col-md-4"><div class="card"><div class="card-header">Religion Wise</div><div class="card-body"><div class="chart-container"><canvas id="religionReportChart"></canvas></div></div></div></div></div></div>
    <div class="tab-pane fade" id="birthday"><div class="card"><div class="card-header">Birthday Report by Month</div><div class="card-body"><div class="chart-container" style="height:350px"><canvas id="birthdayReportChart"></canvas></div></div></div></div>
    <div class="tab-pane fade" id="campaign"><div class="card"><div class="card-body" id="campaignReport"></div></div></div>
    <div class="tab-pane fade" id="delivery"><div class="card"><div class="card-body"><table class="table" id="deliveryTable"><thead><tr><th>Type</th><th>Contact</th><th>Status</th><th>Sent At</th></tr></thead><tbody></tbody></table></div></div></div>
  </div>`;

initReports();
async function initReports() {
  const [contactReport, birthdayReport, campaignReport, deliveryReport, dashboard] = await Promise.all([
    RMS.api.get('/reports/contacts'), RMS.api.get('/reports/birthdays'),
    RMS.api.get('/reports/campaigns'), RMS.api.get('/reports/delivery'),
    RMS.api.get('/dashboard/stats')
  ]);
  const cr = contactReport?.data || {};
  makeChart('cityChart', 'bar', Object.keys(cr.byCity||{}), Object.values(cr.byCity||{}), '#2563eb');
  makeChart('sectorReportChart', 'doughnut', Object.keys(cr.bySector||{}), Object.values(cr.bySector||{}));
  makeChart('religionReportChart', 'pie', Object.keys(cr.byReligion||{}), Object.values(cr.byReligion||{}));
  const br = birthdayReport?.data?.byMonth || {};
  makeChart('birthdayReportChart', 'bar', Object.keys(br), Object.values(br), '#10b981');
  const camp = campaignReport?.data || {};
  document.getElementById('campaignReport').innerHTML = `<h5>Total Campaigns: ${camp.total||0}</h5><div class="row g-3 mt-2">${Object.entries(camp.byType||{}).map(([k,v])=>`<div class="col-md-3"><div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div></div>`).join('')}</div>`;
  const messages = deliveryReport?.data?.messages || [];
  document.querySelector('#deliveryTable tbody').innerHTML = messages.map(m=>`<tr><td>${m.type}</td><td>${m.subject||'-'}</td><td>${RMS.utils.statusBadge(m.status)}</td><td>${RMS.utils.formatDateTime(m.sentAt)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center">No data</td></tr>';
}
function makeChart(id, type, labels, data, color) {
  const el = document.getElementById(id); if (!el) return;
  new Chart(el, { type, data: { labels, datasets: [{ data, backgroundColor: color || ['#2563eb','#7c3aed','#10b981','#f59e0b','#ef4444','#0891b2'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
}
