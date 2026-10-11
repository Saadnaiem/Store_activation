const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Render PostgreSQL requires SSL in production or when connecting externally
    const sslConfig = connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
      ? false
      : { rejectUnauthorized: false };

    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

async function initPostgres() {
  const p = getPool();
  const client = await p.connect();
  try {
    // 1. Create activations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activations (
        id VARCHAR(64) PRIMARY KEY,
        activity_name TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        vendor_name TEXT,
        category TEXT,
        activity_type TEXT,
        objective TEXT,
        description TEXT,
        start_date VARCHAR(32) NOT NULL,
        end_date VARCHAR(32) NOT NULL,
        start_time VARCHAR(32),
        end_time VARCHAR(32),
        stores JSONB DEFAULT '[]'::jsonb,
        images JSONB DEFAULT '[]'::jsonb,
        author_id VARCHAR(128),
        author_email VARCHAR(255),
        author_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Create stores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create settings table (branding, whitelist, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default stores if empty
    const storesRes = await client.query(`SELECT COUNT(*) FROM stores;`);
    if (parseInt(storesRes.rows[0].count, 10) === 0) {
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
      for (const st of defaultStores) {
        await client.query(`INSERT INTO stores (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;`, [st]);
      }
    }

    // Seed default settings if empty
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('whitelist', $1::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `, [JSON.stringify({ mode: 'ALL', whitelistMap: { 'saad.naiem@gmail.com': true } })]);

    console.log('✅ PostgreSQL database initialized and verified successfully.');
  } finally {
    client.release();
  }
}

function mapRowToActivation(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityName: row.activity_name,
    brandName: row.brand_name,
    vendorName: row.vendor_name,
    category: row.category,
    activityType: row.activity_type,
    objective: row.objective,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    stores: Array.isArray(row.stores) ? row.stores : (typeof row.stores === 'string' ? JSON.parse(row.stores) : []),
    images: Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images) : []),
    authorId: row.author_id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const postgresDb = {
  async getActivations() {
    const res = await getPool().query(`
      SELECT * FROM activations 
      ORDER BY start_date ASC, created_at DESC;
    `);
    return res.rows.map(mapRowToActivation);
  },

  async getActivationById(id) {
    const res = await getPool().query(`SELECT * FROM activations WHERE id = $1;`, [id]);
    return mapRowToActivation(res.rows[0]);
  },

  async createActivation(act) {
    const id = act.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const res = await getPool().query(`
      INSERT INTO activations (
        id, activity_name, brand_name, vendor_name, category,
        activity_type, objective, description, start_date, end_date,
        start_time, end_time, stores, images, author_id,
        author_email, author_name, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13::jsonb, $14::jsonb, $15,
        $16, $17, $18, $19
      ) RETURNING *;
    `, [
      id,
      act.activityName,
      act.brandName,
      act.vendorName || '',
      act.category || '',
      act.activityType || '',
      act.objective || '',
      act.description || '',
      act.startDate,
      act.endDate,
      act.startTime || '',
      act.endTime || '',
      JSON.stringify(act.stores || []),
      JSON.stringify(act.images || []),
      act.authorId || 'local',
      act.authorEmail || '',
      act.authorName || '',
      act.createdAt || now,
      now
    ]);
    return mapRowToActivation(res.rows[0]);
  },

  async updateActivation(id, act) {
    const now = new Date().toISOString();
    const res = await getPool().query(`
      UPDATE activations SET
        activity_name = COALESCE($2, activity_name),
        brand_name = COALESCE($3, brand_name),
        vendor_name = COALESCE($4, vendor_name),
        category = COALESCE($5, category),
        activity_type = COALESCE($6, activity_type),
        objective = COALESCE($7, objective),
        description = COALESCE($8, description),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        start_time = COALESCE($11, start_time),
        end_time = COALESCE($12, end_time),
        stores = COALESCE($13::jsonb, stores),
        images = COALESCE($14::jsonb, images),
        updated_at = $15
      WHERE id = $1
      RETURNING *;
    `, [
      id,
      act.activityName,
      act.brandName,
      act.vendorName,
      act.category,
      act.activityType,
      act.objective,
      act.description,
      act.startDate,
      act.endDate,
      act.startTime,
      act.endTime,
      act.stores ? JSON.stringify(act.stores) : null,
      act.images ? JSON.stringify(act.images) : null,
      now
    ]);
    return mapRowToActivation(res.rows[0]);
  },

  async deleteActivation(id) {
    const res = await getPool().query(`DELETE FROM activations WHERE id = $1 RETURNING id;`, [id]);
    return res.rowCount > 0;
  },

  async bulkDeleteActivations(ids) {
    if (!ids || ids.length === 0) return 0;
    const res = await getPool().query(`DELETE FROM activations WHERE id = ANY($1::text[]);`, [ids]);
    return res.rowCount;
  },

  async wipeActivations() {
    await getPool().query(`TRUNCATE TABLE activations;`);
    return true;
  },

  async getStores() {
    const res = await getPool().query(`SELECT name FROM stores ORDER BY name ASC;`);
    return res.rows.map(r => r.name);
  },

  async addStores(names) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      for (const name of names) {
        if (name && name.trim()) {
          await client.query(
            `INSERT INTO stores (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;`,
            [name.trim()]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getStores();
  },

  async renameStore(oldName, newName) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE stores SET name = $1 WHERE name = $2;`, [newName.trim(), oldName.trim()]);
      
      // Cascade rename inside activations stores JSON array
      const acts = await client.query(`SELECT id, stores FROM activations WHERE stores @> $1::jsonb;`, [JSON.stringify([oldName.trim()])]);
      for (const act of acts.rows) {
        const storeArray = Array.isArray(act.stores) ? act.stores : JSON.parse(act.stores);
        const updated = storeArray.map(s => s === oldName ? newName : s);
        await client.query(`UPDATE activations SET stores = $1::jsonb WHERE id = $2;`, [JSON.stringify(updated), act.id]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getStores();
  },

  async deleteStore(name) {
    await getPool().query(`DELETE FROM stores WHERE name = $1;`, [name.trim()]);
    return this.getStores();
  },

  async getSetting(key) {
    const res = await getPool().query(`SELECT value FROM settings WHERE key = $1;`, [key]);
    if (res.rows.length === 0) return null;
    return res.rows[0].value;
  },

  async setSetting(key, value) {
    await getPool().query(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, [key, JSON.stringify(value)]);
    return value;
  }
};

module.exports = {
  initPostgres,
  postgresDb
};
