// Render newsletter HTML for AgentMail. Self-contained inline styles.
import { buildNameDisplayMap } from '../../src/utils/formatName.js'

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatEndDate(s) {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function pct(n) {
  const v = Number(n || 0)
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function color(returnPct, spy) {
  if (returnPct > spy) return '#15803d'
  if (returnPct < spy) return '#b91c1c'
  return '#374151'
}

function renderTable(rows, spy) {
  if (!rows.length) return '<p style="color:#6b7280;font-size:13px;margin:6px 0;">No data.</p>'
  const items = rows.slice(0, 5).map((r, i) => `
    <tr>
      <td style="padding:6px 8px;color:#6b7280;width:24px;font-size:13px;">${i + 1}</td>
      <td style="padding:6px 8px;font-size:14px;color:#111827;">${escapeHtml(r.label)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:14px;font-weight:600;color:${color(r.returnPct, spy)};">${pct(r.returnPct)}</td>
    </tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden;">${items}</table>`
}

function renderWindow(title, data, nameMap) {
  const groups = data.groups.map(g => ({ label: g.name, returnPct: g.returnPct }))
  const funds = data.funds.map(f => ({ label: `${f.fundName} — ${f.groupName}`, returnPct: f.returnPct }))
  const individuals = data.individuals.map(i => ({ label: nameMap.get(i.name) || i.name, returnPct: i.returnPct }))

  return `
    <h3 style="margin:24px 0 6px;font-size:16px;color:#111827;">${escapeHtml(title)}</h3>
    <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">S&P 500 benchmark: <strong style="color:#111827;">${pct(data.spyReturnPct)}</strong></p>

    <p style="margin:14px 0 4px;font-size:13px;font-weight:600;color:#374151;">🏆 Top Groups</p>
    ${renderTable(groups, data.spyReturnPct)}

    <p style="margin:14px 0 4px;font-size:13px;font-weight:600;color:#374151;">📊 Top Funds</p>
    ${renderTable(funds, data.spyReturnPct)}

    <p style="margin:14px 0 4px;font-size:13px;font-weight:600;color:#374151;">⭐ Top Individuals</p>
    ${renderTable(individuals, data.spyReturnPct)}
  `
}

export function renderNewsletterHtml({ subject, introHtml, payload, unsubscribeUrl, classSignupUrl }) {
  // Build name display map across all individuals across all windows
  const allNames = new Set()
  for (const w of [payload.allTime, payload.threeMonth, payload.oneMonth]) {
    for (const i of (w?.individuals || [])) allNames.add(i.name)
  }
  const nameMap = buildNameDisplayMap([...allNames])

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#ffffff;">
    <div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
      ${payload.daysRemaining != null ? `
      <div style="background:#eef2ff;border:1px solid #c7d2fe;padding:14px;border-radius:8px;margin-bottom:18px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#3730a3;">Class ends ${escapeHtml(formatEndDate(payload.endDate))}</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#3730a3;">${payload.daysRemaining} ${payload.daysRemaining === 1 ? 'day' : 'days'} remaining</p>
      </div>` : ''}
      <div style="font-size:15px;color:#111827;line-height:1.55;">${introHtml || ''}</div>

      ${renderWindow('Last 1 month', payload.oneMonth, nameMap)}
      ${renderWindow('Last 3 months', payload.threeMonth, nameMap)}
      ${renderWindow('All-time', payload.allTime, nameMap)}

      <hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      ${classSignupUrl ? `<p style="font-size:12px;color:#6b7280;margin:0 0 8px;">Parents: <a href="${escapeHtml(classSignupUrl)}" style="color:#6366f1;">subscribe to receive these updates</a>.</p>` : ''}
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        You're receiving this because you're enrolled in (or subscribed to) a Beat the S&P 500 class.
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  </div>`
}
