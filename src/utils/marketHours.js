/**
 * Utility to check if US markets are currently open.
 * Standard hours: 9:30 AM - 4:00 PM Eastern Time, Monday - Friday.
 */
function getEasternTime(now = new Date()) {
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

export function isMarketOpen(now = new Date()) {
  const easternTime = getEasternTime(now)
  const day = easternTime.getDay() // 0 = Sunday, 6 = Saturday
  const hours = easternTime.getHours()
  const minutes = easternTime.getMinutes()

  // Weekend check
  if (day === 0 || day === 6) return false

  // Time check (9:30 AM to 4:00 PM)
  const timeInMinutes = hours * 60 + minutes
  const openTime = 9 * 60 + 30
  const closeTime = 16 * 60

  return timeInMinutes >= openTime && timeInMinutes < closeTime
}

export function getMarketHoursMessage(now = new Date()) {
  if (isMarketOpen(now)) return ''
  const easternTime = getEasternTime(now)
  const day = easternTime.getDay()

  if (day === 0 || day === 6) {
    return 'The market is closed. Orders placed now will queue for the next trading session, Monday through Friday, 9:30 AM to 4:00 PM ET.'
  }

  return 'The market is closed. Orders placed now will queue for the next regular session at 9:30 AM ET.'
}
