import { genId } from './id.js'

const now = () => new Date().toISOString()

export function nextSeq(store) {
  if (store.seq == null) {
    const max = store.items.reduce((m, i) => Math.max(m, i.seq || 0), 0)
    store.seq = max + 1
  }
  const n = store.seq
  store.seq = n + 1
  return n
}

export function ensureSeq(store) {
  const missing = store.items
    .filter((i) => i.seq == null)
    .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0))
  for (const it of missing) it.seq = nextSeq(store)
  return store
}

export function listItems(store, { all = false } = {}) {
  // most-recent-activity first: by updated desc so an edited item floats back to
  // the top, tie-broken by seq desc (stable for items touched in the same ms).
  // Falls back to created when updated is absent (legacy items pre-`updated`).
  const stamp = (i) => i.updated || i.created
  return store.items
    .filter((i) => (all ? true : i.status === 'open'))
    .sort((a, b) => {
      const sa = stamp(a)
      const sb = stamp(b)
      if (sa !== sb) return sa > sb ? -1 : 1
      return (b.seq || 0) - (a.seq || 0)
    })
}

export function findItem(store, ref) {
  const byId = store.items.find((i) => i.id === ref)
  if (byId) return byId
  if (/^\d+$/.test(ref)) {
    const n = Number(ref)
    const bySeq = store.items.find((i) => i.seq === n)
    if (bySeq) return bySeq
  }
  throw new Error(`item not found: ${ref}`)
}

export function addItem(store, { title, desc = '', from = null, ref = [] }) {
  const ts = now()
  const item = {
    id: genId(),
    seq: nextSeq(store),
    title,
    desc,
    from,
    sourceMeta: {},
    note: '',
    ref: [...ref],
    status: 'open',
    source: 'manual',
    sourceKey: null,
    created: ts,
    updated: ts,
    doneAt: null,
  }
  store.items.push(item)
  return item
}

export function setFocus(store, sessionId, ref) {
  const item = findItem(store, ref)
  if (!store.focus) store.focus = {}
  store.focus[sessionId] = item.id
  return item
}

export function clearFocus(store, sessionId) {
  if (store.focus) delete store.focus[sessionId]
}

export function getFocus(store, sessionId) {
  const id = store.focus?.[sessionId]
  if (!id) return null
  const item = store.items.find((i) => i.id === id)
  if (!item || item.status !== 'open') return null
  return item
}

export function clearFocusForItem(store, itemId) {
  if (!store.focus) return
  for (const [sid, id] of Object.entries(store.focus)) {
    if (id === itemId) delete store.focus[sid]
  }
}

export function markDone(store, ref) {
  const item = findItem(store, ref)
  item.status = 'done'
  item.doneAt = now()
  item.updated = now()
  clearFocusForItem(store, item.id)
  return item
}

export function ignoreItem(store, ref) {
  const item = findItem(store, ref)
  item.status = 'ignored'
  item.updated = now()
  clearFocusForItem(store, item.id)
  return item
}

export function removeItem(store, ref) {
  const item = findItem(store, ref)
  store.items = store.items.filter((i) => i !== item)
  clearFocusForItem(store, item.id)
  return item
}

export function addNote(store, ref, text) {
  const item = findItem(store, ref)
  item.note = item.note ? `${item.note}\n${text}` : text
  item.updated = now()
  return item
}

export function addRef(store, ref, p) {
  const item = findItem(store, ref)
  item.ref.push(p)
  item.updated = now()
  return item
}

const STATUSES = ['open', 'done', 'ignored']

export function updateItem(store, ref, patch) {
  const item = findItem(store, ref)
  if ('title' in patch) {
    if (!patch.title) throw new Error('title cannot be empty')
    item.title = patch.title
  }
  if ('desc' in patch) item.desc = patch.desc
  if ('from' in patch) item.from = patch.from || null
  if ('note' in patch) item.note = patch.note
  if ('ref' in patch) item.ref = [...patch.ref]
  if ('status' in patch) {
    if (!STATUSES.includes(patch.status)) {
      throw new Error(`status must be one of: ${STATUSES.join(', ')}`)
    }
    item.status = patch.status
    item.doneAt = patch.status === 'done' ? now() : null
    if (patch.status !== 'open') clearFocusForItem(store, item.id)
  }
  item.updated = now()
  return item
}
