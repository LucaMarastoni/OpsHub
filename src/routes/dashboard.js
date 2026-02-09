const express = require('express')
const dayjs = require('dayjs')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (_req, res) => res.redirect('/dashboard'))

  router.get('/dashboard', (req, res) => {
    const now = dayjs()
    const soon = now.add(3, 'day').toISOString()
    const inWeek = now.add(7, 'day').toISOString()

    const upcomingTodos = db.prepare(`
      SELECT * FROM todos
      WHERE status != 'done' AND due_date IS NOT NULL AND due_date <= ?
      ORDER BY due_date ASC
      LIMIT 6
    `).all(soon)

    const upcomingReminders = db.prepare(`
      SELECT * FROM reminders
      WHERE done = 0 AND remind_at IS NOT NULL AND remind_at <= ?
      ORDER BY remind_at ASC
      LIMIT 6
    `).all(inWeek)

    const latestNotes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5').all()
    const latestLinks = db.prepare('SELECT * FROM links ORDER BY created_at DESC LIMIT 5').all()

    res.render('dashboard', {
      active: 'dashboard',
      upcomingTodos,
      upcomingReminders,
      latestNotes,
      latestLinks,
      searchQuery: req.query.q || ''
    })
  })

  return router
}
