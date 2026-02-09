const express = require('express')
const dayjs = require('dayjs')
const { normalizeTags } = require('../utils/tags')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const view = req.query.view || 'next'
    let sql = 'SELECT * FROM reminders WHERE 1=1'
    const params = []
    if (view === 'today') {
      sql += ' AND remind_at IS NOT NULL AND remind_at <= ?'
      params.push(dayjs().endOf('day').toISOString())
    } else if (view === 'next') {
      sql += ' AND remind_at IS NOT NULL AND remind_at <= ?'
      params.push(dayjs().add(7, 'day').endOf('day').toISOString())
    }
    sql += ' ORDER BY COALESCE(remind_at, created_at) ASC'
    const reminders = db.prepare(sql).all(...params)
    res.render('reminders', { active: 'reminders', reminders, view, searchQuery: '' })
  })

  router.post('/', (req, res) => {
    const title = (req.body.title || '').trim() || 'Promemoria'
    const remindAt = req.body.remind_at ? dayjs(req.body.remind_at).toISOString() : null
    const tags = normalizeTags(req.body.tags)
    const now = new Date().toISOString()
    db.prepare('INSERT INTO reminders (title, remind_at, done, tags, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(title, remindAt, 0, tags, now, now)
    res.redirect('/reminders')
  })

  router.post('/:id/update', (req, res) => {
    const id = Number(req.params.id)
    const title = (req.body.title || '').trim() || 'Promemoria'
    const remindAt = req.body.remind_at ? dayjs(req.body.remind_at).toISOString() : null
    const done = req.body.done ? 1 : 0
    const tags = normalizeTags(req.body.tags)
    db.prepare('UPDATE reminders SET title=?, remind_at=?, done=?, tags=?, updated_at=? WHERE id=?')
      .run(title, remindAt, done, tags, new Date().toISOString(), id)
    res.redirect('/reminders')
  })

  router.post('/:id/toggle', (req, res) => {
    const id = Number(req.params.id)
    const current = db.prepare('SELECT done FROM reminders WHERE id=?').get(id)
    const newVal = current && current.done ? 0 : 1
    db.prepare('UPDATE reminders SET done=?, updated_at=? WHERE id=?').run(newVal, new Date().toISOString(), id)
    res.redirect('back')
  })

  router.post('/:id/delete', (req, res) => {
    const id = Number(req.params.id)
    db.prepare('DELETE FROM reminders WHERE id=?').run(id)
    res.redirect('/reminders')
  })

  return router
}
