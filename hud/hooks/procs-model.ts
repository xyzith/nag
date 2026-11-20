import type { Leftover, ProcRow, SessionSummary, TreeRow } from '../types'

export const PS_FORMAT = 'pid=,ppid=,etimes=,rss=,comm=,args='
const START_TOLERANCE_MS = 5_000

export type SessionRecord = {
  owner: { pid: number; startedAt: number; name: string | null }
  children: { pid: number; startedAt: number; args: string }[]
}

export function parsePs(stdout: string): ProcRow[] {
  return stdout
    .split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/))
    .filter(match => match !== null)
    .map(([, pid, ppid, etimes, rss, comm, args]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      etimes: Number(etimes),
      rss: Number(rss),
      comm: comm ?? '',
      args: args ?? '',
    }))
}

const isClaude = (row: ProcRow) => row.comm === 'claude'

export function findSelf(rows: readonly ProcRow[], psPid: number): number | null {
  const byPid = new Map(rows.map(row => [row.pid, row]))
  let at = byPid.get(psPid)
  while (at && at.pid > 1) {
    if (isClaude(at)) return at.pid
    at = byPid.get(at.ppid)
  }
  return null
}

export function descendants(rows: readonly ProcRow[], root: number, skip: ReadonlySet<number>): TreeRow[] {
  const children = new Map<number, ProcRow[]>()
  for (const row of rows) {
    if (skip.has(row.pid)) continue
    children.set(row.ppid, [...(children.get(row.ppid) ?? []), row])
  }
  const walk = (pid: number, depth: number): TreeRow[] =>
    (children.get(pid) ?? []).flatMap(row => [
      { pid: row.pid, depth, etimes: row.etimes, rss: row.rss, args: row.args },
      ...walk(row.pid, depth + 1),
    ])
  return walk(root, 0)
}

export function sessionName(args: string): string | null {
  return args.match(/(?:^|\s)-n\s+(\S+)/)?.[1] ?? null
}

export function summarizeSessions(rows: readonly ProcRow[], selfPid: number | null, skip: ReadonlySet<number>): SessionSummary[] {
  return rows.filter(isClaude).map(row => {
    const tree = descendants(rows, row.pid, skip)
    return {
      pid: row.pid,
      name: sessionName(row.args),
      etimes: row.etimes,
      rss: row.rss,
      childCount: tree.length,
      childRss: tree.reduce((sum, one) => sum + one.rss, 0),
      isSelf: row.pid === selfPid,
    }
  })
}

const startedAt = (etimes: number, now: number) => now - etimes * 1000

const sameStart = (a: number, b: number) => Math.abs(a - b) <= START_TOLERANCE_MS

export function recordFor(rows: readonly ProcRow[], tree: readonly TreeRow[], selfPid: number, now: number): SessionRecord {
  const self = rows.find(row => row.pid === selfPid)
  return {
    owner: {
      pid: selfPid,
      startedAt: startedAt(self?.etimes ?? 0, now),
      name: self ? sessionName(self.args) : null,
    },
    children: tree.map(row => ({ pid: row.pid, startedAt: startedAt(row.etimes, now), args: row.args })),
  }
}

export function isOwnerAlive(record: SessionRecord, rows: readonly ProcRow[], now: number): boolean {
  return rows.some(
    row => row.pid === record.owner.pid && isClaude(row) && sameStart(startedAt(row.etimes, now), record.owner.startedAt),
  )
}

export function leftoversOf(record: SessionRecord, rows: readonly ProcRow[], now: number): Leftover[] {
  return record.children.flatMap(child => {
    const row = rows.find(
      one => one.pid === child.pid && one.args === child.args && sameStart(startedAt(one.etimes, now), child.startedAt),
    )
    return row ? [{ pid: row.pid, args: row.args, etimes: row.etimes, rss: row.rss, ownerName: record.owner.name }] : []
  })
}
