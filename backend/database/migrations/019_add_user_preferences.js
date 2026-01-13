/**
 * Migration: Add user preferences (currency, dateFormat)
 * 
 * @module migrations/019_add_user_preferences
 */

const migrationInfo = {
  id: 19,
  name: '019_add_user_preferences',
  description: 'Adds currency and dateFormat columns to users table',
  createdAt: '2026-01-13'
};

const addCurrencySql = `
  ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'GBP' NOT NULL;
`;

const addDateFormatSql = `
  ALTER TABLE users ADD COLUMN dateFormat TEXT DEFAULT 'DD/MM/YYYY' NOT NULL;
`;

function up(db) {
  try {
    db.exec(addCurrencySql);
    db.exec(addDateFormatSql);
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log(`Migration ${migrationInfo.name}: Columns already exist, skipping.`);
    } else {
      console.error(`Migration ${migrationInfo.name} failed:`, error.message);
      throw error;
    }
  }
}

function down(db) {
  console.log(`Migration ${migrationInfo.name}: SQLite does not support DROP COLUMN easily.`);
}

module.exports = {
  migrationInfo,
  up,
  down
};
