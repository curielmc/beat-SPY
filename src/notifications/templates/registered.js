// #1 — Entry registered. Email + in-app. No SMS.
export default {
  type: 'registered',
  channels: { email: true, inApp: true, sms: false },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `Registrado en ${data.competitionName}`
        : `You're registered for ${data.competitionName}`,
      text: isEs
        ? `Estás dentro. ${data.competitionName} comienza el ${data.startDate}. Buena suerte.\n\n${data.competitionUrl || ''}`
        : `You're in. ${data.competitionName} starts ${data.startDate}. Good luck.\n\n${data.competitionUrl || ''}`
    }
  },
  inApp({ data }) {
    return {
      title: `Registered: ${data.competitionName}`,
      body: `Starts ${data.startDate}.`
    }
  }
}
