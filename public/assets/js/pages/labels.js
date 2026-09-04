RMS.components.initLayout('/pages/labels.html', 'Label Printing', 'Home / Labels');

const SIZE_PRESETS = {
  envelope: { width: 100, height: 50, name: 'Envelope (10×5 cm)' },
  giftMedium: { width: 80, height: 60, name: 'Gift Box — Medium (8×6 cm)' },
  giftLarge: { width: 100, height: 70, name: 'Gift Box — Large (10×7 cm)' },
  sticker: { width: 70, height: 40, name: 'Sticker (7×4 cm)' }
};

const TO_VARS = ['firstName', 'lastName', 'fullName', 'company', 'designation', 'address', 'city', 'state', 'pincode', 'country', 'mobile'];
const FROM_VARS = ['companyName', 'companyAddress', 'companyPhone', 'companyEmail', 'companyWebsite'];

const DEFAULT_TO = `{{fullName}}
{{designation}}
{{company}}
{{address}}
{{city}}, {{state}} {{pincode}}`;

const DEFAULT_FROM = `{{companyName}}
{{companyAddress}}
{{companyPhone}}`;

let labelConfig = {};
let companyData = {};
let selectedContacts = [];
let previewContact = null;
let searchResultCache = [];

document.getElementById('pageActions').innerHTML = `
  <button class="btn btn-outline-secondary" onclick="saveLabelFormat(this)"><i class="bi bi-save me-1"></i> Save Format</button>
  <button class="btn btn-outline-primary" onclick="downloadLabelsPdf()" id="downloadPdfBtn" disabled><i class="bi bi-file-earmark-pdf me-1"></i> Download PDF</button>
  <button class="btn btn-outline-primary" onclick="downloadLabelsHtml()" id="downloadHtmlBtn" disabled><i class="bi bi-download me-1"></i> Download HTML</button>
  <button class="btn btn-primary" onclick="printLabels()" id="printBtn" disabled><i class="bi bi-printer me-1"></i> Print</button>`;

document.getElementById('pageBody').innerHTML = `
  <div class="alert py-2 small d-none" id="labelMutationStatus"></div>
  <div class="row g-4">
    <div class="col-lg-4">
      <div class="card label-format-panel">
        <div class="card-header gradient"><i class="bi bi-sliders me-2"></i>Label Format</div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label">Size Preset</label>
            <select class="form-select" id="sizePreset" onchange="applySizePreset()">
              ${Object.entries(SIZE_PRESETS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
              <option value="custom">Custom size</option>
            </select>
          </div>
          <div class="row g-2 mb-3" id="customSizeRow" style="display:none">
            <div class="col-6"><label class="form-label small">Width (mm)</label><input type="number" class="form-control form-control-sm" id="labelWidth" min="40" max="200" value="100"></div>
            <div class="col-6"><label class="form-label small">Height (mm)</label><input type="number" class="form-control form-control-sm" id="labelHeight" min="30" max="150" value="50"></div>
          </div>
          <div class="mb-3">
            <label class="form-label">Layout</label>
            <select class="form-select" id="labelLayout" onchange="renderPreview()">
              <option value="stacked">To on top, From below</option>
              <option value="side">To and From side by side</option>
              <option value="toOnly">To address only</option>
              <option value="fromOnly">From address only</option>
            </select>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-6"><label class="form-label small">Font size (pt)</label><input type="number" class="form-control form-control-sm" id="labelFontSize" min="8" max="18" value="11"></div>
            <div class="col-6"><label class="form-label small">To label text</label><input class="form-control form-control-sm" id="toHeading" value="To"></div>
          </div>
          <div class="mb-1"><label class="form-label">From label text</label><input class="form-control form-control-sm mb-2" id="fromHeading" value="From"></div>

          <div class="mb-3">
            <label class="form-label">To format</label>
            <textarea class="form-control font-monospace small" id="toFormat" rows="5" oninput="renderPreview()"></textarea>
            <div class="mt-1">${TO_VARS.map(v => `<button type="button" class="var-chip" onclick="insertVar('toFormat','${v}')">${v}</button>`).join('')}</div>
          </div>
          <div class="mb-3">
            <label class="form-label">From format</label>
            <textarea class="form-control font-monospace small" id="fromFormat" rows="4" oninput="renderPreview()"></textarea>
            <div class="mt-1">${FROM_VARS.map(v => `<button type="button" class="var-chip" onclick="insertVar('fromFormat','${v}')">${v}</button>`).join('')}</div>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="showBorder" checked onchange="renderPreview()">
            <label class="form-check-label" for="showBorder">Show label border (preview)</label>
          </div>
        </div>
      </div>
    </div>

    <div class="col-lg-8">
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-people me-2"></i>Select Recipients</span>
          <span class="badge bg-primary" id="selectedCount">0 selected</span>
        </div>
        <div class="card-body">
          <div class="row g-2 mb-3">
            <div class="col-md-8">
              <label class="visually-hidden" for="contactSearch">Search contacts</label>
              <input type="text" class="form-control" id="contactSearch" placeholder="Search by name, designation, company, city..." oninput="searchContacts()">
            </div>
            <div class="col-md-4">
              <label class="visually-hidden" for="groupFilter">Add contacts from group</label>
              <select class="form-select" id="groupFilter" onchange="loadGroupContacts()">
                <option value="">Add from group...</option>
              </select>
            </div>
          </div>
          <div id="searchResults" class="list-group mb-3" style="max-height:160px;overflow-y:auto"></div>
          <div id="selectedChips" class="mb-2"></div>
          <button class="btn btn-sm btn-outline-danger" onclick="clearSelected()" id="clearBtn" style="display:none"><i class="bi bi-x-lg"></i> Clear all</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="bi bi-eye me-2"></i>Preview & Print</div>
        <div class="card-body">
          <div class="alert alert-light border small mb-3">
            <strong><i class="bi bi-info-circle me-1"></i>How to download & print</strong>
            <ol class="mb-0 mt-2 ps-3">
              <li>Select one or more contacts above</li>
              <li><strong>Download PDF</strong> — saves a PDF file to your computer, then open and print</li>
              <li><strong>Download HTML</strong> — saves a printable file; open it and press Ctrl+P (or choose Print → Save as PDF)</li>
              <li><strong>Print</strong> — opens the print dialog directly (choose your printer or <em>Save as PDF</em> / <em>Microsoft Print to PDF</em>)</li>
            </ol>
          </div>
          <p class="small text-secondary mb-2" id="previewHint">Preview shows the first selected contact. Download/print creates one label per contact.</p>
          <div class="label-preview-wrap">
            <div class="label-sheet-preview" id="previewArea">
              <p class="text-secondary mb-0">Select a contact to preview the label</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div id="printArea"></div>`;

