// #5 — T-24h before end. Email + SMS.
export default {
  type: 'end_tomorrow',
  channels: { email: true, inApp: false, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `${data.competitionName} termina mañana`
        : `${data.competitionName} ends tomorrow`,
      text: isEs
        ? `Última oportunidad: ${data.competitionName} termina mañana (${data.endDate}). Revisa tu portafolio.\n\n${data.competitionUrl || ''}`
        : `Last chance: ${data.competitionName} ends tomorrow (${data.endDate}). Check your portfolio.\n\n${data.competitionUrl || ''}`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `beat-SPY: ${data.competitionName} termina mañana. Última oportunidad.`
      : `beat-SPY: ${data.competitionName} ends tomorrow. Last chance.`
  }
}
