import type { EngineInterface } from 'claude-code'

import type { NagItem } from '../../types'

const NAG_BIN = 'nag'

export type NagStatus = {
  count: number
  focusTitle: string | null
  focusShort: string | null
  newestShort: string | null
  seq: number | null
}

export type NagSource = {
  list: () => Promise<NagItem[]>
  status: () => Promise<NagStatus>
  focus: (id: string) => Promise<void>
  unfocus: () => Promise<void>
  done: (id: string) => Promise<void>
  ignore: (id: string) => Promise<void>
  show: (task: string, focus: boolean) => Promise<string>
  add: (fields: { title: string; from?: string; desc?: string; ref?: string[] }) => Promise<string>
  note: (task: string, text: string) => Promise<string>
  update: (task: string, fields: Record<string, string>) => Promise<string>
}

export function cliNag($: EngineInterface): NagSource {
  const run = async (args: string[]) => {
    const { exitCode, stdout, stderr } = await $.process.run([NAG_BIN, ...args])
    if (exitCode !== 0) throw new Error(`nag ${args[0]}: ${(stderr || stdout).trim()}`)
    return stdout
  }
  const withSession = async (args: string[]) => [...args, '--session', await $.session.id()]

  const list = async () => JSON.parse(await run(['list', '--json'])) as NagItem[]

  return {
    list,
    status: async () => {
      const [raw, items] = await Promise.all([run(await withSession(['status', '--json'])).then(JSON.parse), list()])
      const shownTitle = raw.focus?.full ?? raw.shown?.full
      return {
        count: raw.count ?? 0,
        focusTitle: raw.focus?.full ?? null,
        focusShort: raw.focus?.title ?? null,
        newestShort: raw.focus ? null : (raw.shown?.title ?? null),
        seq: items.find(item => item.title === shownTitle)?.seq ?? null,
      }
    },
    focus: async id => void (await run(await withSession(['focus', id]))),
    unfocus: async () => void (await run(await withSession(['unfocus']))),
    done: async id => void (await run(['done', id])),
    ignore: async id => void (await run(['ignore', id])),
    show: async (task, focus) =>
      run(focus ? await withSession(['show', task, '--json']) : ['show', task, '--json', '--no-focus']),
    add: async ({ title, from, desc, ref = [] }) =>
      run([
        'add',
        '--title',
        title,
        ...(from ? ['--from', from] : []),
        ...(desc ? ['--desc', desc] : []),
        ...ref.flatMap(url => ['--ref', url]),
      ]),
    note: async (task, text) => run(['note', '--id', task, '--text', text]),
    update: async (task, fields) =>
      run(['update', task, ...Object.entries(fields).flatMap(([key, value]) => [`--${key}`, value])]),
  }
}
