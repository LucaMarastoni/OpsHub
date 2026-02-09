const path = require('path')
const Database = require('better-sqlite3')
const { setupDatabase, isFtsEnabled } = require('./init')

function createDb () {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../db/data.sqlite')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  setupDatabase(db)
  return db
}

module.exports = {
  createDb,
  isFtsEnabled
}
