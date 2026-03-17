function toPositiveNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

export function getImmediateExecutionPrice(quote) {
  return toPositiveNumber(quote?.price) ?? toPositiveNumber(quote?.previousClose)
}

export function getQueuedExecutionPrice(quote) {
  return toPositiveNumber(quote?.open) ?? toPositiveNumber(quote?.price) ?? toPositiveNumber(quote?.previousClose)
}

export function getAvailableCashForQueuedBuys(cashBalance, pendingOrders = []) {
  const cash = toPositiveNumber(cashBalance) ?? 0
  const reservedCash = pendingOrders.reduce((sum, order) => {
    if (order?.side !== 'buy') return sum
    if (!['queued', 'processing'].includes(order?.status)) return sum
    return sum + (toPositiveNumber(order?.dollars) ?? 0)
  }, 0)
  return Math.max(0, cash - reservedCash)
}
