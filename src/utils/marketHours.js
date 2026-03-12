/**
 * Utility to check if US markets are currently open.
 * Standard hours: 9:30 AM - 4:00 PM Eastern Time, Monday - Friday.
 * Accounts for US market holidays.
 */
function getEasternTime(now = new Date()) {
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

function easterDate(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const em = h + l - 7 * m + 114
  return new Date(year, Math.floor(em / 31) - 1, (em % 31) + 1)
}

function observedDate(month, day, year) {
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()
  if (dow === 0) d.setDate(d.getDate() + 1) // Sunday -> Monday
  if (dow === 6) d.setDate(d.getDate() - 1) // Saturday -> Friday
  return d
}

function nthWeekday(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1)
  let offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7)
}

function lastMonday(year, month) {
  const last = new Date(year, month, 0) // last day of month
  const dow = last.getDay()
  const offset = (dow - 1 + 7) % 7
  return new Date(year, month - 1, last.getDate() - offset)
}

export function isUSMarketHoliday(date) {
  const y = date.getFullYear()

  function same(a, b) { return a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

  const holidays = [
    observedDate(1, 1, y),                // New Year's Day
    nthWeekday(y, 1, 1, 3),               // MLK Day (3rd Monday Jan)
    nthWeekday(y, 2, 1, 3),               // Presidents' Day (3rd Monday Feb)
    new Date(easterDate(y).getTime() - 2 * 86400000), // Good Friday
    lastMonday(y, 5),                      // Memorial Day
    observedDate(6, 19, y),                // Juneteenth
    observedDate(7, 4, y),                 // Independence Day
    nthWeekday(y, 9, 1, 1),               // Labor Day (1st Monday Sep)
    nthWeekday(y, 11, 4, 4),              // Thanksgiving (4th Thursday Nov)
    observedDate(12, 25, y),               // Christmas
  ]

  return holidays.some(h => same(h, date))
}

export function isMarketOpen(now = new Date()) {
  const easternTime = getEasternTime(now)
  const day = easternTime.getDay() // 0 = Sunday, 6 = Saturday

  // Weekend check
  if (day === 0 || day === 6) return false

  // Holiday check
  if (isUSMarketHoliday(easternTime)) return false

  // Time check (9:30 AM to 4:00 PM)
  const timeInMinutes = easternTime.getHours() * 60 + easternTime.getMinutes()
  const openTime = 9 * 60 + 30
  const closeTime = 16 * 60

  return timeInMinutes >= openTime && timeInMinutes < closeTime
}

export function getMarketHoursMessage(now = new Date()) {
  if (isMarketOpen(now)) return ''
  const easternTime = getEasternTime(now)
  const day = easternTime.getDay()

  if (isUSMarketHoliday(easternTime)) {
    return 'The market is closed for a holiday. Orders placed now will queue for the next trading session and use that session\'s opening price.'
  }

  if (day === 0 || day === 6) {
    return 'The market is closed. Orders placed now will queue for the next trading session and use that session\'s opening price, Monday through Friday, 9:30 AM to 4:00 PM ET.'
  }

  return 'The market is closed. Orders placed now will queue for the next regular session at 9:30 AM ET and use that session\'s opening price.'
}
