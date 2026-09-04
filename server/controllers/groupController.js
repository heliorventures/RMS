const Group = require('../models/Group');
const Contact = require('../models/Contact');

const GROUP_RULE_FIELDS = new Set(['city', 'sector', 'religion', 'status', 'gender', 'occupation', 'company', 'designation']);

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

function matchRule(contact, rule) {
  const val = contact[rule.field];
  switch (rule.operator) {
    case 'equals':
      if (val == null || rule.value == null) return false;
      if (['city', 'sector', 'religion', 'status'].includes(rule.field)) {
        return String(val).toLowerCase() === String(rule.value).toLowerCase();
      }
      return val === rule.value;
    case 'contains': return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'in': return Array.isArray(rule.value) && rule.value.includes(val);
    case 'not_in': return Array.isArray(rule.value) && !rule.value.includes(val);
    default: return true;
  }
}

function applyRules(contacts, rules) {
  if (!rules || !rules.length) return contacts;
  return contacts.filter(contact => rules.every(rule => matchRule(contact, rule)));
}

function resolveMembers(group, allContacts) {
  const excluded = new Set((group.excludedMembers || []).map(String));
  let members;
  if (group.type === 'dynamic') members = applyRules(allContacts, group.rules);
  else if (group.members && group.members.length) {
    const ids = group.members.map(String);
    members = allContacts.filter(c => ids.includes(String(c._id)));
  } else {
    members = allContacts.filter(c => (c.groups || []).map(String).includes(String(group._id)));
  }
  return members.filter(c => !excluded.has(String(c._id)));
}

async function syncContactGroups(groupId, memberIds) {
  const ids = (memberIds || []).map(String);
  await Contact.updateMany({ groups: groupId, _id: { $nin: ids } }, { $pull: { groups: groupId } });
  if (ids.length) await Contact.updateMany({ _id: { $in: ids } }, { $addToSet: { groups: groupId } });
}

function withMemberCount(group, allContacts) {
  const obj = group.toObject ? group.toObject() : { ...group };
  obj.memberCount = resolveMembers(obj, allContacts).length;
  return obj;
}

const groupController = {
  async getMembers(req, res) {
    try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
      const query = memberQuery(group);
      const total = await Contact.countDocuments(query);
      const members = await Contact.find(query).sort({ firstName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
      res.json({ success: true, data: members, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getAll(req, res) {
    try {
      const groups = await Group.find().sort({ name: 1 }).lean();
      await Promise.all(groups.map(async group => {
        group.memberCount = await Contact.countDocuments(memberQuery(group));
      }));
      res.json({ success: true, data: groups });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      const contacts = await Contact.find();
      const members = resolveMembers(group, contacts);
      const enriched = withMemberCount(group, contacts);
      res.json({ success: true, data: { group: enriched, members } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const data = { ...req.body };
      if (data.memberIds) {
        data.members = data.memberIds;
        data.memberCount = data.memberIds.length;
        delete data.memberIds;
      }
      const contacts = await Contact.find();
      if (data.type === 'dynamic') {
        data.memberCount = resolveMembers(data, contacts).length;
      } else if (data.type === 'static' && data.members?.length) {
        data.memberCount = data.members.length;
      }
      const group = await Group.create(data);
      if (group.type === 'static' && group.members?.length) {
        await syncContactGroups(group._id, group.members);
      }
      res.status(201).json({ success: true, data: withMemberCount(group, contacts) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const data = { ...req.body };
      if (data.memberIds) {
        data.members = data.memberIds;
        data.memberCount = data.memberIds.length;
        delete data.memberIds;
      }
      const contacts = await Contact.find();
      if (data.type === 'dynamic' || (data.rules && !data.memberIds)) {
        const existing = await Group.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Group not found.' });
        const merged = { ...existing.toObject(), ...data };
        data.memberCount = resolveMembers(merged, contacts).length;
      }
      const group = await Group.findByIdAndUpdate(req.params.id, data, { new: true });
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      if (group.type === 'static' && data.members) {
        await syncContactGroups(group._id, group.members);
      }
      res.json({ success: true, data: withMemberCount(group, contacts) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateMembers(req, res) {
    try {
      const { memberIds = [] } = req.body;
      const group = await Group.findByIdAndUpdate(
        req.params.id,
        { members: memberIds, memberCount: memberIds.length, type: 'static' },
        { new: true }
      );
      if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
      await syncContactGroups(group._id, memberIds);
      const members = resolveMembers(group, await Contact.find());
      res.json({ success: true, data: { group, members } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

    async remove(req, res) {
    try {
      await Group.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Group deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = groupController;
