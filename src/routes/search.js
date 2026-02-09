const express = require('express')
const sanitizeHtml = require('sanitize-html')
const { globalSearch } = require('../utils/search')

module.exports = function (db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const q = req.query.q || ''
    const resultsRaw = globalSearch(db, q)
    const results = resultsRaw.map(r => ({
      ...r,
      snippet: r.snippet ? sanitizeHtml(r.snippet, { allowedTags: ['mark'] }) : ''
    }))
    res.render('search', { active: 'search', results, q, searchQuery: q })
  })

  return router
}
