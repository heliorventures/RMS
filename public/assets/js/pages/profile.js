RMS.components.initLayout('/pages/profile.html', 'User Profile', 'Home / Profile');
document.getElementById('pageBody').innerHTML = `
  <div class="row g-4">
    <div class="col-lg-4"><div class="card text-center"><div class="card-body p-4">
      <div class="avatar avatar-lg mx-auto mb-3" id="profileAvatar" style="width:100px;height:100px;font-size:2rem"></div>
      <h4 id="profileName"></h4><p class="text-secondary" id="profileEmail"></p>
      <span class="badge bg-primary" id="profileRole"></span>
    </div></div></div>
    <div class="col-lg-8"><ul class="nav nav-tabs mb-3"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#profileTab">Profile</button></li>
    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#passwordTab">Password</button></li>
    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#notifTab">Notifications</button></li></ul>
    <div class="tab-content">
      <div class="tab-pane fade show active" id="profileTab"><div class="card"><div class="card-body"><form id="profileForm">
        <div class="row g-3"><div class="col-md-6"><label class="form-label">Full Name</label><input class="form-control" id="profName"></div>
        <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="profPhone"></div>
        <div class="col-12"><button type="button" class="btn btn-primary" onclick="saveProfile()">Update Profile</button></div></div>
      </form></div></div></div>
      <div class="tab-pane fade" id="passwordTab"><div class="card"><div class="card-body">
        <div class="mb-3"><label class="form-label">Current Password</label><input type="password" class="form-control" id="curPass"></div>
        <div class="mb-3"><label class="form-label">New Password</label><input type="password" class="form-control" id="newPass"></div>
        <div class="mb-3"><label class="form-label">Confirm Password</label><input type="password" class="form-control" id="confPass"></div>
        <button class="btn btn-primary" onclick="changePassword()">Change Password</button>
      </div></div></div>
      <div class="tab-pane fade" id="notifTab"><div class="card"><div class="card-body">
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="nEmail" checked><label class="form-check-label">Email Notifications</label></div>
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="nWhatsapp" checked><label class="form-check-label">WhatsApp Notifications</label></div>
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="nBirthday" checked><label class="form-check-label">Birthday Reminders</label></div>
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="nAnniversary" checked><label class="form-check-label">Anniversary Reminders</label></div>
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="nCampaign" checked><label class="form-check-label">Campaign Updates</label></div>
        <button class="btn btn-primary" onclick="saveNotifPrefs()">Save Preferences</button>
      </div></div></div>
    </div></div></div>`;

loadProfile();
async function loadProfile() {
  const res = await RMS.api.get('/auth/profile');
  const u = res?.data || RMS.auth.getUser();
  if (!u) return;
  const parts = u.name.split(' ');
  document.getElementById('profileAvatar').textContent = RMS.utils.getInitials(parts[0], parts[1]);
  document.getElementById('profileName').textContent = u.name;
  document.getElementById('profileEmail').textContent = u.email;
  document.getElementById('profileRole').textContent = u.role;
  document.getElementById('profName').value = u.name;
  document.getElementById('profPhone').value = u.phone || '';
  const prefs = u.notificationPrefs || {};
  ['Email','Whatsapp','Birthday','Anniversary','Campaign'].forEach(k => {
    const el = document.getElementById('n'+k);
    if (el) el.checked = prefs[k.toLowerCase()] !== false;
  });
}
window.saveProfile = async () => {
  await RMS.api.put('/auth/profile', { name: document.getElementById('profName').value, phone: document.getElementById('profPhone').value });
  RMS.toast.show('Profile updated');
  loadProfile();
};
window.changePassword = async () => {
  const newPass = document.getElementById('newPass').value;
  if (newPass !== document.getElementById('confPass').value) return RMS.toast.show('Passwords do not match','error');
  await RMS.api.put('/auth/change-password', { currentPassword: document.getElementById('curPass').value, newPassword: newPass });
  RMS.toast.show('Password changed successfully');
};
window.saveNotifPrefs = async () => {
  await RMS.api.put('/auth/profile', { notificationPrefs: { email: document.getElementById('nEmail').checked, whatsapp: document.getElementById('nWhatsapp').checked, birthday: document.getElementById('nBirthday').checked, anniversary: document.getElementById('nAnniversary').checked, campaign: document.getElementById('nCampaign').checked } });
  RMS.toast.show('Notification preferences saved');
};
