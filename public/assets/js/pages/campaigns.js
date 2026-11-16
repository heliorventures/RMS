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
    <th>Campaign</th><th>Type</th><th>Channel</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Failed</th><th>Skipped</th><th>Actions</th>
  </tr></thead><tbody></tbody></table><p class="small text-secondary mb-0">Sent includes SMTP acceptance. Delivered requires a provider receipt; SMTP email does not provide one. Partial campaigns include failed or skipped recipients; open the delivery report for each reason.</p></div></div>
  <div class="modal fade" id="campaignModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title">Create Campaign</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><form id="campaignForm"><input type="hidden" id="campaignId">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">Campaign Name *</label><input class="form-control" id="campName" required></div>
        <div class="col-md-6"><label class="form-label">Type</label><select class="form-select" id="campType"><option value="birthday">Birthday</option><option value="festival">Festival</option><option value="invitation">Invitation</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms" disabled>SMS</option></select><div class="form-text" id="smsCapabilityReason">SMS provider is not configured</div></div>
        <div class="col-md-6"><label class="form-label">Channel</label><select class="form-select" id="campChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select></div>
        <div class="col-md-6"><p class="form-text">Save a draft to edit it later. Schedule creates the delivery job.</p></div>
        <div class="col-12"><label class="form-label">Content</label><textarea class="form-control" id="campContent" rows="4" placeholder="Use {{Name}}, {{City}}, {{Sector}} variables"></textarea></div>
        <div class="col-12"><label class="form-label" for="campAudience">Recipients</label><select id="campAudience" class="form-select"><option value="selected">Selected contacts, groups or filters</option><option value="all">All active contacts</option></select><div class="form-text">Birthday and anniversary campaigns only include matching dates on the scheduled day.</div></div>
        <div class="col-12" id="campRecipientPicker"><label class="form-label" for="campContactSearch">Find contacts</label><input type="search" id="campContactSearch" class="form-control" placeholder="Search by name or email"><div id="campContactResults" class="list-group my-2"></div><div id="campSelectedContacts" class="small mb-2"></div><label for="campGroups" class="form-label">Groups</label><select id="campGroups" class="form-select" multiple></select></div>
        <div class="col-md-6"><label class="form-label" for="campCities">Cities</label><input id="campCities" class="form-control" placeholder="Pune, Mumbai"><div class="form-text">Optional, comma separated. Filters narrow the chosen audience.</div></div>
        <div class="col-md-6"><label class="form-label" for="campSectors">Sectors</label><input id="campSectors" class="form-control" placeholder="Associates, Business"></div>
        <div class="col-12"><label class="form-label" for="campSchedule">Schedule</label><input type="datetime-local" class="form-control" id="campSchedule" min="1900-01-01T00:00" max="9999-12-31T23:59"><div class="form-text">Choose a future date and time to schedule delivery.</div></div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveCampaign(this)">Save Draft</button><button class="btn btn-success" onclick="scheduleCampaign(this)"><i class="bi bi-calendar-check"></i> Schedule</button></div>
  </div></div></div>`;

const selectedCampaignContacts = new Map();
let campaignRecipientVersion = 0;
let campaignSearchVersion = 0;
let campaignRecipientsReady = false;
const escapeCampaign = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function setCampaignRecipientsReady(ready) {
  campaignRecipientsReady = ready;
  for (const button of document.querySelectorAll('#campaignModal .modal-footer .btn-primary, #campaignModal .modal-footer .btn-success')) button.disabled = !ready;
  document.getElementById('campContactSearch').disabled = !ready;
  document.getElementById('campGroups').disabled = !ready;
}
document.getElementById('campAudience').addEventListener('change', () => document.getElementById('campRecipientPicker').classList.toggle('d-none', document.getElementById('campAudience').value === 'all'));
function renderCampaignContacts() {
  const target = document.getElementById('campSelectedContacts'); target.replaceChildren();
  for (const [id, name] of selectedCampaignContacts) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-sm btn-outline-secondary me-1 mb-1';
    button.textContent = `${name} ×`; button.setAttribute('aria-label', `Remove ${name}`);
    button.onclick = () => { selectedCampaignContacts.delete(id); renderCampaignContacts(); }; target.append(button);
  }
}
document.getElementById('campContactSearch').addEventListener('input', RMS.utils.debounce(async () => {
  const version = ++campaignSearchVersion;
  const query = document.getElementById('campContactSearch').value.trim();
  const target = document.getElementById('campContactResults'); target.replaceChildren();
  if (!query) return;
  try {
    const response = await RMS.api.get(`/contacts?search=${encodeURIComponent(query)}&limit=20`);
    if (version !== campaignSearchVersion) return;
    for (const contact of response.data || []) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'list-group-item list-group-item-action';
      button.textContent = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      button.onclick = () => { selectedCampaignContacts.set(String(contact._id), button.textContent); renderCampaignContacts(); }; target.append(button);
    }
  } catch (error) { if (version === campaignSearchVersion) target.textContent = error.message; }
}, 300));
async function loadCampaignRecipients(campaign = {}) {
  const version = ++campaignRecipientVersion; ++campaignSearchVersion;
  setCampaignRecipientsReady(false);
  const groups = document.getElementById('campGroups'); groups.replaceChildren();
  document.getElementById('campContactResults').replaceChildren();
  selectedCampaignContacts.clear();
  for (const id of campaign.recipients?.contacts || []) selectedCampaignContacts.set(String(id), String(id));
  renderCampaignContacts();
  try {
    const response = await RMS.api.get('/groups');
    if (version !== campaignRecipientVersion) return;
    for (const group of response.data || []) groups.add(new Option(group.name, group._id, false, (campaign.recipients?.groups || []).includes(group._id)));
    if (selectedCampaignContacts.size) {
      const contacts = await RMS.api.post('/contacts/bulk-lookup', { ids: [...selectedCampaignContacts.keys()] });
      if (version !== campaignRecipientVersion) return;
      for (const contact of contacts.data || []) selectedCampaignContacts.set(String(contact._id), `${contact.firstName} ${contact.lastName}`);
    }
    renderCampaignContacts(); setCampaignRecipientsReady(true);
  } catch (error) {
    if (version === campaignRecipientVersion) RMS.mutations.showValidationError('#campaignForm', `Recipients could not be loaded. Reopen the campaign to retry. ${error.message}`);
  }
}
document.getElementById('campaignModal').addEventListener('hidden.bs.modal', () => { ++campaignRecipientVersion; ++campaignSearchVersion; setCampaignRecipientsReady(false); });
function campaignAudienceData() {
  const values = id => [...new Set(document.getElementById(id).value.split(',').map(value => value.trim()).filter(Boolean))];
  return { audience: document.getElementById('campAudience').value, recipients: { contacts: [...selectedCampaignContacts.keys()], groups: [...document.getElementById('campGroups').selectedOptions].map(option => option.value), filters: { cities: values('campCities'), sectors: values('campSectors') } } };
}
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
      { data: 'name', render: name => `<span class="fw-semibold">${escapeCampaign(name)}</span>` },
      { data: 'type', render: type => `<span class="badge bg-primary-subtle text-primary">${escapeCampaign(type)}</span>` },
      { data: 'channel' },
      { data: 'status', render: status => RMS.utils.statusBadge(status) },
      { data: 'stats', render: stats => stats?.sent || 0 },
      { data: 'stats', render: (stats, type, campaign) => campaign.channel === 'email' && !(stats?.delivered > 0)
        ? (type === 'display' ? '<span class="text-secondary" title="SMTP confirms acceptance, not inbox delivery. Provider delivery receipts are unavailable for email.">Not tracked</span>' : '')
        : stats?.delivered || 0 },
      { data: 'stats', render: stats => stats?.failed || 0 },
      { data: 'stats', render: (stats, type, campaign) => stats?.skipped ?? (campaign.status === 'draft' ? 0 : (type === 'display' ? '<span class="text-secondary" title="This older campaign did not record skipped totals. Open its delivery report for recipient outcomes.">Not recorded</span>' : '')) },
      { data: null, orderable: false, render: campaign => `${campaign.status === 'draft' ? `<button type="button" class="btn btn-sm btn-outline-primary" onclick="editCampaign('${campaign._id}')" aria-label="Edit campaign"><i class="bi bi-pencil"></i></button>` : `<a class="btn btn-sm btn-outline-primary" href="/pages/delivery.html?campaignId=${campaign._id}" aria-label="View delivery report"><i class="bi bi-bar-chart"></i></a>`} <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteCampaign('${campaign._id}')" aria-label="Delete campaign"><i class="bi bi-trash"></i></button>` }
    ],
    pageLength: 10
  });
}

