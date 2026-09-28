RMS.components.initLayout('/pages/invitations.html', 'Invitation Module', 'Home / Invitations');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#eventModal" onclick="openEventModal()"><i class="bi bi-plus-lg me-1"></i> Create Event</button>`;
document.getElementById('pageBody').innerHTML = `
  <div class="row g-3" id="eventsGrid"></div>
  <div class="modal fade" id="eventModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title" id="eventModalTitle">Create Event / Invitation</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><form id="eventForm"><input type="hidden" id="eventId">
      <div class="row g-3">
        <div class="col-12"><label class="form-label">Title *</label><input class="form-control" id="eventTitle" required></div>
        <div class="col-12"><label class="form-label">Description</label><textarea class="form-control" id="eventDesc" rows="2"></textarea></div>
        <div class="col-md-6"><label class="form-label">Venue</label><input class="form-control" id="eventVenue"></div>
        <div class="col-md-3"><label class="form-label">Date</label><input type="date" class="form-control" id="eventDate" min="1900-01-01" max="9999-12-31"></div>
        <div class="col-md-3"><label class="form-label">Time</label><input type="time" class="form-control" id="eventTime"></div>
        <div class="col-12"><label class="form-label">Google Maps Link</label><input type="url" class="form-control" id="eventMaps" placeholder="https://maps.google.com/..."></div>
        <div class="col-md-6"><label class="form-label" for="eventImage">Upload Image</label><input type="file" class="form-control" id="eventImage" name="eventImage" accept="image/*"></div>
        <div class="col-md-6"><label class="form-label" for="eventPdf">Upload PDF</label><input type="file" class="form-control" id="eventPdf" name="eventPdf" accept=".pdf"></div>
        <div class="col-md-6"><label class="form-label">Send via</label><select class="form-select" id="eventChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
        <div class="col-12 small" id="eventAttachments"></div>
        <div class="col-12"><label class="form-label" for="eventAudience">Recipients</label><select id="eventAudience" class="form-select"><option value="selected">Selected contacts or groups</option><option value="all">All active contacts</option></select></div>
        <div class="col-12" id="eventRecipientPicker"><label class="form-label" for="eventContactSearch">Find contacts</label><input type="search" id="eventContactSearch" class="form-control" placeholder="Search by name or email"><div id="eventContactResults" class="list-group my-2"></div><div id="eventSelectedContacts" class="small mb-2"></div><label for="eventGroups" class="form-label">Groups</label><select id="eventGroups" class="form-select" multiple aria-describedby="eventGroupsHint"></select><div class="form-text" id="eventGroupsHint">Select one or more groups, or choose individual contacts above.</div></div>
        <div class="col-md-6"><label class="form-label">Schedule</label><input type="datetime-local" class="form-control" id="eventSchedule"></div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-outline-primary" onclick="previewEvent()"><i class="bi bi-eye"></i> Preview</button><button class="btn btn-primary" onclick="saveEvent(this)">Save</button><button class="btn btn-success" onclick="sendEvent(this)"><i class="bi bi-send"></i> Send</button></div>
  </div></div></div>
  <div class="modal fade" id="previewModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-header"><h5 class="modal-title">Invitation Preview</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body" id="previewBody"></div>
  </div></div></div>`;

