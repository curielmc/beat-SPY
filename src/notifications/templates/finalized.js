// #6 — Finalization complete. Email + in-app + SMS.
export default {
  type: 'finalized',
  channels: { email: true, inApp: true, sms: true },
  email({ lang, data }) {
    const isEs = lang === 'es'
    const rank = data.rank != null ? `#${data.rank}` : '—'
    return {
      subject: isEs
        ? `${data.competitionName}: resultados finales`
        : `${data.competitionName}: final results`,
      text: isEs
        ? `${data.competitionName} terminó. Tu ranking final: ${rank}.\n\n${data.competitionUrl || ''}`
        : `${data.competitionName} is complete. Your final rank: ${rank}.\n\n${data.competitionUrl || ''}`
    }
  },
  sms({ lang, data }) {
    const rank = data.rank != null ? `#${data.rank}` : '—'
    return lang === 'es'
      ? `beat-SPY: ${data.competitionName} terminó. Ranking final: ${rank}.`
      : `beat-SPY: ${data.competitionName} is complete. Final rank: ${rank}.`
  },
  inApp({ data }) {
    const rank = data.rank != null ? `#${data.rank}` : '—'
    return { title: `${data.competitionName} complete`, body: `Final rank: ${rank}.` }
  }
}
