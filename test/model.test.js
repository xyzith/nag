import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addItem, listItems, findItem, markDone, ignoreItem, removeItem, addNote, addRef,
  setFocus, clearFocus, getFocus, clearFocusForItem, nextSeq, ensureSeq, updateItem,
} from '../src/model.js'

function fresh() { return { version: 1, items: [] } }

test('addItem fills all fields with defaults', () => {
  const store = fresh()
  const item = addItem(store, { title: 'call PO' })
  assert.equal(item.title, 'call PO')
  assert.equal(item.status, 'open')
  assert.equal(item.source, 'manual')
  assert.equal(item.sourceKey, null)
  assert.equal(item.from, null)
  assert.deepEqual(item.ref, [])
  assert.equal(item.desc, '')
  assert.ok(item.id && item.created && item.updated)
  assert.equal(store.items.length, 1)
})

test('addItem accepts from/desc/ref', () => {
  const store = fresh()
  const item = addItem(store, { title: 't', desc: 'd', from: 'PM', ref: ['docs/x.md'] })
  assert.equal(item.from, 'PM')
  assert.equal(item.desc, 'd')
  assert.deepEqual(item.ref, ['docs/x.md'])
})

test('listItems default shows only open, newest first', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  b.status = 'done'
  const open = listItems(store, {})
  assert.deepEqual(open.map((i) => i.title), ['a'])
  // all: true, sorted newest first (b added after a)
  assert.deepEqual(listItems(store, { all: true }).map((i) => i.title), ['b', 'a'])
})

test('listItems bubbles a recently-updated item to the front', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  // b was created after a (created-sort would put b on top), but a was edited
  // more recently — last-activity ordering must float a above b.
  a.created = '2026-01-01T00:00:00.000Z'
  a.updated = '2026-01-03T00:00:00.000Z'
  b.created = '2026-01-02T00:00:00.000Z'
  b.updated = '2026-01-02T00:00:00.000Z'
  assert.deepEqual(listItems(store, {}).map((i) => i.title), ['a', 'b'])
})

test('findItem resolves by id and by permanent seq', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  assert.equal(findItem(store, a.id).title, 'a')
  assert.equal(findItem(store, String(a.seq)).title, 'a')
  assert.equal(findItem(store, String(b.seq)).title, 'b')
})

test('findItem throws on a numeric ref matching no seq', () => {
  const store = fresh()
  addItem(store, { title: 'a' })
  assert.throws(() => findItem(store, '999'), /not found/i)
})

test('findItem throws on unknown ref', () => {
  assert.throws(() => findItem(fresh(), 'nope'), /not found/i)
})

test('markDone sets status and doneAt', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const r = markDone(store, a.id)
  assert.equal(r.status, 'done')
  assert.ok(r.doneAt)
})

test('ignoreItem sets status ignored', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  assert.equal(ignoreItem(store, a.id).status, 'ignored')
})

test('removeItem deletes the item from store', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  removeItem(store, a.id)
  assert.equal(store.items.length, 0)
})

test('addNote appends with newline separator', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  addNote(store, a.id, 'first')
  addNote(store, a.id, 'second')
  assert.equal(a.note, 'first\nsecond')
})

test('addRef pushes a path onto ref', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  addRef(store, a.id, 'docs/spec.md')
  assert.deepEqual(a.ref, ['docs/spec.md'])
})

test('setFocus resolves a seq ref and stores the resolved item id', () => {
  const store = fresh()
  addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  const it = setFocus(store, 'S1', '2')
  assert.equal(it.id, b.id)
  assert.equal(store.focus.S1, b.id)
})

test('setFocus overwrites the same session and resolves by id', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  setFocus(store, 'S1', a.id)
  setFocus(store, 'S1', b.id)
  assert.equal(store.focus.S1, b.id)
})

test('getFocus returns the open focused item, null when absent', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  assert.equal(getFocus(store, 'S1'), null)
  setFocus(store, 'S1', a.id)
  assert.equal(getFocus(store, 'S1').id, a.id)
})

test('getFocus returns null when the focused item is no longer open', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  a.status = 'done'
  assert.equal(getFocus(store, 'S1'), null)
})

test('clearFocus removes only that session', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  setFocus(store, 'S2', a.id)
  clearFocus(store, 'S1')
  assert.equal(store.focus.S1, undefined)
  assert.equal(store.focus.S2, a.id)
})

test('clearFocusForItem drops every session pointing at the item', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  setFocus(store, 'S2', a.id)
  clearFocusForItem(store, a.id)
  assert.deepEqual(store.focus, {})
})

test('markDone clears focus for that item', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  markDone(store, a.id)
  assert.equal(getFocus(store, 'S1'), null)
  assert.equal(store.focus.S1, undefined)
})

