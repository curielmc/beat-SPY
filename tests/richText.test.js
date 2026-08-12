import { test } from 'node:test'
import assert from 'node:assert'

// Mirrors richText() in api/notify-message.js — AI content arrives with **bold**
// markers that were previously escaped and rendered as literal asterisks.
function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function richText(input) {
  return escapeHtml(input)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

test('converts **bold** instead of printing literal asterisks', () => {
  assert.strictEqual(richText('**Today:** AMZN is up'), '<strong>Today:</strong> AMZN is up')
  assert.ok(!richText('**Today:** AMZN').includes('**'))
})

test('still escapes HTML so content cannot inject markup', () => {
  assert.strictEqual(richText('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;')
})

test('ampersands survive escaping (S&P 500)', () => {
  assert.strictEqual(richText('S&P 500'), 'S&amp;P 500')
})

test('newlines become line breaks', () => {
  assert.strictEqual(richText('a\nb'), 'a<br>b')
})
