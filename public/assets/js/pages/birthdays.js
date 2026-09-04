RMS.components.initLayout('/pages/birthdays.html', 'Birthday Module', 'Home / Birthdays');
document.getElementById('pageActions').innerHTML = `
  <button class="btn btn-outline-primary me-2" onclick="RMS.toast.show('Auto wishes enabled for all contacts','success')"><i class="bi bi-robot me-1"></i> Auto Wishes</button>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#wishModal"><i class="bi bi-send me-1"></i> Send Wishes</button>`;

document.getElementById('pageBody').innerHTML = `
  <ul class="nav nav-tabs mb-4" role="tablist">
    <li class="nav-item" role="presentation"><button type="button" class="nav-link active" id="todayTab" role="tab" aria-controls="today" aria-selected="true" data-bs-toggle="tab" data-bs-target="#today">Today's Birthdays</button></li>
    <li class="nav-item" role="presentation"><button type="button" class="nav-link" id="upcomingTab" role="tab" aria-controls="upcoming" aria-selected="false" data-bs-toggle="tab" data-bs-target="#upcoming">Upcoming</button></li>
    <li class="nav-item" role="presentation"><button type="button" class="nav-link" id="calendarTab" role="tab" aria-controls="calendar" aria-selected="false" data-bs-toggle="tab" data-bs-target="#calendar">Calendar</button></li>
    <li class="nav-item" role="presentation"><button type="button" class="nav-link" id="templatesTab" role="tab" aria-controls="templates" aria-selected="false" data-bs-toggle="tab" data-bs-target="#templates">Templates</button></li>
  </ul>
  <div class="tab-content">
    <div class="tab-pane fade show active" id="today" role="tabpanel" aria-labelledby="todayTab"><div class="row g-3" id="todayGrid"></div></div>
    <div class="tab-pane fade" id="upcoming" role="tabpanel" aria-labelledby="upcomingTab"><div class="card"><div class="card-body"><table class="table" id="upcomingTable"><caption class="visually-hidden">Upcoming birthdays</caption><thead><tr><th>Contact</th><th>Designation</th><th>DOB</th><th>City</th><th>Days Left</th><th>Actions</th></tr></thead><tbody></tbody></table></div></div></div>
    <div class="tab-pane fade" id="calendar" role="tabpanel" aria-labelledby="calendarTab"><div class="card"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="changeMonth(-1)" aria-label="Previous month"><i class="bi bi-chevron-left"></i></button>
        <h5 id="calMonth" class="mb-0 fw-bold"></h5>
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="changeMonth(1)" aria-label="Next month"><i class="bi bi-chevron-right"></i></button>
      </div>
      <div class="calendar-grid mb-3" id="calendarGrid"></div>
      <div class="d-flex gap-3 small text-secondary mb-3 flex-wrap">
        <span><span class="calendar-legend today d-inline-block"></span> Today</span>
        <span><span class="calendar-legend has-event d-inline-block"></span> Birthday</span>
      </div>
      <div id="calendarMonthList"></div>
    </div></div></div>
    <div class="tab-pane fade" id="templates" role="tabpanel" aria-labelledby="templatesTab"><div class="row g-3" id="templateGrid"></div></div>
  </div>
  <div class="modal fade" id="wishModal" tabindex="-1" aria-labelledby="wishModalTitle"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title" id="wishModalTitle">Send Birthday Wish</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
    <div class="modal-body" id="birthdayWishForm">
      <div class="mb-3"><label class="form-label">Channel</label><select class="form-select" id="wishChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
      <div class="mb-3"><label class="form-label">Template</label><select class="form-select" id="wishTemplate"></select></div>
      <div class="mb-3"><label class="form-label">Schedule</label><input type="datetime-local" class="form-control" id="wishSchedule"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="sendWish(this)">Send Now</button></div>
  </div></div></div>`;

let allContacts = [], calDate = new Date(), birthdayTemplates = [], todayBirthdays = [];
let birthdayCountsByDay = {};
init();

