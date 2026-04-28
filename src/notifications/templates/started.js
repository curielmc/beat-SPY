// #3 — At start. Email + in-app + SMS.
export default {
  type: 'started',
  channels: { email: true, inApp: true, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `${data.competitionName} ya está activo`
        : `${data.competitionName} is live`,
      text: isEs
        ? `${data.competitionName} acaba de comenzar. ¡Empieza a operar!\n\n${data.competitionUrl || ''}`
        : `${data.competitionName} just started. Time to trade.\n\n${data.competitionUrl || ''}`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `beat-SPY: ${data.competitionName} ya está activo. ¡A operar!`
      : `beat-SPY: ${data.competitionName} is live. Time to trade.`
  },
  inApp({ data }) {
    return { title: `${data.competitionName} is live`, body: 'Time to trade.' }
  }
}
