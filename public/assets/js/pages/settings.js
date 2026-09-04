if (!RMS.auth.requireAdmin()) { /* redirected */ } else {
RMS.components.initLayout('/pages/settings.html', 'Settings', 'Home / Settings');



const PERMISSION_OPTIONS = [

  { id: 'all', label: 'Full access (all modules)' },

  { id: 'contacts', label: 'Contacts' },

  { id: 'groups', label: 'Groups' },

  { id: 'campaigns', label: 'Campaigns' },

  { id: 'delivery', label: 'Delivery' },

  { id: 'templates', label: 'Templates' },

  { id: 'reports', label: 'Reports' },

  { id: 'view_reports', label: 'View reports only' },

  { id: 'settings', label: 'Settings' },

  { id: 'festivals', label: 'Festivals' },

  { id: 'invitations', label: 'Invitations' },

  { id: 'labels', label: 'Labels' }

];



let allUsers = [];

let allRoles = [];



document.getElementById('pageBody').innerHTML = `

  <div class="row g-4">

    <div class="col-lg-3"><div class="card"><div class="card-body p-2">

      <nav class="nav flex-column settings-nav">

        <a class="nav-link active" data-bs-toggle="pill" href="#company"><i class="bi bi-building"></i>Company</a>

        <a class="nav-link" data-bs-toggle="pill" href="#smtp"><i class="bi bi-envelope-at"></i>SMTP</a>

        <a class="nav-link" data-bs-toggle="pill" href="#whatsapp"><i class="bi bi-whatsapp"></i>WhatsApp API</a>

        <a class="nav-link" data-bs-toggle="pill" href="#theme"><i class="bi bi-palette"></i>Theme</a>

        <a class="nav-link" data-bs-toggle="pill" href="#roles"><i class="bi bi-shield-lock"></i>Roles</a>

        <a class="nav-link" data-bs-toggle="pill" href="#users"><i class="bi bi-people"></i>Users</a>

      </nav>

    </div></div></div>

    <div class="col-lg-9"><div class="tab-content">

      <div class="tab-pane fade show active" id="company"><div class="card"><div class="card-header">Company Details</div><div class="card-body"><form id="companyForm">

        <div class="row g-3">

          <div class="col-md-6"><label class="form-label">Company Name</label><input class="form-control" id="compName"></div>

          <div class="col-md-6"><label class="form-label">Email</label><input class="form-control" id="compEmail"></div>

          <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="compPhone"></div>

          <div class="col-md-6"><label class="form-label">Website</label><input class="form-control" id="compWebsite"></div>

          <div class="col-12"><label class="form-label">Address</label><textarea class="form-control" id="compAddress" rows="2"></textarea></div>

          <div class="col-12"><label class="form-label" for="companyLogo">Logo</label><input type="file" class="form-control" id="companyLogo" name="companyLogo" accept="image/*"></div>

          <div class="col-12"><button type="button" class="btn btn-primary" onclick="saveSettings(this, 'company')">Save Company Details</button></div>

        </div>

      </form></div></div></div>

      <div class="tab-pane fade" id="smtp"><div class="card"><div class="card-header">SMTP Settings</div><div class="card-body" id="smtpForm">

        <div class="row g-3">

          <div class="col-md-6"><label class="form-label">SMTP Host</label><input class="form-control" id="smtpHost" placeholder="smtp.gmail.com"></div>

          <div class="col-md-6"><label class="form-label">Port</label><input class="form-control" id="smtpPort" type="number" value="587"></div>

          <div class="col-md-6"><label class="form-label">Username</label><input class="form-control" id="smtpUser"></div>

          <div class="col-md-6"><label class="form-label">Password</label><input class="form-control" id="smtpPass" type="password" placeholder="Leave blank to keep the stored credential"><small class="d-block text-secondary mt-1" id="smtpCredentialState" role="status"></small></div>

          <div class="col-md-6"><label class="form-label">From Email</label><input class="form-control" id="smtpFrom"></div>

          <div class="col-md-6"><label class="form-label">From Name</label><input class="form-control" id="smtpFromName"></div>

          <div class="col-12"><small class="d-block text-secondary mb-2">Port 587 uses STARTTLS; port 465 uses implicit TLS. The server can override this through SMTP_TLS_MODE.</small><button class="btn btn-primary" onclick="saveSettings(this, 'smtp')">Save SMTP</button> <button class="btn btn-outline-secondary" onclick="testSmtp(this)">Test Connection</button></div>

        </div>

      </div></div></div>

      <div class="tab-pane fade" id="whatsapp"><div class="card"><div class="card-header">WhatsApp API Settings</div><div class="card-body" id="whatsappForm">

        <div class="row g-3">

          <div class="col-12"><label class="form-label">API URL</label><input class="form-control" id="waUrl" placeholder="https://graph.facebook.com/v18.0"></div>

          <div class="col-md-6"><label class="form-label">API Key / Token</label><input class="form-control" id="waKey" type="password" placeholder="Leave blank to keep the stored credential"><small class="d-block text-secondary mt-1" id="whatsappCredentialState" role="status"></small></div>

          <div class="col-md-6"><label class="form-label">Phone Number ID</label><input class="form-control" id="waPhoneId"></div>

          <div class="col-12"><label class="form-label">Business Account ID</label><input class="form-control" id="waBusinessId"></div>

          <div class="col-12"><button class="btn btn-primary" onclick="saveSettings(this, 'whatsapp')">Save WhatsApp Settings</button></div>

        </div>

      </div></div></div>

      <div class="tab-pane fade" id="theme"><div class="card"><div class="card-header">Theme Settings</div><div class="card-body" id="themeForm">

        <div class="mb-3"><label class="form-label">Primary Color</label><input type="color" class="form-control form-control-color" id="themeColor" value="#2563eb"></div>

        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="darkMode"><label class="form-check-label">Dark Mode</label></div>

        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="autoBirthday" checked><label class="form-check-label">Auto Birthday Wishes</label></div>

        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="autoAnniversary" checked><label class="form-check-label">Auto Anniversary Wishes</label></div>

        <button class="btn btn-primary" onclick="saveSettings(this, 'theme')">Save Theme</button>

      </div></div></div>

      <div class="tab-pane fade" id="roles"><div class="card"><div class="card-header">Roles & Permissions</div><div class="card-body" id="rolesBody"></div></div></div>

      <div class="tab-pane fade" id="users"><div class="card">

        <div class="card-header d-flex justify-content-between align-items-center">

          <span>Users</span>

          <button class="btn btn-sm btn-primary" onclick="openUserModal()"><i class="bi bi-plus-lg me-1"></i> Add User</button>

        </div>

        <div class="card-body table-responsive">

          <table class="table align-middle mb-0">

            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="text-end">Actions</th></tr></thead>

            <tbody id="usersBody"></tbody>

          </table>

        </div>

      </div></div>

    </div></div></div>



  <div class="modal fade" id="userModal" tabindex="-1">

    <div class="modal-dialog"><div class="modal-content">

      <div class="modal-header gradient"><h5 class="modal-title" id="userModalTitle">Add User</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>

      <div class="modal-body" id="userForm">

        <input type="hidden" id="userId">

        <div class="mb-3"><label class="form-label">Full Name *</label><input class="form-control" id="userName" required></div>

        <div class="mb-3"><label class="form-label">Email *</label><input type="email" class="form-control" id="userEmail" required></div>

        <div class="mb-3"><label class="form-label" id="userPasswordLabel">Password *</label><input type="password" class="form-control" id="userPassword" minlength="12"><small class="text-secondary" id="userPasswordHint"></small></div>

        <div class="mb-3"><label class="form-label">Phone</label><input class="form-control" id="userPhone"></div>

        <div class="mb-3"><label class="form-label">Role</label><select class="form-select" id="userRole"><option value="admin">Admin</option><option value="manager">Manager</option><option value="user">User</option></select></div>

        <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="userActive" checked><label class="form-check-label">Active</label></div>

      </div>

      <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveUser(this)">Save User</button></div>

    </div></div></div>



  <div class="modal fade" id="roleModal" tabindex="-1">

    <div class="modal-dialog"><div class="modal-content">

      <div class="modal-header gradient"><h5 class="modal-title" id="roleModalTitle">Edit Role</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>

      <div class="modal-body" id="roleForm">

        <input type="hidden" id="roleOriginalName">

        <div class="mb-3"><label class="form-label">Role Name</label><input class="form-control" id="roleName"></div>

        <div class="mb-2"><label class="form-label">Permissions</label></div>

        <div id="rolePermissions"></div>

      </div>

      <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" onclick="saveRole(this)">Save Role</button></div>

    </div></div></div>`;



loadSettings();



async function loadSettings() {

  const res = await RMS.api.get('/settings');

  const s = res?.data || {};

  const c = s.company || {}, smtp = s.smtp || {}, wa = s.whatsapp || {}, theme = s.theme || {};

  document.getElementById('compName').value = c.name || '';

  document.getElementById('compEmail').value = c.email || '';

  document.getElementById('compPhone').value = c.phone || '';

  document.getElementById('compWebsite').value = c.website || '';

  document.getElementById('compAddress').value = c.address || '';

  document.getElementById('smtpHost').value = smtp.host || '';

  document.getElementById('smtpPort').value = smtp.port || 587;

  document.getElementById('smtpUser').value = smtp.user || '';

  document.getElementById('smtpPass').value = '';

  document.getElementById('smtpCredentialState').textContent = smtp.configured
    ? 'Credential configured. Leave blank to keep it.'
    : 'No credential configured.';

  document.getElementById('smtpFrom').value = smtp.fromEmail || '';

  document.getElementById('smtpFromName').value = smtp.fromName || '';

  document.getElementById('waUrl').value = wa.apiUrl || '';

  document.getElementById('waKey').value = '';

  document.getElementById('whatsappCredentialState').textContent = wa.configured
    ? 'Credential configured. Leave blank to keep it.'
    : 'No credential configured.';

  document.getElementById('waPhoneId').value = wa.phoneNumberId || '';

  document.getElementById('waBusinessId').value = wa.businessAccountId || '';

  document.getElementById('themeColor').value = theme.primaryColor || '#2563eb';

  document.getElementById('darkMode').checked = theme.darkMode || false;

  document.getElementById('autoBirthday').checked = s.autoBirthdayWish !== false;

  allRoles = s.roles || [];

  renderRoles();

  await loadUsers();

}



async function loadUsers() {

  const usersRes = await RMS.api.get('/settings/users');

  allUsers = usersRes?.data || [];

  renderUsers();

}



function renderRoles() {

  document.getElementById('rolesBody').innerHTML = allRoles.length

    ? allRoles.map(r => `

      <div class="d-flex justify-content-between align-items-center p-3 border rounded mb-2">

        <div>

          <strong>${r.name}</strong>

          <div class="small text-secondary">${(r.permissions || []).join(', ') || 'No permissions'}</div>

        </div>

        <button class="btn btn-sm btn-outline-primary" onclick="editRole('${encodeURIComponent(r.name)}')"><i class="bi bi-pencil"></i> Edit</button>

      </div>`).join('')

    : '<p class="text-secondary mb-0">No roles configured.</p>';

}



function renderUsers() {

  const currentUser = RMS.auth.getUser();

  document.getElementById('usersBody').innerHTML = allUsers.length

    ? allUsers.map(u => `

      <tr>

        <td>${u.name}</td>

        <td>${u.email}</td>

        <td><span class="badge bg-primary">${u.role}</span></td>

        <td>${u.isActive !== false ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>

        <td class="text-end">

          <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="editUser('${u._id}')" aria-label="Edit user"><i class="bi bi-pencil"></i></button>

          ${currentUser?._id !== u._id && u.isActive !== false

            ? `<button type="button" class="btn btn-sm btn-outline-danger" onclick="deactivateUser('${u._id}')" aria-label="Deactivate user"><i class="bi bi-person-x"></i></button>`

            : ''}

        </td>

      </tr>`).join('')

    : '<tr><td colspan="5" class="text-center text-secondary py-4">No users found</td></tr>';

}



window.openUserModal = () => {

  RMS.mutations.clearFormErrors(document.getElementById('userForm'));

  document.getElementById('userModalTitle').textContent = 'Add User';

  document.getElementById('userId').value = '';

  document.getElementById('userName').value = '';

  document.getElementById('userEmail').value = '';

  document.getElementById('userPassword').value = '';

  document.getElementById('userPhone').value = '';

  document.getElementById('userRole').value = 'user';

  document.getElementById('userActive').checked = true;

  document.getElementById('userPasswordLabel').textContent = 'Password *';

  document.getElementById('userPassword').required = true;

  document.getElementById('userPasswordHint').textContent = 'Minimum 12 characters';

  new bootstrap.Modal(document.getElementById('userModal')).show();

};



window.editUser = (id) => {

  const user = allUsers.find(u => u._id === id);

  if (!user) return RMS.toast.show('User not found', 'error');

  RMS.mutations.clearFormErrors(document.getElementById('userForm'));



  document.getElementById('userModalTitle').textContent = 'Edit User';

  document.getElementById('userId').value = user._id;

  document.getElementById('userName').value = user.name || '';

  document.getElementById('userEmail').value = user.email || '';

  document.getElementById('userPassword').value = '';

  document.getElementById('userPhone').value = user.phone || '';

  document.getElementById('userRole').value = user.role || 'user';

  document.getElementById('userActive').checked = user.isActive !== false;

  document.getElementById('userPasswordLabel').textContent = 'New Password';

  document.getElementById('userPassword').required = false;

  document.getElementById('userPasswordHint').textContent = 'Leave blank to keep current password';

  new bootstrap.Modal(document.getElementById('userModal')).show();

};



window.saveUser = async (button) => {

  const id = document.getElementById('userId').value;

  const payload = {

    name: document.getElementById('userName').value.trim(),

    email: document.getElementById('userEmail').value.trim(),

    phone: document.getElementById('userPhone').value.trim(),

    role: document.getElementById('userRole').value,

    isActive: document.getElementById('userActive').checked

  };

  const password = document.getElementById('userPassword').value;



  if (!payload.name || !payload.email) {
    const field = !payload.name ? '#userName' : '#userEmail';
    return RMS.mutations.showValidationError('#userForm', 'Name and email are required', field);

  }

  if (!id && (!password || password.length < 12)) {
    return RMS.mutations.showValidationError('#userForm', 'Password must be at least 12 characters', '#userPassword');

  }

  if (password) payload.password = password;



  const result = await RMS.mutations.runMutation(
    button,
    () => id
      ? RMS.api.put(`/settings/users/${id}`, payload)
      : RMS.api.post('/settings/users', payload),
    {
      form: '#userForm',
      pending: 'Saving…',
      success: (res) => res.message || (id ? 'User updated' : 'User created')
    }
  );

  if (!result.ok) return;
  bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
  await loadUsers();

};



window.deactivateUser = (id) => {

  RMS.components.confirmDelete('Deactivate this user? They will no longer be able to login.', async (button) => {
    const result = await RMS.mutations.runMutation(button, () => RMS.api.delete(`/settings/users/${id}`), {
      errorTarget: '#rmsConfirmStatus',
      pending: 'Deactivating…',
      success: 'User deactivated'
    });
    if (result.ok) await loadUsers();
    return result;
  });

};



window.editRole = (encodedName) => {

  const roleName = decodeURIComponent(encodedName);

  const role = allRoles.find(r => r.name === roleName);

  if (!role) return RMS.toast.show('Role not found', 'error');

  RMS.mutations.clearFormErrors(document.getElementById('roleForm'));



  document.getElementById('roleModalTitle').textContent = `Edit Role — ${role.name}`;

  document.getElementById('roleOriginalName').value = role.name;

  document.getElementById('roleName').value = role.name;

  document.getElementById('rolePermissions').innerHTML = PERMISSION_OPTIONS.map(p => `

    <div class="form-check mb-2">

      <input class="form-check-input role-perm" type="checkbox" value="${p.id}" id="perm_${p.id}"

        ${(role.permissions || []).includes(p.id) ? 'checked' : ''}

        ${(role.permissions || []).includes('all') && p.id !== 'all' ? 'disabled' : ''}>

      <label class="form-check-label" for="perm_${p.id}">${p.label}</label>

    </div>`).join('');



  document.querySelectorAll('.role-perm').forEach(cb => {

    cb.addEventListener('change', () => {

      const allCb = document.getElementById('perm_all');

      if (cb.value === 'all' && cb.checked) {

        document.querySelectorAll('.role-perm:not(#perm_all)').forEach(x => { x.checked = false; x.disabled = true; });

      } else if (cb.value === 'all' && !cb.checked) {

        document.querySelectorAll('.role-perm:not(#perm_all)').forEach(x => { x.disabled = false; });

      } else if (cb.checked && allCb) {

        allCb.checked = false;

      }

    });

  });



  new bootstrap.Modal(document.getElementById('roleModal')).show();

};



window.saveRole = async (button) => {

  const roleName = document.getElementById('roleOriginalName').value;

  const name = document.getElementById('roleName').value.trim();

  const permissions = [...document.querySelectorAll('.role-perm:checked')].map(cb => cb.value);



  if (!name) {
    return RMS.mutations.showValidationError('#roleForm', 'Role name is required', '#roleName');

  }

  if (!permissions.length) {
    return RMS.mutations.showValidationError('#roleForm', 'Select at least one permission');

  }



  const result = await RMS.mutations.runMutation(
    button,
    () => RMS.api.put('/settings/roles', { roleName, name, permissions }),
    { form: '#roleForm', pending: 'Saving…', success: 'Role updated successfully' }
  );
  if (!result.ok) return;

  bootstrap.Modal.getInstance(document.getElementById('roleModal')).hide();
  const settingsRes = await RMS.api.get('/settings');
  allRoles = settingsRes?.data?.roles || [];
  renderRoles();

};



function settingsPayload(section) {
  if (section === 'company') return { company: { name: document.getElementById('compName').value, email: document.getElementById('compEmail').value, phone: document.getElementById('compPhone').value, website: document.getElementById('compWebsite').value, address: document.getElementById('compAddress').value } };
  if (section === 'smtp') {
    const smtp = { host: document.getElementById('smtpHost').value, port: +document.getElementById('smtpPort').value, user: document.getElementById('smtpUser').value, fromEmail: document.getElementById('smtpFrom').value, fromName: document.getElementById('smtpFromName').value };
    const password = document.getElementById('smtpPass').value;
    if (password.trim()) smtp.password = password;
    return { smtp };
  }
  if (section === 'whatsapp') {
    const whatsapp = { apiUrl: document.getElementById('waUrl').value, phoneNumberId: document.getElementById('waPhoneId').value, businessAccountId: document.getElementById('waBusinessId').value };
    const apiKey = document.getElementById('waKey').value;
    if (apiKey.trim()) whatsapp.apiKey = apiKey;
    return { whatsapp };
  }
  if (section === 'theme') return { theme: { primaryColor: document.getElementById('themeColor').value, darkMode: document.getElementById('darkMode').checked }, autoBirthdayWish: document.getElementById('autoBirthday').checked, autoAnniversaryWish: document.getElementById('autoAnniversary').checked };
  throw new Error('Unknown settings section.');
}

function settingsForm(section) {
  return {
    company: '#companyForm',
    smtp: '#smtpForm',
    whatsapp: '#whatsappForm',
    theme: '#themeForm'
  }[section];
}

window.saveSettings = async (button, section) => {
  const payload = settingsPayload(section);
  const result = await RMS.mutations.runMutation(button, () => RMS.api.put('/settings', payload), {
    form: settingsForm(section),
    pending: 'Saving…',
    success: 'Settings saved successfully'
  });
  if (!result.ok) return result;
  if (section === 'smtp' && payload.smtp.password) {
    document.getElementById('smtpPass').value = '';
    document.getElementById('smtpCredentialState').textContent = 'Credential configured. Leave blank to keep it.';
  }
  if (section === 'whatsapp' && payload.whatsapp.apiKey) {
    document.getElementById('waKey').value = '';
    document.getElementById('whatsappCredentialState').textContent = 'Credential configured. Leave blank to keep it.';
  }
  return result;
};

window.testSmtp = (button) => RMS.mutations.runMutation(button, async () => {
  await RMS.api.put('/settings', settingsPayload('smtp'));
  return RMS.api.post('/delivery/test-email', { to: document.getElementById('smtpFrom').value });
}, {
  form: '#smtpForm',
  pending: 'Testing…',
  success: 'Test email sent successfully'
});

} // end admin-only settings