async function init() {
  const [todayRes, upcomingRes, tmplRes] = await Promise.all([
    RMS.api.get('/contacts/birthdays?type=today'),
    RMS.api.get('/contacts/birthdays?type=upcoming'),
    RMS.api.get('/templates')
  ]);
  const today = todayRes?.data || [];
  todayBirthdays = today;
  const upcoming = upcomingRes?.data || [];
  allContacts = [...today, ...upcoming].filter(c => c.dob);

  document.getElementById('todayGrid').innerHTML = today.length ? today.map(c => birthdayCard(c)).join('') : '<div class="col-12"><div class="empty-state"><i class="bi bi-cake2 d-block"></i>No birthdays today</div></div>';
  document.querySelector('#upcomingTable tbody').innerHTML = upcoming.map(c => {
    const days = daysUntil(c.dob);
    return `<tr><td><div class="d-flex align-items-center gap-2"><div class="avatar">${RMS.utils.getInitials(c.firstName,c.lastName)}</div>${c.firstName} ${c.lastName}</div></td><td>${c.designation || '-'}</td><td>${RMS.utils.formatDate(c.dob)}</td><td>${c.city || '-'}</td><td><span class="badge bg-primary">${days} days</span></td><td><button type="button" class="btn btn-sm btn-primary" onclick="sendBirthdayWish('${c._id}', undefined, this)" aria-label="Send birthday wish"><i class="bi bi-send"></i></button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="text-center text-secondary">No upcoming birthdays</td></tr>';

  const templates = (tmplRes?.data || []).filter(t => t.type === 'birthday');
  birthdayTemplates = templates;
  document.getElementById('templateGrid').innerHTML = templates.map(t => `<div class="col-md-6"><div class="card"><div class="card-header">${t.name} ${t.isDefault?'<span class="badge bg-primary">Default</span>':''}</div><div class="card-body"><pre class="small bg-light p-3 rounded">${t.body}</pre><div class="mt-2">${(t.variables||[]).map(v=>`<span class="var-chip">{{${v}}}</span>`).join('')}</div></div></div></div>`).join('');
  document.getElementById('wishTemplate').innerHTML = templates.map(t => `<option value="${t._id}">${t.name}</option>`).join('');

  document.querySelector('[data-bs-target="#calendar"]')?.addEventListener('shown.bs.tab', loadCalendar);
  renderCalendar();
}

async function loadCalendar() {
  const month = calDate.getMonth() + 1;
  const res = await RMS.requests.run('birthdays:calendar', ({ signal }) =>
    RMS.api.get(`/contacts/birthdays/calendar?month=${month}`, { signal })
  );
  if (!res) return;
  birthdayCountsByDay = Object.fromEntries((res?.data || []).map(entry => [entry.day, entry.count]));
  renderCalendar();
}

function parseDob(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split('T')[0].split('-').map(Number);
  return { month: m - 1, day: d };
}

function getBirthdaysByDay(month) {
  const map = {};
  allContacts.forEach(c => {
    const p = parseDob(c.dob);
    if (!p || p.month !== month) return;
    if (!map[p.day]) map[p.day] = [];
    map[p.day].push(c);
  });
  return map;
}

function birthdayCard(c) {
  return `<div class="col-md-4"><div class="card"><div class="card-body text-center">
    <div class="avatar avatar-lg mx-auto mb-3" style="background:${RMS.utils.getAvatarColor(c.firstName)}">${RMS.utils.getInitials(c.firstName,c.lastName)}</div>
    <h5>${c.firstName} ${c.lastName}</h5><p class="text-secondary small">${RMS.utils.formatContactSubtitle(c)} · ${c.city || ''}</p>
    <div class="d-flex gap-2 justify-content-center mt-3">
      <button class="btn btn-primary btn-sm" onclick="sendBirthdayWish('${c._id}', 'email', this)"><i class="bi bi-envelope"></i> Email</button>
      <button class="btn btn-success btn-sm" onclick="sendBirthdayWish('${c._id}', 'whatsapp', this)"><i class="bi bi-whatsapp"></i> WhatsApp</button>
    </div></div></div></div>`;
}
function daysUntil(dob) {
  const today = new Date(); const d = new Date(dob);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear()+1);
  return Math.ceil((next-today)/86400000);
}
window.changeMonth = (dir) => { calDate.setMonth(calDate.getMonth() + dir); loadCalendar(); };

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calMonth');
  const monthList = document.getElementById('calendarMonthList');
  if (!grid || !monthLabel) return;

  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  monthLabel.textContent = calDate.toLocaleString('en', { month: 'long', year: 'numeric' });

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const birthdayMap = getBirthdaysByDay(m);

  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(d => `<div class="calendar-day header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const knownBirthdays = birthdayMap[d] || [];
    const count = birthdayCountsByDay[d] || knownBirthdays.length;
    const hasEvent = count > 0;
    const title = hasEvent ? `${count} birthday${count === 1 ? '' : 's'}` : '';
    html += `<button type="button" class="calendar-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}" title="${title}" aria-label="${monthLabel.textContent} ${d}${hasEvent ? `, ${count} birthday${count === 1 ? '' : 's'}` : ', no birthdays'}" onclick="showDayBirthdays(${d})">
      <span class="day-num">${d}</span>
      ${hasEvent ? `<span class="day-count">${count}</span>` : ''}
    </button>`;
  }

  grid.innerHTML = html;

  const monthContacts = Object.entries(birthdayMap)
    .sort(([a], [b]) => +a - +b)
    .flatMap(([, contacts]) => contacts);

  if (false && monthList) {
    monthList.innerHTML = monthContacts.length
      ? `<h6 class="fw-semibold mb-3"><i class="bi bi-cake2 me-2"></i>Birthdays in ${monthLabel.textContent} (${monthContacts.length})</h6>
         <div class="row g-2">${monthContacts.map(c => `
           <div class="col-md-6">
             <div class="d-flex align-items-center gap-2 p-2 border rounded">
               <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
               <div class="flex-grow-1">
                 <div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
                 <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatDate(c.dob)} · ${RMS.utils.formatContactSubtitle(c)}</div>
               </div>
               <button type="button" class="btn btn-sm btn-outline-primary" onclick="sendBirthdayWish('${c._id}', undefined, this)" aria-label="Send birthday wish"><i class="bi bi-send"></i></button>
             </div>
           </div>`).join('')}</div>`
      : `<div class="empty-state py-3"><i class="bi bi-calendar-x d-block"></i>No birthdays in ${monthLabel.textContent}</div>`;
  }
  if (monthList) {
    monthList.innerHTML = '<div class="text-secondary small py-2">Select a birthday date to view its contacts.</div>';
  }
}

