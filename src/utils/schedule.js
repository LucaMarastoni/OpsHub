const dayjs = require('dayjs')

function assertIntInRange (value, min, max, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name || 'valore'} non valido`)
  }
  return n
}

function assertDate (value, name = 'data') {
  if (!value || !dayjs(value, 'YYYY-MM-DD', true).isValid()) {
    throw new Error(`${name} non valida`)
  }
  return value
}

function assertTime (value, name = 'ora') {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`${name} non valida`)
  const [h, m] = value.split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error(`${name} fuori range`)
  return value
}

function assertTimesArray (arr) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('orari custom vuoti')
  return arr.map(t => assertTime(t.trim(), 'ora custom'))
}

function distributeTimes (start, end, n) {
  if (n <= 0) throw new Error('numero occorrenze non valido')
  if (n === 1) return [assertTime(start, 'ora inizio')]
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const span = (eh * 60 + em) - (sh * 60 + sm)
  if (span <= 0) throw new Error('intervallo orario non valido')
  const step = span / (n - 1)
  return Array.from({ length: n }, (_, i) => {
    const total = Math.round(sh * 60 + sm + step * i)
    const h = String(Math.floor(total / 60)).padStart(2, '0')
    const m = String(total % 60).padStart(2, '0')
    return `${h}:${m}`
  })
}

module.exports = {
  assertIntInRange,
  assertDate,
  assertTime,
  assertTimesArray,
  distributeTimes
}
