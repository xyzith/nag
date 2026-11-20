import { expect, test } from 'claude-code/testing'

import {
  descendants,
  findSelf,
  isOwnerAlive,
  leftoversOf,
  parsePs,
  recordFor,
  sessionName,
  summarizeSessions,
} from '../hooks/procs-model'
import { elapsed, megabytes, shortArgs } from '../hooks/ui/procs-format'

const PS = `
    787       1    9468 57696 tailscaled      /usr/sbin/tailscaled --port=41641
  13042   13041    9119    12 bash            bash -lic claude -n orch-tools
  13489   13042    9117 214056 claude         claude --dangerously-skip-permissions -n orch-tools --model x
  20001   13489     300  4096 node            node server.js --watch
  20002   20001     299  1024 esbuild         esbuild --serve
  20003   13489       1  2048 ps              ps -eo pid=,ppid=,etimes=,rss=,comm=,args=
  30000   29999     100 99999 claude          /usr/local/bin/claude -n keeper /keeper
`

const NOW = 1_800_000_000_000

test('parses ps rows including args with spaces', () => {
  const rows = parsePs(PS)
  expect(rows).toHaveLength(7)
  expect(rows[2]).toEqual({
    pid: 13489,
    ppid: 13042,
    etimes: 9117,
    rss: 214056,
    comm: 'claude',
    args: 'claude --dangerously-skip-permissions -n orch-tools --model x',
  })
})

test('finds the owning claude and its tree without the ps call itself', () => {
  const rows = parsePs(PS)
  expect(findSelf(rows, 20003)).toBe(13489)
  const tree = descendants(rows, 13489, new Set([20003]))
  expect(tree.map(row => [row.pid, row.depth])).toEqual([
    [20001, 0],
    [20002, 1],
  ])
})

test('summarizes every claude session with its children', () => {
  const rows = parsePs(PS)
  const sessions = summarizeSessions(rows, 13489, new Set([20003]))
  expect(sessions.map(s => [s.name, s.childCount, s.childRss, s.isSelf])).toEqual([
    ['orch-tools', 2, 5120, true],
    ['keeper', 0, 0, false],
  ])
  expect(sessionName('claude --resume abc')).toBe(null)
})

test('a dead owner leaves only children that are still the same process', () => {
  const before = parsePs(PS)
  const tree = descendants(before, 13489, new Set([20003]))
  const record = recordFor(before, tree, 13489, NOW)
  expect(isOwnerAlive(record, before, NOW)).toBe(true)

  const later = NOW + 60_000
  const after = parsePs(`
  20001       1     360  4096 node            node server.js --watch
  20002   20001     359  1024 esbuild         esbuild --other
`)
  expect(isOwnerAlive(record, after, later)).toBe(false)
  expect(leftoversOf(record, after, later).map(left => [left.pid, left.ownerName])).toEqual([[20001, 'orch-tools']])
})

test('formats sizes, durations and long commands', () => {
  expect(megabytes(214056)).toBe('209M')
  expect(elapsed(45)).toBe('45s')
  expect(elapsed(9117)).toBe('2h31m')
  expect(elapsed(200_000)).toBe('2d7h')
  expect(shortArgs('a   b', 10)).toBe('a b')
  expect(shortArgs('abcdefghij', 5)).toBe('abcd…')
})
