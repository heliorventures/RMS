const { normalizeSchedule } = require('../time/schedule');
const { resolveRecipients, filterContacts } = require('./recipients');

function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }

function validateCampaignAudience(campaign) {
  const audience = campaign.audience || 'selected';
  if (!['all', 'selected'].includes(audience)) invalid('Choose a valid campaign audience.');
  const recipients = campaign.recipients || {};
  if (typeof recipients !== 'object' || Array.isArray(recipients)) invalid('Campaign recipients must contain contact and group lists.');
  const filters = recipients.filters || {};
  if (typeof filters !== 'object' || Array.isArray(filters)) invalid('Campaign filters must contain lists of values.');
  for (const [field, values] of Object.entries(filters)) {
    if (!['cities', 'sectors', 'religions'].includes(field) || !Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) invalid('Campaign filters must be lists of non-empty cities, sectors or religions.');
  }
  const contactIds = recipients.contacts || [];
  const groupIds = recipients.groups || [];
  if (!Array.isArray(contactIds) || !Array.isArray(groupIds)) invalid('Campaign contacts and groups must be lists.');
  return { audience, filters, contactIds, groupIds };
}

function campaignDelivery(campaign) {
  if (campaign.status !== 'draft') invalid('Only a draft campaign can be scheduled.');
  if (!String(campaign.content || '').trim() && campaign.channel !== 'whatsapp') invalid('Campaign content is required.');
  const schedule = normalizeSchedule({ scheduledAt: campaign.scheduledAt instanceof Date ? campaign.scheduledAt.toISOString() : campaign.scheduledAt, scheduleTimezone: campaign.scheduleTimezone });
  if (!schedule.scheduledAt || schedule.scheduledAt.getTime() <= Date.now()) invalid('Choose a future schedule date and time for this campaign.');
  const { audience, filters, contactIds, groupIds } = validateCampaignAudience(campaign);
  if (audience !== 'all' && !contactIds.length && !groupIds.length && !Object.values(filters).some(v => Array.isArray(v) && v.length)) invalid('Select at least one contact, group or filter, or explicitly choose all active contacts.');
  return { ...schedule, audience, filters, contactIds, groupIds, name: campaign.name, channel: campaign.channel, subject: campaign.name, body: campaign.content || '', type: 'campaign', campaignId: campaign._id };
}

function resolveCampaignRecipients(campaign, allContacts, allGroups) {
  const { audience, filters, contactIds, groupIds, scheduledAt, scheduleTimezone } = campaignDelivery(campaign);
  const hasSelection = contactIds.length || groupIds.length;
  let contacts = audience === 'all' || !hasSelection ? allContacts : resolveRecipients({ contactIds, groupIds, allContacts, allGroups });
  contacts = filterContacts(contacts, filters);
  const dateField = { birthday: 'dob', anniversary: 'anniversary' }[campaign.type];
  if (!dateField) return contacts;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: scheduleTimezone, month: '2-digit', day: '2-digit' }).formatToParts(scheduledAt).map(p => [p.type, p.value]));
  return contacts.filter(contact => {
    const date = new Date(contact[dateField]);
    return contact[dateField] && !Number.isNaN(date.getTime()) && date.getUTCMonth() + 1 === Number(parts.month) && date.getUTCDate() === Number(parts.day);
  });
}

module.exports = { campaignDelivery, resolveCampaignRecipients, validateCampaignAudience };
