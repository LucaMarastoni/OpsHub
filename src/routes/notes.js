const express = require('express')
const { normalizeTags } = require('../utils/tags')
const { renderSafeMarkdown } = require('../utils/markdown')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const { q, tag } = req.query
    const params = []
    let sql = 'SELECT * FROM notes WHERE 1=1'
    if (q) {
      sql += ' AND (title LIKE ? OR body_md LIKE ? OR tags LIKE ?)'
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (tag) {
      sql += ' AND tags LIKE ?'
      params.push(`%${tag}%`)
    }
    sql += ' ORDER BY updated_at DESC'
    const notesRaw = db.prepare(sql).all(...params)
    const notes = notesRaw.map(n => ({ ...n, body_html: renderSafeMarkdown(n.body_md) }))
    res.render('notes', { active: 'notes', notes, filters: { q, tag }, searchQuery: '' })
  })

  router.post('/', (req, res) => {
    const title = (req.body.title || '').trim() || 'Nota'
    const body = (req.body.body_md || '').trim()
    const tags = normalizeTags(req.body.tags)
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO notes (title, body_md, tags, created_at, updated_at) VALUES (?,?,?,?,?)`)
      .run(title, body, tags, now, now)
    res.redirect('/notes')
  })

  router.post('/:id/update', (req, res) => {
    const id = Number(req.params.id)
    const title = (req.body.title || '').trim() || 'Nota'
    const body = (req.body.body_md || '').trim()
    const tags = normalizeTags(req.body.tags)
    db.prepare('UPDATE notes SET title=?, body_md=?, tags=?, updated_at=? WHERE id=?')
      .run(title, body, tags, new Date().toISOString(), id)
    res.redirect('/notes')
  })

  router.post('/:id/delete', (req, res) => {
    const id = Number(req.params.id)
    db.prepare('DELETE FROM notes WHERE id=?').run(id)
    res.redirect('/notes')
  })

  return router
}
