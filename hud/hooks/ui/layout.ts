import type { NagItem } from '../../types'

export const SEQ_COLUMN = 8

const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u

export function cellWidth(text: string): number {
  let width = 0
  for (const char of text) width += WIDE.test(char) ? 2 : 1
  return width
}

function pieces(text: string): string[] {
  const out: string[] = []
  let run = ''
  let isSpaceRun = false
  for (const char of text) {
    const isSpace = /\s/u.test(char)
    if (WIDE.test(char)) {
      if (run) out.push(run)
      out.push(char)
      run = ''
      continue
    }
    if (run && isSpace !== isSpaceRun) {
      out.push(run)
      run = ''
    }
    run += char
    isSpaceRun = isSpace
  }
  if (run) out.push(run)
  return out
}

const NO_LINE_START = /^[，。、；：！？）」』】》〉,.;:!?)\]]/u
const NO_LINE_END = /[（「『【《〈(\[]$/u
const LINE_TAIL = new RegExp(`(?:(?!${WIDE.source})\\S)+$|.$`, 'u')

export function wrapTitle(title: string, columns: number): string[] {
  const width = Math.max(2, columns)
  const lines = ['']
  const breakBefore = (piece: string) => {
    const current = lines.at(-1) ?? ''
    const tail = current.match(LINE_TAIL)?.[0] ?? ''
    const kept = current.slice(0, current.length - tail.length).trimEnd()
    const carry = tail + piece
    if ((NO_LINE_START.test(piece) || NO_LINE_END.test(tail)) && kept && cellWidth(carry) <= width) {
      lines.splice(-1, 1, kept, carry)
    } else lines.push(piece)
  }
  const place = (piece: string) => {
    const current = lines.at(-1) ?? ''
    if (cellWidth(current + piece) <= width) lines.splice(-1, 1, current + piece)
    else if (/^\s+$/u.test(piece)) return
    else if (cellWidth(piece) > width) for (const char of piece) place(char)
    else breakBefore(piece)
  }
  for (const piece of pieces(title.trim())) place(piece)
  return lines.map(line => line.trimEnd())
}

export function listWindow(heights: readonly number[], selectedIndex: number, rows: number) {
  if (heights.length === 0) return { start: 0, end: 0 }
  const height = (at: number) => heights[at] ?? 0
  let start = selectedIndex
  let end = selectedIndex + 1
  let used = height(selectedIndex)
  const fits = (at: number) => used + height(at) <= rows
  while (start > 0 && fits(start - 1) && used - height(selectedIndex) + height(start - 1) <= Math.floor(rows / 2)) {
    used += height(--start)
  }
  while (end < heights.length && fits(end)) used += height(end++)
  while (start > 0 && fits(start - 1)) used += height(--start)
  return { start, end }
}

export function listOffset(heights: readonly number[], selectedIndex: number, rows: number): number {
  const { start } = listWindow(heights, selectedIndex, rows)
  return heights.slice(0, start).reduce((sum, height) => sum + height, 0)
}

export function step(items: readonly NagItem[], selected: string | null, by: number): string | null {
  if (items.length === 0) return null
  const at = items.findIndex(item => item.id === selected)
  const next = Math.max(0, Math.min(items.length - 1, (at < 0 ? 0 : at) + by))
  return items[next]?.id ?? null
}

export function leftWidth(bodyColumns: number): number {
  return Math.max(24, Math.min(50, Math.round(bodyColumns * 0.35)))
}

export function previewLines(item: NagItem, isFocused: boolean): string[] {
  const meta = [
    `\`${item.status}\``,
    isFocused ? '🎯 focus' : null,
    item.source !== 'manual' ? item.source : null,
    `建立 ${item.created.slice(0, 10)}`,
    `更新 ${item.updated.slice(0, 10)}`,
  ].filter(Boolean)

  return [
    `**#${item.seq} ${item.title}**`,
    meta.join(' · '),
    ...(item.from ? [`from：${item.from}`] : []),
    '',
    ...(item.desc ? item.desc.split('\n') : ['_（無內文）_']),
    ...(item.note ? ['', '**note**', ...item.note.split('\n')] : []),
    ...(item.ref.length > 0 ? ['', '**ref**', ...item.ref.map(url => `- ${url}`)] : []),
  ]
}

export function focusFooter(item: NagItem): string {
  return `做完這筆後，先跟使用者確認，再呼叫 nag_done（task: "${item.seq}"）結案；使用者說先放著就呼叫 nag_unfocus。`
}

export function clampOffset(offset: number, lineCount: number): number {
  return Math.max(0, Math.min(offset, lineCount - 1))
}
