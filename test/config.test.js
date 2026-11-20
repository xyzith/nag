import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { loadConfig } from '../src/config.js'

function tmpJson(obj) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nagcfg-')), 'config.json')
  fs.writeFileSync(p, JSON.stringify(obj))
  return p
}

test('loadConfig returns empty sources when file missing', () => {
  assert.deepEqual(loadConfig('/no/such/config.json'), { sources: {} })
})

test('loadConfig reads sources map', () => {
  const p = tmpJson({ sources: { demo: { cmd: ['node', '/x/demo.js'] } } })
  assert.deepEqual(loadConfig(p).sources.demo.cmd, ['node', '/x/demo.js'])
})
