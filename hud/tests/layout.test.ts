import { expect, test } from 'claude-code/testing'

import type { NagItem } from '../types'
import { cellWidth, clampOffset, focusFooter, listOffset, listWindow, previewLines, step, wrapTitle } from '../hooks/ui/layout'

const item = (id: string, seq: number, extra: Partial<NagItem> = {}): NagItem => ({
  id,
  seq,
  title: `task ${seq}`,
  desc: '',
  from: '',
  note: '',
  ref: [],
  status: 'open',
  source: 'manual',
  created: '2026-10-14T10:58:13.184Z',
  updated: '2026-10-15T04:49:35.303Z',
  ...extra,
})

const list = [item('a', 1), item('b', 2), item('c', 3)]

test('window keeps the selected row inside the visible rows', () => {
  const ones = Array(30).fill(1)
  expect(listWindow(ones, 0, 10)).toEqual({ start: 0, end: 10 })
  expect(listWindow(ones, 15, 10)).toEqual({ start: 10, end: 20 })
  expect(listWindow(ones, 29, 10)).toEqual({ start: 20, end: 30 })
  expect(listWindow([1, 1, 1], 1, 10)).toEqual({ start: 0, end: 3 })
  expect(listWindow([], 0, 10)).toEqual({ start: 0, end: 0 })
})

test('window counts wrapped titles by their rows', () => {
  const window = listWindow([3, 3, 3, 3, 3], 4, 7)
  expect(window).toEqual({ start: 3, end: 5 })
  expect(listWindow([20], 0, 7)).toEqual({ start: 0, end: 1 })
})

test('offset skips the rows above the window', () => {
  expect(listOffset([2, 1, 3, 1, 1, 1], 0, 4)).toBe(0)
  expect(listOffset([2, 1, 3, 1, 1, 1], 4, 4)).toBe(6)
  expect(listOffset([], 0, 4)).toBe(0)
})

test('titles wrap at spaces or between CJK, every line inside the column', () => {
  expect(cellWidth('ab中文')).toBe(6)
  expect(wrapTitle('中文中文中文', 5)).toEqual(['中文', '中文', '中文'])
  expect(wrapTitle('', 5)).toEqual([''])
  expect(wrapTitle('app mod 第二項：FE subagent 結束自動跑 typecheck-diff＋biome 判讀', 42)).toEqual([
    'app mod 第二項：FE subagent 結束自動跑',
    'typecheck-diff＋biome 判讀',
  ])
  expect(wrapTitle('mytool /handoff:cmd：交棒全文預設帶軟停口語授權段', 42)).toEqual([
    'mytool /handoff:cmd：交棒全文預設帶軟停口',
    '語授權段',
  ])
  expect(wrapTitle('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  expect(wrapTitle('local 登入權限改由 Mac 簽發（B 案，等要在 local', 32)).toEqual([
    'local 登入權限改由 Mac 簽發（B',
    '案，等要在 local',
  ])
  expect(wrapTitle('統一處理方式（做成 script）', 26)).toEqual(['統一處理方式（做成', 'script）'])
  expect(wrapTitle('skill 與 resolver 要共用（resolve-stop 自動解', 32)).toEqual([
    'skill 與 resolver 要共用',
    '（resolve-stop 自動解',
  ])
  for (const line of wrapTitle('[mytool] alpha inbox 對話記憶參考 TencentDB Agent Memory 四層結構', 20)) {
    expect(cellWidth(line)).toBeLessThanOrEqual(20)
  }
})

test('focus footer tells the model how to close the item', () => {
  expect(focusFooter(item('x', 631))).toContain('nag_done（task: "631"）')
})

test('step clamps at both ends and recovers from a vanished selection', () => {
  expect(step(list, 'a', -1)).toBe('a')
  expect(step(list, 'a', 1)).toBe('b')
  expect(step(list, 'c', 1)).toBe('c')
  expect(step(list, 'gone', 1)).toBe('b')
  expect(step([], 'a', 1)).toBe(null)
})

test('preview carries desc, note and refs', () => {
  const lines = previewLines(item('x', 9, { desc: 'line1\nline2', note: 'n', ref: ['https://x.y'] }), true)
  expect(lines[0]).toBe('**#9 task 9**')
  expect(lines[1]).toContain('🎯 focus')
  expect(lines).toContain('line2')
  expect(lines).toContain('- https://x.y')
  expect(clampOffset(99, lines.length)).toBe(lines.length - 1)
})
