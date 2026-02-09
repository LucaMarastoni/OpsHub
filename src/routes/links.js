/* global fetch, AbortController */
const express = require('express')
const { normalizeTags } = require('../utils/tags')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const { q, tag } = req.query
    const params = []
    let sql = 'SELECT * FROM links WHERE 1=1'
    if (q) {
      sql += ' AND (url LIKE ? OR title LIKE ? OR note LIKE ? OR tags LIKE ?)'
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (tag) {
      sql += ' AND tags LIKE ?'
      params.push(`%${tag}%`)
    }
    sql += ' ORDER BY created_at DESC'
    const links = db.prepare(sql).all(...params)
    res.render('links', { active: 'links', links, filters: { q, tag }, searchQuery: '' })
  })

  router.post('/', async (req, res, next) => {
    try {
      const url = (req.body.url || '').trim()
      const titleInput = (req.body.title || '').trim()
      const note = (req.body.note || '').trim()
      const tags = normalizeTags(req.body.tags)
      const now = new Date().toISOString()
      let finalTitle = titleInput || url

      // optional lightweight fetch for title (best effort)
      if (!titleInput && url.startsWith('http')) {
        try {
          const ctrl = new AbortController()
          setTimeout(() => ctrl.abort(), 2500)
          const resp = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
          const text = await resp.text()
          const match = text.match(/<title>([^<]*)<\/title>/i)
          if (match && match[1]) finalTitle = match[1].trim()
        } catch (_err) {
          finalTitle = url
        }
      }

      db.prepare('INSERT INTO links (url, title, note, tags, created_at) VALUES (?,?,?,?,?)')
        .run(url, finalTitle, note, tags, now)
      res.redirect('/links')
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/update', (req, res) => {
    const id = Number(req.params.id)
    const url = (req.body.url || '').trim()
    const title = (req.body.title || '').trim() || url
    const note = (req.body.note || '').trim()
    const tags = normalizeTags(req.body.tags)
    db.prepare('UPDATE links SET url=?, title=?, note=?, tags=? WHERE id=?')
      .run(url, title, note, tags, id)
    res.redirect('/links')
  })

  router.post('/:id/delete', (req, res) => {
    const id = Number(req.params.id)
    db.prepare('DELETE FROM links WHERE id=?').run(id)
    res.redirect('/links')
  })

  return router
}
