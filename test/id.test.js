import { test } from 'node:test'
import assert from 'node:assert/strict'
import { genId } from '../src/id.js'

test('genId returns a non-empty lowercase alnum string', () => {
  const id = genId()
  assert.match(id, /^[a-z0-9]{6,}$/)
})

test('genId returns unique values across calls', () => {
  const ids = new Set(Array.from({ length: 500 }, () => genId()))
  assert.equal(ids.size, 500)
})
