import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withLock } from '../src/lock.js'

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'naglock-'))
  return path.join(dir, 'store.json')
}

test('withLock runs fn, returns its value, and releases the lock', () => {
  const f = tmpFile()
  const r = withLock(f, () => 42)
  assert.equal(r, 42)
  assert.ok(!fs.existsSync(`${f}.lock`))
})

test('withLock releases the lock even when fn throws', () => {
  const f = tmpFile()
  assert.throws(() => withLock(f, () => { throw new Error('boom') }), /boom/)
  assert.ok(!fs.existsSync(`${f}.lock`))
})

test('withLock steals a stale lock (older than the stale window)', () => {
  const f = tmpFile()
  fs.mkdirSync(`${f}.lock`)
  const old = new Date(Date.now() - 60_000) // 60s ago, > 30s stale window
  fs.utimesSync(`${f}.lock`, old, old)
  const r = withLock(f, () => 'ok')
  assert.equal(r, 'ok')
  assert.ok(!fs.existsSync(`${f}.lock`))
})

test('withLock creates the parent dir if missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'naglock-'))
  const f = path.join(dir, 'nested', 'store.json') // nested/ does not exist yet
  const r = withLock(f, () => 'ok')
  assert.equal(r, 'ok')
})
