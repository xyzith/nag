import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatList, formatShow, formatStatus, truncWidth, shouldRenderMarkdown } from '../src/format.js'
import { addItem, setFocus } from '../src/model.js'

function fresh() { return { version: 1, items: [] } }

test('formatList --json returns open items carrying their permanent seq', () => {
  const store = fresh()
  addItem(store, { title: 'a' })
  const out = JSON.parse(formatList(store, { json: true }))
  assert.equal(out.length, 1)
  assert.equal(out[0].seq, 1)
  assert.equal(out[0].index, undefined) // no synthetic positional index
  assert.equal(out[0].title, 'a')
})

test('formatList text shows the seq number and title in aligned columns', () => {
  const store = fresh()
  addItem(store, { title: 'call PO' })
  const out = formatList(store, {})
  assert.match(out, /\b1\b.*call PO/)
})

test('formatList text shows the activity date in local time so ordering is legible', () => {
  const saved = process.env.TZ
  try {
    process.env.TZ = 'Asia/Taipei' // +08:00
    const store = fresh()
    const it = addItem(store, { title: 'call PO' })
    it.updated = '2026-06-09T11:25:15.300Z' // 19:25 local
    const out = formatList(store, {})
    assert.match(out, /06-09 19:25/)
  } finally {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  }
})

test('formatList renders the activity date in UTC when that is the local zone', () => {
  const saved = process.env.TZ
  try {
    process.env.TZ = 'UTC'
    const store = fresh()
    const it = addItem(store, { title: 'call PO' })
    it.updated = '2026-06-09T11:25:15.300Z'
    const out = formatList(store, {})
    assert.match(out, /06-09 11:25/)
  } finally {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  }
})

test('formatList shows the updated date, not the stale created date', () => {
  const saved = process.env.TZ
  try {
    process.env.TZ = 'UTC'
    const store = fresh()
    const it = addItem(store, { title: 'call PO' })
    it.created = '2026-06-09T11:25:15.300Z' // stale
    it.updated = '2026-07-15T02:44:38.000Z' // last edit
    const out = formatList(store, {})
    assert.match(out, /07-15 02:44/)
    assert.doesNotMatch(out, /06-09/)
  } finally {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  }
})

test('formatList plain text carries no ANSI escapes', () => {
  const store = fresh()
  const it = addItem(store, { title: 'plain' })
  setFocus(store, 'S1', it.id)
  const out = formatList(store, {})
  assert.ok(!out.includes('\x1b['))
})

