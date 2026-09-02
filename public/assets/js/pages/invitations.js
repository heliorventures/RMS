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
        <div class="col-md-3"><label class="form-label">Date</label><input type="date" class="form-control" id="eventDate"></div>
        <div class="col-md-3"><label class="form-label">Time</label><input type="time" class="form-control" id="eventTime"></div>
        <div class="col-12"><label class="form-label">Google Maps Link</label><input class="form-control" id="eventMaps" placeholder="https://maps.google.com/..."></div>
        <div class="col-md-6"><label class="form-label">Upload Image</label><input type="file" class="form-control" accept="image/*"></div>
        <div class="col-md-6"><label class="form-label">Upload PDF</label><input type="file" class="form-control" accept=".pdf"></div>
        <div class="col-md-6"><label class="form-label">Send via</label><select class="form-select" id="eventChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
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
loadEvents();

async function loadEvents() {
  const res = await RMS.api.get('/events');
  allEvents = res?.data || [];
  document.getElementById('eventsGrid').innerHTML = allEvents.map(e => `
    <div class="col-md-6 col-lg-4"><div class="card h-100">
      <div class="card-header d-flex justify-content-between"><span class="fw-semibold">${e.title}</span>${RMS.utils.statusBadge(e.status)}</div>
      <div class="card-body">
        <p class="small text-secondary mb-2">${(e.description||'').substring(0,80)}...</p>
        <p class="mb-1"><i class="bi bi-geo-alt text-primary me-2"></i>${e.venue||'TBD'}</p>
        <p class="mb-1"><i class="bi bi-calendar text-primary me-2"></i>${RMS.utils.formatDate(e.date)} ${e.time||''}</p>
        ${e.deliveryStats ? `<div class="mt-3 small"><span class="badge bg-success me-1">Email: ${e.deliveryStats.email?.delivered||0}</span><span class="badge bg-info">WhatsApp: ${e.deliveryStats.whatsapp?.delivered||0}</span></div>` : ''}
      </div>
      <div class="card-footer bg-transparent d-flex gap-1">
        <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="editEvent('${e._id}')"><i class="bi bi-pencil"></i> Edit</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="previewEventData('${e._id}')"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-success" onclick="sendEventById('${e._id}', this)"><i class="bi bi-send"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent('${e._id}')"><i class="bi bi-trash"></i></button>
      </div>
    </div></div>`).join('');
}
window.openEventModal = () => {
  RMS.mutations.clearFormErrors(document.getElementById('eventForm'));
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventModalTitle').textContent = 'Create Event / Invitation';
};

window.editEvent = async (id) => {
  let event = allEvents.find(e => e._id === id);
  if (!event) {
    const res = await RMS.api.get(`/events/${id}`);
    event = res?.data;
  }
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

  if (event.scheduledAt) {
    const d = new Date(event.scheduledAt);
    document.getElementById('eventSchedule').value = d.toISOString().slice(0, 16);
  } else {
    document.getElementById('eventSchedule').value = '';
  }

  new bootstrap.Modal(document.getElementById('eventModal')).show();
};

function eventFormData() {
  const title = document.getElementById('eventTitle').value.trim();
  const id = document.getElementById('eventId').value;
  const existing = id ? allEvents.find(e => e._id === id) : null;
  return {
    title,
    description: document.getElementById('eventDesc').value,
    venue: document.getElementById('eventVenue').value,
    date: document.getElementById('eventDate').value,
    time: document.getElementById('eventTime').value,
    mapsLink: document.getElementById('eventMaps').value,
    channel: document.getElementById('eventChannel').value,
    scheduledAt: document.getElementById('eventSchedule').value || null,
    status: existing?.status || 'draft',
    recipients: existing?.recipients || { contacts: [], groups: [], cities: [], sectors: [] },
    deliveryStats: existing?.deliveryStats
  };
}

async function persistEvent() {
  const id = document.getElementById('eventId').value;
  const data = eventFormData();
  const res = id
    ? await RMS.api.put(`/events/${id}`, data)
    : await RMS.api.post('/events', data);
  return res.data;
}

function validateEvent() {
  if (document.getElementById('eventTitle').value.trim()) return true;
  return RMS.mutations.showValidationError('#eventForm', 'Title is required', '#eventTitle');
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
    success: 'Invitation queued for delivery',
    error: (error) => {
      if (phase === 'queueing') return `Invitation saved, but delivery queue failed: ${error.message}`;
      if (phase === 'updating-status') return `Delivery was queued, but invitation status could not be updated: ${error.message}`;
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
    success: 'Invitation queued for delivery',
    error: (error) => phase === 'updating-status'
      ? `Delivery was queued, but invitation status could not be updated: ${error.message}`
      : error.message
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
    name: `Invitation: ${event.title}`,
    type: 'event',
    channel: event.channel || 'email',
    subject: event.title,
    body,
    contactIds: recipients.contacts || [],
    groupIds: recipients.groups || []
  };
  if (!payload.contactIds.length && !payload.groupIds.length) {
    payload.filters = {
      cities: recipients.cities || [],
      sectors: recipients.sectors || []
    };
    if (!payload.filters.cities.length && !payload.filters.sectors.length) {
      payload.audience = 'all';
    }
  }

  setPhase('queueing');
  const jobRes = await RMS.api.post('/delivery/jobs', payload);
  setPhase('updating-status');
  await RMS.api.put(`/events/${event._id}`, { status: 'scheduled' });
  return jobRes.data;
};

window.previewEvent = () => {
  document.getElementById('previewBody').innerHTML = `<div class="text-center p-4 border rounded"><h4>${document.getElementById('eventTitle').value||'Event Title'}</h4><p>${document.getElementById('eventDesc').value||''}</p><p><i class="bi bi-geo-alt"></i> ${document.getElementById('eventVenue').value||'Venue'}</p><p><i class="bi bi-calendar"></i> ${document.getElementById('eventDate').value} ${document.getElementById('eventTime').value}</p></div>`;
  new bootstrap.Modal(document.getElementById('previewModal')).show();
};
window.previewEventData = async (id) => {
  const res = await RMS.api.get(`/events/${id}`);
  const e = res?.data; if (!e) return;
  document.getElementById('previewBody').innerHTML = `<div class="text-center p-4 border rounded"><h4>${e.title}</h4><p>${e.description||''}</p><p>${e.venue}</p><p>${RMS.utils.formatDate(e.date)} ${e.time||''}</p></div>`;
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