window.openCampaignModal = () => {
  document.getElementById('campaignForm').reset();
  document.getElementById('campaignId').value = '';
  document.querySelector('#campaignModal .modal-title').textContent = 'Create Campaign';
  RMS.mutations.clearFormErrors(document.getElementById('campaignForm'));
  document.getElementById('campAudience').dispatchEvent(new Event('change'));
  loadCampaignRecipients();
};

window.editCampaign = async id => {
  const res = await RMS.api.get(`/campaigns/${id}`);
  if (res.data?.status !== 'draft') return RMS.toast.show('Only draft campaigns can be edited', 'warning');
  window.openCampaignModal();
  document.getElementById('campaignId').value = id;
  document.querySelector('#campaignModal .modal-title').textContent = 'Edit Campaign';
  for (const [input, field] of [['campName', 'name'], ['campType', 'type'], ['campChannel', 'channel'], ['campContent', 'content']]) document.getElementById(input).value = res.data[field] || '';
  document.getElementById('campSchedule').value = RMS.datetime.toLocalInput(res.data.scheduledAt);
  document.getElementById('campAudience').value = res.data.audience || 'selected';
  document.getElementById('campAudience').dispatchEvent(new Event('change'));
  document.getElementById('campCities').value = (res.data.recipients?.filters?.cities || []).join(', ');
  document.getElementById('campSectors').value = (res.data.recipients?.filters?.sectors || []).join(', ');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('campaignModal')).show();
  await loadCampaignRecipients(res.data);
};

