require('dotenv').config()
const path = require('path')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')
const basicAuth = require('basic-auth')
const rateLimit = require('express-rate-limit')
const { createDb, isFtsEnabled } = require('./db')

const db = createDb()
const app = express()
const port = process.env.PORT || 3000

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false
})

app.set('trust proxy', 1)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '../views'))

app.use(helmet({ contentSecurityPolicy: false }))
app.use(limiter)
app.use(morgan('dev'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/public', express.static(path.join(__dirname, '../public')))

function maybeAuth (req, res, next) {
  const user = process.env.ADMIN_USER
  const pass = process.env.ADMIN_PASS
  if (!user || !pass) return next()
  const creds = basicAuth(req)
  if (!creds || creds.name !== user || creds.pass !== pass) {
    res.set('WWW-Authenticate', 'Basic realm="Personal Ops Hub"')
    return res.status(401).send('Autenticazione richiesta')
  }
  return next()
}

app.use(maybeAuth)

// share helpers
app.locals.isFtsEnabled = isFtsEnabled

// routes
app.use('/', require('./routes/dashboard')(db))
app.use('/todos', require('./routes/todos')(db))
app.use('/notes', require('./routes/notes')(db))
app.use('/reminders', require('./routes/reminders')(db))
app.use('/links', require('./routes/links')(db))
app.use('/search', require('./routes/search')(db))
app.use('/quick-add', require('./routes/quickAdd')(db))

app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).send('Errore interno, riprova')
})

app.listen(port, () => {
  console.log(`Personal Ops Hub pronto su http://localhost:${port}`)
})