test('formatList color:true marks a focused (claude session) item', () => {
  const store = fresh()
  const a = addItem(store, { title: 'focused one' })
  addItem(store, { title: 'idle one' })
  setFocus(store, 'S1', a.id)
  const out = formatList(store, { color: true })
  // the focused row is highlighted (ANSI) and carries the 🎯 marker
  assert.match(out, /🎯.*focused one/)
  assert.ok(out.includes('\x1b['))
  // a colored segment wraps the focused title, not the idle one
  assert.match(out, /\x1b\[[0-9;]*m[^\x1b]*focused one/)
})

test('formatShow --json includes briefing fields', () => {
  const store = fresh()
  const it = addItem(store, { title: 't', desc: 'd', from: 'PM', ref: ['docs/x.md'] })
  const out = JSON.parse(formatShow(it, { json: true }))
  assert.equal(out.title, 't')
  assert.equal(out.from, 'PM')
  assert.deepEqual(out.ref, ['docs/x.md'])
})

test('formatShow text lists title, from, desc, ref', () => {
  const store = fresh()
  const it = addItem(store, { title: 't', desc: 'do the thing', from: 'PM', ref: ['docs/x.md'] })
  it.sourceMeta = { url: 'https://j/ABC-1' }
  const out = formatShow(it, {})
  assert.match(out, /t/)
  assert.match(out, /PM/)
  assert.match(out, /do the thing/)
  assert.match(out, /docs\/x\.md/)
  assert.match(out, /ABC-1/)
})

test('truncWidth returns the string unchanged when it fits', () => {
  assert.equal(truncWidth('abc', 10), 'abc')
})

test('truncWidth cuts ASCII to the budget and appends an ellipsis', () => {
  const out = truncWidth('abcdefghij', 5)
  assert.equal(out, 'abcd…')
})

test('truncWidth counts CJK as 2 columns', () => {
  // budget 6, reserve 1 col for the ellipsis -> 5 cols of text -> 2 CJK chars (4 cols)
  const out = truncWidth('翻新遊戲管理', 6)
  assert.equal(out, '翻新…')
})

test('shouldRenderMarkdown: true only on a plain TTY', () => {
  assert.equal(shouldRenderMarkdown({ isTTY: true, json: false, plain: false, noColor: false }), true)
})

test('shouldRenderMarkdown: false when not a TTY (the AI/pipe path)', () => {
  assert.equal(shouldRenderMarkdown({ isTTY: false, json: false, plain: false, noColor: false }), false)
})

test('shouldRenderMarkdown: false for --json, --plain, or NO_COLOR even on a TTY', () => {
  assert.equal(shouldRenderMarkdown({ isTTY: true, json: true, plain: false, noColor: false }), false)
  assert.equal(shouldRenderMarkdown({ isTTY: true, json: false, plain: true, noColor: false }), false)
  assert.equal(shouldRenderMarkdown({ isTTY: true, json: false, plain: false, noColor: true }), false)
})

test('formatStatus empty store shows just the count', () => {
  assert.equal(formatStatus(fresh(), {}), '📋 0')
})

test('formatStatus with no focus shows count and the newest title', () => {
  const store = fresh()
  addItem(store, { title: 'oldest' })
  const n = addItem(store, { title: 'newer' })
  const out = formatStatus(store, {})
  assert.match(out, /📋 2/)
  assert.match(out, /newer/)
  // the newest item's number is shown so you can quickly `nag focus <seq>`
  assert.match(out, new RegExp(`#${n.seq}\\b`))
  assert.ok(!out.includes('🎯'))
})

test('formatStatus with a session focus shows the focused title and target marker', () => {
  const store = fresh()
  addItem(store, { title: 'oldest' })
  const b = addItem(store, { title: 'focusme' })
  setFocus(store, 'S1', b.id)
  const out = formatStatus(store, { sessionId: 'S1' })
  assert.match(out, /🎯/)
  assert.match(out, /focusme/)
  // the focused task's own number is shown (#<seq>), distinct from the 📋 total
  assert.match(out, new RegExp(`#${b.seq}\\b`))
})

test('formatStatus emits ANSI only when color is true', () => {
  const store = fresh()
  addItem(store, { title: 'a' })
  assert.ok(!formatStatus(store, {}).includes('\x1b['))
  assert.ok(formatStatus(store, { color: true }).includes('\x1b['))
})

test('formatStatus --json reports count, sources, focus and shown title', () => {
  const store = fresh()
  const a = addItem(store, { title: 'a' })
  a.source = 'demo'
  const b = addItem(store, { title: 'b' })
  setFocus(store, 'S1', b.id)
  const out = JSON.parse(formatStatus(store, { sessionId: 'S1', json: true }))
  assert.equal(out.count, 2)
  assert.match(out.sources, /demo/)
  assert.equal(out.focus.full, 'b')
  assert.equal(out.shown.full, 'b')
})

test('formatStatus title width is overridable via NAG_STATUS_TITLE_WIDTH', () => {
  const store = fresh()
  addItem(store, { title: 'abcdefghijklmnopqrstuvwxyz' }) // 26 ASCII cols
  process.env.NAG_STATUS_TITLE_WIDTH = '10'
  try {
    assert.match(formatStatus(store, {}), /abcdefghi…/) // budget 10 -> 9 cols + ellipsis
  } finally {
    delete process.env.NAG_STATUS_TITLE_WIDTH
  }
})

test('formatStatus default title width fits a ~37-col CJK title without truncation', () => {
  const store = fresh()
  addItem(store, { title: '[LottoBO] 翻新 遊戲管理> 彩票玩法參數' })
  const out = formatStatus(store, {})
  assert.match(out, /彩票玩法參數/) // full tail visible (well under default cap 100)
  assert.ok(!out.includes('…'))
})

test('formatStatus title budget is a cap, not a fixed reserve (short titles are not padded)', () => {
  const store = fresh()
  const t = addItem(store, { title: 'tiny' })
  const out = formatStatus(store, {})
  assert.equal(out, `📋 1 · #${t.seq} tiny`) // no padding to the 100-col cap
})

test('formatStatus truncates titles longer than the default cap', () => {
  const store = fresh()
  // ~120 display cols, well over the default 100-col cap
  addItem(store, { title: '[DEV][APP UI] [ABC] Account Management > Notification Settings Management > Content Management > Template Editor Settings' })
  const out = formatStatus(store, {})
  assert.ok(out.includes('…'))
})