async function persistCampaign(data) {
  const id = document.getElementById('campaignId').value;
  const result = id ? await RMS.api.put(`/campaigns/${id}`, data) : await RMS.api.post('/campaigns', data);
  document.getElementById('campaignId').value = result.data._id;
  return result;
}

if (RMS.utils.queryParams().action === 'create') {
  window.openCampaignModal();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('campaignModal')).show();
}

window.saveCampaign = async (button) => {
  let schedule;
  try { schedule = RMS.datetime.fromLocalInput(document.getElementById('campSchedule').value); }
  catch (error) { return RMS.mutations.showValidationError('#campaignForm', error.message, '#campSchedule'); }
  const data = {
    name: document.getElementById('campName').value,
    type: document.getElementById('campType').value,
    channel: document.getElementById('campChannel').value,
    status: 'draft',
    content: document.getElementById('campContent').value,
    ...campaignAudienceData(),
    ...schedule
  };
  if (!data.name.trim()) return RMS.mutations.showValidationError('#campaignForm', 'Campaign name is required', '#campName');
  if (!campaignRecipientsReady) return RMS.mutations.showValidationError('#campaignForm', 'Wait for recipients to load before saving.');

  const result = await RMS.mutations.runMutation(button, () => persistCampaign(data), {
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
  let schedule;
  try { schedule = RMS.datetime.fromLocalInput(document.getElementById('campSchedule').value); }
  catch (error) { return RMS.mutations.showValidationError('#campaignForm', error.message, '#campSchedule'); }
  const data = {
    name: document.getElementById('campName').value,
    type: document.getElementById('campType').value,
    channel: document.getElementById('campChannel').value,
    status: 'draft',
    content: document.getElementById('campContent').value,
    ...campaignAudienceData(),
    ...schedule,
    stats: { total: 0, sent: 0, delivered: 0, failed: 0 }
  };
  if (!data.name.trim()) return RMS.mutations.showValidationError('#campaignForm', 'Campaign name is required', '#campName');
  if (!campaignRecipientsReady) return RMS.mutations.showValidationError('#campaignForm', 'Wait for recipients to load before scheduling.');
  if (!data.content.trim() && data.channel !== 'whatsapp') return RMS.mutations.showValidationError('#campaignForm', 'Campaign content is required', '#campContent');
  if (!schedule.scheduledAt || new Date(schedule.scheduledAt).getTime() <= Date.now()) return RMS.mutations.showValidationError('#campaignForm', 'Choose a future schedule date and time for this campaign.', '#campSchedule');
  if (data.audience !== 'all' && !data.recipients.contacts.length && !data.recipients.groups.length && !Object.values(data.recipients.filters).some(values => values.length)) return RMS.mutations.showValidationError('#campaignForm', 'Select at least one contact, group or filter, or explicitly choose all active contacts.', '#campAudience');

  let campaignSaved = false;
  const result = await RMS.mutations.runMutation(button, async () => {
    const selection = await RMS.utils.withWhatsAppTemplate({ channel: data.channel });
    const campaign = await persistCampaign(data);
    campaignSaved = true;
    return RMS.api.post('/delivery/jobs', {
      name: data.name,
      type: 'campaign',
      channel: data.channel,
      subject: data.name,
      body: data.content,
      campaignId: campaign.data._id,
      templateId: selection.templateId,
      audience: data.audience,
      contactIds: data.recipients.contacts,
      groupIds: data.recipients.groups,
      filters: data.recipients.filters,
      ...schedule
    });
  }, {
    form: '#campaignForm',
    pending: 'Scheduling…',
    success: (job) => {
      const total = job.data?.stats?.total ?? job.message;
      const skipped = job.data?.stats?.skipped || 0;
      const queueText = `Campaign queued — ${typeof total === 'number' ? (total - skipped) + ' messages' : total}${skipped ? `; ${skipped} skipped (see delivery report)` : ''}`;
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
