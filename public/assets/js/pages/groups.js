RMS.components.initLayout('/pages/groups.html', 'Group Management', 'Home / Groups');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" onclick="openGroupModal()"><i class="bi bi-plus-lg me-1"></i> Create Group</button>`;
document.getElementById('pageBody').innerHTML = `<div class="row g-3" id="groupsGrid"></div>`;

mountGroupModals();

let allGroups = [];
let allContacts = [];
let selectedMemberIds = new Set();
let excludedMemberIds = new Set();
let activeGroupId = null;
let activeGroupType = 'static';

init();

async function init() {
  const [groupsRes, contactsRes] = await Promise.all([
    RMS.api.get('/groups'),
    RMS.api.get('/contacts?limit=500')
  ]);
  allGroups = groupsRes?.data || [];
  allContacts = (contactsRes?.data || []).filter(Boolean);
  enrichGroupCounts();
  renderGroups();

  document.getElementById('groupType').addEventListener('change', toggleGroupSections);
  document.getElementById('memberSearch').addEventListener('input', RMS.utils.debounce(renderMemberPicker, 200));
  document.getElementById('modalMemberSearch').addEventListener('input', RMS.utils.debounce(renderModalMemberPicker, 200));
}

function matchRule(contact, rule) {
  const val = contact[rule.field];
  if (rule.operator === 'equals') {
    if (val == null || rule.value == null) return false;
    if (['city', 'sector', 'religion', 'status'].includes(rule.field)) {
      return String(val).toLowerCase() === String(rule.value).toLowerCase();
    }
    return val === rule.value;
  }
  if (rule.operator === 'contains') {
    return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
  }
  return true;
}

function resolveGroupMembers(group) {
  const excludedSource = group._id === activeGroupId
    ? [...excludedMemberIds]
    : (group.excludedMembers || []);
  const excluded = new Set(excludedSource.map(String));
  let members;
  if (group.type === 'dynamic' && group.rules?.length) {
    members = allContacts.filter(c => group.rules.every(rule => matchRule(c, rule)));
  } else if (group.members?.length) {
    const ids = group.members.map(String);
    members = allContacts.filter(c => ids.includes(String(c._id)));
  } else {
    members = allContacts.filter(c => (c.groups || []).map(String).includes(String(group._id)));
  }
  return members.filter(c => !excluded.has(String(c._id)));
}

function getGroupMemberCount(group) {
  return resolveGroupMembers(group).length;
}

function enrichGroupCounts() {
  allGroups = allGroups.map(g => ({ ...g, memberCount: getGroupMemberCount(g) }));
}

