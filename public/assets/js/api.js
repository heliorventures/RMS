window.RMS.api = {
  baseUrl: '',
  _cache: null,

  async _fetch(endpoint, options = {}) {
    const isAuthRoute = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
    const token = window.RMS.auth.getToken();
    if (token && token.startsWith('demo.')) {
      return this._localFallback(endpoint, options);
    }
    try {
      const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...options,
        headers: { ...window.RMS.auth.headers(), ...(options.headers || {}) }
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned an invalid response. Please run: npm start');
      }
      if (res.status === 401 && !isAuthRoute) {
        window.RMS.auth.logout();
        return null;
      }
      if (!res.ok) {
        return { success: false, message: data.message || 'Request failed' };
      }
      return data;
    } catch (err) {
      console.warn('API fallback:', err.message);
      return this._localFallback(endpoint, options);
    }
  },

  async _loadLocalData() {
    if (this._cache) return this._cache;
    try {
      const res = await fetch('/data/sample-data.json');
      this._cache = await res.json();
    } catch {
      this._cache = { contacts: [], groups: [], festivals: [], events: [], templates: [], campaigns: [], messages: [], deliveryJobs: [], communicationHistory: [], settings: {}, notifications: [] };
    }
    return this._cache;
  },

  async _localFallback(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const parts = endpoint.split('?')[0].split('/').filter(Boolean);

    if (endpoint.startsWith('/auth/login') && method === 'POST') {
      return this._demoLogin(options.body);
    }
    if (endpoint.startsWith('/auth/profile')) {
      const user = window.RMS.auth.getUser();
      return { success: true, data: user };
    }
    if (endpoint.startsWith('/auth/')) {
      return { success: true, message: 'OK' };
    }

    const data = await this._loadLocalData();

    if (endpoint.startsWith('/dashboard/stats')) {
      return { success: true, data: this._buildDashboardStats(data) };
    }
    if (parts[0] === 'contacts') {
      if (parts[1] === 'birthdays') return { success: true, data: this._filterDates(data.contacts, 'dob', 'upcoming') };
      if (parts[1] === 'anniversaries') return { success: true, data: this._filterDates(data.contacts, 'anniversary', 'upcoming') };

      if (parts[1] === 'bulk-import' && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const rows = body.contacts || [];
        const prepared = rows.map(row => ({
          _id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          ...window.RMS.utils.normalizeContactRow(row),
          groups: [],
          photo: null,
          timeline: [{ action: 'Imported', description: 'Bulk upload', date: new Date().toISOString(), user: 'Admin User' }],
          createdAt: new Date().toISOString()
        })).filter(c => c.firstName && c.lastName);
        data.contacts.push(...prepared);
        return { success: true, data: { inserted: prepared.length, skipped: rows.length - prepared.length, errors: [] } };
      }

      if (parts[1] && method === 'PUT') {
        const body = JSON.parse(options.body || '{}');
        const idx = data.contacts.findIndex(c => c._id === parts[1]);
        if (idx === -1) return { success: false, message: 'Contact not found.' };
        data.contacts[idx] = { ...data.contacts[idx], ...body, updatedAt: new Date().toISOString() };
        return { success: true, data: data.contacts[idx] };
      }

      if (parts[1] && method === 'DELETE') {
        const idx = data.contacts.findIndex(c => c._id === parts[1]);
        if (idx === -1) return { success: false, message: 'Contact not found.' };
        data.contacts.splice(idx, 1);
        return { success: true, message: 'Contact deleted.' };
      }

      if (method === 'POST' && !parts[1]) {
        const body = JSON.parse(options.body || '{}');
        const newItem = {
          _id: `con_${Date.now()}`,
          ...body,
          country: body.country || 'India',
          createdAt: new Date().toISOString()
        };
        data.contacts.push(newItem);
        return { success: true, data: newItem };
      }

      if (parts[1]) return { success: true, data: data.contacts.find(c => c._id === parts[1]) };

      const params = new URLSearchParams((endpoint.split('?')[1] || ''));
      const page = +params.get('page') || 1;
      const limit = +params.get('limit') || 10;
      const search = params.get('search') || '';
      const sort = params.get('sort') || 'firstName';
      const order = params.get('order') || 'asc';
      const filters = {
        city: params.get('city') || '',
        sector: params.get('sector') || '',
        religion: params.get('religion') || '',
        status: params.get('status') || ''
      };
      const result = this._paginateList(data.contacts, { page, limit, search, sort, order, filters });
      return { success: true, ...result };
    }
    const collectionMap = { groups: 'groups', festivals: 'festivals', events: 'events', templates: 'templates', campaigns: 'campaigns', messages: 'messages', communication: 'communicationHistory', notifications: 'notifications' };
    const key = collectionMap[parts[0]];
    if (key) {
      const list = data[key] || [];
      const item = parts[1] ? list.find(i => i._id === parts[1]) : null;

      if (parts[0] === 'groups' && parts[1] && parts[2] === 'members' && method === 'PUT') {
        const body = JSON.parse(options.body || '{}');
        const memberIds = body.memberIds || [];
        const idx = list.findIndex(i => i._id === parts[1]);
        if (idx === -1) return { success: false, message: 'Group not found.' };
        list[idx] = { ...list[idx], members: memberIds, memberCount: memberIds.length, type: 'static', updatedAt: new Date().toISOString() };
        this._syncGroupMembers(data, parts[1], memberIds);
        list[idx] = this._withGroupMemberCount(list[idx], data.contacts || []);
        const members = this._resolveGroupMembers(list[idx], data.contacts || []);
        return { success: true, data: { group: list[idx], members } };
      }

      if (parts[1] && method === 'PUT') {
        const body = JSON.parse(options.body || '{}');
        const idx = list.findIndex(i => i._id === parts[1]);
        if (idx === -1) return { success: false, message: 'Record not found.' };
        if (body.memberIds) {
          body.members = body.memberIds;
          body.memberCount = body.memberIds.length;
          delete body.memberIds;
          this._syncGroupMembers(data, parts[1], body.members);
        }
        list[idx] = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
        if (parts[0] === 'groups') {
          list[idx] = this._withGroupMemberCount(list[idx], data.contacts || []);
          const members = this._resolveGroupMembers(list[idx], data.contacts || []);
          return { success: true, data: { group: list[idx], members } };
        }
        return { success: true, data: list[idx] };
      }

      if (parts[1] && method === 'DELETE') {
        const idx = list.findIndex(i => i._id === parts[1]);
        if (idx === -1) return { success: false, message: 'Record not found.' };
        list.splice(idx, 1);
        return { success: true, message: 'Deleted.' };
      }

      if (method === 'POST' && !parts[1]) {
        const body = JSON.parse(options.body || '{}');
        if (body.memberIds) {
          body.members = body.memberIds;
          body.memberCount = body.memberIds.length;
          delete body.memberIds;
        }
        const prefix = parts[0].slice(0, 3);
        const newItem = { _id: `${prefix}_${Date.now()}`, ...body, createdAt: new Date().toISOString() };
        if (parts[0] === 'groups') {
          const withCount = this._withGroupMemberCount(newItem, data.contacts || []);
          Object.assign(newItem, withCount);
        }
        list.push(newItem);
        if (parts[0] === 'groups' && newItem.members?.length) {
          this._syncGroupMembers(data, newItem._id, newItem.members);
        }
        return { success: true, data: newItem };
      }

      if (parts[0] === 'groups' && parts[1] && method === 'GET' && !parts[2]) {
        if (!item) return { success: false, message: 'Group not found.' };
        const members = this._resolveGroupMembers(item, data.contacts || []);
        return { success: true, data: { group: this._withGroupMemberCount(item, data.contacts || []), members } };
      }

      if (parts[1]) return { success: true, data: item };
      if (parts[0] === 'groups') {
        return { success: true, data: list.map(g => this._withGroupMemberCount(g, data.contacts || [])) };
      }
      return { success: true, data: list };
    }
    if (endpoint.startsWith('/settings')) {
      const currentUser = window.RMS.auth.getUser();
      const isAdmin = currentUser?.role === 'admin';

      if (endpoint.includes('/users')) {
        if (!isAdmin) {
          return { success: false, message: 'Access denied. Admin privileges required.' };
        }
        const userParts = endpoint.split('?')[0].split('/').filter(Boolean);
        const userId = userParts[userParts.length - 1] !== 'users' ? userParts[userParts.length - 1] : null;

        if (method === 'GET') return { success: true, data: (data.users || []).map(({ password, ...u }) => u) };

        if (method === 'POST') {
          const body = JSON.parse(options.body || '{}');
          const exists = (data.users || []).find(u => u.email?.toLowerCase() === body.email?.toLowerCase());
          if (exists) return { success: false, message: 'Email already exists.' };
          const newUser = {
            _id: `usr_${Date.now()}`,
            name: body.name,
            email: body.email,
            role: body.role || 'user',
            phone: body.phone || '',
            isActive: body.isActive !== false,
            password: 'demo-hash',
            createdAt: new Date().toISOString()
          };
          if (!data.users) data.users = [];
          data.users.push(newUser);
          const { password, ...safe } = newUser;
          return { success: true, data: safe, message: 'User created.' };
        }

        if (method === 'PUT' && userId) {
          const body = JSON.parse(options.body || '{}');
          const idx = (data.users || []).findIndex(u => u._id === userId);
          if (idx === -1) return { success: false, message: 'User not found.' };
          data.users[idx] = { ...data.users[idx], ...body, updatedAt: new Date().toISOString() };
          const { password, ...safe } = data.users[idx];
          return { success: true, data: safe, message: 'User updated.' };
        }

        if (method === 'DELETE' && userId) {
          const idx = (data.users || []).findIndex(u => u._id === userId);
          if (idx === -1) return { success: false, message: 'User not found.' };
          data.users[idx].isActive = false;
          const { password, ...safe } = data.users[idx];
          return { success: true, data: safe, message: 'User deactivated.' };
        }
      }
      if (endpoint.includes('/roles') && method === 'PUT') {
        if (!isAdmin) return { success: false, message: 'Access denied. Admin privileges required.' };
        const body = JSON.parse(options.body || '{}');
        const roles = [...(data.settings?.roles || [])];
        const idx = roles.findIndex(r => r.name === body.roleName);
        if (idx === -1) return { success: false, message: 'Role not found.' };
        roles[idx] = { name: body.name || body.roleName, permissions: body.permissions || [] };
        data.settings = { ...data.settings, roles };
        return { success: true, data: roles[idx], message: 'Role updated.' };
      }
      if (method === 'PUT') {
        if (!isAdmin) return { success: false, message: 'Access denied. Admin privileges required.' };
        const body = JSON.parse(options.body || '{}');
        data.settings = { ...data.settings, ...body, updatedAt: new Date().toISOString() };
        return { success: true, data: data.settings };
      }
      const settings = data.settings || {};
      if (!isAdmin) {
        return {
          success: true,
          data: {
            company: settings.company,
            labels: settings.labels,
            theme: settings.theme
          }
        };
      }
      return { success: true, data: settings };
    }
    if (endpoint.startsWith('/reports/contacts')) return { success: true, data: { total: data.contacts.length } };
    if (parts[0] === 'delivery') {
      if (parts[1] === 'jobs' && method === 'GET' && !parts[2]) {
        const jobs = data.deliveryJobs || [];
        return { success: true, data: jobs.slice(0, 30), pagination: { page: 1, limit: 30, total: jobs.length, pages: 1 } };
      }
      if (parts[1] === 'jobs' && method === 'POST') {
        return { success: false, message: 'Delivery requires the server. Start with: npm start' };
      }
      if (parts[1] === 'test-email' && method === 'POST') {
        return { success: false, message: 'SMTP test requires the server. Start with: npm start' };
      }
      return { success: true, data: [] };
    }
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return { success: false, message: 'Server is not running. Please start the app with: npm start' };
    }
    return { success: true, data: [] };
  },

  async _demoLogin(bodyStr) {
    let body = {};
    try { body = JSON.parse(bodyStr || '{}'); } catch { /* ignore */ }
    const data = await this._loadLocalData();
    const user = (data.users || []).find(u => u.email?.toLowerCase() === body.email?.toLowerCase());
    const demoAccounts = {
      'admin@rms.com': { name: 'Admin User', role: 'admin' },
      'manager@rms.com': { name: 'Manager User', role: 'manager' },
      'demo@rms.com': { name: 'Demo User', role: 'user' }
    };
    const demo = demoAccounts[body.email?.toLowerCase()];
    if (demo && body.password === 'admin123') {
      const token = 'demo.' + btoa(JSON.stringify({ id: user?._id || 'demo', email: body.email, role: demo.role, name: demo.name }));
      return { success: true, token, user: { _id: user?._id || 'demo', name: demo.name, email: body.email, role: demo.role } };
    }
    if (user && body.password === 'admin123') {
      const token = 'demo.' + btoa(JSON.stringify({ id: user._id, email: user.email, role: user.role, name: user.name }));
      const { password, ...safeUser } = user;
      return { success: true, token, user: safeUser };
    }
    return { success: false, message: 'Invalid email or password.' };
  },

  _withGroupMemberCount(group, contacts) {
    return { ...group, memberCount: this._resolveGroupMembers(group, contacts).length };
  },

  _matchRule(contact, rule) {
    const val = contact[rule.field];
    switch (rule.operator) {
      case 'equals':
        if (val == null || rule.value == null) return false;
        if (['city', 'sector', 'religion', 'status'].includes(rule.field)) {
          return String(val).toLowerCase() === String(rule.value).toLowerCase();
        }
        return val === rule.value;
      case 'contains': return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
      default: return true;
    }
  },

  _resolveGroupMembers(group, contacts) {
    const excluded = new Set((group.excludedMembers || []).map(String));
    let members;
    if (group.type === 'dynamic' && group.rules?.length) {
      members = contacts.filter(c => group.rules.every(rule => this._matchRule(c, rule)));
    } else if (group.members?.length) {
      const ids = group.members.map(String);
      members = contacts.filter(c => ids.includes(String(c._id)));
    } else {
      members = contacts.filter(c => (c.groups || []).map(String).includes(String(group._id)));
    }
    return members.filter(c => !excluded.has(String(c._id)));
  },

  _syncGroupMembers(data, groupId, memberIds) {
    const ids = (memberIds || []).map(String);
    (data.contacts || []).forEach(c => {
      const set = new Set((c.groups || []).map(String));
      if (ids.includes(String(c._id))) set.add(String(groupId));
      else set.delete(String(groupId));
      c.groups = [...set];
    });
  },

  _paginateList(items, { page = 1, limit = 10, search = '', sort = 'firstName', order = 'asc', filters = {} } = {}) {
    let list = [...(items || [])];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item => ['firstName', 'lastName', 'email', 'mobile', 'company', 'designation', 'occupation', 'city', 'sector'].some(k => {
        const v = item[k];
        return v && String(v).toLowerCase().includes(q);
      }));
    }
    Object.entries(filters).forEach(([k, v]) => {
      if (v) list = list.filter(i => i[k] === v);
    });
    list.sort((a, b) => {
      const av = (a[sort] ?? '').toString().toLowerCase();
      const bv = (b[sort] ?? '').toString().toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });
    const total = list.length;
    const start = (page - 1) * limit;
    return {
      data: list.slice(start, start + limit),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  _filterDates(contacts, field, type) {
    const today = new Date();
    return contacts.filter(c => {
      if (!c[field]) return false;
      const d = new Date(c[field]);
      if (type === 'today') return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      return (next - today) / 86400000 <= 30;
    });
  },

  _buildDashboardStats(data) {
    const contacts = data.contacts || [];
    const messages = data.messages || [];
    const today = new Date();
    const todayBirthdays = contacts.filter(c => c.dob && new Date(c.dob).getMonth() === today.getMonth() && new Date(c.dob).getDate() === today.getDate());
    const bySector = {}, byReligion = {};
    contacts.forEach(c => { bySector[c.sector] = (bySector[c.sector] || 0) + 1; byReligion[c.religion] = (byReligion[c.religion] || 0) + 1; });
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const bMonth = months.map((m, i) => ({ month: m, count: contacts.filter(c => c.dob && new Date(c.dob).getMonth() === i).length }));
    return {
      stats: {
        totalContacts: contacts.length, todayBirthdays: todayBirthdays.length,
        upcomingBirthdays: 10, upcomingAnniversaries: 8, upcomingEvents: (data.events || []).length,
        messagesToday: 12, pendingMessages: messages.filter(m => m.status === 'pending').length,
        emailSent: messages.filter(m => m.type === 'email').length,
        whatsappSent: messages.filter(m => m.type === 'whatsapp').length,
        activeCampaigns: (data.campaigns || []).filter(c => c.status === 'running').length
      },
      charts: { birthdaysByMonth: bMonth, contactsBySector: bySector, contactsByReligion: byReligion, messagesByMonth: {} },
      recentActivities: (data.communicationHistory || []).slice(0, 10),
      recentContacts: contacts.slice(-5).reverse(),
      notifications: data.notifications || [],
      todayBirthdaysList: todayBirthdays.slice(0, 5)
    };
  },

  get: (ep) => window.RMS.api._fetch(ep),
  post: (ep, body) => window.RMS.api._fetch(ep, { method: 'POST', body: JSON.stringify(body) }),
  put: (ep, body) => window.RMS.api._fetch(ep, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (ep) => window.RMS.api._fetch(ep, { method: 'DELETE' })
};

