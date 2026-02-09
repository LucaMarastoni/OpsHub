function normalizeTags (raw) {
  if (!raw) return ''
  return raw
    .split(/[,#]/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .join(',')
}

function tagsArray (tags) {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

module.exports = { normalizeTags, tagsArray }
