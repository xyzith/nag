import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { loadStore, saveStore } from '../src/store.js'

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nag-')), 'todos.json')
}

test('loadStore returns fresh store when file missing', () => {
  const store = loadStore(tmpFile())
  assert.deepEqual(store, { version: 1, items: [] })
})

test('saveStore then loadStore round-trips', () => {
  const p = tmpFile()
  const store = { version: 1, items: [{ id: 'a', title: 'hi' }] }
  saveStore(p, store)
  assert.deepEqual(loadStore(p), store)
})

test('saveStore writes atomically (no leftover tmp file)', () => {
  const p = tmpFile()
  saveStore(p, { version: 1, items: [] })
  const dir = path.dirname(p)
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'))
  assert.deepEqual(leftovers, [])
})
