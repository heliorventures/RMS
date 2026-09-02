RMS.components.initLayout('/pages/contacts.html', 'Contact Management', 'Home / Contacts');
document.getElementById('pageActions').innerHTML = `
  <span class="badge bg-primary-subtle text-primary border border-primary-subtle me-2 px-3 py-2" id="contactTotalBadge">Loading...</span>
  <a href="/assets/templates/contacts-import-template.csv" download class="btn btn-outline-secondary">
    <i class="bi bi-file-earmark-spreadsheet me-1"></i> Download Template
  </a>
  <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#bulkUploadModal">
    <i class="bi bi-upload me-1"></i> Bulk Upload
  </button>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#contactModal" onclick="openContactModal()">
    <i class="bi bi-person-plus me-1"></i> Add Contact
  </button>`;

document.getElementById('pageBody').innerHTML = `
  <div class="alert alert-info border-0 shadow-sm mb-3">
    <div class="d-flex align-items-start gap-2">
      <i class="bi bi-info-circle fs-5"></i>
      <div>
        <strong>Bulk import up to 50,000+ contacts</strong>
        <p class="mb-0 small">Download the CSV template, fill in your contacts, and upload. RMS handles large datasets with server-side pagination and batch processing.</p>
      </div>
    </div>
  </div>
  <div class="filter-bar">
    <div class="row g-2 align-items-end">
      <div class="col-md-2"><label class="form-label small">City</label><select class="form-select form-select-sm" id="filterCity"><option value="">All Cities</option></select></div>
      <div class="col-md-2"><label class="form-label small">Sector</label><select class="form-select form-select-sm" id="filterSector"><option value="">All Sectors</option></select></div>
      <div class="col-md-2"><label class="form-label small">Religion</label><select class="form-select form-select-sm" id="filterReligion"><option value="">All</option></select></div>
      <div class="col-md-2"><label class="form-label small">Status</label><select class="form-select form-select-sm" id="filterStatus"><option value="">All</option><option>Active</option><option>Inactive</option><option>VIP</option></select></div>
      <div class="col-md-2"><button class="btn btn-outline-primary btn-sm w-100" onclick="applyFilters()"><i class="bi bi-funnel me-1"></i>Apply Filters</button></div>
      <div class="col-md-2"><button class="btn btn-outline-secondary btn-sm w-100" onclick="exportContacts()"><i class="bi bi-download me-1"></i>Export</button></div>
    </div>
  </div>
  <div class="card"><div class="card-body"><table class="table table-hover w-100" id="contactsTable"><thead><tr>
    <th>Contact</th><th>Designation</th><th>Mobile</th><th>Email</th><th>City</th><th>Sector</th><th>Religion</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody></tbody></table></div></div>

  <div class="modal fade" id="bulkUploadModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header gradient">
          <h5 class="modal-title"><i class="bi bi-upload me-2"></i>Bulk Upload Contacts</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="bulkUploadForm">
          <ol class="small text-secondary mb-3">
            <li>Download the <a href="/assets/templates/contacts-import-template.csv" download>CSV template</a></li>
            <li>Fill in contact details (First Name and Last Name are required)</li>
            <li>Upload the CSV file — supports 50,000+ contacts via batch import</li>
          </ol>
          <div class="mb-3">
            <label class="form-label">Select CSV file</label>
            <input type="file" class="form-control" id="bulkCsvFile" accept=".csv,text/csv">
          </div>
          <div id="bulkUploadProgress" class="d-none">
            <div class="d-flex justify-content-between small mb-1">
              <span id="bulkUploadStatus">Uploading...</span>
              <span id="bulkUploadPercent">0%</span>
            </div>
            <div class="progress mb-2" style="height:8px">
              <div class="progress-bar progress-bar-striped progress-bar-animated" id="bulkUploadBar" style="width:0%"></div>
            </div>
            <p class="small text-secondary mb-0" id="bulkUploadDetail"></p>
          </div>
          <div id="bulkUploadResult" class="d-none alert mb-0"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          <button class="btn btn-primary" id="bulkUploadBtn" onclick="startBulkUpload(this)">
            <i class="bi bi-cloud-upload me-1"></i> Upload Contacts
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="contactModal" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header gradient"><h5 class="modal-title" id="contactModalTitle">Add Contact</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <form id="contactForm">
            <input type="hidden" id="contactId">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">First Name *</label><input class="form-control" id="firstName" required></div>
              <div class="col-md-6"><label class="form-label">Last Name *</label><input class="form-control" id="lastName" required></div>
              <div class="col-md-4"><label class="form-label">Gender</label><select class="form-select" id="gender"><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div class="col-md-4"><label class="form-label">Date of Birth</label><input type="date" class="form-control" id="dob"></div>
              <div class="col-md-4"><label class="form-label">Anniversary</label><input type="date" class="form-control" id="anniversary"></div>
              <div class="col-md-6"><label class="form-label">Mobile</label><input class="form-control" id="mobile"></div>
              <div class="col-md-6"><label class="form-label">WhatsApp</label><input class="form-control" id="whatsapp"></div>
              <div class="col-md-6"><label class="form-label">Email</label><input type="email" class="form-control" id="email"></div>
              <div class="col-md-6"><label class="form-label">Religion</label><select class="form-select" id="religion"></select></div>
              <div class="col-md-6"><label class="form-label">Sector</label><select class="form-select" id="sector"></select></div>
              <div class="col-md-6"><label class="form-label">Occupation</label><input class="form-control" id="occupation"></div>
              <div class="col-md-6"><label class="form-label">Company</label><input class="form-control" id="company"></div>
              <div class="col-md-6"><label class="form-label">Designation</label><input class="form-control" id="designation"></div>
              <div class="col-md-4"><label class="form-label">City</label><select class="form-select" id="city"></select></div>
              <div class="col-md-4"><label class="form-label">State</label><input class="form-control" id="state"></div>
              <div class="col-md-4"><label class="form-label">Pincode</label><input class="form-control" id="pincode"></div>
              <div class="col-12"><label class="form-label">Address</label><textarea class="form-control" id="address" rows="2"></textarea></div>
              <div class="col-md-6"><label class="form-label">Tags (comma separated)</label><input class="form-control" id="tags"></div>
              <div class="col-md-6"><label class="form-label">Status</label><select class="form-select" id="status"><option>Active</option><option>Inactive</option><option>VIP</option></select></div>
              <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" id="notes" rows="2"></textarea></div>
            </div>
          </form>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveContact(this)">Save Contact</button></div>
      </div>
    </div>
  </div>`;

