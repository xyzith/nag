import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAdapter, fetchSource, fetchAll } from '../src/sync.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fake = path.join(here, 'fixtures', 'fake-adapter.js')

test('runAdapter parses stdout JSON candidates', async () => {
  const cands = await runAdapter(['node', fake])
  assert.equal(cands.length, 1)
  assert.equal(cands[0].sourceKey, 'K1')
})

test('fetchSource returns candidates without touching any store', async () => {
  const config = { sources: { fake: { cmd: ['node', fake] } } }
  const res = await fetchSource('fake', config)
  assert.equal(res.error, undefined)
  assert.equal(res.count, 1)
  assert.equal(res.candidates[0].sourceKey, 'K1')
})

test('fetchSource returns error when source not configured', async () => {
  const res = await fetchSource('nope', { sources: {} })
  assert.match(res.error, /not configured/i)
})

test('fetchSource returns error on adapter failure', async () => {
  const config = { sources: { fake: { cmd: ['node', '/no/such/adapter.js'] } } }
  const res = await fetchSource('fake', config)
  assert.ok(res.error)
})

test('fetchAll fetches every configured source', async () => {
  const config = { sources: { fake: { cmd: ['node', fake] } } }
  const res = await fetchAll(config)
  assert.equal(res.fake.count, 1)
})

test('fetchAll with a name fetches only that source', async () => {
  const config = { sources: { fake: { cmd: ['node', fake] }, other: { cmd: ['node', fake] } } }
  const res = await fetchAll(config, 'fake')
  assert.deepEqual(Object.keys(res), ['fake'])
})
