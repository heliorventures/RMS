RMS.components.initLayout('/pages/dashboard.html', 'Dashboard', 'Home / Dashboard');
document.getElementById('pageBody').innerHTML = RMS.components.renderSkeletonCards(8);

(async function init() {
  const res = await RMS.requests.run('dashboard:stats', ({ signal }) => RMS.api.get('/dashboard/stats', { signal }));
  if (!res) return;
  const d = res?.data || {};
  const s = d.stats || {};

  document.getElementById('pageBody').innerHTML = `
    <div class="row g-3 mb-4">
      ${statCard('primary', 'bi-people-fill', s.totalContacts, 'Total Contacts', '+12% this month')}
      ${statCard('success', 'bi-cake2-fill', s.todayBirthdays, "Today's Birthdays", 'Send wishes now')}
      ${statCard('warning', 'bi-calendar-event', s.upcomingBirthdays, 'Upcoming Birthdays', 'Next 30 days')}
      ${statCard('info', 'bi-heart-fill', s.upcomingAnniversaries, 'Upcoming Anniversaries', 'Next 30 days')}
      ${statCard('primary', 'bi-envelope-paper', s.upcomingEvents, 'Upcoming Events', 'Scheduled')}
      ${statCard('success', 'bi-send-fill', s.messagesToday, 'Messages Today', 'Sent today')}
      ${statCard('warning', 'bi-hourglass-split', s.pendingMessages, 'Pending Messages', 'Awaiting delivery')}
      ${statCard('danger', 'bi-envelope-at', s.emailSent, 'Emails Sent', `WhatsApp: ${s.whatsappSent || 0}`)}
    </div>

    <div class="row g-3 mb-4">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header"><span><i class="bi bi-bar-chart me-2"></i>Campaign Statistics</span></div>
          <div class="card-body"><div class="chart-container"><canvas id="messagesChart"></canvas></div></div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card h-100">
          <div class="card-header gradient"><i class="bi bi-lightning-charge me-2"></i>Quick Actions</div>
          <div class="card-body">
            <div class="row g-2">
              ${quickAction('/pages/contacts.html', 'bi-person-plus', 'Add Contact')}
              ${quickAction('/pages/campaigns.html', 'bi-megaphone', 'New Campaign')}
              ${quickAction('/pages/birthdays.html', 'bi-cake2', 'Birthday Wishes')}
              ${quickAction('/pages/invitations.html', 'bi-envelope-paper', 'Send Invite')}
              ${quickAction('/pages/festivals.html', 'bi-stars', 'Festival Msg')}
              ${quickAction('/pages/reports.html', 'bi-file-bar-graph', 'View Reports')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-lg-4"><div class="card"><div class="card-header"><i class="bi bi-calendar3 me-2"></i>Birthdays by Month</div><div class="card-body"><div class="chart-container"><canvas id="birthdayChart"></canvas></div></div></div></div>
      <div class="col-lg-4"><div class="card"><div class="card-header"><i class="bi bi-pie-chart me-2"></i>Contacts by Sector</div><div class="card-body"><div class="chart-container"><canvas id="sectorChart"></canvas></div></div></div></div>
      <div class="col-lg-4"><div class="card"><div class="card-header"><i class="bi bi-pie-chart-fill me-2"></i>Contacts by Religion</div><div class="card-body"><div class="chart-container"><canvas id="religionChart"></canvas></div></div></div></div>
    </div>

    <div class="row g-3">
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header"><span><i class="bi bi-cake2 me-2"></i>Today's Birthdays</span><a href="/pages/birthdays.html" class="small">View all</a></div>
          <div class="card-body p-0">${renderBirthdayList(d.todayBirthdaysList || [])}</div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header"><i class="bi bi-clock-history me-2"></i>Recent Activities</div>
          <div class="card-body p-0" style="max-height:320px;overflow-y:auto">${renderActivities(d.recentActivities || [])}</div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header"><i class="bi bi-person-lines-fill me-2"></i>Recent Contacts</div>
          <div class="card-body p-0">${renderRecentContacts(d.recentContacts || [])}</div>
        </div>
      </div>
    </div>`;

  document.querySelectorAll('.stat-value').forEach((el, i) => {
    const vals = [s.totalContacts, s.todayBirthdays, s.upcomingBirthdays, s.upcomingAnniversaries, s.upcomingEvents, s.messagesToday, s.pendingMessages, s.emailSent];
    RMS.utils.animateCount(el, vals[i] || 0);
  });

  initCharts(d.charts || {});
})();

