window.RMS = window.RMS || {};

window.RMS.utils = {
  formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  getInitials(first, last) {
    return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
  },

  getAvatarColor(name) {
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#059669', '#0891b2'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  },

  statusBadge(status) {
    const map = {
      Active: 'badge-active', Inactive: 'badge-inactive', VIP: 'badge-vip',
      draft: 'badge-draft', scheduled: 'badge-scheduled', sent: 'badge-sent',
      completed: 'badge-completed', delivered: 'badge-sent', pending: 'badge-scheduled',
      failed: 'badge-inactive', skipped: 'badge-draft', processing: 'badge-scheduled',
      queued: 'badge-scheduled', partial: 'badge-vip', running: 'badge-scheduled'
    };
    return `<span class="badge-status ${map[status] || 'badge-draft'}">${status || 'Unknown'}</span>`;
  },

  async queueDeliveryJob(payload, options = {}) {
    const res = await window.RMS.api.post('/delivery/jobs', payload);
    if (res?.success) {
      const total = res.data?.stats?.total;
      const msg = options.successMessage
        || (typeof total === 'number'
          ? `Queued ${total.toLocaleString()} message${total === 1 ? '' : 's'} for delivery`
          : (res.message || 'Messages queued'));
      window.RMS.toast.show(msg, 'success');
      if (options.redirect) window.location.href = options.redirect;
      return res.data;
    }
    window.RMS.toast.show(res?.message || options.errorMessage || 'Delivery queue failed', 'error');
    return null;
  },

  debounce(fn, delay = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  },

  animateCount(el, target, duration = 1000) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = Math.floor(start + (target - start) * progress).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  replaceVars(text, data) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || data[key.toLowerCase()] || `{{${key}}}`);
  },

  formatContactSubtitle(c) {
    if (!c) return '';
    const role = [c.designation, c.company].filter(Boolean).join(' · ');
    return role || c.sector || c.city || '';
  },

  contactTemplateVars(c) {
    if (!c) return {};
    return {
      Name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      FirstName: c.firstName || '',
      LastName: c.lastName || '',
      City: c.city || '',
      Sector: c.sector || '',
      Company: c.company || '',
      Designation: c.designation || '',
      Occupation: c.occupation || '',
      Mobile: c.mobile || '',
      Email: c.email || '',
      Address: c.address || '',
      State: c.state || '',
      Pincode: c.pincode || '',
      Religion: c.religion || '',
      Birthday: c.dob ? this.formatDate(c.dob) : '',
      Anniversary: c.anniversary ? this.formatDate(c.anniversary) : ''
    };
  },

  contactSearchText(c) {
    if (!c) return '';
    return [c.firstName, c.lastName, c.email, c.mobile, c.company, c.designation, c.occupation, c.city, c.sector]
      .filter(Boolean).join(' ').toLowerCase();
  },

  queryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  },

  downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  },

  parseCSV(text) {
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line.charAt(i);
        if (ch === '"') {
          if (inQuotes && line.charAt(i + 1) === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += ch;
      }
      result.push(current.trim());
      return result;
    };

    const fieldMap = {
      'first name': 'firstName', 'firstname': 'firstName',
      'last name': 'lastName', 'lastname': 'lastName',
      'gender': 'gender', 'date of birth': 'dob', 'dob': 'dob', 'birthday': 'dob',
      'anniversary': 'anniversary', 'mobile': 'mobile', 'phone': 'mobile',
      'whatsapp': 'whatsapp', 'email': 'email', 'religion': 'religion',
      'sector': 'sector', 'occupation': 'occupation', 'company': 'company',
      'designation': 'designation', 'city': 'city', 'state': 'state',
      'pincode': 'pincode', 'address': 'address', 'tags': 'tags',
      'status': 'status', 'notes': 'notes'
    };

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.every(v => !v)) continue;
      const row = {};
      headers.forEach((header, idx) => {
        const key = fieldMap[header] || header.replace(/\s+/g, '');
        row[key] = values[idx] ?? '';
      });
      rows.push(row);
    }
    return rows;
  },

  normalizeContactRow(row) {
    const parseDate = (value) => {
      if (!value || !String(value).trim()) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };
    return {
      firstName: String(row.firstName || '').trim(),
      lastName: String(row.lastName || '').trim(),
      gender: row.gender || 'Male',
      dob: parseDate(row.dob),
      anniversary: parseDate(row.anniversary),
      mobile: row.mobile || null,
      whatsapp: row.whatsapp || null,
      email: row.email || null,
      religion: row.religion || null,
      sector: row.sector || null,
      occupation: row.occupation || null,
      company: row.company || null,
      designation: row.designation || null,
      city: row.city || null,
      state: row.state || null,
      country: 'India',
      pincode: row.pincode || null,
      address: row.address || null,
      tags: row.tags ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
      status: row.status || 'Active',
      notes: row.notes || null
    };
  }
};

window.RMS.toast = {
  show(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: 'check-circle-fill', error: 'x-circle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#2563eb' };
    const toast = document.createElement('div');
    toast.className = 'toast-rms d-flex align-items-center gap-2';
    toast.innerHTML = `<i class="bi bi-${icons[type] || icons.info}" style="color:${colors[type] || colors.info};font-size:1.25rem"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
