const Group = require('../models/Group');
const Contact = require('../models/Contact');

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
  const contacts = await Contact.find();
  await Promise.all(contacts.map(async (c) => {
    const set = new Set((c.groups || []).map(String));
    if (ids.includes(String(c._id))) set.add(String(groupId));
    else set.delete(String(groupId));
    c.groups = [...set];
    await c.save();
  }));
}

function withMemberCount(group, allContacts) {
  const obj = group.toObject ? group.toObject() : { ...group };
  obj.memberCount = resolveMembers(obj, allContacts).length;
  return obj;
}

const groupController = {
  async getAll(req, res) {
    try {
      const contacts = await Contact.find();
      const groups = (await Group.find().sort({ name: 1 })).map(g => withMemberCount(g, contacts));
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
