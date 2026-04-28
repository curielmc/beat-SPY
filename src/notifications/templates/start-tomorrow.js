// #2 — T-24h before start. Email + SMS.
export default {
  type: 'start_tomorrow',
  channels: { email: true, inApp: false, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `${data.competitionName} comienza mañana`
        : `${data.competitionName} starts tomorrow`,
      text: isEs
        ? `Recordatorio: ${data.competitionName} comienza mañana (${data.startDate}). Prepara tu portafolio.\n\n${data.competitionUrl || ''}`
        : `Reminder: ${data.competitionName} starts tomorrow (${data.startDate}). Get your portfolio ready.\n\n${data.competitionUrl || ''}`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `beat-SPY: ${data.competitionName} comienza mañana. Prepara tu portafolio.`
      : `beat-SPY: ${data.competitionName} starts tomorrow. Get your portfolio ready.`
  }
}
