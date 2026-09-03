RMS.components.initLayout('/pages/campaigns.html', 'Campaign Management', 'Home / Campaigns');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#campaignModal" onclick="openCampaignModal()"><i class="bi bi-plus-lg me-1"></i> Create Campaign</button>`;
document.getElementById('pageBody').innerHTML = `
  <div class="row g-3 mb-4">
    <div class="col-md-3"><div class="stat-card primary"><div class="stat-icon primary"><i class="bi bi-megaphone"></i></div><div class="stat-value" id="totalCampaigns">0</div><div class="stat-label">Total Campaigns</div></div></div>
    <div class="col-md-3"><div class="stat-card success"><div class="stat-icon success"><i class="bi bi-check-circle"></i></div><div class="stat-value" id="completedCampaigns">0</div><div class="stat-label">Completed</div></div></div>
    <div class="col-md-3"><div class="stat-card warning"><div class="stat-icon warning"><i class="bi bi-clock"></i></div><div class="stat-value" id="scheduledCampaigns">0</div><div class="stat-label">Scheduled</div></div></div>
    <div class="col-md-3"><div class="stat-card info"><div class="stat-icon info"><i class="bi bi-file-earmark"></i></div><div class="stat-value" id="draftCampaigns">0</div><div class="stat-label">Drafts</div></div></div>
  </div>
  <div class="card"><div class="card-body"><table class="table w-100" id="campaignsTable"><thead><tr>
    <th>Campaign</th><th>Type</th><th>Channel</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Failed</th><th>Actions</th>
  </tr></thead><tbody></tbody></table></div></div>
  <div class="modal fade" id="campaignModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title">Create Campaign</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><form id="campaignForm">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">Campaign Name *</label><input class="form-control" id="campName" required></div>
        <div class="col-md-6"><label class="form-label">Type</label><select class="form-select" id="campType"><option value="birthday">Birthday</option><option value="festival">Festival</option><option value="invitation">Invitation</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms" disabled>SMS</option></select><div class="form-text" id="smsCapabilityReason">SMS provider is not configured</div></div>
        <div class="col-md-6"><label class="form-label">Channel</label><select class="form-select" id="campChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
        <div class="col-md-6"><label class="form-label">Status</label><select class="form-select" id="campStatus"><option value="draft">Draft</option><option value="scheduled">Scheduled</option></select></div>
        <div class="col-12"><label class="form-label">Content</label><textarea class="form-control" id="campContent" rows="4" placeholder="Use {{Name}}, {{City}}, {{Sector}} variables"></textarea></div>
        <div class="col-12"><label class="form-label">Schedule</label><input type="datetime-local" class="form-control" id="campSchedule"></div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveCampaign(this)">Save Draft</button><button class="btn btn-success" onclick="scheduleCampaign(this)"><i class="bi bi-calendar-check"></i> Schedule</button></div>
  </div></div></div>`;

loadCampaigns();
loadDeliveryCapabilities();

async function loadDeliveryCapabilities() {
  try {
    const response = await RMS.api.get('/delivery/capabilities');
    const sms = response?.data?.sms || { enabled: false, reason: 'SMS provider is not configured' };
    document.querySelector('#campType option[value="sms"]').disabled = !sms.enabled;
    const reason = document.getElementById('smsCapabilityReason');
    reason.textContent = sms.enabled ? 'SMS provider available' : (sms.reason || 'SMS provider is not configured');
    reason.classList.toggle('d-none', sms.enabled);
  } catch (error) {
    document.getElementById('smsCapabilityReason').textContent = error.message || 'Provider capabilities are unavailable';
  }
}
async function loadCampaigns() {
  const res = await RMS.api.get('/campaigns');
  const campaigns = res?.data || [];
  document.getElementById('totalCampaigns').textContent = campaigns.length;
  document.getElementById('completedCampaigns').textContent = campaigns.filter(c => c.status === 'completed').length;
  document.getElementById('scheduledCampaigns').textContent = campaigns.filter(c => c.status === 'scheduled').length;
  document.getElementById('draftCampaigns').textContent = campaigns.filter(c => c.status === 'draft').length;
  $('#campaignsTable').DataTable({
    data: campaigns,
    destroy: true,
    columns: [
      { data: 'name', render: name => `<span class="fw-semibold">${name}</span>` },
      { data: 'type', render: type => `<span class="badge bg-primary-subtle text-primary">${type}</span>` },
      { data: 'channel' },
      { data: 'status', render: status => RMS.utils.statusBadge(status) },
      { data: 'stats', render: stats => stats?.sent || 0 },
      { data: 'stats', render: stats => stats?.delivered || 0 },
      { data: 'stats', render: stats => stats?.failed || 0 },
      { data: null, orderable: false, render: campaign => `<a class="btn btn-sm btn-outline-primary" href="/pages/delivery.html?campaignId=${campaign._id}" aria-label="View delivery report"><i class="bi bi-bar-chart"></i></a> <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign('${campaign._id}')"><i class="bi bi-trash"></i></button>` }
    ],
    pageLength: 10
  });
}

