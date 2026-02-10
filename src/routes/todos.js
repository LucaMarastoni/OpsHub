const express = require('express')
const dayjs = require('dayjs')
const { normalizeTags } = require('../utils/tags')
const {
  assertIntInRange,
  assertDate,
  assertTimesArray,
  distributeTimes
} = require('../utils/schedule')

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

    // ricorrenti: assicurati di avere occorrenze oggi e domani (lazy)
    const today = dayjs().format('YYYY-MM-DD')
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
    ensureOccurrencesForDay(today)
    ensureOccurrencesForDay(tomorrow)

    const recurringToday = db.prepare(`
      SELECT s.id, s.title, s.repeats_per_day, s.total_days, s.start_date,
             COALESCE(p.done_slots, 0) AS done_slots,
             COALESCE(p.total_slots, s.repeats_per_day) AS total_slots,
             (SELECT COUNT(DISTINCT day_date) FROM todo_occurrences WHERE schedule_id=s.id AND status='done') AS days_done
      FROM todo_schedules s
      LEFT JOIN (
        SELECT schedule_id, day_date, COUNT(*) AS total_slots,
               SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done_slots
        FROM todo_occurrences
        WHERE day_date = ?
        GROUP BY schedule_id, day_date
      ) p ON p.schedule_id = s.id
      WHERE date(?) BETWEEN date(s.start_date) AND date(s.start_date, printf('+%d day', s.total_days - 1))
      ORDER BY s.start_date DESC
    `).all(today, today)

    const occurrencesToday = db.prepare(`
      SELECT o.id, o.schedule_id, o.day_date, o.slot_time, o.status
      FROM todo_occurrences o
      WHERE o.day_date = ?
      ORDER BY o.slot_time ASC
    `).all(today)

    res.render('todos', {
      active: 'todos',
      todos,
      filters: { status, tag, q, due },
      searchQuery: req.query.search || '',
      recurringToday,
      occurrencesToday
    })
  })

  router.post('/', (req, res) => {
    const title = (req.body.title || '').trim() || 'Nuovo task'
    const description = (req.body.description || '').trim()
    const status = ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo'
    const priority = ['low', 'med', 'high'].includes(req.body.priority) ? req.body.priority : 'med'
    const due = req.body.due_date ? dayjs(req.body.due_date).toISOString() : null
    const tags = normalizeTags(req.body.tags)

    const isRecurring = req.body.recurring === 'on'

    if (!isRecurring) {
      db.prepare(`INSERT INTO todos (title, description, status, priority, due_date, tags, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?);`)
        .run(title, description, status, priority, due, tags, new Date().toISOString(), new Date().toISOString())
      return res.redirect('/todos')
    }

    try {
      const repeatsPerDay = assertIntInRange(req.body.repeats_per_day, 1, 12, 'ripeti N volte')
      const startDate = assertDate(req.body.start_date || dayjs().format('YYYY-MM-DD'), 'data inizio')
      const endDateRaw = req.body.end_date && req.body.end_date.trim()
      let totalDays = req.body.total_days ? assertIntInRange(req.body.total_days, 1, 90, 'durata giorni') : null
      const wakeStart = (req.body.wake_start || '09:00').trim()
      const wakeEnd = (req.body.wake_end || '21:00').trim()
      let customTimes = null
      if (req.body.custom_times) {
        const arr = req.body.custom_times.split(',').map(s => s.trim()).filter(Boolean)
        customTimes = JSON.stringify(assertTimesArray(arr))
      }

      let endDate = endDateRaw
      if (endDate) {
        endDate = assertDate(endDate, 'data fine')
        if (dayjs(endDate).isBefore(dayjs(startDate))) {
          throw new Error('data fine deve essere dopo l\'inizio')
        }
        totalDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
        if (totalDays <= 0) throw new Error('durata calcolata non valida')
      }
      if (!totalDays) totalDays = 10
      if (totalDays > 90) throw new Error('durata troppo lunga')

      if (customTimes) {
        const parsed = JSON.parse(customTimes)
        if (parsed.length !== repeatsPerDay) {
          throw new Error('orari manuali devono coincidere con N occorrenze')
        }
      }

      const info = db.prepare(`
        INSERT INTO todo_schedules
          (title, repeats_per_day, total_days, start_date, wake_start, wake_end, custom_times)
        VALUES (@title,@rpd,@days,@start,@ws,@we,@custom)
      `).run({
        title,
        rpd: repeatsPerDay,
        days: totalDays,
        start: startDate,
        ws: wakeStart,
        we: wakeEnd,
        custom: customTimes
      })

      generateForDays(info.lastInsertRowid, [startDate, dayjs(startDate).add(1, 'day').format('YYYY-MM-DD')])
      res.redirect('/todos')
    } catch (err) {
      console.error(err)
      res.status(400).send('Input ricorrente non valido: ' + err.message)
    }
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

  router.post('/occurrence/:occId/toggle', (req, res) => {
    const occId = Number(req.params.occId)
    const row = db.prepare('SELECT status FROM todo_occurrences WHERE id=?').get(occId)
    if (!row) return res.redirect('back')
    const next = row.status === 'done' ? 'pending' : 'done'
    db.prepare('UPDATE todo_occurrences SET status=?, done_at=? WHERE id=?')
      .run(next, next === 'done' ? new Date().toISOString() : null, occId)
    return res.redirect('back')
  })

  function generateForDays (scheduleId, days) {
    const sch = db.prepare('SELECT * FROM todo_schedules WHERE id=?').get(scheduleId)
    if (!sch) throw new Error('schedule non trovato')
    const times = sch.custom_times ? JSON.parse(sch.custom_times) : distributeTimes(sch.wake_start, sch.wake_end, sch.repeats_per_day)
    const insert = db.prepare(`
      INSERT OR IGNORE INTO todo_occurrences (schedule_id, day_date, slot_time)
      VALUES (@sid, @day, @time)
    `)
    const tx = db.transaction((dlist) => {
      dlist.forEach(day => {
        times.forEach(time => insert.run({ sid: scheduleId, day, time }))
      })
    })
    tx(days)
  }

  function ensureOccurrencesForDay (day) {
    const schedules = db.prepare(`
      SELECT * FROM todo_schedules
      WHERE date(?) BETWEEN date(start_date) AND date(start_date, printf('+%d day', total_days - 1))
    `).all(day)
    schedules.forEach(s => generateForDays(s.id, [day]))
  }

  return router
}
