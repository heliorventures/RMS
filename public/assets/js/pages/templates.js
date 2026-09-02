RMS.components.initLayout('/pages/templates.html', 'Template Management', 'Home / Templates');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#templateModal" onclick="openTemplateModal()"><i class="bi bi-plus-lg me-1"></i> New Template</button>`;
document.getElementById('pageBody').innerHTML = `
  <div class="card mb-4"><div class="card-body">
    <h6 class="mb-2">Reusable Variables</h6>
    <span class="var-chip" onclick="insertVar('Name')">{{Name}}</span>
    <span class="var-chip" onclick="insertVar('City')">{{City}}</span>
    <span class="var-chip" onclick="insertVar('Sector')">{{Sector}}</span>
    <span class="var-chip" onclick="insertVar('Birthday')">{{Birthday}}</span>
    <span class="var-chip" onclick="insertVar('Company')">{{Company}}</span>
    <span class="var-chip" onclick="insertVar('Designation')">{{Designation}}</span>
    <span class="var-chip" onclick="insertVar('Occupation')">{{Occupation}}</span>
    <span class="var-chip" onclick="insertVar('EventTitle')">{{EventTitle}}</span>
  </div></div>
  <ul class="nav nav-pills mb-4" id="typeTabs"></ul>
  <div class="row g-3" id="templateGrid"></div>
  <div class="modal fade" id="templateModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
    <div class="modal-header gradient"><h5 class="modal-title">Template Editor</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><form id="templateForm"><input type="hidden" id="templateId">
      <div class="row g-3">
        <div class="col-md-8"><label class="form-label">Template Name *</label><input class="form-control" id="tmplName" required></div>
        <div class="col-md-4"><label class="form-label">Type</label><select class="form-select" id="tmplType"><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="festival">Festival</option><option value="invitation">Invitation</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
        <div class="col-12"><label class="form-label">Subject</label><input class="form-control" id="tmplSubject"></div>
        <div class="col-12"><label class="form-label">Body *</label><textarea class="form-control" id="tmplBody" rows="8" required></textarea></div>
        <div class="col-12"><div class="form-check"><input class="form-check-input" type="checkbox" id="tmplDefault"><label class="form-check-label">Set as default for this type</label></div></div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveTemplate(this)">Save Template</button></div>
  </div></div></div>`;

const TYPES = ['all','birthday','anniversary','festival','invitation','email','whatsapp'];
let allTemplates = [], activeType = 'all';

document.getElementById('typeTabs').innerHTML = TYPES.map(t => `<li class="nav-item"><button class="nav-link ${t==='all'?'active':''}" onclick="filterType('${t}')">${t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)}</button></li>`).join('');
loadTemplates();

async function loadTemplates() {
  const res = await RMS.api.get('/templates');
  allTemplates = res?.data || [];
  renderTemplates();
}
function renderTemplates() {
  const filtered = activeType === 'all' ? allTemplates : allTemplates.filter(t => t.type === activeType);
  document.getElementById('templateGrid').innerHTML = filtered.map(t => `
    <div class="col-md-6"><div class="card h-100">
      <div class="card-header d-flex justify-content-between"><span>${t.name} ${t.isDefault?'<span class="badge bg-primary">Default</span>':''}</span><span class="badge bg-secondary">${t.type}</span></div>
      <div class="card-body"><p class="small fw-semibold">${t.subject||''}</p><pre class="small bg-light p-3 rounded" style="white-space:pre-wrap">${t.body}</pre>
      <div>${(t.variables||[]).map(v=>`<span class="var-chip">{{${v}}}</span>`).join('')}</div></div>
      <div class="card-footer bg-transparent"><button class="btn btn-sm btn-outline-primary" onclick="editTemplate('${t._id}')"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${t._id}')"><i class="bi bi-trash"></i></button></div>
    </div></div>`).join('');
}
window.filterType = (t) => { activeType = t; document.querySelectorAll('#typeTabs .nav-link').forEach((el,i) => el.classList.toggle('active', TYPES[i]===t)); renderTemplates(); };
window.openTemplateModal = () => { document.getElementById('templateForm').reset(); document.getElementById('templateId').value=''; };
window.insertVar = (v) => { const body = document.getElementById('tmplBody'); if(body){ body.value += `{{${v}}}`; body.focus(); } else RMS.toast.show(`Variable {{${v}}} copied`,'info'); };
window.saveTemplate = async (button) => {
  const data = { name: document.getElementById('tmplName').value, type: document.getElementById('tmplType').value, subject: document.getElementById('tmplSubject').value, body: document.getElementById('tmplBody').value, isDefault: document.getElementById('tmplDefault').checked, variables: ['Name','City','Sector','Company','Designation','Occupation'] };
  if (!data.name.trim()) return RMS.mutations.showValidationError('#templateForm', 'Template name is required', '#tmplName');
  if (!data.body.trim()) return RMS.mutations.showValidationError('#templateForm', 'Template body is required', '#tmplBody');
  const id = document.getElementById('templateId').value;
  const result = await RMS.mutations.runMutation(button, () => id
    ? RMS.api.put(`/templates/${id}`, data)
    : RMS.api.post('/templates', data), {
    form: '#templateForm',
    pending: 'Saving…',
    success: 'Template saved'
  });
  if (result.ok) {
    bootstrap.Modal.getInstance(document.getElementById('templateModal')).hide();
    await loadTemplates();
  }
};
window.editTemplate = (id) => {
  const t = allTemplates.find(x=>x._id===id); if(!t) return;
  document.getElementById('templateId').value = t._id;
  document.getElementById('tmplName').value = t.name;
  document.getElementById('tmplType').value = t.type;
  document.getElementById('tmplSubject').value = t.subject||'';
  document.getElementById('tmplBody').value = t.body;
  document.getElementById('tmplDefault').checked = t.isDefault;
  new bootstrap.Modal(document.getElementById('templateModal')).show();
};
window.deleteTemplate = (id) => RMS.components.confirmDelete(null, (button) => RMS.mutations.runMutation(button, async () => {
  await RMS.api.delete(`/templates/${id}`);
  await loadTemplates();
}, {
  pending: 'Deleting…',
  success: 'Template deleted',
  errorTarget: '#rmsConfirmStatus'
}));
