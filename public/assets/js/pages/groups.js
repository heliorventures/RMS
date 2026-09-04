RMS.components.initLayout('/pages/groups.html', 'Group Management', 'Home / Groups');
document.getElementById('pageActions').innerHTML = `<button class="btn btn-primary" onclick="openGroupModal()"><i class="bi bi-plus-lg me-1"></i> Create Group</button>`;
document.getElementById('pageBody').innerHTML = `<div class="row g-3" id="groupsGrid"></div>`;

mountGroupModals();

let allGroups = [];
let allContacts = [];
let memberSearchResults = [];
let selectedMemberIds = new Set();
let excludedMemberIds = new Set();
let activeGroupId = null;
let activeGroupType = 'static';
let activeMembers = [];
let activeMemberPagination = { page: 1, pages: 1, total: 0 };

init();

async function init() {
  const groupsRes = await RMS.api.get('/groups');
  allGroups = groupsRes?.data || [];
  renderGroups();

  document.getElementById('groupType').addEventListener('change', toggleGroupSections);
  document.getElementById('memberSearch').addEventListener('input', RMS.utils.debounce(() => searchMembers('group'), 250));
  document.getElementById('modalMemberSearch').addEventListener('input', RMS.utils.debounce(() => searchMembers('modal'), 250));
}

function rememberContacts(contacts) {
  const byId = new Map(allContacts.map(contact => [String(contact._id), contact]));
  contacts.forEach(contact => byId.set(String(contact._id), contact));
  allContacts = [...byId.values()];
}

async function searchMembers(target) {
  const input = document.getElementById(target === 'group' ? 'memberSearch' : 'modalMemberSearch');
  const query = input.value.trim();
  if (query.length < 2) {
    memberSearchResults = [];
    return target === 'group' ? renderMemberPicker() : renderModalMemberPicker();
  }
  const res = await RMS.requests.run(`groups:member-search:${target}`, ({ signal }) =>
    RMS.api.get(`/contacts?page=1&limit=25&search=${encodeURIComponent(query)}`, { signal })
  );
  if (!res) return;
  memberSearchResults = res?.data || [];
  rememberContacts(memberSearchResults);
  return target === 'group' ? renderMemberPicker() : renderModalMemberPicker();
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
    <div class="modal fade rms-modal" id="groupModal" tabindex="-1" data-bs-backdrop="static" aria-hidden="true" aria-labelledby="groupModalTitle">
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
                    <div class="col-md-4"><label class="form-label small" for="ruleField">Field</label><select class="form-select" id="ruleField"><option value="city">City</option><option value="sector">Sector</option><option value="religion">Religion</option><option value="status">Status</option></select></div>
                    <div class="col-md-4"><label class="form-label small" for="ruleOp">Condition</label><select class="form-select" id="ruleOp"><option value="equals">Equals</option></select></div>
                    <div class="col-md-4"><label class="form-label small" for="ruleValue">Value</label><input class="form-control" id="ruleValue" placeholder="For example, Pune"></div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" onclick="saveGroup(this)"><i class="bi bi-check-lg me-1"></i>Save Group</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade rms-modal" id="membersModal" tabindex="-1" data-bs-backdrop="static" aria-hidden="true" aria-labelledby="membersTitle">
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
            <div class="d-flex justify-content-between align-items-center mt-3 d-none" id="groupMembersPager">
              <button type="button" class="btn btn-sm btn-outline-secondary" id="groupMembersPrev" onclick="changeGroupMemberPage(-1)">Previous</button>
              <span class="small text-secondary" id="groupMembersPageInfo"></span>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="groupMembersNext" onclick="changeGroupMemberPage(1)">Next</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button class="btn btn-outline-primary" onclick="editGroupFromMembers()"><i class="bi bi-pencil me-1"></i>Edit Group</button>
            <button class="btn btn-primary" id="saveMembersBtn" onclick="saveMembers(this)"><i class="bi bi-check-lg me-1"></i>Save Changes</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
}

