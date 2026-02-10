const FTS_OFFSETS = {
  todos: 0,
  notes: 1000000,
  reminders: 2000000,
  links: 3000000
}

let ftsAvailable = false

function setupDatabase (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
      priority TEXT NOT NULL DEFAULT 'med' CHECK(priority IN ('low','med','high')),
      due_date TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body_md TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      remind_at TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    /* Ricorrenze todo: definizione + occorrenze generate on-demand */
    CREATE TABLE IF NOT EXISTS todo_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      repeats_per_day INTEGER NOT NULL CHECK(repeats_per_day > 0 AND repeats_per_day <= 12),
      total_days INTEGER NOT NULL CHECK(total_days > 0 AND total_days <= 60),
      start_date TEXT NOT NULL,
      wake_start TEXT NOT NULL DEFAULT '09:00',
      wake_end TEXT NOT NULL DEFAULT '21:00',
      custom_times TEXT DEFAULT NULL, -- JSON array HH:MM
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS todo_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES todo_schedules(id) ON DELETE CASCADE,
      day_date TEXT NOT NULL, -- yyyy-mm-dd
      slot_time TEXT NOT NULL, -- HH:MM
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),
      done_at TEXT,
      UNIQUE(schedule_id, day_date, slot_time)
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      note TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
    CREATE INDEX IF NOT EXISTS idx_todos_tags ON todos(tags);
    CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes(tags);
    CREATE INDEX IF NOT EXISTS idx_reminders_done ON reminders(done);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
    CREATE INDEX IF NOT EXISTS idx_todo_occ_day ON todo_occurrences(day_date);
    CREATE INDEX IF NOT EXISTS idx_todo_occ_schedule ON todo_occurrences(schedule_id);
  `)

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        entity,
        item_id UNINDEXED,
        title,
        body,
        tags
      );
    `)
    ftsAvailable = true
    registerFtsTriggers(db)
    rebuildFts(db)
  } catch (err) {
    ftsAvailable = false
    console.warn('FTS5 not available, falling back to LIKE search.')
  }
}

function ftsRowId (entity, id) {
  return (FTS_OFFSETS[entity] || 0) + id
}

function registerFtsTriggers (db) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_todos_ai AFTER INSERT ON todos BEGIN
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.todos} + new.id, 'todos', new.id, new.title, COALESCE(new.description,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_todos_au AFTER UPDATE ON todos BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.todos} + old.id;
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.todos} + new.id, 'todos', new.id, new.title, COALESCE(new.description,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_todos_ad AFTER DELETE ON todos BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.todos} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS fts_notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.notes} + new.id, 'notes', new.id, new.title, COALESCE(new.body_md,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_notes_au AFTER UPDATE ON notes BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.notes} + old.id;
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.notes} + new.id, 'notes', new.id, new.title, COALESCE(new.body_md,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_notes_ad AFTER DELETE ON notes BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.notes} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS fts_reminders_ai AFTER INSERT ON reminders BEGIN
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.reminders} + new.id, 'reminders', new.id, new.title, COALESCE(new.remind_at,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_reminders_au AFTER UPDATE ON reminders BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.reminders} + old.id;
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.reminders} + new.id, 'reminders', new.id, new.title, COALESCE(new.remind_at,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_reminders_ad AFTER DELETE ON reminders BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.reminders} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS fts_links_ai AFTER INSERT ON links BEGIN
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.links} + new.id, 'links', new.id, COALESCE(new.title,new.url), COALESCE(new.note,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_links_au AFTER UPDATE ON links BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.links} + old.id;
      INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
      VALUES ( ${FTS_OFFSETS.links} + new.id, 'links', new.id, COALESCE(new.title,new.url), COALESCE(new.note,''), COALESCE(new.tags,''));
    END;
    CREATE TRIGGER IF NOT EXISTS fts_links_ad AFTER DELETE ON links BEGIN
      DELETE FROM search_index WHERE rowid = ${FTS_OFFSETS.links} + old.id;
    END;
  `)
}

function rebuildFts (db) {
  if (!ftsAvailable) return
  db.exec('DELETE FROM search_index;')
  db.exec(`INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
           SELECT ${FTS_OFFSETS.todos} + id, 'todos', id, title, COALESCE(description,''), COALESCE(tags,'') FROM todos;`)
  db.exec(`INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
           SELECT ${FTS_OFFSETS.notes} + id, 'notes', id, title, COALESCE(body_md,''), COALESCE(tags,'') FROM notes;`)
  db.exec(`INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
           SELECT ${FTS_OFFSETS.reminders} + id, 'reminders', id, title, COALESCE(remind_at,''), COALESCE(tags,'') FROM reminders;`)
  db.exec(`INSERT INTO search_index(rowid, entity, item_id, title, body, tags)
           SELECT ${FTS_OFFSETS.links} + id, 'links', id, COALESCE(title,url), COALESCE(note,''), COALESCE(tags,'') FROM links;`)
}

function isFtsEnabled () {
  return ftsAvailable
}

module.exports = {
  setupDatabase,
  isFtsEnabled,
  ftsRowId,
  rebuildFts,
  FTS_OFFSETS
}
