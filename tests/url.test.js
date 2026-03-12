import test from 'node:test'
import assert from 'node:assert/strict'

import { getCanonicalUrl } from '../src/lib/url.js'

test('getCanonicalUrl rewrites www host to apex domain', () => {
  assert.equal(
    getCanonicalUrl({
      hostname: 'www.beat-snp.com',
      pathname: '/admin/users',
      search: '?q=francisco',
      hash: '#top'
    }),
    'https://beat-snp.com/admin/users?q=francisco#top'
  )
})

test('getCanonicalUrl leaves canonical host alone', () => {
  assert.equal(
    getCanonicalUrl({
      hostname: 'beat-snp.com',
      pathname: '/admin/users',
      search: '',
      hash: ''
    }),
    null
  )
})
