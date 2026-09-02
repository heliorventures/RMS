RMS.components.initLayout('/pages/delivery.html', 'Delivery Tracking', 'Home / Delivery');

let activeJobId = null;
let pollTimer = null;

document.getElementById('pageActions').innerHTML = `
  <button class="btn btn-outline-secondary" onclick="loadJobs()"><i class="bi bi-arrow-clockwise me-1"></i> Refresh</button>`;

document.getElementById('pageBody').innerHTML = `
  <div class="alert alert-light border mb-4">
    <strong><i class="bi bi-shield-check me-1"></i> Production delivery engine</strong>
    <p class="mb-0 small text-secondary">Bulk messages are queued, validated, sent in batches, retried on failure, and logged. Invalid emails are skipped automatically. Set <code>DELIVERY_DRY_RUN=true</code> for safe testing without SMTP.</p>
  </div>
  <div class="row g-4">
    <div class="col-lg-5">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-list-task me-2"></i>Delivery Jobs</span>
          <span class="badge bg-primary" id="jobCount">0</span>
        </div>
        <div class="card-body p-0" id="jobsList" style="max-height:520px;overflow-y:auto">
          <div class="p-4 text-secondary text-center">Loading jobs...</div>
        </div>
      </div>
    </div>
    <div class="col-lg-7">
      <div class="card mb-3" id="jobDetailCard" style="display:none">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-0" id="jobTitle">Job</h6>
            <small class="text-secondary" id="jobMeta"></small>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" id="retryBtn" onclick="retryFailed(this)"><i class="bi bi-arrow-repeat"></i> Retry Failed</button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert py-2 small d-none" id="retryStatus"></div>
          <div class="row g-2 mb-3" id="jobStats"></div>
          <div class="progress mb-2" style="height:10px">
            <div class="progress-bar bg-success" id="progDelivered" style="width:0%"></div>
            <div class="progress-bar bg-danger" id="progFailed" style="width:0%"></div>
            <div class="progress-bar bg-warning" id="progPending" style="width:0%"></div>
          </div>
          <p class="small text-secondary mb-0" id="jobProgressText"></p>
        </div>
      </div>
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-envelope-check me-2"></i>Message Log</span>
          <select class="form-select form-select-sm w-auto" id="statusFilter" onchange="loadJobMessages()">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead><tr><th>Contact</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Retries</th><th>Error</th></tr></thead>
            <tbody id="messagesBody"><tr><td colspan="6" class="text-center text-secondary py-4">Select a job</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;

loadJobs();

async function loadJobs() {
  const res = await RMS.api.get('/delivery/jobs?limit=30');
  const jobs = res?.data || [];
  document.getElementById('jobCount').textContent = jobs.length;

  if (!jobs.length) {
    document.getElementById('jobsList').innerHTML = '<div class="p-4 text-secondary text-center">No delivery jobs yet. Schedule a campaign to start.</div>';
    return;
  }

  document.getElementById('jobsList').innerHTML = jobs.map(j => {
    const s = j.stats || {};
    const pct = s.total ? Math.round(((s.delivered || 0) + (s.failed || 0) + (s.skipped || 0)) / s.total * 100) : 0;
    return `
      <button type="button" class="list-group-item list-group-item-action border-0 border-bottom py-3 ${activeJobId === j._id ? 'active' : ''}" onclick="selectJob('${j._id}')">
        <div class="d-flex justify-content-between align-items-start">
          <div class="text-start">
            <div class="fw-semibold">${j.name}</div>
            <small class="${activeJobId === j._id ? 'text-white-50' : 'text-secondary'}">${j.channel} · ${RMS.utils.formatDateTime(j.createdAt)}</small>
          </div>
          ${RMS.utils.statusBadge(j.status)}
        </div>
        <div class="progress mt-2" style="height:4px">
          <div class="progress-bar ${activeJobId === j._id ? 'bg-light' : 'bg-primary'}" style="width:${pct}%"></div>
        </div>
        <small class="${activeJobId === j._id ? 'text-white-50' : 'text-secondary'}">${s.delivered || 0} delivered · ${s.failed || 0} failed · ${s.pending || 0} pending</small>
      </button>`;
  }).join('');

  if (!activeJobId && jobs[0]) selectJob(jobs[0]._id);
  else if (activeJobId) refreshJobDetail(activeJobId);
}

window.selectJob = async (id) => {
  activeJobId = id;
  await refreshJobDetail(id);
  await loadJobMessages();
  loadJobs();
  startPolling();
};

async function refreshJobDetail(id) {
  const res = await RMS.api.get(`/delivery/jobs/${id}`);
  const job = res?.data;
  if (!job) return;

  const s = job.stats || {};
  document.getElementById('jobDetailCard').style.display = '';
  document.getElementById('jobTitle').textContent = job.name;
  document.getElementById('jobMeta').textContent = `${job.channel} · ${job.status} · Job ${job._id.slice(0, 8)}`;
  document.getElementById('retryBtn').disabled = !(s.failed > 0);

  document.getElementById('jobStats').innerHTML = [
    ['Total', s.total, 'primary'],
    ['Delivered', s.delivered, 'success'],
    ['Failed', s.failed, 'danger'],
    ['Skipped', s.skipped, 'secondary'],
    ['Pending', s.pending, 'warning']
  ].map(([label, val, color]) => `
    <div class="col"><div class="border rounded p-2 text-center">
      <div class="fw-bold text-${color}">${(val || 0).toLocaleString()}</div>
      <div class="small text-secondary">${label}</div>
    </div></div>`).join('');

  const total = s.total || 1;
  document.getElementById('progDelivered').style.width = `${((s.delivered || 0) / total) * 100}%`;
  document.getElementById('progFailed').style.width = `${((s.failed || 0) / total) * 100}%`;
  document.getElementById('progPending').style.width = `${((s.pending || 0) / total) * 100}%`;
  document.getElementById('jobProgressText').textContent = `${s.processed || 0} of ${s.total} processed · ${s.retrying || 0} retrying`;
}

async function loadJobMessages() {
  if (!activeJobId) return;
  const status = document.getElementById('statusFilter').value;
  const params = new URLSearchParams({ limit: 100 });
  if (status) params.set('status', status);
  const res = await RMS.api.get(`/delivery/jobs/${activeJobId}/messages?${params}`);
  const rows = res?.data || [];
  document.getElementById('messagesBody').innerHTML = rows.length
    ? rows.map(m => `<tr>
        <td>${m.contactName || '-'}</td>
        <td><span class="badge bg-secondary">${m.type}</span></td>
        <td class="small">${m.recipient || '-'}</td>
        <td>${RMS.utils.statusBadge(m.status)}</td>
        <td>${m.retryCount || 0}</td>
        <td class="small text-danger">${m.failureReason || m.error || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-secondary py-3">No messages</td></tr>';
}

window.retryFailed = async (button) => {
  if (!activeJobId) return;
  const result = await RMS.mutations.runMutation(
    button,
    () => RMS.api.post(`/delivery/jobs/${activeJobId}/retry-failed`, {}),
    {
      statusTarget: '#retryStatus',
      errorTarget: '#retryStatus',
      pending: 'Retrying…',
      success: (res) => res.message || 'Failed messages requeued'
    }
  );
  if (!result.ok) return;
  await refreshJobDetail(activeJobId);
  loadJobMessages();
  loadJobs();
};

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!activeJobId) return;
    await refreshJobDetail(activeJobId);
    loadJobMessages();
  }, 5000);
}

window.loadJobs = loadJobs;
