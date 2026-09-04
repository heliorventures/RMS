const Group = require('../models/Group');
const Contact = require('../models/Contact');

const GROUP_RULE_FIELDS = new Set(['city', 'sector', 'religion', 'status', 'gender', 'occupation', 'company', 'designation']);
const MAX_MEMBER_PAGE_SIZE = 100;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function memberQuery(group) {
  const filter = {};
  const excluded = (group.excludedMembers || []).filter(Boolean);
  if (excluded.length) filter._id = { $nin: excluded };
  if (group.type === 'dynamic') {
    const rules = (group.rules || []).filter(rule => GROUP_RULE_FIELDS.has(rule.field));
    const clauses = rules.map(rule => {
      if (rule.operator === 'contains') return { [rule.field]: { $regex: escapeRegex(rule.value || ''), $options: 'i' } };
      if (rule.operator === 'in' && Array.isArray(rule.value)) return { [rule.field]: { $in: rule.value } };
      if (rule.operator === 'not_in' && Array.isArray(rule.value)) return { [rule.field]: { $nin: rule.value } };
      return { [rule.field]: rule.value };
    });
    if (clauses.length) filter.$and = clauses;
  } else if (group.members?.length) {
    filter._id = { ...(filter._id || {}), $in: group.members };
  } else {
    filter.groups = group._id;
  }
  return filter;
}

function pageRequest(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_MEMBER_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit };
}

async function memberPage(group, query) {
  const { page, limit } = pageRequest(query);
  const filter = memberQuery(group);
  const total = await Contact.countDocuments(filter);
  const members = await Contact.find(filter).sort({ firstName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
  return { members, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function syncContactGroups(groupId, memberIds) {
  const ids = (memberIds || []).map(String);
  await Contact.updateMany({ groups: groupId, _id: { $nin: ids } }, { $pull: { groups: groupId } });
  if (ids.length) await Contact.updateMany({ _id: { $in: ids } }, { $addToSet: { groups: groupId } });
}

async function responseGroup(group) {
  const data = group.toObject ? group.toObject() : { ...group };
  data.memberCount = await Contact.countDocuments(memberQuery(data));
  return data;
}

const groupController = {
  async getMembers(req, res) {
    try {
      const group = await Group.findById(req.params.id).lean();
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      const { members, pagination } = await memberPage(group, req.query);
      res.json({ success: true, data: members, pagination });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getAll(req, res) {
    try {
      const groups = await Group.find().sort({ name: 1 }).lean();
      await Promise.all(groups.map(async group => { group.memberCount = await Contact.countDocuments(memberQuery(group)); }));
      res.json({ success: true, data: groups });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getById(req, res) {
    try {
      const group = await Group.findById(req.params.id).lean();
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      const { members, pagination } = await memberPage(group, req.query);
      group.memberCount = pagination.total;
      res.json({ success: true, data: { group, members, pagination } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async create(req, res) {
    try {
      const data = { ...req.body };
      const memberIds = data.memberIds;
      if (memberIds) { data.members = memberIds; delete data.memberIds; }
      const group = await Group.create(data);
      if (group.type === 'static' && memberIds) await syncContactGroups(group._id, memberIds);
      res.status(201).json({ success: true, data: await responseGroup(group) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async update(req, res) {
    try {
      const existing = await Group.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ success: false, message: 'Group not found.' });
      const data = { ...req.body };
      const memberIds = data.memberIds;
      if (memberIds) { data.members = memberIds; delete data.memberIds; }
      const group = await Group.findByIdAndUpdate(req.params.id, data, { new: true });
      if (group.type === 'static' && memberIds) await syncContactGroups(group._id, memberIds);
      res.json({ success: true, data: await responseGroup(group) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async updateMembers(req, res) {
    try {
      const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
      const group = await Group.findByIdAndUpdate(req.params.id, { members: memberIds, type: 'static' }, { new: true });
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      await syncContactGroups(group._id, memberIds);
      const groupData = await responseGroup(group);
      const { members, pagination } = await memberPage(groupData, { page: 1, limit: MAX_MEMBER_PAGE_SIZE });
      res.json({ success: true, data: { group: groupData, members, pagination } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async remove(req, res) {
    try {
      await Group.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Group deleted.' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
};

module.exports = groupController;
