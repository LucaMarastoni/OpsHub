const { marked } = require('marked')
const sanitizeHtml = require('sanitize-html')

marked.setOptions({
  breaks: true,
  gfm: true
})

function renderSafeMarkdown (md) {
  if (!md) return ''
  const html = marked.parse(md)
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img', 'span']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title']
    }
  })
}

module.exports = { renderSafeMarkdown }