initLabels();

async function initLabels() {
  const [settingsRes, groupsRes] = await Promise.all([
    RMS.api.get('/settings'),
    RMS.api.get('/groups')
  ]);

  companyData = settingsRes?.data?.company || {};
  labelConfig = settingsRes?.data?.labels || {};

  document.getElementById('toFormat').value = labelConfig.toFormat || DEFAULT_TO;
  document.getElementById('fromFormat').value = labelConfig.fromFormat || DEFAULT_FROM;
  document.getElementById('labelLayout').value = labelConfig.layout || 'stacked';
  document.getElementById('labelFontSize').value = labelConfig.fontSize || 11;
  document.getElementById('toHeading').value = labelConfig.toHeading || 'To';
  document.getElementById('fromHeading').value = labelConfig.fromHeading || 'From';
  document.getElementById('showBorder').checked = labelConfig.showBorder !== false;

  const preset = labelConfig.sizePreset || 'envelope';
  document.getElementById('sizePreset').value = preset;
  if (preset === 'custom') {
    document.getElementById('customSizeRow').style.display = '';
    document.getElementById('labelWidth').value = labelConfig.width || 100;
    document.getElementById('labelHeight').value = labelConfig.height || 50;
  } else {
    applySizePreset(false);
  }

  const groups = groupsRes?.data || [];
  document.getElementById('groupFilter').innerHTML = '<option value="">Add from group...</option>' +
    groups.map(g => `<option value="${g._id}">${g.name} (${g.memberCount || 0})</option>`).join('');

  ['labelWidth', 'labelHeight', 'labelFontSize', 'toHeading', 'fromHeading'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderPreview);
  });

  const ids = (RMS.utils.queryParams().ids || '').split(',').filter(Boolean);
  if (ids.length) {
    const res = await RMS.api.post('/contacts/bulk-lookup', { ids });
    (res?.data || []).forEach(addContact);
  }

  renderPreview();
}

function getLabelDimensions() {
  const preset = document.getElementById('sizePreset').value;
  if (preset === 'custom') {
    return {
      width: +document.getElementById('labelWidth').value || 100,
      height: +document.getElementById('labelHeight').value || 50
    };
  }
  const p = SIZE_PRESETS[preset] || SIZE_PRESETS.envelope;
  return { width: p.width, height: p.height };
}