const CITIES = ['Pune','Mumbai','Delhi','Bangalore','Hyderabad','Ahmedabad'];
const SECTORS = ['Government','Supplier','Consultant','Builder','Friends','Associates','Flat Holder'];
const RELIGIONS = ['Hindu','Jain','Muslim','Christian','Sikh'];
const BATCH_SIZE = 1000;
let table;
let totalContacts = 0;
let activeFilters = { city: '', sector: '', religion: '', status: '' };

['city','filterCity'].forEach(id => { const el = document.getElementById(id); if (el) CITIES.forEach(c => { el.innerHTML += `<option>${c}</option>`; }); });
['sector','filterSector'].forEach(id => { const el = document.getElementById(id); if (el) SECTORS.forEach(s => { el.innerHTML += `<option>${s}</option>`; }); });
['religion','filterReligion'].forEach(id => { const el = document.getElementById(id); if (el) RELIGIONS.forEach(r => { el.innerHTML += `<option>${r}</option>`; }); });

initContactsTable();
updateContactTotal();

function buildContactRow(c) {
  return [
    `<div class="d-flex align-items-center gap-2"><div class="avatar" style="background:${RMS.utils.getAvatarColor(c.firstName)}">${RMS.utils.getInitials(c.firstName, c.lastName)}</div><div><a href="/pages/contact-profile.html?id=${c._id}" class="fw-semibold text-decoration-none">${c.firstName} ${c.lastName}</a><br><small class="text-secondary">${RMS.utils.formatContactSubtitle(c)}</small></div></div>`,
    c.designation || '-',
    c.mobile || '-',
    c.email || '-',
    c.city || '-',
    c.sector || '-',
    c.religion || '-',
    RMS.utils.statusBadge(c.status),
    `<div class="btn-group btn-group-sm"><a href="/pages/contact-profile.html?id=${c._id}" class="btn btn-outline-primary" title="View"><i class="bi bi-eye"></i></a><a href="/pages/labels.html?ids=${c._id}" class="btn btn-outline-secondary" title="Print label"><i class="bi bi-tag"></i></a><button class="btn btn-outline-secondary" onclick="editContact('${c._id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-outline-danger" onclick="deleteContact('${c._id}')"><i class="bi bi-trash"></i></button></div>`
  ];
}

