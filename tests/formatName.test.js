import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNameDisplayMap, formatStudentName } from '../src/utils/formatName.js'

test('formatStudentName returns first + last initial', () => {
  assert.equal(formatStudentName('Chloe Lawrence'), 'Chloe L.')
  assert.equal(formatStudentName('Marco Diaz'), 'Marco D.')
})

test('formatStudentName handles single name', () => {
  assert.equal(formatStudentName('Chloe'), 'Chloe')
})

test('formatStudentName handles empty input', () => {
  assert.equal(formatStudentName(''), 'Student')
  assert.equal(formatStudentName(null), 'Student')
})

test('buildNameDisplayMap with no clashes uses first + last initial', () => {
  const map = buildNameDisplayMap(['Chloe Lawrence', 'Marco Diaz'])
  assert.equal(map.get('Chloe Lawrence'), 'Chloe L.')
  assert.equal(map.get('Marco Diaz'), 'Marco D.')
})

test('buildNameDisplayMap disambiguates two Chloe L.s', () => {
  const map = buildNameDisplayMap(['Chloe Lawrence', 'Chloe Lee'])
  assert.equal(map.get('Chloe Lawrence'), 'Chloe La.')
  assert.equal(map.get('Chloe Lee'), 'Chloe Le.')
})

test('buildNameDisplayMap extends until unique on long shared prefixes', () => {
  const map = buildNameDisplayMap(['Sam Parker', 'Sam Parks'])
  assert.equal(map.get('Sam Parker'), 'Sam Parke.')
  assert.equal(map.get('Sam Parks'), 'Sam Parks')
})

test('buildNameDisplayMap leaves first-name-only entries as first name', () => {
  const map = buildNameDisplayMap(['Chloe'])
  assert.equal(map.get('Chloe'), 'Chloe')
})