function mountGroupModals() {
  const existing = document.getElementById('groupModalsRoot');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'groupModalsRoot';
  root.innerHTML = `
    <div class="modal fade rms-modal" id="groupModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header gradient">
            <h5 class="modal-title" id="groupModalTitle">Create Group</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="groupForm" onsubmit="return false">
              <input type="hidden" id="groupId">
              <div class="row g-3">
                <div class="col-md-8"><label class="form-label">Group Name *</label><input class="form-control" id="groupName" required></div>
                <div class="col-md-4"><label class="form-label">Color</label><input type="color" class="form-control form-control-color w-100" id="groupColor" value="#2563eb"></div>
                <div class="col-12"><label class="form-label">Description</label><textarea class="form-control" id="groupDesc" rows="2"></textarea></div>
                <div class="col-12"><label class="form-label">Group Type</label>
                  <select class="form-select" id="groupType">
                    <option value="static">Custom — pick members manually</option>
                    <option value="dynamic">Smart — auto-add by rules</option>
                  </select>
                </div>
                <div class="col-12" id="membersSection">
                  <label class="form-label">Select Members</label>
                  <div id="selectedMemberChips" class="mb-2"></div>
                  <input type="text" class="form-control mb-2" id="memberSearch" placeholder="Search contacts to add...">
                  <div class="member-picker" id="memberPicker"></div>
                </div>
                <div class="col-12 d-none" id="rulesSection">
                  <label class="form-label">Smart Rule</label>
                  <div class="row g-2">
                    <div class="col-md-4"><select class="form-select" id="ruleField"><option value="city">City</option><option value="sector">Sector</option><option value="religion">Religion</option><option value="status">Status</option></select></div>
                    <div class="col-md-4"><select class="form-select" id="ruleOp"><option value="equals">Equals</option></select></div>
                    <div class="col-md-4"><input class="form-control" id="ruleValue" placeholder="Value e.g. Pune"></div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" onclick="saveGroup()"><i class="bi bi-check-lg me-1"></i>Save Group</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade rms-modal" id="membersModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header gradient">
            <div>
              <h5 class="modal-title mb-0" id="membersTitle">Group Members</h5>
              <small class="opacity-75" id="membersSubtitle"></small>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="membersDynamicNote" class="alert alert-info small d-none">Smart group — members match your rules. Use <strong>Remove</strong> to exclude someone from this group.</div>
            <div id="membersEditSection">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label mb-0 fw-semibold">Members</label>
                <span class="badge bg-primary" id="membersCountBadge">0</span>
              </div>
              <div id="currentMemberChips" class="mb-3"></div>
              <div id="addMembersBlock">
                <label class="form-label fw-semibold">Add Members</label>
                <input type="text" class="form-control mb-2" id="modalMemberSearch" placeholder="Search contacts...">
                <div class="member-picker mb-3" id="modalMemberPicker"></div>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead><tr><th>Name</th><th>Designation</th><th>City</th><th>Sector</th><th>Mobile</th><th class="text-end">Action</th></tr></thead>
                <tbody id="membersTableBody"></tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button class="btn btn-outline-primary" onclick="editGroupFromMembers()"><i class="bi bi-pencil me-1"></i>Edit Group</button>
            <button class="btn btn-primary" id="saveMembersBtn" onclick="saveMembers()"><i class="bi bi-check-lg me-1"></i>Save Changes</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
}

function renderGroups() {
  enrichGroupCounts();
  document.getElementById('groupsGrid').innerHTML = allGroups.length ? allGroups.map(g => {
    const count = getGroupMemberCount(g);
    return `
    <div class="col-md-4 col-lg-3">
      <div class="group-card" onclick="viewMembers('${g._id}')">
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="group-icon" style="background:${g.color || '#2563eb'}"><i class="bi ${g.icon || 'bi-people'}"></i></div>
          <div>
            <div class="fw-bold">${g.name}</div>
            <small class="text-secondary">${g.type === 'dynamic' ? 'Smart Group' : 'Custom Group'}</small>
          </div>
        </div>
        <p class="small text-secondary mb-2">${g.description || ''}</p>
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge bg-primary-subtle text-primary">${count} member${count === 1 ? '' : 's'}</span>
          <div class="btn-group btn-group-sm" onclick="event.stopPropagation()">
            <button class="btn btn-outline-secondary" onclick="editGroup('${g._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger" onclick="deleteGroup('${g._id}')" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="col-12 empty-state"><i class="bi bi-collection d-block"></i>No groups yet</div>';
}

function toggleGroupSections() {
  const isDynamic = document.getElementById('groupType').value === 'dynamic';
  document.getElementById('rulesSection').classList.toggle('d-none', !isDynamic);
  document.getElementById('membersSection').classList.toggle('d-none', isDynamic);
}

function renderMemberChips(containerId, ids, removable, removeFn = 'toggleMember') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const list = [...ids].map(id => allContacts.find(c => String(c._id) === String(id))).filter(Boolean);
  el.innerHTML = list.length
    ? list.map(c => `<span class="member-chip">${c.firstName} ${c.lastName}${removable ? `<button type="button" onclick="${removeFn}('${c._id}')" title="Remove">&times;</button>` : ''}</span>`).join('')
    : '<span class="text-secondary small">No members</span>';
}

function renderMemberPicker() {
  const q = document.getElementById('memberSearch').value.toLowerCase();
  const filtered = allContacts.filter(c =>
    !selectedMemberIds.has(c._id) &&
    RMS.utils.contactSearchText(c).includes(q)
  ).slice(0, 50);
  document.getElementById('memberPicker').innerHTML = filtered.length
    ? filtered.map(c => `
      <div class="member-picker-item" onclick="toggleMember('${c._id}')">
        <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
          <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatContactSubtitle(c)}</div>
        </div>
        <i class="bi bi-plus-circle text-primary"></i>
      </div>`).join('')
    : '<div class="p-3 text-secondary small text-center">No contacts found</div>';
  renderMemberChips('selectedMemberChips', selectedMemberIds, true);
}