let allEvents = [];
let selectedEventContacts = new Map();
let recipientSearchVersion = 0;
let recipientLoadVersion = 0;
let recipientsReady = false;
function setRecipientReady(ready) {
  recipientsReady = ready;
  for (const button of document.querySelectorAll('#eventModal .modal-footer .btn-primary, #eventModal .modal-footer .btn-success, #eventSelectedContacts button')) button.disabled = !ready;
  document.getElementById('eventContactSearch').disabled = !ready;
  document.getElementById('eventGroups').disabled = !ready;
}
const escapeEvent = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
document.getElementById('eventAudience').addEventListener('change', () => {
  document.getElementById('eventRecipientPicker').classList.toggle('d-none', document.getElementById('eventAudience').value === 'all');
});
document.getElementById('eventContactSearch').addEventListener('input', RMS.utils.debounce(async () => {
  const version = ++recipientSearchVersion;
  const query = document.getElementById('eventContactSearch').value.trim();
  const target = document.getElementById('eventContactResults');
  if (!query) { target.replaceChildren(); return; }
  try {
    const res = await RMS.api.get(`/contacts?search=${encodeURIComponent(query)}&limit=20`);
    if (version !== recipientSearchVersion) return;
    target.replaceChildren();
    for (const contact of res.data || []) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'list-group-item list-group-item-action';
      button.textContent = `${contact.firstName} ${contact.lastName}`;
      button.onclick = () => { selectedEventContacts.set(contact._id, button.textContent); renderEventContacts(); };
      target.append(button);
    }
  } catch (error) { target.textContent = error.message; }
}, 300));
function renderEventContacts() {
  const target = document.getElementById('eventSelectedContacts'); target.replaceChildren();
  for (const [id, name] of selectedEventContacts) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-sm btn-outline-secondary me-1 mb-1';
    button.disabled = !recipientsReady;
    button.textContent = `${name} ×`; button.setAttribute('aria-label', `Remove ${name}`);
    button.onclick = () => { selectedEventContacts.delete(id); renderEventContacts(); }; target.append(button);
  }
}
async function loadEventRecipients(event = {}) {
  const version = ++recipientLoadVersion;
  ++recipientSearchVersion;
  setRecipientReady(false);
  const picker = document.getElementById('eventGroups'); picker.replaceChildren();
  document.getElementById('eventContactResults').replaceChildren();
  selectedEventContacts = new Map((event.recipients?.contacts || []).map(id => [String(id), String(id)]));
  renderEventContacts();
  try {
  const groups = await RMS.api.get('/groups');
  if (version !== recipientLoadVersion) return false;
  for (const group of groups.data || []) picker.add(new Option(group.name, group._id, false, (event.recipients?.groups || []).includes(group._id)));
  if (selectedEventContacts.size) {
    const contacts = await RMS.api.post('/contacts/bulk-lookup', { ids: [...selectedEventContacts.keys()] });
    if (version !== recipientLoadVersion) return false;
    for (const c of contacts.data || []) selectedEventContacts.set(c._id, `${c.firstName} ${c.lastName}`);
  }
  renderEventContacts();
  setRecipientReady(true);
  return true;
  } catch (error) {
    if (version === recipientLoadVersion) RMS.mutations.showValidationError('#eventForm', `Recipients could not be loaded. Reopen the invitation to retry. ${error.message}`);
    return false;
  }
}
document.getElementById('eventModal').addEventListener('hidden.bs.modal', () => { ++recipientLoadVersion; ++recipientSearchVersion; setRecipientReady(false); });
loadEvents();