function renderGroups() {
  document.getElementById('groupsGrid').innerHTML = allGroups.length ? allGroups.map(g => {
    const count = g.memberCount || 0;
    return `
    <div class="col-md-4 col-lg-3">
      <div class="group-card">
        <button type="button" class="group-card-main" onclick="viewMembers('${g._id}')">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="group-icon" style="background:${g.color || '#2563eb'}"><i class="bi ${g.icon || 'bi-people'}"></i></div>
            <div>
              <div class="fw-bold">${g.name}</div>
              <small class="text-secondary">${g.type === 'dynamic' ? 'Smart Group' : 'Custom Group'}</small>
            </div>
          </div>
          <p class="small text-secondary mb-2">${g.description || ''}</p>
          <span class="visually-hidden">View members</span>
        </button>
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge bg-primary-subtle text-primary">${count} member${count === 1 ? '' : 's'}</span>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary" onclick="editGroup('${g._id}')" aria-label="Edit group"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn btn-outline-danger" onclick="deleteGroup('${g._id}')" aria-label="Delete group"><i class="bi bi-trash"></i></button>
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
  const selected = [...ids];
  const list = selected.slice(0, 100).map(id => allContacts.find(c => String(c._id) === String(id))).filter(Boolean);
  el.innerHTML = list.length
    ? `${list.map(c => `<span class="member-chip">${c.firstName} ${c.lastName}${removable ? `<button type="button" onclick="${removeFn}('${c._id}')" aria-label="Remove member">&times;</button>` : ''}</span>`).join('')}${selected.length > list.length ? `<span class="text-secondary small">+${selected.length - list.length} more</span>` : ''}`
    : '<span class="text-secondary small">No members</span>';
}

function renderMemberPicker() {
  const q = document.getElementById('memberSearch').value.toLowerCase();
  const filtered = memberSearchResults.filter(c =>
    !selectedMemberIds.has(c._id) &&
    RMS.utils.contactSearchText(c).includes(q)
  ).slice(0, 50);
  document.getElementById('memberPicker').innerHTML = filtered.length
    ? filtered.map(c => `
      <button type="button" class="member-picker-item" onclick="toggleMember('${c._id}')">
        <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
          <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatContactSubtitle(c)}</div>
        </div>
        <i class="bi bi-plus-circle text-primary"></i>
      </button>`).join('')
    : `<div class="p-3 text-secondary small text-center">${q.trim().length < 2 ? 'Type at least two characters to search contacts' : 'No contacts found'}</div>`;
  renderMemberChips('selectedMemberChips', selectedMemberIds, true);
}

function renderModalMemberPicker() {
  const q = document.getElementById('modalMemberSearch').value.toLowerCase();
  const filtered = memberSearchResults.filter(c =>
    !selectedMemberIds.has(c._id) &&
    RMS.utils.contactSearchText(c).includes(q)
  ).slice(0, 50);
  document.getElementById('modalMemberPicker').innerHTML = filtered.length
    ? filtered.map(c => `
      <button type="button" class="member-picker-item" onclick="addMemberInModal('${c._id}')">
        <div class="avatar">${RMS.utils.getInitials(c.firstName, c.lastName)}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${c.firstName} ${c.lastName}</div>
          <div class="text-secondary" style="font-size:.75rem">${RMS.utils.formatContactSubtitle(c)}</div>
        </div>
        <i class="bi bi-plus-circle text-primary"></i>
      </button>`).join('')
    : `<div class="p-3 text-secondary small text-center">${q.trim().length < 2 ? 'Type at least two characters to search contacts' : 'No contacts to add'}</div>`;
}

window.toggleMember = (id) => {
  if (selectedMemberIds.has(id)) selectedMemberIds.delete(id);
  else selectedMemberIds.add(id);
  renderMemberPicker();
};

window.addMemberInModal = (id) => {
  selectedMemberIds.add(id);
  excludedMemberIds.delete(String(id));
  const contact = allContacts.find(item => String(item._id) === String(id));
  if (contact && !activeMembers.some(item => String(item._id) === String(id))) activeMembers.push(contact);
  refreshMembersModal();
};

window.removeMemberInModal = (id) => {
  selectedMemberIds.delete(id);
  activeMembers = activeMembers.filter(item => String(item._id) !== String(id));
  refreshMembersModal();
};

window.excludeMemberFromGroup = (id) => {
  excludedMemberIds.add(String(id));
  selectedMemberIds.delete(id);
  activeMembers = activeMembers.filter(item => String(item._id) !== String(id));
  refreshMembersModal();
};

function refreshMembersModal() {
  renderMembersModalContent(activeMembers);
  if (activeGroupType === 'static') renderModalMemberPicker();
}

function renderMembersModalContent(members) {
  const displayedCount = activeGroupType === 'static' ? selectedMemberIds.size : activeMemberPagination.total;
  document.getElementById('membersCountBadge').textContent = displayedCount;
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
  renderMembersPager();
}

function renderMembersPager() {
  const pager = document.getElementById('groupMembersPager');
  const { page = 1, pages = 1, total = 0 } = activeMemberPagination;
  pager.classList.toggle('d-none', pages <= 1);
  document.getElementById('groupMembersPageInfo').textContent = `Page ${page} of ${pages} (${total} members)`;
  document.getElementById('groupMembersPrev').disabled = page <= 1;
  document.getElementById('groupMembersNext').disabled = page >= pages;
}

async function loadMembersPage(page) {
  const res = await RMS.requests.run('groups:members', ({ signal }) =>
    RMS.api.get(`/groups/${activeGroupId}?page=${page}&limit=100`, { signal })
  );
  if (!res) return;
  const { group, members, pagination } = res?.data || {};
  if (!group?._id) return RMS.toast.show('Group members could not be loaded', 'error');
  activeMembers = members || [];
  activeMemberPagination = pagination || { page, pages: 1, total: activeMembers.length };
  rememberContacts(activeMembers);
  if (activeGroupType === 'dynamic') selectedMemberIds = new Set(activeMembers.map(member => String(member._id)));
  renderMembersModalContent(activeMembers);
}

window.changeGroupMemberPage = (direction) => {
  const nextPage = Math.max(1, Math.min(activeMemberPagination.pages, activeMemberPagination.page + direction));
  if (nextPage !== activeMemberPagination.page) loadMembersPage(nextPage);
};

window.openGroupModal = async () => {
  document.getElementById('groupForm').reset();
  document.getElementById('groupId').value = '';
  document.getElementById('groupModalTitle').textContent = 'Create Custom Group';
  document.getElementById('groupColor').value = '#2563eb';
  document.getElementById('groupType').value = 'static';
  selectedMemberIds = new Set();
  memberSearchResults = [];
  toggleGroupSections();
  renderMemberPicker();
  new bootstrap.Modal(document.getElementById('groupModal')).show();
};

window.editGroup = async (id) => {
  let group = allGroups.find(g => g._id === id);
  const res = await RMS.requests.run('groups:members', ({ signal }) =>
    RMS.api.get(`/groups/${id}?page=1&limit=100`, { signal })
  );
  if (!res) return;
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
  rememberContacts(members);
  memberSearchResults = [];
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

window.saveGroup = async (button) => {
  const name = document.getElementById('groupName').value.trim();
  if (!name) return RMS.mutations.showValidationError('#groupForm', 'Group name is required', '#groupName');

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
    if (!data.memberIds.length) return RMS.mutations.showValidationError('#groupForm', 'Select at least one member for custom group');
  }

  const id = document.getElementById('groupId').value;
  const result = await RMS.mutations.runMutation(button, () => id
    ? RMS.api.put(`/groups/${id}`, data)
    : RMS.api.post('/groups', data), {
    form: '#groupForm',
    pending: 'Saving…',
    success: id ? 'Group updated' : 'Group created'
  });
  if (result.ok) {
    bootstrap.Modal.getInstance(document.getElementById('groupModal'))?.hide();
    await reloadGroups();
  }
};

async function reloadGroups() {
  const groupsRes = await RMS.api.get('/groups');
  allGroups = groupsRes?.data || [];
  renderGroups();
}

window.viewMembers = async (id) => {
  activeGroupId = id;
  const res = await RMS.requests.run('groups:members', ({ signal }) =>
    RMS.api.get(`/groups/${id}?page=1&limit=100`, { signal })
  );
  if (!res) return;
  const { group, members } = res?.data || { group: {}, members: [] };
  if (!group?._id) return RMS.toast.show('Group not found', 'error');

  activeGroupType = group.type || 'static';
  selectedMemberIds = new Set(members.map(m => String(m._id)));
  if (activeGroupType === 'static' && group.members?.length) selectedMemberIds = new Set(group.members.map(String));
  excludedMemberIds = new Set((group.excludedMembers || []).map(String));
  rememberContacts(members);
  memberSearchResults = [];
  activeMembers = members;
  activeMemberPagination = res?.data?.pagination || { page: 1, pages: 1, total: members.length };

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

window.saveMembers = async (button) => {
  if (!activeGroupId) return;
  const result = await RMS.mutations.runMutation(button, () => activeGroupType === 'dynamic'
    ? RMS.api.put(`/groups/${activeGroupId}`, { excludedMembers: [...excludedMemberIds] })
    : RMS.api.put(`/groups/${activeGroupId}/members`, { memberIds: [...selectedMemberIds] }), {
    form: '#membersEditSection',
    pending: 'Saving…',
    success: 'Members updated'
  });
  if (result.ok) {
    const res = result.value;
    const group = res.data?.group || res.data;
    const members = res.data?.members || resolveGroupMembers({ ...group, excludedMembers: [...excludedMemberIds], members: [...selectedMemberIds], type: activeGroupType });
    activeMembers = members;
    activeMemberPagination = res.data?.pagination || { page: 1, pages: 1, total: members.length };
    allGroups = allGroups.map(g => g._id === activeGroupId ? { ...g, ...group, memberCount: group.memberCount ?? activeMemberPagination.total ?? members.length } : g);
    renderGroups();
    renderMembersModalContent(members);
    if (activeGroupType === 'static') renderModalMemberPicker();
  }
};

window.deleteGroup = (id) => RMS.components.confirmDelete('Delete this group?', (button) => RMS.mutations.runMutation(button, async () => {
  await RMS.api.delete(`/groups/${id}`);
  allGroups = allGroups.filter(g => g._id !== id);
  renderGroups();
}, {
  pending: 'Deleting…',
  success: 'Group deleted',
  errorTarget: '#rmsConfirmStatus'
}));
