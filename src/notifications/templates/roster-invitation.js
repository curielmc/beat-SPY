// #10 — Roster invitation (pre-signup). Email only.
export default {
  type: 'roster_invitation',
  channels: { email: true, inApp: false, sms: false },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `Estás invitado a ${data.competitionName}`
        : `You're invited to ${data.competitionName}`,
      text: isEs
        ? `${data.organizerName || 'Un organizador'} te invitó a ${data.competitionName} en beat-SPY. Crea tu cuenta y regístrate:\n\n${data.signupUrl || ''}`
        : `${data.organizerName || 'An organizer'} invited you to ${data.competitionName} on beat-SPY. Sign up and register:\n\n${data.signupUrl || ''}`
    }
  }
}
