// #7 — Won a payout. CRITICAL — bypasses opt-out. Email + in-app + SMS.
export default {
  type: 'won_payout',
  channels: { email: true, inApp: true, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    return {
      subject: isEs
        ? `Has ganado $${data.amount} en ${data.competitionName}`
        : `You won $${data.amount} in ${data.competitionName}`,
      text: isEs
        ? `Felicitaciones — ganaste $${data.amount}. Reclama tu premio antes del ${data.claimBy}: ${data.claimUrl}`
        : `Congrats — you won $${data.amount}. Claim by ${data.claimBy}: ${data.claimUrl}`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `¡Ganaste $${data.amount} en ${data.competitionName}! Reclama: ${data.claimUrl}`
      : `You won $${data.amount} in ${data.competitionName}! Claim: ${data.claimUrl}`
  },
  inApp({ data }) {
    return {
      title: `You won $${data.amount}`,
      body: `In ${data.competitionName}. Claim by ${data.claimBy}.`
    }
  }
}