window.applySizePreset = (render = true) => {
  const preset = document.getElementById('sizePreset').value;
  document.getElementById('customSizeRow').style.display = preset === 'custom' ? '' : 'none';
  if (preset !== 'custom') {
    const p = SIZE_PRESETS[preset];
    document.getElementById('labelWidth').value = p.width;
    document.getElementById('labelHeight').value = p.height;
  }
  if (render) renderPreview();
};

window.insertVar = (fieldId, varName) => {
  const el = document.getElementById(fieldId);
  const token = `{{${varName}}}`;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = el.value.slice(0, start) + token + el.value.slice(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + token.length;
  renderPreview();
};

function contactToData(c) {
  return {
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    fullName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    company: c.company || '',
    designation: c.designation || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    pincode: c.pincode || '',
    country: c.country || '',
    mobile: c.mobile || ''
  };
}

function companyToData(c) {
  return {
    companyName: c.name || '',
    companyAddress: c.address || '',
    companyPhone: c.phone || '',
    companyEmail: c.email || '',
    companyWebsite: c.website || ''
  };
}

function applyTemplate(template, data) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] ?? '').trim()).replace(/\n\s*\n/g, '\n').trim();
}

function buildLabelHtml(contact, forPrint = false) {
  const { width, height } = getLabelDimensions();
  const layout = document.getElementById('labelLayout').value;
  const fontSize = document.getElementById('labelFontSize').value;
  const toHeading = document.getElementById('toHeading').value || 'To';
  const fromHeading = document.getElementById('fromHeading').value || 'From';
  const showBorder = document.getElementById('showBorder').checked;
  const toText = applyTemplate(document.getElementById('toFormat').value, contactToData(contact));
  const fromText = applyTemplate(document.getElementById('fromFormat').value, companyToData(companyData));

  const layoutClass = layout === 'side' ? 'layout-side'
    : layout === 'fromOnly' ? 'layout-from-only'
    : layout === 'toOnly' ? 'layout-to-only'
    : 'layout-stacked';
  const borderStyle = showBorder || forPrint ? '' : 'border-style:solid;border-color:transparent;';
  const sizeStyle = forPrint
    ? `width:${width}mm;min-height:${height}mm;height:auto;`
    : `width:${width}mm;height:${height}mm;`;
  const overflowStyle = forPrint ? 'overflow:visible;' : 'overflow:hidden;';

  let toBlock = '';
  let fromBlock = '';

  if (layout !== 'fromOnly') {
    toBlock = `
      <div class="label-to">
        <div class="label-heading">${escapeHtml(toHeading)}</div>
        <div class="label-body">${escapeHtml(toText)}</div>
      </div>`;
  }

  if (layout !== 'toOnly') {
    fromBlock = `
      <div class="label-from">
        <div class="label-heading">${escapeHtml(fromHeading)}</div>
        <div class="label-body">${escapeHtml(fromText)}</div>
      </div>`;
  }

  return `
    <div class="print-label ${layoutClass}" style="${sizeStyle}font-size:${fontSize}pt;${borderStyle}${overflowStyle}">
      ${toBlock}
      ${fromBlock}
    </div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setOutputButtonsEnabled(enabled) {
  ['printBtn', 'downloadPdfBtn', 'downloadHtmlBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

const STANDALONE_LABEL_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Inter, Arial, sans-serif; background: #fff; }
  .print-sheet {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    gap: 2mm;
    width: 194mm;
    min-height: 277mm;
    padding: 0;
    page-break-after: always;
    break-after: page;
  }
  .print-sheet:last-child { page-break-after: auto; break-after: auto; }
  .print-label {
    background: #fff;
    border: 1px solid #ccc;
    padding: 4mm 5mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: visible;
    word-break: break-word;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .print-label.layout-stacked .label-to { flex: 0 1 auto; }
  .print-label.layout-stacked .label-from {
    border-top: 1px solid #cbd5e1;
    padding-top: 3mm;
    margin-top: 3mm;
    flex-shrink: 0;
  }
  .print-label.layout-side { flex-direction: row; gap: 3mm; align-items: flex-start; }
  .print-label.layout-side .label-to, .print-label.layout-side .label-from { flex: 1; min-width: 0; }
  .print-label.layout-side .label-from { border-left: 1px solid #cbd5e1; padding-left: 3mm; border-top: none; margin-top: 0; padding-top: 0; }
  .print-label.layout-from-only,
  .print-label.layout-to-only { justify-content: flex-start; }
  .print-label.layout-from-only .label-from,
  .print-label.layout-to-only .label-to { flex: 1; width: 100%; }
  .label-heading { font-size: .65em; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 600; margin-bottom: 1.5mm; }
  .label-body { white-space: pre-line; line-height: 1.35; }
  @media print {
    @page { size: A4 portrait; margin: 8mm; }
    html, body { width: 100%; height: auto; }
    .print-sheet { width: 100%; min-height: auto; gap: 2mm; padding: 0; }
    .print-label { page-break-inside: avoid; break-inside: avoid; overflow: visible !important; height: auto !important; }
  }
`;

function isFromOnlyLayout() {
  return document.getElementById('labelLayout')?.value === 'fromOnly';
}

function getPrintContacts() {
  const layout = document.getElementById('labelLayout').value;
  if (layout !== 'fromOnly') return selectedContacts;

  if (!selectedContacts.length) {
    const { width, height } = getLabelDimensions();
    const pageW = 210 - 16;
    const pageH = 297 - 16;
    const perPage = Math.max(1, Math.floor(pageW / width) * Math.floor(pageH / height));
    return Array(perPage).fill({});
  }

  return selectedContacts.map(() => ({}));
}

function requireSelectedContacts() {
  if (isFromOnlyLayout()) return true;
  if (!selectedContacts.length) {
    RMS.toast.show('Select at least one contact', 'warning');
    return false;
  }
  return true;
}

function buildPrintSheetsHtml() {
  const { width, height } = getLabelDimensions();
  const pageW = 210 - 16;
  const pageH = 297 - 16;
  const cols = Math.max(1, Math.floor(pageW / width));
  const rows = Math.max(1, Math.floor(pageH / height));
  const perPage = cols * rows;
  const contacts = getPrintContacts();

  let html = '';
  for (let i = 0; i < contacts.length; i += perPage) {
    const chunk = contacts.slice(i, i + perPage);
    html += `<div class="print-sheet">`;
    chunk.forEach(c => { html += buildLabelHtml(c, true); });
    html += '</div>';
  }
  return html;
}

function buildStandalonePrintDocument(autoPrint = false) {
  const content = buildPrintSheetsHtml();
  const script = autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>' : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RMS Labels — Print</title><style>${STANDALONE_LABEL_CSS}</style></head><body>${content}${script}</body></html>`;
}

function renderPdfInIframe() {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      reject(new Error('Could not create print frame'));
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ iframe, body: doc.body });
    };

    doc.open();
    doc.write(buildStandalonePrintDocument(false));
    doc.close();

    iframe.onload = () => setTimeout(finish, 400);
    setTimeout(finish, 1200);
  });
}

