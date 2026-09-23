const Template = require('../models/Template');
const { buildTemplate } = require('./whatsappService');
const { applyTemplate } = require('../utils/recipients');
async function loadMapping(templateId) {
  if (typeof templateId !== 'string' || !/^[a-f\d]{24}$/i.test(templateId)) throw Object.assign(new Error('Select an RMS template mapped to an approved Meta WhatsApp template.'), { status: 400 });
  const template = await Template.findById(templateId).lean();
  if (!template || template.isActive === false) throw Object.assign(new Error('WhatsApp template is missing or inactive.'), { status: 400 });
  buildTemplate(template.whatsapp);
  return template.whatsapp;
}
function renderMapping(mapping, contact) {
  const variables = new Set(['Name', 'FirstName', 'LastName', 'City', 'Sector', 'Company', 'Designation', 'Occupation', 'Mobile', 'Email']);
  for (const parameter of mapping.bodyParameters || []) {
    for (const match of parameter.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (!variables.has(match[1])) throw Object.assign(new Error(`Unsupported WhatsApp variable: ${match[1]}. Use contact variables or literal text.`), { status: 400 });
      if (!applyTemplate(match[0], contact).trim()) throw Object.assign(new Error(`WhatsApp template parameters must be nonempty: ${match[1]} is missing for this contact.`), { status: 400 });
    }
  }
  const rendered = { name: mapping.name, language: mapping.language, bodyParameters: (mapping.bodyParameters || []).map(p => applyTemplate(p, contact)) };
  buildTemplate(rendered);
  return rendered;
}
module.exports = { loadMapping, renderMapping };
