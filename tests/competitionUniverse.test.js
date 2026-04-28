import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertTickerAllowed } from '../src/lib/competitionUniverse.js'

const sp500Set = new Set(['AAPL', 'MSFT', 'GOOGL'])

test('app_all allows anything', () => {
  assert.equal(assertTickerAllowed({ mode: 'app_all' }, 'XYZ', sp500Set), true)
})

test('sp500_via_spy allows constituents', () => {
  assert.equal(assertTickerAllowed({ mode: 'sp500_via_spy' }, 'AAPL', sp500Set), true)
})

test('sp500_via_spy rejects non-constituents', () => {
  assert.throws(
    () => assertTickerAllowed({ mode: 'sp500_via_spy' }, 'TSLA', sp500Set),
    /not in the S&P 500/
  )
})

test('custom_list allows listed tickers only', () => {
  const u = { mode: 'custom_list', tickers: ['F', 'GM'] }
  assert.equal(assertTickerAllowed(u, 'F', sp500Set), true)
  assert.throws(() => assertTickerAllowed(u, 'AAPL', sp500Set), /not in the allowed list/)
})

test('exclude_list rejects listed tickers, allows others', () => {
  const u = { mode: 'exclude_list', tickers: ['TSLA'] }
  assert.equal(assertTickerAllowed(u, 'AAPL', sp500Set), true)
  assert.throws(() => assertTickerAllowed(u, 'TSLA', sp500Set), /restricted/)
})

test('case-insensitive ticker match', () => {
  assert.equal(assertTickerAllowed({ mode: 'sp500_via_spy' }, 'aapl', sp500Set), true)
})
