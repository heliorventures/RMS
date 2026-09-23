RMS.components.initLayout('/pages/contacts.html', 'Contact Profile', 'Home / Contacts / Profile');
const id = RMS.utils.queryParams().id;
if (!id) { document.getElementById('pageBody').innerHTML = '<div class="alert alert-warning">Contact not found</div>'; }
else loadProfile(id);

async function loadProfile(contactId) {
  const [contactRes, commRes] = await Promise.all([
    RMS.api.get(`/contacts/${contactId}`),
    RMS.api.get('/communication')
  ]);
  const c = contactRes?.data;
  if (!c) { document.getElementById('pageBody').innerHTML = '<div class="alert alert-warning">Contact not found</div>'; return; }
  const comm = (commRes?.data || []).filter(h => h.contactId === contactId);

  document.getElementById('pageActions').innerHTML = `
    <a href="/pages/contacts.html" class="btn btn-outline-secondary me-2"><i class="bi bi-arrow-left"></i> Back</a>
    <a href="/pages/labels.html?ids=${c._id}" class="btn btn-outline-primary me-2"><i class="bi bi-tag"></i> Print Label</a>
    <a class="btn btn-primary" href="/pages/contacts.html?edit=${c._id}"><i class="bi bi-pencil"></i> Edit</a>`;

  document.getElementById('pageBody').innerHTML = `
    <div class="profile-header mb-4">
      <div class="avatar avatar-lg">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
      <div class="flex-grow-1">
        <h2 class="mb-1">${c.firstName} ${c.lastName} ${c.status === 'VIP' ? '<span class="badge bg-warning text-dark ms-2">VIP</span>' : ''}</h2>
        <p class="mb-2 opacity-75">${c.designation || ''} ${c.company ? 'at ' + c.company : ''}</p>
        <div class="d-flex gap-3 flex-wrap">
          <span><i class="bi bi-telephone me-1"></i>${c.mobile || '-'}</span>
          <span><i class="bi bi-envelope me-1"></i>${c.email || '-'}</span>
          <span><i class="bi bi-geo-alt me-1"></i>${c.city || '-'}</span>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-light btn-sm"><i class="bi bi-envelope"></i> Email</button>
        <button class="btn btn-light btn-sm"><i class="bi bi-whatsapp"></i> WhatsApp</button>
      </div>
    </div>

    <ul class="nav nav-pills profile-tabs mb-4" role="tablist">
      <li class="nav-item" role="presentation"><button type="button" class="nav-link active" id="infoTab" role="tab" aria-controls="info" aria-selected="true" data-bs-toggle="pill" data-bs-target="#info">Information</button></li>
      <li class="nav-item" role="presentation"><button type="button" class="nav-link" id="timelineTab" role="tab" aria-controls="timeline" aria-selected="false" data-bs-toggle="pill" data-bs-target="#timeline">Timeline</button></li>
      <li class="nav-item" role="presentation"><button type="button" class="nav-link" id="communicationTab" role="tab" aria-controls="communication" aria-selected="false" data-bs-toggle="pill" data-bs-target="#communication">Communication</button></li>
    </ul>

    <div class="tab-content">
      <div class="tab-pane fade show active" id="info" role="tabpanel" aria-labelledby="infoTab">
        <div class="card"><div class="card-body">
          <div class="info-grid">
            ${infoItem('Gender', c.gender)} ${infoItem('Date of Birth', RMS.utils.formatDate(c.dob))}
            ${infoItem('Anniversary', RMS.utils.formatDate(c.anniversary))} ${infoItem('Religion', c.religion)}
            ${infoItem('Sector', c.sector)} ${infoItem('Occupation', c.occupation)}
            ${infoItem('Company', c.company)} ${infoItem('Designation', c.designation)}
            ${infoItem('WhatsApp', c.whatsapp)} ${infoItem('Address', c.address)}
            ${infoItem('State', c.state)} ${infoItem('Pincode', c.pincode)}
            ${infoItem('Status', c.status)} ${infoItem('Tags', (c.tags||[]).join(', ') || '-')}
          </div>
          ${c.notes ? `<hr><h6>Notes</h6><p class="text-secondary">${c.notes}</p>` : ''}
        </div></div>
      </div>
      <div class="tab-pane fade" id="timeline" role="tabpanel" aria-labelledby="timelineTab">
        <div class="card"><div class="card-body"><div class="timeline">
          ${(c.timeline||[{action:'Created',description:'Contact profile created',date:c.createdAt,user:'System'}]).map(t => `
            <div class="timeline-item"><div class="fw-semibold">${t.action}</div><div class="text-secondary small">${t.description}</div><div class="time">${RMS.utils.formatDateTime(t.date)} · ${t.user||''}</div></div>`).join('')}
        </div></div></div>
      </div>
      <div class="tab-pane fade" id="communication" role="tabpanel" aria-labelledby="communicationTab">
        <div class="card"><div class="card-body p-0">
          ${comm.length ? comm.map(h => `<div class="d-flex gap-3 p-3 border-bottom">
            <div class="stat-icon primary" style="width:36px;height:36px"><i class="bi bi-${h.type==='email'?'envelope':h.type==='whatsapp'?'whatsapp':'chat'}"></i></div>
            <div class="flex-grow-1"><div class="fw-semibold">${h.subject||h.type}</div><div class="small text-secondary">${h.message}</div><div class="time">${RMS.utils.formatDateTime(h.sentAt)} · ${RMS.utils.statusBadge(h.status)}</div></div>
          </div>`).join('') : '<div class="empty-state"><i class="bi bi-chat-dots d-block"></i>No communication history</div>'}
        </div></div>
      </div>
    </div>`;
  if (RMS.auth.isAdmin() && (c.whatsapp || c.mobile)) await renderWhatsAppConsent(contactId);
}

