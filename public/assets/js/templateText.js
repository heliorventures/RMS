(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMS.renderTemplateText = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  return function renderTemplateText(text, data = {}) {
    const lookup = Object.fromEntries(Object.entries(data).map(([key, value]) => [key.toLowerCase(), String(value ?? '').trim()]));
    return String(text || '').split('\n').map(line => {
      // Commas separating optional fields belong to those fields, not to an empty value.
      const fields = line.split(/(\{\{\w+\}\})/);
      for (let index = 1; index < fields.length; index += 2) {
        const key = fields[index].slice(2, -2).toLowerCase();
        const value = lookup[key] || '';
        if (!value) {
          if (/^[ \t]*[,;|]/.test(fields[index + 1] || '')) fields[index + 1] = fields[index + 1].replace(/^[ \t]*[,;|][ \t]*/, '');
          else fields[index - 1] = fields[index - 1].replace(/[,;|][ \t]*$/, '');
        }
        fields[index] = value;
      }
      const rendered = fields.join('').replace(/[ \t]{2,}/g, ' ').trim();
      return /^[,;|\s]*$/.test(rendered) ? '' : rendered;
    }).filter(Boolean).join('\n').trim();
  };
});