async function loadEvents() {
  const res = await RMS.api.get('/events');
  allEvents = res?.data || [];
  document.getElementById('eventsGrid').innerHTML = allEvents.map(e => `
    <div class="col-md-6 col-lg-4"><div class="card h-100">
      <div class="card-header d-flex justify-content-between"><span class="fw-semibold">${escapeEvent(e.title)}</span>${RMS.utils.statusBadge(e.status)}</div>
      <div class="card-body">
        <p class="small text-secondary mb-2">${escapeEvent((e.description||'').substring(0,80))}...</p>
        <p class="mb-1"><i class="bi bi-geo-alt text-primary me-2"></i>${escapeEvent(e.venue||'TBD')}</p>
        <p class="mb-1"><i class="bi bi-calendar text-primary me-2"></i>${RMS.utils.formatDate(e.date)} ${escapeEvent(e.time)}</p>
        ${e.deliveryStats ? `<div class="mt-3 small"><span class="badge bg-success me-1">Email: ${e.deliveryStats.email?.delivered||0}</span><span class="badge bg-info">WhatsApp: ${e.deliveryStats.whatsapp?.delivered||0}</span></div>` : ''}
      </div>
      <div class="card-footer bg-transparent d-flex gap-1">
        <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="editEvent('${e._id}')"><i class="bi bi-pencil"></i> Edit</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="previewEventData('${e._id}')" aria-label="Preview invitation"><i class="bi bi-eye"></i></button>
        <button type="button" class="btn btn-sm btn-success" onclick="sendEventById('${e._id}', this)" aria-label="Send invitation"><i class="bi bi-send"></i></button>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteEvent('${e._id}')" aria-label="Delete invitation"><i class="bi bi-trash"></i></button>
      </div>
    </div></div>`).join('');
}
window.openEventModal = () => {
  RMS.mutations.clearFormErrors(document.getElementById('eventForm'));
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventModalTitle').textContent = 'Create Event / Invitation';
  document.getElementById('eventAttachments').replaceChildren();
  document.getElementById('eventContactResults').replaceChildren();
  selectedEventContacts.clear(); renderEventContacts();
  document.getElementById('eventAudience').dispatchEvent(new Event('change'));
  loadEventRecipients().catch(error => RMS.mutations.showValidationError('#eventForm', error.message));
};

window.editEvent = async (id) => {
  ++recipientLoadVersion; ++recipientSearchVersion;
  const editVersion = recipientLoadVersion;
  setRecipientReady(false);
  document.getElementById('eventGroups').replaceChildren();
  document.getElementById('eventForm').reset();
  RMS.mutations.clearFormErrors(document.getElementById('eventForm'));
  let event = allEvents.find(e => e._id === id);
  if (!event) {
    const res = await RMS.api.get(`/events/${id}`);
    event = res?.data;
  }
  if (editVersion !== recipientLoadVersion) return;
  if (!event || !event._id) {
    RMS.toast.show('Invitation not found', 'error');
    return;
  }

  document.getElementById('eventId').value = event._id;
  document.getElementById('eventModalTitle').textContent = 'Edit Invitation';
  document.getElementById('eventTitle').value = event.title || '';
  document.getElementById('eventDesc').value = event.description || '';
  document.getElementById('eventVenue').value = event.venue || '';
  document.getElementById('eventDate').value = event.date ? event.date.split('T')[0] : '';
  document.getElementById('eventTime').value = event.time || '';
  document.getElementById('eventMaps').value = event.mapsLink || '';
  document.getElementById('eventChannel').value = event.channel || 'email';
  document.getElementById('eventAudience').value = event.audience || 'selected';
  document.getElementById('eventAudience').dispatchEvent(new Event('change'));
  document.getElementById('eventAttachments').innerHTML = [event.invitationImage, event.invitationPdf].filter(url => /^\/uploads\/invitations\/[\w.-]+$/.test(url)).map(url => `<a class="me-3" href="${escapeEvent(url)}" target="_blank" rel="noopener">${url.endsWith('.pdf') ? 'Saved PDF' : 'Saved image'}</a>`).join('');

  if (event.scheduledAt) {
    document.getElementById('eventSchedule').value = RMS.datetime.toLocalInput(event.scheduledAt);
  } else {
    document.getElementById('eventSchedule').value = '';
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('eventModal')).show();
  await loadEventRecipients(event);
};

