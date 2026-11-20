import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSource } from '../src/merge.js'

function storeWith(items) { return { version: 1, items } }
function cand(over = {}) {
  return { sourceKey: 'K1', title: 'T', desc: 'D', from: 'PM', sourceMeta: { url: 'u' }, ...over }
}

test('new candidate is inserted as open item', () => {
  const store = storeWith([])
  mergeSource(store, [cand()], 'demo')
  assert.equal(store.items.length, 1)
  const it = store.items[0]
  assert.equal(it.source, 'demo')
  assert.equal(it.sourceKey, 'K1')
  assert.equal(it.status, 'open')
  assert.equal(it.title, 'T')
  assert.equal(it.from, 'PM')
  assert.deepEqual(it.sourceMeta, { url: 'u' })
})

test('existing source item: source-owned fields overwritten, note/ref preserved', () => {
  const store = storeWith([{
    id: 'x', source: 'demo', sourceKey: 'K1', status: 'open',
    title: 'old', desc: 'old', from: 'old', sourceMeta: {},
    note: 'my note', ref: ['docs/a.md'], created: '2026-01-01T00:00:00Z', updated: 'x', doneAt: null,
  }])
  mergeSource(store, [cand({ title: 'new', desc: 'newd', from: 'PO' })], 'demo')
  const it = store.items[0]
  assert.equal(it.title, 'new')
  assert.equal(it.desc, 'newd')
  assert.equal(it.from, 'PO')
  assert.equal(it.note, 'my note')        // untouched
  assert.deepEqual(it.ref, ['docs/a.md']) // untouched
})

test('re-merging an unchanged candidate does not bump updated', () => {
  const store = storeWith([{
    id: 'x', source: 'demo', sourceKey: 'K1', status: 'open',
    title: 'T', desc: 'D', from: 'PM', sourceMeta: { url: 'u' },
    note: '', ref: [], created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z', doneAt: null,
  }])
  mergeSource(store, [cand()], 'demo') // identical content
  assert.equal(store.items[0].updated, '2026-01-01T00:00:00Z')
})

test('merging a changed candidate bumps updated', () => {
  const store = storeWith([{
    id: 'x', source: 'demo', sourceKey: 'K1', status: 'open',
    title: 'T', desc: 'D', from: 'PM', sourceMeta: { url: 'u' },
    note: '', ref: [], created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z', doneAt: null,
  }])
  mergeSource(store, [cand({ title: 'changed' })], 'demo')
  assert.notEqual(store.items[0].updated, '2026-01-01T00:00:00Z')
  assert.equal(store.items[0].title, 'changed')
})

test('ignored item is not resurrected', () => {
  const store = storeWith([{ id: 'x', source: 'demo', sourceKey: 'K1', status: 'ignored', title: 'old', note: '', ref: [] }])
  mergeSource(store, [cand()], 'demo')
  assert.equal(store.items[0].status, 'ignored')
})

test('done item stays done', () => {
  const store = storeWith([{ id: 'x', source: 'demo', sourceKey: 'K1', status: 'done', title: 'old', note: '', ref: [] }])
  mergeSource(store, [cand()], 'demo')
  assert.equal(store.items[0].status, 'done')
})

test('source item gone from candidates stays open (no auto-done)', () => {
  const store = storeWith([{ id: 'x', source: 'demo', sourceKey: 'GONE', status: 'open', title: 'old', note: '', ref: [], sourceMeta: {} }])
  mergeSource(store, [], 'demo')
  const it = store.items[0]
  assert.equal(it.status, 'open')
  assert.equal(it.doneReason, undefined)
  assert.ok(!it.doneAt)
})

test('manual items are never touched by sync', () => {
  const store = storeWith([{ id: 'm', source: 'manual', sourceKey: null, status: 'open', title: 'mine', note: '', ref: [] }])
  mergeSource(store, [], 'demo')
  assert.equal(store.items[0].status, 'open')
})

test('items from a different source are not auto-done', () => {
  const store = storeWith([{ id: 'j', source: 'jira', sourceKey: 'J1', status: 'open', title: 'j', note: '', ref: [] }])
  mergeSource(store, [], 'demo')
  assert.equal(store.items[0].status, 'open')
})

test('merged candidates get increasing seq numbers', () => {
  const store = storeWith([])
  mergeSource(store, [cand({ sourceKey: 'A' }), cand({ sourceKey: 'B' })], 'demo')
  const seqs = store.items.map((i) => i.seq).sort((a, b) => a - b)
  assert.deepEqual(seqs, [1, 2])
})
