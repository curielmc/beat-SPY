// #4 — Digest. Email only.
export default {
  type: 'digest',
  channels: { email: true, inApp: false, sms: false },
  email({ lang, data }) {
    const isEs = lang === 'es'
    const rank = data.rank != null ? `#${data.rank}` : '—'
    const ret = data.return != null ? `${(data.return * 100).toFixed(2)}%` : '—'
    const spy = data.spyReturn != null ? `${(data.spyReturn * 100).toFixed(2)}%` : '—'
    const days = data.daysRemaining != null ? data.daysRemaining : '—'
    return {
      subject: isEs
        ? `${data.competitionName}: tu resumen`
        : `${data.competitionName}: your digest`,
      text: isEs
        ? `Resumen de ${data.competitionName}:\n\nRanking: ${rank}\nTu rendimiento: ${ret}\nSPY: ${spy}\nDías restantes: ${days}\n\n${data.competitionUrl || ''}`
        : `${data.competitionName} digest:\n\nRank: ${rank}\nYour return: ${ret}\nSPY: ${spy}\nDays remaining: ${days}\n\n${data.competitionUrl || ''}`
    }
  }
}