function initContactsTable() {
  if (table) table.destroy();
  table = $('#contactsTable').DataTable({
    processing: true,
    serverSide: true,
    ajax(data, callback) {
      const page = Math.floor(data.start / data.length) + 1;
      const params = new URLSearchParams({
        page,
        limit: data.length,
        search: data.search.value || '',
        sort: 'firstName',
        order: 'asc'
      });
      Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });

      RMS.api.get(`/contacts?${params}`).then(res => {
        totalContacts = res?.pagination?.total || 0;
        updateContactTotal();
        callback({
          draw: data.draw,
          recordsTotal: totalContacts,
          recordsFiltered: totalContacts,
          data: (res?.data || []).map(buildContactRow)
        });
      });
    },
    columns: [
      { data: 0, orderable: false },
      { data: 1, orderable: false },
      { data: 2, orderable: false },
      { data: 3, orderable: false },
      { data: 4, orderable: false },
      { data: 5, orderable: false },
      { data: 6, orderable: false },
      { data: 7, orderable: false },
      { data: 8, orderable: false }
    ],
    pageLength: 25,
    lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
    order: []
  });

  const search = RMS.utils.queryParams().search;
  if (search) table.search(search).draw();
}

function updateContactTotal() {
  const el = document.getElementById('contactTotalBadge');
  if (!el) return;
  el.textContent = `${totalContacts.toLocaleString()} Contacts`;
}

function reloadTable() {
  if (table) table.ajax.reload();
  else initContactsTable();
}

window.openContactModal = () => {
  document.getElementById('contactForm').reset();
  document.getElementById('contactId').value = '';
  document.getElementById('contactModalTitle').textContent = 'Add Contact';
};

window.editContact = async (id) => {
  const res = await RMS.api.get(`/contacts/${id}`);
  const c = res?.data;
  if (!c) {
    RMS.toast.show('Contact not found', 'error');
    return;
  }
  document.getElementById('contactId').value = c._id;
  document.getElementById('contactModalTitle').textContent = 'Edit Contact';
  ['firstName','lastName','gender','mobile','whatsapp','email','religion','sector','occupation','company','designation','city','state','pincode','address','status','notes'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = c[f] || '';
  });
  if (c.dob) document.getElementById('dob').value = c.dob.split('T')[0];
  if (c.anniversary) document.getElementById('anniversary').value = c.anniversary.split('T')[0];
  if (c.tags) document.getElementById('tags').value = c.tags.join(', ');
  new bootstrap.Modal(document.getElementById('contactModal')).show();
};

window.saveContact = async (button) => {
  const id = document.getElementById('contactId').value;
  const data = {};
  ['firstName','lastName','gender','mobile','whatsapp','email','religion','sector','occupation','company','designation','city','state','pincode','address','status','notes','dob','anniversary'].forEach(f => {
    data[f] = document.getElementById(f).value || null;
  });
  data.tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean);
  data.country = 'India';
  if (!data.firstName?.trim() || !data.lastName?.trim()) {
    const field = !data.firstName?.trim() ? '#firstName' : '#lastName';
    return RMS.mutations.showValidationError('#contactForm', 'First and last name are required', field);
  }
  const result = await RMS.mutations.runMutation(button, () => id
    ? RMS.api.put(`/contacts/${id}`, data)
    : RMS.api.post('/contacts', data), {
    form: '#contactForm',
    pending: 'Saving…',
    success: id ? 'Contact updated' : 'Contact created'
  });
  if (result.ok) {
    bootstrap.Modal.getInstance(document.getElementById('contactModal')).hide();
    reloadTable();
  }
};

