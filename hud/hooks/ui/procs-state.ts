import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EngineTask, Leftover, ProcsView } from '../../types'
import { descendants, findSelf, isOwnerAlive, leftoversOf, recordFor, summarizeSessions } from '../procs-model'
import { deleteRecord, killPid, readRecords, snapshot, writeRecord } from '../sources/procs'

const PROCS_EVERY_MS = 10_000

const procs = atom({ plugin: 'hud', key: 'procs' } as const, {
  selfPid: null,
  selfRss: 0,
  tree: [],
  sessions: [],
  leftovers: [],
} as ProcsView)
const tasks = atom({ plugin: 'hud', key: 'tasks' } as const, [] as EngineTask[])

let lastWritten = ''

export async function refreshProcs($: EngineInterface) {
  try {
    const { rows, psPid, now } = await snapshot($)
    const skip = new Set(psPid === null ? [] : [psPid])
    const selfPid = psPid === null ? null : findSelf(rows, psPid)
    const tree = selfPid === null ? [] : descendants(rows, selfPid, skip)

    if (selfPid !== null) {
      const record = recordFor(rows, tree, selfPid, now)
      const signature = JSON.stringify(record.children.map(child => [child.pid, child.args]))
      if (signature !== lastWritten) {
        await writeRecord($, record)
        lastWritten = signature
      }
    }

    const leftovers: Leftover[] = []
    for (const record of await readRecords($)) {
      if (isOwnerAlive(record, rows, now)) continue
      const alive = leftoversOf(record, rows, now)
      if (alive.length === 0) await deleteRecord($, record.owner.pid)
      leftovers.push(...alive)
    }

    await update($, procs, () => ({
      selfPid,
      selfRss: rows.find(row => row.pid === selfPid)?.rss ?? 0,
      tree,
      sessions: summarizeSessions(rows, selfPid, skip),
      leftovers,
    }))
  } catch {}
}

export async function killAndRefresh($: EngineInterface, pid: number) {
  try {
    await killPid($, pid)
    $.ui.toast(`已送出 kill ${pid}`)
  } catch (err) {
    $.ui.toast(String(err))
  }
  await refreshProcs($)
}

export async function recordEngineTasks($: EngineInterface, list: readonly EngineTask[]) {
  await update($, tasks, () => list.map(({ id, type, status, description }) => ({ id, type, status, description })))
}

export async function startProcsRefresh($: EngineInterface) {
  await refreshProcs($)
  $.clock.every(PROCS_EVERY_MS, () => refreshProcs($))
}
