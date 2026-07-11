RMS.components.initLayout('/pages/festivals.html', 'Festival Module', 'Home / Festivals');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#festivalModal" onclick="openFestivalModal()"><i class="bi bi-plus-lg me-1"></i> Add Festival</button>`;
document.getElementById('pageBody').innerHTML = `
  <div class="row g-3" id="festivalGrid"></div>
  <div class="modal fade" id="festivalModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title" id="festivalModalTitle">Festival Master</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><form id="festivalForm"><input type="hidden" id="festivalId">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">Festival Name *</label><input class="form-control" id="festName" required></div>
        <div class="col-md-6"><label class="form-label">Date *</label><input type="date" class="form-control" id="festDate" required></div>
        <div class="col-md-6"><label class="form-label">Religion</label><select class="form-select" id="festReligion"><option>Hindu</option><option>Jain</option><option>Muslim</option><option>Christian</option><option>Sikh</option></select></div>
        <div class="col-md-6"><label class="form-label">Status</label><select class="form-select" id="festStatus"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option></select></div>
        <div class="col-12"><label class="form-label">Message</label><textarea class="form-control" id="festMessage" rows="3"></textarea></div>
        <div class="col-md-6"><label class="form-label">Filter by City</label><select class="form-select" id="festCity" multiple><option>Pune</option><option>Mumbai</option><option>Delhi</option><option>Bangalore</option></select></div>
        <div class="col-md-6"><label class="form-label">Filter by Sector</label><select class="form-select" id="festSector" multiple><option>Government</option><option>Builder</option><option>Consultant</option></select></div>
        <div class="col-12"><label class="form-label">Schedule Send</label><input type="datetime-local" class="form-control" id="festSchedule"></div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveFestival()">Save</button><button class="btn btn-success" onclick="sendFestival()"><i class="bi bi-send"></i> Send</button></div>
  </div></div></div>`;

let allFestivals = [];
loadFestivals();

async function loadFestivals() {
  const res = await RMS.api.get('/festivals');
  allFestivals = res?.data || [];
  document.getElementById('festivalGrid').innerHTML = allFestivals.map(f => `
    <div class="col-md-4"><div class="card h-100">
      <div class="card-header gradient d-flex justify-content-between"><span><i class="bi bi-stars me-2"></i>${f.name}</span>${RMS.utils.statusBadge(f.status)}</div>
      <div class="card-body">
        <p class="mb-2"><i class="bi bi-calendar me-2"></i>${RMS.utils.formatDate(f.date)}</p>
        <p class="mb-2"><i class="bi bi-bookmark me-2"></i>${f.religion}</p>
        <p class="small text-secondary">${(f.message||'').substring(0,100)}...</p>
        ${f.sentCount ? `<p class="small"><i class="bi bi-send me-1"></i>${f.sentCount} sent</p>` : ''}
      </div>
      <div class="card-footer bg-transparent d-flex gap-2">
        <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="editFestival('${f._id}')"><i class="bi bi-pencil"></i> Edit</button>
        <button class="btn btn-sm btn-success" onclick="sendFestivalById('${f._id}')"><i class="bi bi-send"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteFestival('${f._id}')"><i class="bi bi-trash"></i></button>
      </div>
    </div></div>`).join('');
}
window.openFestivalModal = () => {
  document.getElementById('festivalForm').reset();
  document.getElementById('festivalId').value = '';
  document.getElementById('festivalModalTitle').textContent = 'Add Festival';
};

window.editFestival = async (id) => {
  let festival = allFestivals.find(f => f._id === id);
  if (!festival) {
    const res = await RMS.api.get(`/festivals/${id}`);
    festival = res?.data;
  }
  if (!festival || !festival._id) {
    RMS.toast.show('Festival not found', 'error');
    return;
  }

  document.getElementById('festivalId').value = festival._id;
  document.getElementById('festivalModalTitle').textContent = 'Edit Festival';
  document.getElementById('festName').value = festival.name || '';
  document.getElementById('festDate').value = festival.date ? festival.date.split('T')[0] : '';
  document.getElementById('festReligion').value = festival.religion || 'Hindu';
  document.getElementById('festStatus').value = festival.status || 'draft';
  document.getElementById('festMessage').value = festival.message || '';

  const cities = festival.recipients?.cities || [];
  const sectors = festival.recipients?.sectors || [];
  Array.from(document.getElementById('festCity').options).forEach(opt => {
    opt.selected = cities.includes(opt.value);
  });
  Array.from(document.getElementById('festSector').options).forEach(opt => {
    opt.selected = sectors.includes(opt.value);
  });

  if (festival.scheduledAt) {
    const d = new Date(festival.scheduledAt);
    document.getElementById('festSchedule').value = d.toISOString().slice(0, 16);
  } else {
    document.getElementById('festSchedule').value = '';
  }

  new bootstrap.Modal(document.getElementById('festivalModal')).show();
};

window.sendFestival = async () => {
  const saved = await saveFestival(true);
  if (!saved) return;
  await queueFestivalDelivery(saved);
};

window.sendFestivalById = async (id) => {
  let festival = allFestivals.find(f => f._id === id);
  if (!festival) {
    const res = await RMS.api.get(`/festivals/${id}`);
    festival = res?.data;
  }
  if (!festival) return RMS.toast.show('Festival not found', 'error');
  await queueFestivalDelivery(festival);
};

async function queueFestivalDelivery(festival) {
  const filters = {
    cities: festival.recipients?.cities || [],
    sectors: festival.recipients?.sectors || [],
    religions: festival.recipients?.religions || (festival.religion ? [festival.religion] : [])
  };
  const job = await RMS.utils.queueDeliveryJob({
    name: `Festival: ${festival.name}`,
    type: 'festival',
    channel: 'both',
    subject: festival.name,
    body: festival.message || `Warm wishes on ${festival.name}, {{Name}}!`,
    filters
  });
  if (job) {
    await RMS.api.put(`/festivals/${festival._id}`, { status: 'scheduled', sentCount: job.stats?.total || 0 });
    loadFestivals();
  }
}

window.saveFestival = async (silent) => {
  const name = document.getElementById('festName').value.trim();
  if (!name) {
    RMS.toast.show('Festival name is required', 'warning');
    return null;
  }

  const citySelect = document.getElementById('festCity');
  const sectorSelect = document.getElementById('festSector');
  const data = {
    name,
    date: document.getElementById('festDate').value,
    religion: document.getElementById('festReligion').value,
    message: document.getElementById('festMessage').value,
    status: document.getElementById('festStatus').value,
    scheduledAt: document.getElementById('festSchedule').value || null,
    recipients: {
      cities: Array.from(citySelect.selectedOptions).map(o => o.value),
      sectors: Array.from(sectorSelect.selectedOptions).map(o => o.value),
      religions: [document.getElementById('festReligion').value],
      groups: []
    }
  };

  const id = document.getElementById('festivalId').value;
  const res = id
    ? await RMS.api.put(`/festivals/${id}`, data)
    : await RMS.api.post('/festivals', data);

  if (res?.success) {
    if (!silent) RMS.toast.show(id ? 'Festival updated' : 'Festival created');
    if (!silent) bootstrap.Modal.getInstance(document.getElementById('festivalModal')).hide();
    loadFestivals();
    return res.data;
  } else {
    RMS.toast.show(res?.message || 'Failed to save festival', 'error');
    return null;
  }
};

window.deleteFestival = (id) => RMS.components.confirmDelete('Delete this festival?', async () => {
  await RMS.api.delete(`/festivals/${id}`);
  RMS.toast.show('Festival deleted');
  loadFestivals();
});
