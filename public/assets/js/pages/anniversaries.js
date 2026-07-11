RMS.components.initLayout('/pages/anniversaries.html', 'Anniversary Module', 'Home / Anniversaries');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#wishModal"><i class="bi bi-send me-1"></i> Send Wishes</button>`;
document.getElementById('pageBody').innerHTML = `
  <ul class="nav nav-tabs mb-4"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#today">Today's Anniversaries</button></li>
  <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#upcoming">Upcoming</button></li>
  <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#templates">Templates</button></li></ul>
  <div class="tab-content">
    <div class="tab-pane fade show active" id="today"><div class="row g-3" id="todayGrid"></div></div>
    <div class="tab-pane fade" id="upcoming"><div class="card"><div class="card-body"><table class="table"><thead><tr><th>Contact</th><th>Designation</th><th>Anniversary</th><th>City</th><th>Actions</th></tr></thead><tbody id="upcomingBody"></tbody></table></div></div></div>
    <div class="tab-pane fade" id="templates"><div class="row g-3" id="templateGrid"></div></div>
  </div>
  <div class="modal fade" id="wishModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title">Send Anniversary Wish</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body">
      <div class="mb-3"><label class="form-label">Channel</label><select class="form-select" id="wishChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
      <div class="mb-3"><label class="form-label">Template</label><select class="form-select" id="wishTemplate"></select></div>
      <div class="mb-3"><label class="form-label">Schedule</label><input type="datetime-local" class="form-control" id="wishSchedule"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="sendAnniversaryWishes()">Send</button></div>
  </div></div></div>`;

let todayAnniversaries = [], anniversaryTemplates = [];

(async () => {
  const [todayRes, upcomingRes, tmplRes] = await Promise.all([
    RMS.api.get('/contacts/anniversaries?type=today'),
    RMS.api.get('/contacts/anniversaries?type=upcoming'),
    RMS.api.get('/templates')
  ]);
  todayAnniversaries = todayRes?.data || [];
  const upcoming = upcomingRes?.data || [];
  anniversaryTemplates = (tmplRes?.data || []).filter(t => t.type === 'anniversary');

  document.getElementById('todayGrid').innerHTML = todayAnniversaries.length ? todayAnniversaries.map(c => `
    <div class="col-md-4"><div class="card"><div class="card-body text-center">
      <div class="avatar avatar-lg mx-auto mb-3">${RMS.utils.getInitials(c.firstName,c.lastName)}</div>
      <h5>${c.firstName} ${c.lastName}</h5><p class="text-secondary">${RMS.utils.formatDate(c.anniversary)} · ${RMS.utils.formatContactSubtitle(c)}</p>
      <button class="btn btn-primary btn-sm mt-2" onclick="sendAnniversaryWish('${c._id}')"><i class="bi bi-heart"></i> Send Wish</button>
    </div></div></div>`).join('') : '<div class="col-12 empty-state"><i class="bi bi-heart d-block"></i>No anniversaries today</div>';
  document.getElementById('upcomingBody').innerHTML = upcoming.map(c => `<tr><td>${c.firstName} ${c.lastName}</td><td>${c.designation || '-'}</td><td>${RMS.utils.formatDate(c.anniversary)}</td><td>${c.city || '-'}</td><td><button class="btn btn-sm btn-outline-primary" onclick="sendAnniversaryWish('${c._id}')"><i class="bi bi-send"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-secondary">None upcoming</td></tr>';
  document.getElementById('templateGrid').innerHTML = anniversaryTemplates.map(t => `<div class="col-md-6"><div class="card"><div class="card-header">${t.name}</div><div class="card-body"><pre class="small bg-light p-3 rounded">${t.body}</pre></div></div></div>`).join('');
  document.getElementById('wishTemplate').innerHTML = anniversaryTemplates.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
})();

window.sendAnniversaryWish = async (contactId) => {
  const tmpl = anniversaryTemplates.find(t => t.isDefault) || anniversaryTemplates[0];
  await RMS.utils.queueDeliveryJob({
    name: `Anniversary Wish — ${new Date().toLocaleDateString('en-IN')}`,
    type: 'anniversary',
    channel: document.getElementById('wishChannel')?.value || 'email',
    subject: tmpl?.subject || 'Happy Anniversary {{Name}}!',
    body: tmpl?.body || 'Dear {{Name}}, warm wishes on your anniversary!',
    contactIds: [contactId]
  });
};

window.sendAnniversaryWishes = async () => {
  const contactIds = todayAnniversaries.map(c => c._id);
  if (!contactIds.length) {
    RMS.toast.show('No anniversaries today', 'warning');
    return;
  }
  const templateId = document.getElementById('wishTemplate').value;
  const tmpl = anniversaryTemplates.find(t => t._id === templateId) || anniversaryTemplates[0];
  const job = await RMS.utils.queueDeliveryJob({
    name: `Anniversary Wishes — ${new Date().toLocaleDateString('en-IN')}`,
    type: 'anniversary',
    channel: document.getElementById('wishChannel').value,
    subject: tmpl?.subject || 'Happy Anniversary {{Name}}!',
    body: tmpl?.body || 'Dear {{Name}}, warm wishes on your anniversary!',
    contactIds
  });
  if (job) bootstrap.Modal.getInstance(document.getElementById('wishModal')).hide();
};