function renderPreview() {
  previewContact = selectedContacts[0] || previewContact;
  const area = document.getElementById('previewArea');
  const fromOnly = isFromOnlyLayout();

  setOutputButtonsEnabled(selectedContacts.length > 0 || fromOnly);

  const hint = document.getElementById('previewHint');
  if (hint) {
    hint.textContent = fromOnly
      ? 'From-only labels show your company return address. Select contacts to control how many labels to print, or print a full sheet with none selected.'
      : 'Preview shows the first selected contact. Download/print creates one label per contact.';
  }

  if (!fromOnly && !previewContact && selectedContacts.length === 0) {
    area.innerHTML = '<p class="text-secondary mb-0">Select a contact to preview the label</p>';
    return;
  }

  const contact = previewContact || selectedContacts[0] || {};
  area.innerHTML = buildLabelHtml(contact);
}

function updateSelectedUI() {
  document.getElementById('selectedCount').textContent = `${selectedContacts.length} selected`;
  document.getElementById('clearBtn').style.display = selectedContacts.length ? '' : 'none';
  document.getElementById('selectedChips').innerHTML = selectedContacts.map(c => `
    <span class="selected-contact-chip">
      ${c.firstName} ${c.lastName}
      <button type="button" onclick="removeContact('${c._id}')" aria-label="Remove contact"><i class="bi bi-x"></i></button>
    </span>`).join('');
  renderPreview();
}

function addContact(c) {
  if (!c?._id || selectedContacts.some(x => x._id === c._id)) return;
  selectedContacts.push(c);
  previewContact = c;
  updateSelectedUI();
}

window.removeContact = (id) => {
  selectedContacts = selectedContacts.filter(c => c._id !== id);
  if (previewContact?._id === id) previewContact = selectedContacts[0] || null;
  updateSelectedUI();
};

