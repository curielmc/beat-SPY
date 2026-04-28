// #9 — Removed from challenge. CRITICAL — bypasses opt-out. Email + SMS.
export default {
  type: 'removed',
  channels: { email: true, inApp: false, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    const reason = data.reason ? `\n\n${isEs ? 'Razón' : 'Reason'}: ${data.reason}` : ''
    return {
      subject: isEs
        ? `Has sido removido de ${data.competitionName}`
        : `Removed from ${data.competitionName}`,
      text: isEs
        ? `Has sido removido de ${data.competitionName}.${reason}\n\nSi crees que es un error, contacta al organizador.`
        : `You've been removed from ${data.competitionName}.${reason}\n\nIf you think this is a mistake, contact the organizer.`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `beat-SPY: Has sido removido de ${data.competitionName}.`
      : `beat-SPY: You've been removed from ${data.competitionName}.`
  }
}
