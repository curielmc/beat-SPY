import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendMail } from '../api/_lib/mail.js'

test('sendMail posts to Resend with from + retries 429', async () => {
  process.env.RESEND_API_KEY = 're_test'
  const calls = []
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) })
    return calls.length === 1
      ? new Response('', { status: 429, headers: { 'retry-after': '0' } })
      : new Response('{"id":"x"}', { status: 200 })
  }
  const res = await sendMail({ to: ['a@b.co'], subject: 's', html: '<p>h</p>', reply_to: ['t@b.co'] })
  assert.equal(res.status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'https://api.resend.com/emails')
  assert.equal(calls[1].body.from, 'Beat S&P <hello@mail.beat-snp.com>')
  assert.deepEqual(calls[1].body.reply_to, ['t@b.co'])
})
