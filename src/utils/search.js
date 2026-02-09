const { isFtsEnabled } = require('../db')

function globalSearch (db, query) {
  const q = (query || '').trim()
  if (!q) return []

  if (isFtsEnabled()) {
    const term = q.replace(/["']/g, ' ')
    const match = term.split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ')
    const stmt = db.prepare(`
      SELECT entity, item_id, title,
             snippet(search_index, -1, '<mark>', '</mark>', '…', 8) as snippet
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT 30
    `)
    return stmt.all(match)
  }

  const like = `%${q}%`
  return [
    ...db.prepare(`SELECT 'todos' AS entity, id as item_id, title, substr(description,1,120) as snippet FROM todos WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? LIMIT 10`).all(like, like, like),
    ...db.prepare(`SELECT 'notes' AS entity, id as item_id, title, substr(body_md,1,120) as snippet FROM notes WHERE title LIKE ? OR body_md LIKE ? OR tags LIKE ? LIMIT 10`).all(like, like, like),
    ...db.prepare(`SELECT 'reminders' AS entity, id as item_id, title, substr(remind_at,1,120) as snippet FROM reminders WHERE title LIKE ? OR tags LIKE ? LIMIT 10`).all(like, like),
    ...db.prepare(`SELECT 'links' AS entity, id as item_id, coalesce(title,url) as title, substr(note,1,120) as snippet FROM links WHERE title LIKE ? OR url LIKE ? OR tags LIKE ? LIMIT 10`).all(like, like, like)
  ]
}

module.exports = { globalSearch }