function renderModalMemberPicker() {
  const q = document.getElementById('modalMemberSearch').value.toLowerCase();
  const filtered = allContacts.filter(c =>
    !selectedMemberIds.has(c._id) &&
    RMS.utils.contactSearchText(c).includes(q)
  ).slice(0, 50);
  document.getElementById('modalMemberPicker').innerHTML = filtered.length
    ? filtered.map(c => `
      <div class="member-picker-item" onclick="addMemberInModal('${c._id}')">
        <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
          <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatContactSubtitle(c)}</div>
        </div>
        <i class="bi bi-plus-circle text-primary"></i>
      </div>`).join('')
    : '<div class="p-3 text-secondary small text-center">No contacts to add</div>';
}

window.toggleMember = (id) => {
  if (selectedMemberIds.has(id)) selectedMemberIds.delete(id);
  else selectedMemberIds.add(id);
  renderMemberPicker();
};

window.addMemberInModal = (id) => {
  selectedMemberIds.add(id);
  excludedMemberIds.delete(String(id));
  refreshMembersModal();
};

window.removeMemberInModal = (id) => {
  selectedMemberIds.delete(id);
  refreshMembersModal();
};

window.excludeMemberFromGroup = (id) => {
  excludedMemberIds.add(String(id));
  selectedMemberIds.delete(id);
  refreshMembersModal();
};

function refreshMembersModal() {
  const group = allGroups.find(g => g._id === activeGroupId) || { type: activeGroupType, excludedMembers: [...excludedMemberIds] };
  group.excludedMembers = [...excludedMemberIds];
  const members = resolveGroupMembers(group);
  renderMembersModalContent(members);
  if (activeGroupType === 'static') renderModalMemberPicker();
}