function eventFormData() {
  const title = document.getElementById('eventTitle').value.trim();
  const id = document.getElementById('eventId').value;
  const existing = id ? allEvents.find(e => e._id === id) : null;
  const schedule = RMS.datetime.fromLocalInput(document.getElementById('eventSchedule').value);
  return {
    title,
    description: document.getElementById('eventDesc').value,
    venue: document.getElementById('eventVenue').value,
    date: document.getElementById('eventDate').value,
    time: document.getElementById('eventTime').value,
    mapsLink: document.getElementById('eventMaps').value,
    channel: document.getElementById('eventChannel').value,
    audience: document.getElementById('eventAudience').value,
    ...schedule,
    status: existing?.status || 'draft',
    recipients: { contacts: [...selectedEventContacts.keys()], groups: [...document.getElementById('eventGroups').selectedOptions].map(option => option.value), cities: [], sectors: [] },
    deliveryStats: existing?.deliveryStats
  };
}

async function persistEvent() {
  const id = document.getElementById('eventId').value;
  const data = eventFormData();
  for (const [inputId, field] of [['eventImage', 'invitationImage'], ['eventPdf', 'invitationPdf']]) {
    const input = document.getElementById(inputId);
    if (!input.files?.[0]) continue;
    const form = new FormData(); form.append('file', input.files[0]);
    const uploaded = await RMS.api._fetch('/upload/invitations', { method: 'POST', body: form });
    data[field] = uploaded.url;
  }
  const res = id
    ? await RMS.api.put(`/events/${id}`, data)
    : await RMS.api.post('/events', data);
  document.getElementById('eventId').value = res.data._id;
  const saved = { ...data, ...res.data };
  allEvents = [...allEvents.filter(event => event._id !== saved._id), saved];
  document.getElementById('eventImage').value = ''; document.getElementById('eventPdf').value = '';
  return saved;
}

