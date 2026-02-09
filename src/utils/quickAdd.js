const dayjs = require('dayjs')
const { normalizeTags } = require('./tags')

function extractDateTime (text) {
  let cleaned = text
  let date = null

  if (/\bdomani\b/i.test(cleaned)) {
    date = dayjs().add(1, 'day')
    cleaned = cleaned.replace(/\bdomani\b/ig, '')
  } else if (/\boggi\b/i.test(cleaned)) {
    date = dayjs()
    cleaned = cleaned.replace(/\boggi\b/ig, '')
  }

  const isoMatch = cleaned.match(/(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    date = dayjs(isoMatch[1], 'YYYY-MM-DD')
    cleaned = cleaned.replace(isoMatch[1], '')
  }

  const slashMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  if (slashMatch) {
    const [d, m, y] = slashMatch[1].split('/').map(Number)
    date = dayjs(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    cleaned = cleaned.replace(slashMatch[1], '')
  }

  const timeMatch = cleaned.match(/(\d{1,2}:\d{2})/)
  if (timeMatch) {
    const [h, mins] = timeMatch[1].split(':').map(Number)
    cleaned = cleaned.replace(timeMatch[1], '')
    if (!date) date = dayjs()
    date = date.hour(h).minute(mins).second(0).millisecond(0)
  }

  const iso = date ? date.toISOString() : null
  return { cleaned: cleaned.trim(), iso }
}

function pullTags (text) {
  const matches = [...text.matchAll(/#([\p{L}\d_-]+)/giu)]
  const tags = matches.map(m => m[1])
  const without = text.replace(/#[\p{L}\d_-]+/giu, '').trim()
  return { tags, without }
}

function parseQuickAdd (input) {
  const raw = (input || '').trim()
  if (!raw) return { error: 'Inserisci qualcosa' }

  const { tags, without } = pullTags(raw)
  const tagString = normalizeTags(tags.join(','))
  let text = without

  // Link detection
  const urlMatch = text.match(/https?:\/\/\S+/i)
  if (/^link\b/i.test(text) || /^url\b/i.test(text) || urlMatch) {
    const url = urlMatch ? urlMatch[0] : text.split(/\s+/)[1]
    const title = text.replace(/^(link|url)\s*/i, '').replace(url || '', '').trim()
    return { type: 'link', payload: { url, title: title || url, tags: tagString } }
  }

  // Todo detection
  if (/^(todo|task|t:)/i.test(text)) {
    text = text.replace(/^(todo|task|t:)\s*/i, '')
    const { cleaned, iso } = extractDateTime(text)
    return {
      type: 'todo',
      payload: {
        title: cleaned.trim() || 'Nuovo task',
        due_date: iso,
        tags: tagString,
        priority: 'med',
        status: 'todo'
      }
    }
  }

  // Reminder detection
  if (/^(remind|promemoria|ricorda|reminder)/i.test(text)) {
    text = text.replace(/^(remind|promemoria|ricorda|reminder)\s*/i, '')
    const { cleaned, iso } = extractDateTime(text)
    return {
      type: 'reminder',
      payload: {
        title: cleaned || 'Promemoria',
        remind_at: iso,
        tags: tagString
      }
    }
  }

  // Note detection
  if (/^(note|nota|idea|doc)/i.test(text)) {
    text = text.replace(/^(note|nota|idea|doc)\s*/i, '')
    return {
      type: 'note',
      payload: { title: text || 'Nota', body_md: '', tags: tagString }
    }
  }

  // Default: if contains date/time -> reminder else todo? We'll default to todo for verbs? choose note? We'll default to note? maybe quick add for generic? Provide heuristic: if includes verb? but easier choose todo by presence of checkbox? We'll choose todo if contains numbers/time else note.
  const { cleaned, iso } = extractDateTime(text)
  if (iso) {
    return { type: 'reminder', payload: { title: cleaned || 'Promemoria', remind_at: iso, tags: tagString } }
  }

  return { type: 'note', payload: { title: cleaned || 'Nota', body_md: '', tags: tagString } }
}

module.exports = { parseQuickAdd, extractDateTime }
