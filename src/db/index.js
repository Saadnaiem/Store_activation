const { initPostgres, postgresDb } = require('./postgres');
const { initLocal, localDb } = require('./local');

let activeDb = null;
let dbType = 'local';

async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    try {
      console.log('🔄 Attempting to connect to PostgreSQL database...');
      await initPostgres();
      activeDb = postgresDb;
      dbType = 'postgres';
      console.log('🚀 Connected to PostgreSQL (Render DB).');
      return;
    } catch (err) {
      console.error('⚠️ Failed to connect to PostgreSQL. Falling back to local database:', err.message);
    }
  }

  console.log('📁 Using local persistent file storage (data/db.json).');
  await initLocal();
  activeDb = localDb;
  dbType = 'local';
}

module.exports = {
  initDatabase,
  getDatabase: () => activeDb,
  getDbType: () => dbType
};
