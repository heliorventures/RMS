const Contact = require('../models/Contact');
const ExportJob = require('../models/ExportJob');

const ALLOWED_FILTERS = new Set(['city', 'sector', 'religion', 'status', 'gender']);

function filtersFrom(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => ALLOWED_FILTERS.has(key) && typeof value === 'string' && value));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const exportController = {
  async createContactsExport(req, res) {
    try {
      const job = await ExportJob.create({
        type: 'contacts',
        filters: filtersFrom(req.body?.filters),
        createdBy: req.user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });
      res.status(202).json({ success: true, data: { id: job.id, status: job.status, downloadUrl: `/api/exports/${job.id}/download` } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async download(req, res) {
    try {
      const job = await ExportJob.findOne({ _id: req.params.id, createdBy: req.user.id, status: 'ready', expiresAt: { $gt: new Date() } }).lean();
      if (!job) return res.status(404).json({ success: false, message: 'Export is unavailable or has expired.' });

      res.status(200);
      res.type('text/csv');
      res.attachment(`contacts-${job.createdAt.toISOString().slice(0, 10)}.csv`);
      res.write('First Name,Last Name,Email,Mobile,Company,Designation,City,Sector,Religion,Status\n');
      const cursor = Contact.find(job.filters).sort({ firstName: 1, _id: 1 }).lean().cursor();
      for await (const contact of cursor) {
        res.write([contact.firstName, contact.lastName, contact.email, contact.mobile, contact.company, contact.designation, contact.city, contact.sector, contact.religion, contact.status].map(escapeCsv).join(',') + '\n');
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
      else res.destroy(err);
    }
  }
};

module.exports = exportController;
