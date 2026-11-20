import { atom, read } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { EngineTask, ProcsView } from '../../types'
import { elapsed, megabytes, shortArgs } from './procs-format'
import { killAndRefresh, refreshProcs } from './procs-state'

export const PROCS_PANE = 'hud-procs'

const procs = atom({ plugin: 'hud', key: 'procs' } as const, {
  selfPid: null,
  selfRss: 0,
  tree: [],
  sessions: [],
  leftovers: [],
} as ProcsView)
const tasks = atom({ plugin: 'hud', key: 'tasks' } as const, [] as EngineTask[])

export async function openProcsPane($: EngineInterface) {
  await $.ui.open({ id: PROCS_PANE, title: 'procs', focus: true, rows: 30 })
  await refreshProcs($)
}

export function registerProcsPane(on: On) {
  on('ui.render', { component: 'Pane', requestId: PROCS_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const view = await read($, procs)
    const engineTasks = await read($, tasks)
    const width = Math.max(20, e.props.bodyColumns - 30)

    return (
      <Box flexDirection="column">
        <Text bold>
          本 session · pid {view.selfPid ?? '?'} · {megabytes(view.selfRss)}
        </Text>
        {view.tree.length === 0 && <Text dimColor>  沒有子 process</Text>}
        {view.tree.map(row => (
          <Text key={`tree:${row.pid}`} wrap="truncate-end">
            {'  '.repeat(row.depth + 1)}
            <Text dimColor>
              {String(row.pid).padStart(7)} {elapsed(row.etimes).padStart(6)} {megabytes(row.rss).padStart(5)}
            </Text>{' '}
            {shortArgs(row.args, width - row.depth * 2)}
          </Text>
        ))}

        {engineTasks.length > 0 && <Text bold>engine 背景作業（上一輪結束時）</Text>}
        {engineTasks.map(task => (
          <Text key={`task:${task.id}`} wrap="truncate-end">
            {'  '}
            <Text dimColor>
              {task.type} · {task.status}
            </Text>{' '}
            {task.description}
          </Text>
        ))}

        <Text bold>全機 Claude sessions</Text>
        {view.sessions.map(session => (
          <Text key={`session:${session.pid}`} wrap="truncate-end" color={session.isSelf ? 'suggestion' : undefined}>
            {'  '}
            {(session.name ?? `pid ${session.pid}`).padEnd(20)} {elapsed(session.etimes).padStart(6)}{' '}
            {megabytes(session.rss).padStart(5)}
            <Text dimColor>
              {' '}
              · 子 {session.childCount} 個 {megabytes(session.childRss)}
            </Text>
          </Text>
        ))}

        <Text bold color={view.leftovers.length > 0 ? 'error' : undefined}>
          殘留（session 已結束、process 還活著）
        </Text>
        {view.leftovers.length === 0 && <Text dimColor>  沒有</Text>}
        {view.leftovers.map(left => (
          <Button key={`kill:${left.pid}`} plain onPress={() => killAndRefresh($, left.pid)}>
            <Text color="error">  kill </Text>
            <Text dimColor>
              {String(left.pid).padStart(7)} {elapsed(left.etimes).padStart(6)} {megabytes(left.rss).padStart(5)}{' '}
              {left.ownerName ?? ''}
            </Text>{' '}
            {shortArgs(left.args, width - 8)}
          </Button>
        ))}
        <Box flexDirection="row" gap={1}>
          <Button key="r" plain hotkey="r" label="重整" onPress={() => refreshProcs($)} />
          <Button key="q" plain hotkey="q" label="關閉" onPress={() => $.ui.close({ id: PROCS_PANE })} />
        </Box>
      </Box>
    )
  })
}