function renderMembersModalContent(members) {
  document.getElementById('membersCountBadge').textContent = members.length;
  renderMemberChips('currentMemberChips', new Set(members.map(m => m._id)), true,
    activeGroupType === 'dynamic' ? 'excludeMemberFromGroup' : 'removeMemberInModal');
  document.getElementById('membersTableBody').innerHTML = members.length
    ? members.map(m => `<tr>
        <td><div class="d-flex align-items-center gap-2"><div class="avatar" style="width:32px;height:32px;font-size:.75rem">${RMS.utils.getInitials(m.firstName, m.lastName)}</div>${m.firstName} ${m.lastName}</div></td>
        <td>${m.designation || '-'}</td><td>${m.city || '-'}</td><td>${m.sector || '-'}</td><td>${m.mobile || '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" title="Remove from group"
            onclick="${activeGroupType === 'dynamic' ? `excludeMemberFromGroup('${m._id}')` : `removeMemberInModal('${m._id}')`}">
            <i class="bi bi-person-dash"></i> Remove
          </button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-secondary py-3">No members in this group</td></tr>';
}

window.openGroupModal = async () => {
  if (!allContacts.length) {
    const res = await RMS.api.get('/contacts?limit=500');
    allContacts = res?.data || [];
  }
  document.getElementById('groupForm').reset();
  document.getElementById('groupId').value = '';
  document.getElementById('groupModalTitle').textContent = 'Create Custom Group';
  document.getElementById('groupColor').value = '#2563eb';
  document.getElementById('groupType').value = 'static';
  selectedMemberIds = new Set();
  toggleGroupSections();
  renderMemberPicker();
  new bootstrap.Modal(document.getElementById('groupModal')).show();
};

window.editGroup = async (id) => {
  if (!allContacts.length) {
    const res = await RMS.api.get('/contacts?limit=500');
    allContacts = res?.data || [];
  }
  let group = allGroups.find(g => g._id === id);
  const res = await RMS.api.get(`/groups/${id}`);
  const members = res?.data?.members || [];
  group = res?.data?.group || group;
  if (!group?._id) return RMS.toast.show('Group not found', 'error');

  document.getElementById('groupId').value = group._id;
  document.getElementById('groupModalTitle').textContent = 'Edit Group';
  document.getElementById('groupName').value = group.name || '';
  document.getElementById('groupDesc').value = group.description || '';
  document.getElementById('groupType').value = group.type || 'static';
  document.getElementById('groupColor').value = group.color || '#2563eb';

  selectedMemberIds = new Set((group.members || members.map(m => m._id)).map(String));
  toggleGroupSections();

  if (group.rules?.length) {
    document.getElementById('ruleField').value = group.rules[0].field || 'sector';
    document.getElementById('ruleOp').value = group.rules[0].operator || 'equals';
    document.getElementById('ruleValue').value = group.rules[0].value || '';
  }

  renderMemberPicker();
  new bootstrap.Modal(document.getElementById('groupModal')).show();
};

window.editGroupFromMembers = () => {
  bootstrap.Modal.getInstance(document.getElementById('membersModal'))?.hide();
  setTimeout(() => editGroup(activeGroupId), 300);
};

window.saveGroup = async () => {
  const name = document.getElementById('groupName').value.trim();
  if (!name) return RMS.toast.show('Group name is required', 'warning');

  const type = document.getElementById('groupType').value;
  const data = {
    name,
    description: document.getElementById('groupDesc').value,
    type,
    color: document.getElementById('groupColor').value,
    icon: 'bi-people'
  };

  if (type === 'dynamic') {
    data.rules = [{
      field: document.getElementById('ruleField').value,
      operator: document.getElementById('ruleOp').value,
      value: document.getElementById('ruleValue').value
    }];
    data.members = [];
    data.excludedMembers = [];
  } else {
    data.rules = [];
    data.memberIds = [...selectedMemberIds];
    if (!data.memberIds.length) return RMS.toast.show('Select at least one member for custom group', 'warning');
  }

  const id = document.getElementById('groupId').value;
  const res = id ? await RMS.api.put(`/groups/${id}`, data) : await RMS.api.post('/groups', data);

  if (res?.success) {
    RMS.toast.show(id ? 'Group updated' : 'Group created');
    bootstrap.Modal.getInstance(document.getElementById('groupModal'))?.hide();
    await reloadGroups();
  } else {
    RMS.toast.show(res?.message || 'Failed to save group', 'error');
  }
};

async function reloadGroups() {
  const [groupsRes, contactsRes] = await Promise.all([
    RMS.api.get('/groups'),
    RMS.api.get('/contacts?limit=500')
  ]);
  allGroups = groupsRes?.data || [];
  allContacts = (contactsRes?.data || []).filter(Boolean);
  enrichGroupCounts();
  renderGroups();
}

window.viewMembers = async (id) => {
  activeGroupId = id;
  const res = await RMS.api.get(`/groups/${id}`);
  const { group, members } = res?.data || { group: {}, members: [] };
  if (!group?._id) return RMS.toast.show('Group not found', 'error');

  activeGroupType = group.type || 'static';
  selectedMemberIds = new Set(members.map(m => String(m._id)));
  excludedMemberIds = new Set((group.excludedMembers || []).map(String));

  document.getElementById('membersTitle').textContent = group.name;
  document.getElementById('membersSubtitle').textContent = activeGroupType === 'dynamic'
    ? 'Smart group · members matched by rules'
    : 'Custom group · manually managed';
  document.getElementById('membersDynamicNote').classList.toggle('d-none', activeGroupType !== 'dynamic');
  document.getElementById('addMembersBlock').classList.toggle('d-none', activeGroupType === 'dynamic');
  document.getElementById('saveMembersBtn').classList.remove('d-none');
  document.getElementById('modalMemberSearch').value = '';

  renderMembersModalContent(members);
  if (activeGroupType === 'static') renderModalMemberPicker();

  new bootstrap.Modal(document.getElementById('membersModal')).show();
};

window.saveMembers = async () => {
  if (!activeGroupId) return;

  let res;
  if (activeGroupType === 'dynamic') {
    res = await RMS.api.put(`/groups/${activeGroupId}`, {
      excludedMembers: [...excludedMemberIds]
    });
  } else {
    res = await RMS.api.put(`/groups/${activeGroupId}/members`, { memberIds: [...selectedMemberIds] });
  }

  if (res?.success) {
    RMS.toast.show('Members updated');
    const group = res.data?.group || res.data;
    const members = res.data?.members || resolveGroupMembers({ ...group, excludedMembers: [...excludedMemberIds], members: [...selectedMemberIds], type: activeGroupType });
    allGroups = allGroups.map(g => g._id === activeGroupId ? { ...g, ...group, memberCount: members.length } : g);
    enrichGroupCounts();
    renderGroups();
    renderMembersModalContent(members);
    if (activeGroupType === 'static') renderModalMemberPicker();
  } else {
    RMS.toast.show(res?.message || 'Failed to update members', 'error');
  }
};

window.deleteGroup = (id) => RMS.components.confirmDelete('Delete this group?', async () => {
  await RMS.api.delete(`/groups/${id}`);
  RMS.toast.show('Group deleted');
  allGroups = allGroups.filter(g => g._id !== id);
  renderGroups();
});