function statCard(color, icon, value, label, change) {
  return `<div class="col-xl-3 col-md-6"><div class="stat-card ${color}"><div class="stat-icon ${color}"><i class="bi ${icon}"></i></div><div class="stat-value count-up">${value || 0}</div><div class="stat-label">${label}</div><div class="stat-change up"><i class="bi bi-arrow-up-short"></i>${change}</div></div></div>`;
}
function quickAction(href, icon, label) {
  return `<div class="col-6"><a href="${href}" class="quick-action"><i class="bi ${icon}"></i><span>${label}</span></a></div>`;
}
function renderBirthdayList(list) {
  if (!list.length) return '<div class="empty-state py-4"><i class="bi bi-cake2 d-block"></i>No birthdays today</div>';
  return list.map(c => `<div class="d-flex align-items-center gap-3 p-3 border-bottom"><div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div><div class="flex-grow-1"><div class="fw-semibold">${c.firstName} ${c.lastName}</div><small class="text-secondary">${RMS.utils.formatContactSubtitle(c)} · ${c.city || ''}</small></div><a class="btn btn-sm btn-primary" href="/pages/birthdays.html">View birthdays</a></div>`).join('');
}
function renderActivities(list) {
  if (!list.length) return '<div class="p-3 text-secondary small">No recent activity</div>';
  return list.map(a => `<div class="d-flex gap-3 p-3 border-bottom"><div class="stat-icon primary" style="width:36px;height:36px;font-size:.9rem"><i class="bi bi-${a.type === 'email' ? 'envelope' : a.type === 'whatsapp' ? 'whatsapp' : 'chat'}"></i></div><div><div class="small fw-semibold">${a.contactName || a.subject}</div><div class="text-secondary" style="font-size:.75rem">${a.message?.substring(0, 60)}...</div><div class="time">${RMS.utils.formatDateTime(a.sentAt)}</div></div></div>`).join('');
}
function renderRecentContacts(list) {
  if (!list.length) return '<div class="p-3 text-secondary small">No contacts yet</div>';
  return list.map(c => `<a href="/pages/contact-profile.html?id=${c._id}" class="d-flex align-items-center gap-3 p-3 border-bottom text-decoration-none text-dark"><div class="avatar" style="background:${RMS.utils.getAvatarColor(c.firstName)}">${RMS.utils.getInitials(c.firstName, c.lastName)}</div><div><div class="fw-semibold">${c.firstName} ${c.lastName}</div><small class="text-secondary">${RMS.utils.formatContactSubtitle(c)} · ${c.city || ''}</small></div></a>`).join('');
}

function initCharts(charts) {
  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  const bData = charts.birthdaysByMonth || [];
  new Chart(document.getElementById('birthdayChart'), {
    type: 'bar',
    data: { labels: bData.map(d => d.month), datasets: [{ label: 'Birthdays', data: bData.map(d => d.count), backgroundColor: '#2563eb', borderRadius: 6 }] },
    options: { ...chartOpts, plugins: { legend: { display: false } } }
  });
  const sector = charts.contactsBySector || {};
  new Chart(document.getElementById('sectorChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(sector), datasets: [{ data: Object.values(sector), backgroundColor: ['#2563eb','#7c3aed','#059669','#dc2626','#f59e0b','#0891b2','#6366f1'] }] },
    options: chartOpts
  });
  const religion = charts.contactsByReligion || {};
  new Chart(document.getElementById('religionChart'), {
    type: 'pie',
    data: { labels: Object.keys(religion), datasets: [{ data: Object.values(religion), backgroundColor: ['#2563eb','#f59e0b','#10b981','#ef4444','#8b5cf6'] }] },
    options: chartOpts
  });
  const msgMonths = Array.isArray(charts.messagesByMonth) ? charts.messagesByMonth : [];
  new Chart(document.getElementById('messagesChart'), {
    type: 'line',
    data: {
      labels: msgMonths.map(row => row.month),
      datasets: [
        { label: 'Email', data: msgMonths.map(row => row.email || 0), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.1)', fill: true, tension: .4 },
        { label: 'WhatsApp', data: msgMonths.map(row => row.whatsapp || 0), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: .4 }
      ]
    },
    options: { ...chartOpts, scales: { y: { beginAtZero: true } } }
  });
}
