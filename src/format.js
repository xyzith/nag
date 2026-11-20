import { listItems, getFocus } from './model.js'

const DEFAULT_TITLE_WIDTH = 100
const ELLIPSIS = '…'

// statusline title budget in display columns; override with NAG_STATUS_TITLE_WIDTH
function titleWidth() {
  const n = Number(process.env.NAG_STATUS_TITLE_WIDTH)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TITLE_WIDTH
}

function charWidth(cp) {
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) return 2
  return 1
}

function displayWidth(s) {
  let w = 0
  for (const ch of s) w += charWidth(ch.codePointAt(0))
  return w
}

export function truncWidth(s, budget) {
  if (displayWidth(s) <= budget) return s
  let w = 0
  let out = ''
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0))
    if (w + cw > budget - 1) break
    w += cw
    out += ch
  }
  return out + ELLIPSIS
}

// "2026-06-09T11:25:15.300Z" → "06-09 19:25" in the local timezone; just enough
// to make the newest-first ordering legible in the text list
function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatList(store, { all = false, json = false, color = false } = {}) {
  const items = listItems(store, { all })
  if (json) return JSON.stringify(items, null, 2)
  if (items.length === 0) return '(no items)'

  // items currently held by any claude session's focus get highlighted
  const focusedIds = new Set(Object.values(store.focus || {}))
  const useColor = color && !process.env.NO_COLOR
  const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
  const DIM = '2'
  const CYAN = '1;36'

  return items
    .map((it) => {
      const focused = focusedIds.has(it.id)
      const marker = focused ? '🎯' : '  '
      const seq = String(it.seq).padStart(3)
      // show last-activity time (matches the updated-desc list ordering), not the
      // stale creation time — an edited item reads as recent, as it sorts.
      const date = shortDate(it.updated || it.created)
      const tag = it.source === 'manual' ? '' : ` [${it.source}]`
      const from = it.from ? ` (${it.from})` : ''
      let title = it.title
      if (focused) title = paint(CYAN, title)
      else if (it.status !== 'open') title = paint(DIM, title)
      const meta = paint(DIM, `${tag}${from}`)
      return `${marker} ${paint(DIM, seq)}  ${paint(DIM, date)}  ${title}${meta}`
    })
    .join('\n')
}

export function formatShow(item, { json = false } = {}) {
  if (json) return JSON.stringify(item, null, 2)
  const lines = [`# ${item.title}`]
  if (item.from) lines.push(`from: ${item.from}`)
  lines.push(`status: ${item.status}  ·  source: ${item.source}`)
  if (item.desc) lines.push('', item.desc)
  if (item.note) lines.push('', '## note', item.note)
  if (item.ref?.length) lines.push('', '## ref', ...item.ref.map((r) => `- ${r}`))
  const links = Object.values(item.sourceMeta || {}).filter(Boolean)
  if (links.length) lines.push('', '## links', ...links.map((l) => `- ${l}`))
  return lines.join('\n')
}

// Decide whether `show` output should be richly rendered (via leaf) vs emitted
// as plain markdown. Pure so it can be unit-tested without a real TTY; bin/nag.js
// supplies the live process state. Plain markdown is the AI-facing contract — only
// a human on a color-capable TTY gets rich rendering.
export function shouldRenderMarkdown({ isTTY, json, plain, noColor }) {
  return !!isTTY && !json && !plain && !noColor
}

export function formatStatus(store, { sessionId = null, color = false, json = false } = {}) {
  const open = listItems(store, {})
  const count = open.length
  const bySource = {}
  for (const it of open) bySource[it.source] = (bySource[it.source] || 0) + 1
  const sources = Object.entries(bySource)
    .filter(([s]) => s !== 'manual')
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')

  // listItems is newest-first; the statusline fallback shows the newest open item
  const newest = open[0] || null
  const focused = sessionId ? getFocus(store, sessionId) : null
  const shown = focused || newest || null

  if (json) {
    const w = titleWidth()
    const t = (it) => (it ? { title: truncWidth(it.title, w), full: it.title } : null)
    return JSON.stringify({ count, sources, focus: t(focused), shown: t(shown) })
  }

  if (count === 0) return '📋 0'

  const useColor = color && !process.env.NO_COLOR
  const CYAN = useColor ? '\x1b[1;36m' : ''
  const DIM = useColor ? '\x1b[2m' : ''
  const X = useColor ? '\x1b[0m' : ''

  const w = titleWidth()
  if (focused) {
    const seq = focused.seq != null ? `#${focused.seq} ` : ''
    return `🎯 ${CYAN}${seq}${truncWidth(focused.title, w)}${X} ${DIM}·${X} 📋 ${count}`
  }
  const seq = newest.seq != null ? `#${newest.seq} ` : ''
  return `📋 ${count} ${DIM}· ${seq}${truncWidth(newest.title, w)}${X}`
}
