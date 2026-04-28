// #8 — Mid-challenge rule change. Email + in-app.
export default {
  type: 'rule_change',
  channels: { email: true, inApp: true, sms: false },
  email({ lang, data }) {
    const isEs = lang === 'es'
    const fields = Array.isArray(data.changedFields) ? data.changedFields.join(', ') : (data.changedFields || '')
    const reason = data.reason ? `\n\n${isEs ? 'Razón' : 'Reason'}: ${data.reason}` : ''
    return {
      subject: isEs
        ? `Cambio en ${data.competitionName}`
        : `Update to ${data.competitionName}`,
      text: isEs
        ? `El organizador actualizó las reglas de ${data.competitionName}. Campos modificados: ${fields}.${reason}\n\n${data.competitionUrl || ''}`
        : `The organizer updated ${data.competitionName}. Changed: ${fields}.${reason}\n\n${data.competitionUrl || ''}`
    }
  },
  inApp({ data }) {
    return {
      title: `${data.competitionName} updated`,
      body: `Rules changed: ${Array.isArray(data.changedFields) ? data.changedFields.join(', ') : (data.changedFields || '')}.`
    }
  }
}