async function renderWhatsAppConsent(contactId) {
  const panel = document.createElement('div');
  panel.className = 'card mt-3';
  panel.innerHTML = '<div class="card-body" id="waConsentForm"><h6>WhatsApp permission</h6><p id="waConsentState" role="status">Loading...</p><label for="waConsentSource" class="form-label">Permission source or opt-out reason</label><input id="waConsentSource" class="form-control mb-2" maxlength="500" placeholder="For example: signup form, date and reference"><p class="small">Record permission only when the recipient has agreed to receive your messages. It applies to this phone number across all contacts. STOP replies withdraw permission automatically.</p><button class="btn btn-primary me-2" id="waConsentGrant" disabled>Record permission</button><button class="btn btn-outline-danger" id="waConsentWithdraw" disabled>Withdraw permission</button></div>';
  document.getElementById('info').append(panel);
  let phone;
  const reload = async () => {
    const response = await RMS.api.get(`/contacts/${contactId}/whatsapp-consent`);
    phone = response.data.phone;
    panel.querySelector('#waConsentState').textContent = `${phone}: ${response.data.status}${response.data.changedAt ? ` (${RMS.utils.formatDateTime(response.data.changedAt)})` : ''}`;
    panel.querySelectorAll('button').forEach(b => { b.disabled = false; });
  };
  try { await reload(); } catch (error) { panel.querySelector('#waConsentState').textContent = error.message; return; }
  for (const [selector, status] of [['#waConsentGrant', 'granted'], ['#waConsentWithdraw', 'withdrawn']]) {
    panel.querySelector(selector).addEventListener('click', async (event) => {
      const source = panel.querySelector('#waConsentSource').value.trim();
      if (!source) return RMS.mutations.showValidationError('#waConsentForm', 'Enter the permission source or opt-out reason.', '#waConsentSource');
      const result = await RMS.mutations.runMutation(event.currentTarget, () => RMS.api.put(`/contacts/${contactId}/whatsapp-consent`, { phone, status, source }), { form: '#waConsentForm', pending: 'Saving...', success: 'WhatsApp permission updated' });
      if (result.ok) await reload();
    });
  }
}

function infoItem(label, value) {
  return `<div class="info-item"><label>${label}</label><p>${value || '-'}</p></div>`;
}