window.openCampaignModal = () => {
  document.getElementById('campaignForm').reset();
  RMS.mutations.clearFormErrors(document.getElementById('campaignForm'));
};

window.saveCampaign = async (button) => {
  const data = {
    name: document.getElementById('campName').value,
    type: document.getElementById('campType').value,
    channel: document.getElementById('campChannel').value,
    status: 'draft',
    content: document.getElementById('campContent').value,
    stats: { total: 0, sent: 0, delivered: 0, failed: 0 }
  };
  if (!data.name.trim()) return RMS.mutations.showValidationError('#campaignForm', 'Campaign name is required', '#campName');

  const result = await RMS.mutations.runMutation(button, () => RMS.api.post('/campaigns', data), {
    form: '#campaignForm',
    pending: 'Saving…',
    success: 'Campaign saved as draft'
  });
  if (result.ok) {
    bootstrap.Modal.getInstance(document.getElementById('campaignModal')).hide();
    await loadCampaigns();
  }
};

window.scheduleCampaign = async (button) => {
  const schedule = RMS.datetime.fromLocalInput(document.getElementById('campSchedule').value);
  const data = {
    name: document.getElementById('campName').value,
    type: document.getElementById('campType').value,
    channel: document.getElementById('campChannel').value,
    status: 'scheduled',
    content: document.getElementById('campContent').value,
    ...schedule,
    stats: { total: 0, sent: 0, delivered: 0, failed: 0 }
  };
  if (!data.name.trim()) return RMS.mutations.showValidationError('#campaignForm', 'Campaign name is required', '#campName');

  let campaignSaved = false;
  const result = await RMS.mutations.runMutation(button, async () => {
    const campaign = await RMS.api.post('/campaigns', data);
    campaignSaved = true;
    return RMS.api.post('/delivery/jobs', {
      name: data.name,
      type: 'campaign',
      channel: data.channel,
      subject: data.name,
      body: data.content || 'Hello {{Name}}',
      campaignId: campaign.data._id,
      audience: 'all',
      ...schedule
    });
  }, {
    form: '#campaignForm',
    pending: 'Scheduling…',
    success: (job) => {
      const total = job.data?.stats?.total ?? job.message;
      const queueText = `Campaign queued — ${typeof total === 'number' ? total + ' messages' : total}`;
      return schedule.scheduledAt
        ? `${queueText}. Scheduled for ${RMS.datetime.format(schedule.scheduledAt, schedule.scheduleTimezone)}`
        : queueText;
    },
    error: (error) => campaignSaved ? `Campaign saved, but delivery queue failed: ${error.message}` : error.message
  });
  if (result.ok) {
    bootstrap.Modal.getInstance(document.getElementById('campaignModal')).hide();
    await loadCampaigns();
  }
};

window.deleteCampaign = (id) => RMS.components.confirmDelete(null, (button) => RMS.mutations.runMutation(button, async () => {
  await RMS.api.delete(`/campaigns/${id}`);
  await loadCampaigns();
}, {
  pending: 'Deleting…',
  success: 'Campaign deleted',
  errorTarget: '#rmsConfirmStatus'
}));