function validateEvent() {
  if (!recipientsReady) return RMS.mutations.showValidationError('#eventForm', 'Wait for recipients to load before saving or sending.');
  if (!document.getElementById('eventTitle').value.trim()) return RMS.mutations.showValidationError('#eventForm', 'Title is required', '#eventTitle');
  if (!document.getElementById('eventForm').reportValidity()) return false;
  const maps = document.getElementById('eventMaps').value.trim();
  if (maps && !/^https?:\/\//i.test(maps)) return RMS.mutations.showValidationError('#eventForm', 'Enter an http or https map URL', '#eventMaps');
  try { eventFormData(); } catch (error) { return RMS.mutations.showValidationError('#eventForm', error.message, '#eventSchedule'); }
  for (const id of ['eventImage', 'eventPdf']) if (document.getElementById(id).files?.[0]?.size > 10 * 1024 * 1024) return RMS.mutations.showValidationError('#eventForm', 'Each attachment must be 10 MB or smaller', `#${id}`);
  return true;
}

window.saveEvent = async (button) => {
  if (!validateEvent()) return;
  const isUpdate = Boolean(document.getElementById('eventId').value);
  const result = await RMS.mutations.runMutation(button, persistEvent, {
    form: '#eventForm',
    pending: 'Saving…',
    success: isUpdate ? 'Invitation updated' : 'Invitation created'
  });

  if (!result.ok) return;
  bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
  await loadEvents();
};

window.sendEvent = async (button) => {
  if (!validateEvent()) return;
  let phase = 'saving';
  const result = await RMS.mutations.runMutation(button, async () => {
    const saved = await persistEvent();
    const job = await queueEventDeliveryRaw(saved, nextPhase => { phase = nextPhase; });
    phase = 'complete';
    return job;
  }, {
    form: '#eventForm',
    pending: 'Sending…',
    success: (job) => RMS.utils.formatScheduleConfirmation(
      'Invitation queued for delivery',
      job.scheduledAt,
      job.scheduleTimezone
    ),
    error: (error) => {
      if (phase === 'queueing') return `Invitation saved, but delivery queue failed: ${error.message}`;
      return error.message;
    }
  });

  if (!result.ok) return;
  bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
  await loadEvents();
};

window.sendEventById = async (id, button) => {
  let phase = 'loading';
  const result = await RMS.mutations.runMutation(button, async () => {
    let event = allEvents.find(e => e._id === id);
    if (!event) {
      const res = await RMS.api.get(`/events/${id}`);
      event = res?.data;
    }
    if (!event) throw new Error('Invitation not found');
    return queueEventDeliveryRaw(event, nextPhase => { phase = nextPhase; });
  }, {
    pending: 'Sending…',
    success: (job) => RMS.utils.formatScheduleConfirmation(
      'Invitation queued for delivery',
      job.scheduledAt,
      job.scheduleTimezone
    ),
    error: (error) => error.message
  });
  if (result.ok) await loadEvents();
};

async function queueEventDeliveryRaw(event, setPhase = () => {}) {
  const body = [
    `You're invited: ${event.title}`,
    event.description || '',
    event.venue ? `Venue: ${event.venue}` : '',
    event.date ? `Date: ${RMS.utils.formatDate(event.date)} ${event.time || ''}` : '',
    event.mapsLink ? `Location: ${event.mapsLink}` : ''
  ].filter(Boolean).join('\n');

  const recipients = event.recipients || {};
  const payload = {
    eventId: event._id,
    name: `Invitation: ${event.title}`,
    type: 'event',
    channel: event.channel || 'email',
    subject: event.title,
    body,
    contactIds: recipients.contacts || [],
    groupIds: recipients.groups || [],
    scheduledAt: event.scheduledAt || null,
    scheduleTimezone: event.scheduleTimezone || RMS.datetime.browserTimezone()
  };
  if (!payload.contactIds.length && !payload.groupIds.length) {
    payload.filters = {
      cities: recipients.cities || [],
      sectors: recipients.sectors || []
    };
    if (!payload.filters.cities.length && !payload.filters.sectors.length) {
      payload.audience = event.audience || 'selected';
    }
  }

  if (event.audience === 'all') payload.audience = 'all';
  if (payload.audience !== 'all' && !payload.contactIds.length && !payload.groupIds.length && !payload.filters?.cities.length && !payload.filters?.sectors.length) throw new Error('Select at least one contact or group, or explicitly choose All active contacts.');

  setPhase('queueing');
  const jobRes = await RMS.api.post('/delivery/jobs', await RMS.utils.withWhatsAppTemplate(payload));
  return {
    ...jobRes.data,
    scheduledAt: payload.scheduledAt,
    scheduleTimezone: payload.scheduleTimezone
  };
};

window.previewEvent = () => {
  document.getElementById('previewBody').innerHTML = `<div class="text-center p-4 border rounded"><h4>${escapeEvent(document.getElementById('eventTitle').value||'Event Title')}</h4><p>${escapeEvent(document.getElementById('eventDesc').value)}</p><p><i class="bi bi-geo-alt"></i> ${escapeEvent(document.getElementById('eventVenue').value||'Venue')}</p><p><i class="bi bi-calendar"></i> ${escapeEvent(document.getElementById('eventDate').value)} ${escapeEvent(document.getElementById('eventTime').value)}</p></div>`;
  new bootstrap.Modal(document.getElementById('previewModal')).show();
};
window.previewEventData = async (id) => {
  const res = await RMS.api.get(`/events/${id}`);
  const e = res?.data; if (!e) return;
  document.getElementById('previewBody').innerHTML = `<div class="text-center p-4 border rounded"><h4>${escapeEvent(e.title)}</h4><p>${escapeEvent(e.description)}</p><p>${escapeEvent(e.venue)}</p><p>${RMS.utils.formatDate(e.date)} ${escapeEvent(e.time)}</p></div>`;
  new bootstrap.Modal(document.getElementById('previewModal')).show();
};
window.deleteEvent = (id) => RMS.components.confirmDelete(null, async (button) => {
  const result = await RMS.mutations.runMutation(button, () => RMS.api.delete(`/events/${id}`), {
    errorTarget: '#rmsConfirmStatus',
    pending: 'Deleting…',
    success: 'Invitation deleted'
  });
  if (result.ok) await loadEvents();
  return result;
});
