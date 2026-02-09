const express = require('express')
const { parseQuickAdd } = require('../utils/quickAdd')

module.exports = function (db) {
  const router = express.Router()

  router.post('/', (req, res) => {
    const parsed = parseQuickAdd(req.body.text || '')
    if (parsed.error) {
      return res.redirect('/dashboard')
    }

    const now = new Date().toISOString()
    let redirectTo = '/dashboard'

    switch (parsed.type) {
      case 'todo': {
        const info = db.prepare('INSERT INTO todos (title, description, status, priority, due_date, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(parsed.payload.title, '', parsed.payload.status, parsed.payload.priority, parsed.payload.due_date, parsed.payload.tags, now, now)
        redirectTo = `/todos#todo-${info.lastInsertRowid}`
        break
      }
      case 'note': {
        const info = db.prepare('INSERT INTO notes (title, body_md, tags, created_at, updated_at) VALUES (?,?,?,?,?)')
          .run(parsed.payload.title, parsed.payload.body_md || '', parsed.payload.tags, now, now)
        redirectTo = `/notes#note-${info.lastInsertRowid}`
        break
      }
      case 'reminder': {
        const info = db.prepare('INSERT INTO reminders (title, remind_at, done, tags, created_at, updated_at) VALUES (?,?,?,?,?,?)')
          .run(parsed.payload.title, parsed.payload.remind_at || null, 0, parsed.payload.tags, now, now)
        redirectTo = `/reminders#reminder-${info.lastInsertRowid}`
        break
      }
      case 'link': {
        const info = db.prepare('INSERT INTO links (url, title, note, tags, created_at) VALUES (?,?,?,?,?)')
          .run(parsed.payload.url, parsed.payload.title, '', parsed.payload.tags, now)
        redirectTo = `/links#link-${info.lastInsertRowid}`
        break
      }
      default:
        break
    }

    res.redirect(redirectTo)
  })

  return router
}
