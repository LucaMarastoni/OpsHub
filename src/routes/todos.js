const express = require('express')
const dayjs = require('dayjs')
const { normalizeTags } = require('../utils/tags')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const { status, tag, q, due } = req.query
    const params = []
    let sql = 'SELECT * FROM todos WHERE 1=1'

    if (status && ['todo', 'doing', 'done'].includes(status)) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (tag) {
      sql += ' AND tags LIKE ?'
      params.push(`%${tag}%`)
    }
    if (due === 'overdue') {
      sql += ' AND due_date IS NOT NULL AND due_date < ?'
      params.push(new Date().toISOString())
    } else if (due === 'soon') {
      sql += ' AND due_date IS NOT NULL AND due_date <= ?'
      params.push(dayjs().add(3, 'day').toISOString())
    }
    if (q) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)'
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    sql += " ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END, COALESCE(due_date, '9999') ASC, created_at DESC"
    const todos = db.prepare(sql).all(...params)

    res.render('todos', {
      active: 'todos',
      todos,
      filters: { status, tag, q, due },
      searchQuery: req.query.search || ''
    })
  })

  router.post('/', (req, res) => {
    const title = (req.body.title || '').trim() || 'Nuovo task'
    const description = (req.body.description || '').trim()
    const status = ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo'
    const priority = ['low', 'med', 'high'].includes(req.body.priority) ? req.body.priority : 'med'
    const due = req.body.due_date ? dayjs(req.body.due_date).toISOString() : null
    const tags = normalizeTags(req.body.tags)

    db.prepare(`INSERT INTO todos (title, description, status, priority, due_date, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);`)
      .run(title, description, status, priority, due, tags, new Date().toISOString(), new Date().toISOString())

    res.redirect('/todos')
  })

  router.post('/:id/update', (req, res) => {
    const id = Number(req.params.id)
    if (!id) return res.redirect('/todos')
    const title = (req.body.title || '').trim() || 'Task'
    const description = (req.body.description || '').trim()
    const status = ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo'
    const priority = ['low', 'med', 'high'].includes(req.body.priority) ? req.body.priority : 'med'
    const due = req.body.due_date ? dayjs(req.body.due_date).toISOString() : null
    const tags = normalizeTags(req.body.tags)

    db.prepare(`UPDATE todos SET title=?, description=?, status=?, priority=?, due_date=?, tags=?, updated_at=? WHERE id=?`)
      .run(title, description, status, priority, due, tags, new Date().toISOString(), id)
    res.redirect('/todos')
  })

  router.post('/:id/status', (req, res) => {
    const id = Number(req.params.id)
    const status = ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo'
    db.prepare('UPDATE todos SET status=?, updated_at=? WHERE id=?').run(status, new Date().toISOString(), id)
    res.redirect('back')
  })

  router.post('/:id/priority', (req, res) => {
    const id = Number(req.params.id)
    const priority = ['low', 'med', 'high'].includes(req.body.priority) ? req.body.priority : 'med'
    db.prepare('UPDATE todos SET priority=?, updated_at=? WHERE id=?').run(priority, new Date().toISOString(), id)
    res.redirect('back')
  })

  router.post('/:id/delete', (req, res) => {
    const id = Number(req.params.id)
    db.prepare('DELETE FROM todos WHERE id=?').run(id)
    res.redirect('/todos')
  })

  return router
}
