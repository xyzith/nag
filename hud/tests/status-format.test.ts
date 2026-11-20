import { expect, test } from 'claude-code/testing'

import { formatNag, quotaSegments, resetIn } from '../hooks/ui/status-format'

const NOW = Date.parse('2026-10-15T08:00:00Z')
const HOUR = 3_600_000

test('reset countdown picks minutes, hours or days', () => {
  expect(resetIn(NOW + 25 * 60_000, NOW)).toBe('25m')
  expect(resetIn(NOW + 2 * HOUR + 10 * 60_000, NOW)).toBe('2h10m')
  expect(resetIn(NOW + 53 * HOUR, NOW)).toBe('2d5h')
  expect(resetIn(NOW - 1, NOW)).toBe(null)
  expect(resetIn(null, NOW)).toBe(null)
})

test('quota segments label and grade each window', () => {
  const segments = quotaSegments(
    [
      { kind: 'five_hour', percent: 66, resetsAt: NOW + HOUR },
      { kind: 'seven_day', percent: 32.5, resetsAt: null },
      { kind: 'spend_limit', percent: 91, resetsAt: null },
    ],
    NOW,
  )
  expect(segments.map(s => [s.text, s.level, s.reset])).toEqual([
    ['5h 66%', 'warning', '1h0m'],
    ['7d 33%', 'success', null],
    ['spend_limit 91%', 'error', null],
  ])
})

test('nag part prefers the focused title and hides when empty', () => {
  const base = { count: 3, focusTitle: null, focusShort: null, newestShort: 'newest', seq: null }
  expect(formatNag(base)).toBe('📋 3 · newest')
  expect(formatNag({ ...base, seq: 42 })).toBe('📋 3 · #42 newest')
  expect(formatNag({ ...base, focusTitle: 'full', focusShort: 'mine', seq: 7 })).toBe('📋 3 · 🎯 #7 mine')
  expect(formatNag({ ...base, count: 0 })).toBe(null)
  expect(formatNag(null)).toBe(null)
})
