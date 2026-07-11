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
    <button class="btn btn-primary" onclick="location.href='/pages/contacts.html';setTimeout(()=>editContact('${c._id}'),500)"><i class="bi bi-pencil"></i> Edit</button>`;

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
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="pill" data-bs-target="#info">Information</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#timeline">Timeline</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#communication">Communication</button></li>
    </ul>

    <div class="tab-content">
      <div class="tab-pane fade show active" id="info">
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
      <div class="tab-pane fade" id="timeline">
        <div class="card"><div class="card-body"><div class="timeline">
          ${(c.timeline||[{action:'Created',description:'Contact profile created',date:c.createdAt,user:'System'}]).map(t => `
            <div class="timeline-item"><div class="fw-semibold">${t.action}</div><div class="text-secondary small">${t.description}</div><div class="time">${RMS.utils.formatDateTime(t.date)} · ${t.user||''}</div></div>`).join('')}
        </div></div></div>
      </div>
      <div class="tab-pane fade" id="communication">
        <div class="card"><div class="card-body p-0">
          ${comm.length ? comm.map(h => `<div class="d-flex gap-3 p-3 border-bottom">
            <div class="stat-icon primary" style="width:36px;height:36px"><i class="bi bi-${h.type==='email'?'envelope':h.type==='whatsapp'?'whatsapp':'chat'}"></i></div>
            <div class="flex-grow-1"><div class="fw-semibold">${h.subject||h.type}</div><div class="small text-secondary">${h.message}</div><div class="time">${RMS.utils.formatDateTime(h.sentAt)} · ${RMS.utils.statusBadge(h.status)}</div></div>
          </div>`).join('') : '<div class="empty-state"><i class="bi bi-chat-dots d-block"></i>No communication history</div>'}
        </div></div>
      </div>
    </div>`;
}

function infoItem(label, value) {
  return `<div class="info-item"><label>${label}</label><p>${value || '-'}</p></div>`;
}