window.deleteContact = (id) => RMS.components.confirmDelete('Delete this contact?', (button) => RMS.mutations.runMutation(button, async () => {
  await RMS.api.delete(`/contacts/${id}`);
  reloadTable();
}, {
  pending: 'Deleting…',
  success: 'Contact deleted',
  errorTarget: '#rmsConfirmStatus'
}));

window.applyFilters = () => {
  activeFilters = {
    city: document.getElementById('filterCity').value,
    sector: document.getElementById('filterSector').value,
    religion: document.getElementById('filterReligion').value,
    status: document.getElementById('filterStatus').value
  };
  reloadTable();
};

window.exportContacts = async () => {
  RMS.toast.show('Preparing export...', 'info');
  const params = new URLSearchParams({ page: 1, limit: 50000, sort: 'firstName', order: 'asc' });
  Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const res = await RMS.api.get(`/contacts?${params}`);
  const rows = res?.data || [];
  RMS.utils.downloadCSV('contacts.csv', [
    ['First Name','Last Name','Designation','Company','Mobile','Email','City','Sector','Religion','Status'],
    ...rows.map(c => [c.firstName, c.lastName, c.designation, c.company, c.mobile, c.email, c.city, c.sector, c.religion, c.status])
  ]);
  RMS.toast.show(`Exported ${rows.length.toLocaleString()} contacts`);
};

window.startBulkUpload = async (button) => {
  const fileInput = document.getElementById('bulkCsvFile');
  const file = fileInput.files?.[0];
  if (!file) {
    return RMS.mutations.showValidationError('#bulkUploadForm', 'Please select a CSV file', '#bulkCsvFile');
  }

  const progressWrap = document.getElementById('bulkUploadProgress');
  const resultEl = document.getElementById('bulkUploadResult');
  progressWrap.classList.remove('d-none');
  resultEl.classList.add('d-none');
  const result = await RMS.mutations.runMutation(button, async () => {
    const text = await file.text();
    const rows = RMS.utils.parseCSV(text).map(RMS.utils.normalizeContactRow).filter(r => r.firstName && r.lastName);
    if (!rows.length) {
      throw new Error('No valid contacts found in file');
    }

    let imported = 0;
    let skipped = 0;
    const total = rows.length;
    const batches = Math.ceil(total / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const pct = Math.round(((i + 1) / batches) * 100);
      document.getElementById('bulkUploadBar').style.width = `${pct}%`;
      document.getElementById('bulkUploadPercent').textContent = `${pct}%`;
      document.getElementById('bulkUploadStatus').textContent = `Importing batch ${i + 1} of ${batches}...`;
      document.getElementById('bulkUploadDetail').textContent = `${imported.toLocaleString()} of ${total.toLocaleString()} contacts processed`;

      const res = await RMS.api.post('/contacts/bulk-import', { contacts: batch });
      imported += res.data?.inserted || batch.length;
      skipped += res.data?.skipped || 0;
    }
    return { imported, skipped };
  }, {
    form: '#bulkUploadForm',
    statusTarget: '#bulkUploadResult',
    errorTarget: '#bulkUploadResult',
    pending: 'Uploading…',
    success: ({ imported, skipped }) => `Successfully imported ${imported.toLocaleString()} contacts${skipped ? ` (${skipped} skipped)` : ''}.`
  });

  if (result.ok) {
    const { imported } = result.value;
    document.getElementById('bulkUploadBar').classList.remove('progress-bar-animated');
    document.getElementById('bulkUploadStatus').textContent = 'Import complete';
    document.getElementById('bulkUploadDetail').textContent = `${imported.toLocaleString()} contacts imported successfully`;
    fileInput.value = '';
    await reloadTable();
  }
};

document.getElementById('bulkUploadModal')?.addEventListener('hidden.bs.modal', () => {
  document.getElementById('bulkUploadProgress')?.classList.add('d-none');
  document.getElementById('bulkUploadResult')?.classList.add('d-none');
  document.getElementById('bulkUploadBar').style.width = '0%';
  document.getElementById('bulkUploadBar').classList.add('progress-bar-animated');
});
