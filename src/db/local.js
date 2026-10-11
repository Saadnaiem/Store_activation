const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultStores = [
  'Branch 101 - Al Olaya, Riyadh',
  'Branch 102 - Al Rayan, Riyadh',
  'Branch 103 - Al Takhassusi, Riyadh',
  'Branch 104 - Diplomatic Quarter, Riyadh',
  'Branch 105 - Al Suwaidi, Riyadh',
  'Branch 106 - Al Qassim, Buraidah',
  'Branch 107 - Al Khobar, Eastern Province',
  'Branch 108 - Jeddah Corniche, Western Province'
];

let memoryDb = {
  activations: [],
  stores: [...defaultStores],
  settings: {
    whitelist: {
      mode: 'ALL',
      whitelistMap: { 'saad.naiem@gmail.com': true }
    },
    branding: {
      logoBase64: null
    }
  }
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
  } else {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      memoryDb = {
        activations: parsed.activations || [],
        stores: parsed.stores && parsed.stores.length > 0 ? parsed.stores : [...defaultStores],
        settings: {
          whitelist: (parsed.settings && parsed.settings.whitelist) || memoryDb.settings.whitelist,
          branding: (parsed.settings && parsed.settings.branding) || memoryDb.settings.branding
        }
      };
    } catch (e) {
      console.warn('Could not read existing db.json, using defaults:', e.message);
    }
  }
}

function persistToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryDb, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist db.json:', err);
  }
}

async function initLocal() {
  ensureDataFile();
  console.log('✅ Local file database initialized at data/db.json');
}

const localDb = {
  async getActivations() {
    return [...memoryDb.activations].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  },

  async getActivationById(id) {
    return memoryDb.activations.find(a => a.id === id) || null;
  },

  async createActivation(act) {
    const id = act.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newAct = {
      ...act,
      id,
      stores: act.stores || [],
      images: act.images || [],
      authorId: act.authorId || 'local',
      authorEmail: (act.authorEmail || '').toLowerCase(),
      authorName: act.authorName || 'Staff Member',
      createdAt: act.createdAt || now,
      updatedAt: now
    };
    memoryDb.activations.unshift(newAct);
    persistToFile();
    return newAct;
  },

  async updateActivation(id, act) {
    const idx = memoryDb.activations.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    memoryDb.activations[idx] = {
      ...memoryDb.activations[idx],
      ...act,
      updatedAt: now
    };
    persistToFile();
    return memoryDb.activations[idx];
  },

  async deleteActivation(id) {
    const initialLen = memoryDb.activations.length;
    memoryDb.activations = memoryDb.activations.filter(a => a.id !== id);
    persistToFile();
    return memoryDb.activations.length < initialLen;
  },

  async bulkDeleteActivations(ids) {
    const idSet = new Set(ids);
    const initialLen = memoryDb.activations.length;
    memoryDb.activations = memoryDb.activations.filter(a => !idSet.has(a.id));
    const deletedCount = initialLen - memoryDb.activations.length;
    persistToFile();
    return deletedCount;
  },

  async wipeActivations() {
    memoryDb.activations = [];
    persistToFile();
    return true;
  },

  async getStores() {
    return [...memoryDb.stores].sort();
  },

  async addStores(names) {
    names.forEach(name => {
      const trimmed = name.trim();
      if (trimmed && !memoryDb.stores.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
        memoryDb.stores.push(trimmed);
      }
    });
    memoryDb.stores.sort();
    persistToFile();
    return [...memoryDb.stores];
  },

  async renameStore(oldName, newName) {
    const idx = memoryDb.stores.indexOf(oldName);
    if (idx !== -1) {
      memoryDb.stores[idx] = newName.trim();
      memoryDb.stores.sort();

      // Cascade rename in activations
      memoryDb.activations.forEach(act => {
        if (act.stores && act.stores.includes(oldName)) {
          act.stores = act.stores.map(s => s === oldName ? newName.trim() : s);
        }
      });
      persistToFile();
    }
    return [...memoryDb.stores];
  },

  async deleteStore(name) {
    memoryDb.stores = memoryDb.stores.filter(s => s !== name);
    persistToFile();
    return [...memoryDb.stores];
  },

  async getSetting(key) {
    return memoryDb.settings[key] || null;
  },

  async setSetting(key, value) {
    memoryDb.settings[key] = value;
    persistToFile();
    return value;
  }
};

module.exports = {
  initLocal,
  localDb
};
