/**
 * Utility to check if US markets are currently open.
 * Standard hours: 9:30 AM - 4:00 PM Eastern Time, Monday - Friday.
 */
export function isMarketOpen() {
  const now = new Date()
  
  // Convert current time to Eastern Time
  const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  
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