test('removeItem clears focus for that item', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  removeItem(store, a.id)
  assert.equal(store.focus.S1, undefined)
})

test('ignoreItem clears focus for that item', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  setFocus(store, 'S1', a.id)
  ignoreItem(store, a.id)
  assert.equal(store.focus.S1, undefined)
})

test('getFocus tolerates a store with no focus field', () => {
  assert.equal(getFocus({ version: 1, items: [] }, 'S1'), null)
})

test('addItem stamps an increasing seq', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  const b = addItem(store, { title: 'b' })
  assert.equal(a.seq, 1)
  assert.equal(b.seq, 2)
})

test('nextSeq returns increasing values and persists store.seq', () => {
  const store = fresh()
  assert.equal(nextSeq(store), 1)
  assert.equal(nextSeq(store), 2)
  assert.equal(store.seq, 3)
})

test('nextSeq initializes from the max existing seq', () => {
  const store = { version: 1, items: [{ id: 'x', seq: 7 }] }
  assert.equal(nextSeq(store), 8)
})

test('ensureSeq backfills missing seqs in created order, idempotently', () => {
  const store = {
    version: 1,
    items: [
      { id: 'x', title: 'older', created: '2026-01-01T00:00:00.000Z' },
      { id: 'y', title: 'newer', created: '2026-01-02T00:00:00.000Z' },
    ],
  }
  ensureSeq(store)
  assert.equal(store.items.find((i) => i.id === 'x').seq, 1)
  assert.equal(store.items.find((i) => i.id === 'y').seq, 2)
  const snapshot = store.items.map((i) => i.seq)
  ensureSeq(store) // idempotent
  assert.deepEqual(store.items.map((i) => i.seq), snapshot)
})

test('ensureSeq continues numbering from the max existing seq', () => {
  const store = {
    version: 1,
    items: [
      { id: 'x', seq: 5, created: '2026-01-01T00:00:00.000Z' },
      { id: 'y', created: '2026-01-02T00:00:00.000Z' },
    ],
  }
  ensureSeq(store)
  assert.equal(store.items.find((i) => i.id === 'y').seq, 6)
})

test('updateItem overwrites only the fields present in the patch', () => {
  const store = fresh()
  const item = addItem(store, { title: 'old', desc: 'olddesc', from: 'PM' })
  updateItem(store, item.id, { title: 'new' })
  assert.equal(item.title, 'new')
  assert.equal(item.desc, 'olddesc') // untouched
  assert.equal(item.from, 'PM')      // untouched
})

test('updateItem clears desc/note with empty string and from with empty string -> null', () => {
  const store = fresh()
  const item = addItem(store, { title: 't', desc: 'd', from: 'PM' })
  addNote(store, item.id, 'a note')
  updateItem(store, item.id, { desc: '', from: '', note: '' })
  assert.equal(item.desc, '')
  assert.equal(item.from, null)
  assert.equal(item.note, '')
})

test('updateItem rejects an empty title', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  assert.throws(() => updateItem(store, item.id, { title: '' }), /title cannot be empty/)
})

test('updateItem rejects an invalid status', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  assert.throws(() => updateItem(store, item.id, { status: 'bogus' }), /status must be one of/)
})

test('updateItem status=done sets doneAt and clears focus', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  setFocus(store, 'S1', item.id)
  updateItem(store, item.id, { status: 'done' })
  assert.equal(item.status, 'done')
  assert.ok(item.doneAt)
  assert.equal(store.focus?.S1, undefined)
})

test('updateItem status=open reverses a done (nulls doneAt)', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  markDone(store, item.id)
  assert.ok(item.doneAt)
  updateItem(store, item.id, { status: 'open' })
  assert.equal(item.status, 'open')
  assert.equal(item.doneAt, null)
})

test('updateItem status=ignored clears focus and nulls doneAt', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  setFocus(store, 'S1', item.id)
  updateItem(store, item.id, { status: 'ignored' })
  assert.equal(item.status, 'ignored')
  assert.equal(item.doneAt, null)
  assert.equal(store.focus?.S1, undefined)
})

test('updateItem replaces the ref list, and an empty array clears it', () => {
  const store = fresh()
  const item = addItem(store, { title: 't', ref: ['docs/a.md'] })
  updateItem(store, item.id, { ref: ['docs/b.md', 'docs/c.md'] })
  assert.deepEqual(item.ref, ['docs/b.md', 'docs/c.md'])
  updateItem(store, item.id, { ref: [] })
  assert.deepEqual(item.ref, [])
})

test('updateItem keeps updated >= created', () => {
  const store = fresh()
  const item = addItem(store, { title: 't' })
  updateItem(store, item.id, { title: 't2' })
  assert.ok(item.updated >= item.created)
})
