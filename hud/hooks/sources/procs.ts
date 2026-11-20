import type { EngineInterface } from 'claude-code'

import type { ProcRow } from '../../types'
import { PS_FORMAT, parsePs } from '../procs-model'
import type { SessionRecord } from '../procs-model'

async function recordDir($: EngineInterface) {
  return `${await $.env.get('HOME')}/.local/state/nag/hud-sessions`
}

export type PsSnapshot = { rows: ProcRow[]; psPid: number | null; now: number }

export async function snapshot($: EngineInterface): Promise<PsSnapshot> {
  const { stdout } = await $.process.run(['sh', '-c', `echo $$; exec ps -eo ${PS_FORMAT}`])
  const [first = '', ...table] = stdout.split('\n')
  const psPid = Number(first.trim())
  return { rows: parsePs(table.join('\n')), psPid: Number.isInteger(psPid) && psPid > 0 ? psPid : null, now: await $.clock.now() }
}

export async function readRecords($: EngineInterface): Promise<SessionRecord[]> {
  const dir = await recordDir($)
  if (!(await $.fs.exists(dir))) return []
  const entries = await $.fs.list(dir)
  const records = await Promise.all(
    entries
      .filter(entry => entry.kind === 'file' && entry.name.endsWith('.json'))
      .map(entry => $.fs.read(`${dir}/${entry.name}`).then(text => JSON.parse(text) as SessionRecord)),
  )
  return records
}

export async function writeRecord($: EngineInterface, record: SessionRecord) {
  const dir = await recordDir($)
  await $.process.run(['mkdir', '-p', dir])
  await $.fs.write(`${dir}/${record.owner.pid}.json`, JSON.stringify(record))
}

export async function deleteRecord($: EngineInterface, ownerPid: number) {
  await $.process.run(['rm', '-f', `${await recordDir($)}/${ownerPid}.json`])
}

export async function killPid($: EngineInterface, pid: number) {
  const { exitCode, stderr } = await $.process.run(['kill', String(pid)])
  if (exitCode !== 0) throw new Error(`kill ${pid}: ${stderr.trim()}`)
}