window.showDayBirthdays = async (day) => {
  const count = birthdayCountsByDay[day] || 0;
  if (!count) return;
  const monthList = document.getElementById('calendarMonthList');
  monthList.innerHTML = '<div class="text-secondary small py-2">Loading birthdays…</div>';
  const res = await RMS.requests.run('birthdays:day', ({ signal }) =>
    RMS.api.get(`/contacts/birthdays/calendar?month=${calDate.getMonth() + 1}&day=${day}&page=1&limit=100`, { signal })
  );
  if (!res) return;
  const contacts = res?.data || [];
  const label = `${calDate.toLocaleString('en', { month: 'long' })} ${day}`;
  monthList.innerHTML = contacts.length
    ? `<h6 class="fw-semibold mb-3"><i class="bi bi-cake2 me-2"></i>Birthdays on ${label} (${count})</h6>
       <div class="row g-2">${contacts.map(c => `
         <div class="col-md-6"><div class="d-flex align-items-center gap-2 p-2 border rounded">
           <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
           <div class="flex-grow-1"><div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
             <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatContactSubtitle(c)}</div></div>
           <button type="button" class="btn btn-sm btn-outline-primary" onclick="sendBirthdayWish('${c._id}', undefined, this)" aria-label="Send birthday wish"><i class="bi bi-send"></i></button>
         </div></div>`).join('')}</div>`
    : `<div class="empty-state py-3"><i class="bi bi-calendar-x d-block"></i>No birthdays on ${label}</div>`;
};
window.sendBirthdayWish = async (contactId, channel, button) => {
  const tmpl = birthdayTemplates.find(t => t.isDefault) || birthdayTemplates[0];
  const schedule = RMS.datetime.fromLocalInput(document.getElementById('wishSchedule')?.value);
  await RMS.utils.queueDeliveryJob({
    name: `Birthday Wish — ${new Date().toLocaleDateString('en-IN')}`,
    type: 'birthday',
    channel: channel || document.getElementById('wishChannel')?.value || 'email',
    subject: tmpl?.subject || 'Happy Birthday {{Name}}!',
    body: tmpl?.body || 'Dear {{Name}}, wishing you a wonderful birthday!',
    contactIds: [contactId],
    ...schedule
  }, { button, pendingMessage: 'Sending…' });
};
window.sendWish = async (button) => {
  const contactIds = todayBirthdays.map(c => c._id);
  if (!contactIds.length) {
    return RMS.mutations.showValidationError('#birthdayWishForm', 'No birthdays today to send wishes');
  }
  const templateId = document.getElementById('wishTemplate').value;
  const tmpl = birthdayTemplates.find(t => t._id === templateId) || birthdayTemplates[0];
  const schedule = RMS.datetime.fromLocalInput(document.getElementById('wishSchedule').value);
  const job = await RMS.utils.queueDeliveryJob({
    name: `Birthday Wishes — ${new Date().toLocaleDateString('en-IN')}`,
    type: 'birthday',
    channel: document.getElementById('wishChannel').value,
    subject: tmpl?.subject || 'Happy Birthday {{Name}}!',
    body: tmpl?.body || 'Dear {{Name}}, wishing you a wonderful birthday!',
    contactIds,
    ...schedule
  }, { button, form: '#birthdayWishForm', pendingMessage: 'Sending…' });
  if (job) bootstrap.Modal.getInstance(document.getElementById('wishModal')).hide();
};