window.clearSelected = () => {
  selectedContacts = [];
  previewContact = null;
  updateSelectedUI();
};

const searchContacts = RMS.utils.debounce(async () => {
  const q = document.getElementById('contactSearch').value.trim();
  const box = document.getElementById('searchResults');
  if (q.length < 2) {
    box.innerHTML = '';
    return;
  }
  const res = await RMS.requests.run('labels:contact-search', ({ signal }) =>
    RMS.api.get(`/contacts?page=1&limit=15&search=${encodeURIComponent(q)}`, { signal })
  );
  if (!res) return;
  const list = res?.data || [];
  searchResultCache = list;
  box.innerHTML = list.length
    ? list.map((c, i) => `
      <button type="button" class="list-group-item list-group-item-action contact-pick-item py-2" onclick="pickContactByIndex(${i})">
        <div class="d-flex justify-content-between">
          <strong>${c.firstName} ${c.lastName}</strong>
          <small class="text-secondary">${c.city || ''}</small>
        </div>
        <small class="text-secondary">${RMS.utils.formatContactSubtitle(c) || c.mobile || ''}</small>
      </button>`).join('')
    : '<div class="list-group-item text-secondary small">No contacts found</div>';
}, 300);

window.pickContactByIndex = (i) => {
  const c = searchResultCache[i];
  if (c) addContact(c);
  document.getElementById('contactSearch').value = '';
  document.getElementById('searchResults').innerHTML = '';
  searchResultCache = [];
};

window.pickContact = (c) => {
  addContact(c);
  document.getElementById('contactSearch').value = '';
  document.getElementById('searchResults').innerHTML = '';
};

window.loadGroupContacts = async () => {
  const groupId = document.getElementById('groupFilter').value;
  if (!groupId) return;
  const res = await RMS.requests.run('labels:group-members', ({ signal }) =>
    RMS.api.get(`/groups/${groupId}/members?page=1&limit=100`, { signal })
  );
  if (!res) return;
  const members = res?.data || [];
  members.slice(0, 100).forEach(addContact);
  const total = res?.pagination?.total || members.length;
  if (total > members.length) RMS.toast.show(`Added first ${members.length} of ${total} group members`, 'info');
  else RMS.toast.show(`Added ${members.length} contacts from group`);
  document.getElementById('groupFilter').value = '';
};

window.saveLabelFormat = async (button) => {
  const { width, height } = getLabelDimensions();
  const payload = {
    labels: {
      toFormat: document.getElementById('toFormat').value,
      fromFormat: document.getElementById('fromFormat').value,
      layout: document.getElementById('labelLayout').value,
      fontSize: +document.getElementById('labelFontSize').value,
      toHeading: document.getElementById('toHeading').value,
      fromHeading: document.getElementById('fromHeading').value,
      showBorder: document.getElementById('showBorder').checked,
      sizePreset: document.getElementById('sizePreset').value,
      width,
      height
    }
  };
  await RMS.mutations.runMutation(button, () => RMS.api.put('/settings', payload), {
    errorTarget: '#labelMutationStatus',
    pending: 'Saving…',
    success: 'Label format saved'
  });
};

window.printLabels = () => {
  if (!requireSelectedContacts()) return;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    RMS.toast.show('Allow pop-ups to print labels', 'warning');
    return;
  }
  w.document.open();
  w.document.write(buildStandalonePrintDocument(true));
  w.document.close();
};

window.downloadLabelsHtml = () => {
  if (!requireSelectedContacts()) return;
  const doc = buildStandalonePrintDocument(false);
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rms-labels-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  RMS.toast.show('HTML file downloaded — open it and press Ctrl+P to print');
};

window.downloadLabelsPdf = async () => {
  if (!requireSelectedContacts()) return;
  if (typeof html2pdf === 'undefined') {
    RMS.toast.show('PDF library not loaded — use Download HTML instead', 'error');
    return;
  }

  RMS.toast.show('Generating PDF...', 'info');
  let iframe = null;

  try {
    const rendered = await renderPdfInIframe();
    iframe = rendered.iframe;
    const target = rendered.body;

    await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: `rms-labels-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        scrollY: 0,
        scrollX: 0,
        useCORS: true,
        logging: false,
        width: 794,
        windowWidth: 794
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], after: '.print-sheet', avoid: '.print-label' }
    }).from(target).save();

    RMS.toast.show('PDF downloaded — open the file and print');
  } catch (err) {
    console.error('PDF generation failed:', err);
    RMS.toast.show('PDF generation failed — try Download HTML or Print', 'error');
  } finally {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
  }
};
