const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../../data/sample-data.json');

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_FILE)) {
    cache = getEmptyStore();
    save();
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return cache;
}

function save() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

function getEmptyStore() {
  return {
    users: [],
    contacts: [],
    groups: [],
    festivals: [],
    events: [],
    templates: [],
    campaigns: [],
    messages: [],
    deliveryJobs: [],
    communicationHistory: [],
    settings: {},
    notifications: []
  };
}

function ensureId(item) {
  if (!item._id) item._id = uuidv4();
  if (!item.createdAt) item.createdAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  return item;
}

const jsonStore = {
  isJsonMode: true,

  getAll(collection, filter = {}) {
    const data = load();
    let items = data[collection] || [];
    if (typeof filter === 'function') items = items.filter(filter);
    else if (Object.keys(filter).length) {
      items = items.filter(item =>
        Object.entries(filter).every(([k, v]) => {
          if (v === undefined) return true;
          return item[k] === v;
        })
      );
    }
    return items;
  },

  getById(collection, id) {
    return this.getAll(collection).find(i => i._id === id) || null;
  },

  create(collection, item) {
    const data = load();
    if (!data[collection]) data[collection] = [];
    const newItem = ensureId({ ...item });
    data[collection].push(newItem);
    save();
    return newItem;
  },

  bulkCreate(collection, items) {
    const data = load();
    if (!data[collection]) data[collection] = [];
    const newItems = items.map(item => ensureId({ ...item }));
    data[collection].push(...newItems);
    save();
    return { inserted: newItems.length, items: newItems };
  },

  update(collection, id, updates) {
    const data = load();
    const idx = (data[collection] || []).findIndex(i => i._id === id);
    if (idx === -1) return null;
    data[collection][idx] = { ...data[collection][idx], ...updates, updatedAt: new Date().toISOString() };
    save();
    return data[collection][idx];
  },

  delete(collection, id) {
    const data = load();
    const before = (data[collection] || []).length;
    data[collection] = (data[collection] || []).filter(i => i._id !== id);
    save();
    return before !== data[collection].length;
  },

  getSettings() {
    const data = load();
    return data.settings || {};
  },

  updateSettings(updates) {
    const data = load();
    data.settings = { ...data.settings, ...updates, updatedAt: new Date().toISOString() };
    save();
    return data.settings;
  },

  paginate(collection, { page = 1, limit = 10, sort = 'createdAt', order = 'desc', search = '', filters = {} } = {}) {
    let items = [...this.getAll(collection)];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        Object.values(item).some(v =>
          typeof v === 'string' && v.toLowerCase().includes(q)
        )
      );
    }

    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') items = items.filter(i => i[k] === v);
    });

    items.sort((a, b) => {
      const av = a[sort] ?? '';
      const bv = b[sort] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });

    const total = items.length;
    const start = (page - 1) * limit;
    return {
      data: items.slice(start, start + limit),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  reload() {
    cache = null;
    return load();
  }
};

module.exports = jsonStore;
