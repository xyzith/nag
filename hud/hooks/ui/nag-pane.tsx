import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { NagItem } from '../../types'
import { cliNag } from '../sources/nag'
import { clampOffset, focusFooter, leftWidth, listOffset, previewLines, SEQ_COLUMN, step, wrapTitle } from './layout'
import { refreshNagStatus } from './band-state'

export const NAG_PANE = 'hud-nag'
const ITEM_KEY = 'item:'
const FOOTER_ROWS = 1
const FOCUS_HEADER = '[hud] 使用者在 nag 面板把本 session focus 到這筆待辦：'
const UNFOCUS_NOTE = '[hud] 使用者已清除本 session 的 nag focus。'

const items = atom({ plugin: 'hud', key: 'items' } as const, [] as NagItem[])
const selected = atom({ plugin: 'hud', key: 'selected' } as const, null as string | null)
const focusTitle = atom({ plugin: 'hud', key: 'focusTitle' } as const, null as string | null)
const previewOffset = atom({ plugin: 'hud', key: 'previewOffset' } as const, 0)
const error = atom({ plugin: 'hud', key: 'error' } as const, null as string | null)

export async function refreshNag($: EngineInterface) {
  const nag = cliNag($)
  try {
    const [list, status] = await Promise.all([nag.list(), nag.status()])
    await update($, items, () => list)
    await update($, focusTitle, () => status.focusTitle)
    await update($, selected, current =>
      list.some(item => item.id === current) ? current : (list[0]?.id ?? null),
    )
    await update($, error, () => null)
    void refreshNagStatus($)
  } catch (err) {
    await update($, error, () => String(err))
  }
}

export async function openNagPane($: EngineInterface) {
  await $.ui.open({ id: NAG_PANE, title: 'nag', focus: true, rows: 30 })
  await refreshNag($)
}

async function select($: EngineInterface, id: string | null) {
  await update($, selected, () => id)
  await update($, previewOffset, () => 0)
}

async function seatRing($: EngineInterface) {
  const id = await read($, selected)
  if (id) await $.ui.focus({ requestId: NAG_PANE, key: `${ITEM_KEY}${id}` }).catch(() => undefined)
}

async function tellModel($: EngineInterface, text: string) {
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
}

async function act(
  $: EngineInterface,
  label: string,
  op: (id: string) => Promise<void>,
  after?: (item: NagItem) => Promise<void>,
) {
  const id = await read($, selected)
  const item = (await read($, items)).find(one => one.id === id)
  if (!item) return
  try {
    await op(item.id)
    await after?.(item)
    $.ui.toast(`nag ${label}`)
  } catch (err) {
    await update($, error, () => String(err))
  }
  await refreshNag($)
  await seatRing($)
}

function announceFocus($: EngineInterface) {
  return (item: NagItem) => tellModel($, [FOCUS_HEADER, ...previewLines(item, true), '', focusFooter(item)].join('\n'))
}

function announceUnfocus($: EngineInterface) {
  return () => tellModel($, UNFOCUS_NOTE)
}

export function registerNagPane(on: On) {
  on('ui.focus', { requestId: NAG_PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person' && e.element && !e.element.startsWith(ITEM_KEY)) return { deny: 'list rows only' }
    const result = await next(e)
    if (result.deny === undefined && e.element?.startsWith(ITEM_KEY)) {
      await select($, e.element.slice(ITEM_KEY.length))
    }
    return result
  })

  on('ui.scroll', { requestId: NAG_PANE }, async ($, e) => {
    await update($, previewOffset, offset => Math.max(0, offset + e.by))
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: NAG_PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await read($, items)
    const current = await read($, selected)
    const focused = await read($, focusTitle)
    const offset = await read($, previewOffset)
    const failure = await read($, error)
    const nag = cliNag($)

    const bodyRows = Math.max(6, e.props.scroll.bodyRows)
    const listRows = bodyRows - FOOTER_ROWS
    const width = leftWidth(e.props.bodyColumns)
    const titleColumns = width - SEQ_COLUMN
    const index = Math.max(0, list.findIndex(item => item.id === current))
    const titles = list.map(row => wrapTitle(row.title, titleColumns))
    const scrolled = listOffset(titles.map(title => title.length), index, listRows)
    const item = list[index]
    const lines = item ? previewLines(item, item.title === focused) : []
    const choose = async (id: string | null) => {
      await select($, id)
      await seatRing($)
    }

    return (
      <Box flexDirection="column" height={bodyRows}>
        <Box flexDirection="row" height={listRows}>
          <Box flexDirection="column" width={width} flexShrink={0} overflow="hidden">
            {list.length === 0 && <Text dimColor>{failure ?? '沒有 open 的待辦'}</Text>}
            <Box flexDirection="column" flexShrink={0} marginTop={-scrolled}>
              {list.map((row, at) => {
                const isCurrent = row.id === item?.id
                const color = isCurrent ? 'suggestion' : undefined
                return (
                  <Box key={row.id} flexDirection="row" flexShrink={0}>
                    <Box width={SEQ_COLUMN} flexShrink={0}>
                      <Text color={color}>
                        {isCurrent ? '▶' : ' '}
                        {row.title === focused ? '🎯' : '  '}
                        {String(row.seq).padStart(4)}
                      </Text>
                    </Box>
                    <Box flexGrow={1} flexShrink={1}>
                      <Button
                        key={`${ITEM_KEY}${row.id}`}
                        plain
                        autoFocus={isCurrent || undefined}
                        onPress={() => choose(row.id)}
                      >
                        <Text color={color}>{titles[at]?.join('\n')}</Text>
                      </Button>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
          <Box flexDirection="column" flexGrow={1} paddingLeft={2} overflow="hidden">
            {item && <Markdown text={lines.slice(clampOffset(offset, lines.length)).join('\n')} />}
          </Box>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="j" plain hotkey="j" label="下" onPress={() => choose(step(list, current, 1))} />
          <Button key="k" plain hotkey="k" label="上" onPress={() => choose(step(list, current, -1))} />
          <Button key="n" plain hotkey="n" label="內文↓" onPress={() => update($, previewOffset, o => clampOffset(o + 5, lines.length))} />
          <Button key="p" plain hotkey="p" label="內文↑" onPress={() => update($, previewOffset, o => Math.max(0, o - 5))} />
          <Button key="f" plain hotkey="f" label="focus" onPress={() => act($, 'focus', nag.focus, announceFocus($))} />
          <Button key="u" plain hotkey="u" label="unfocus" onPress={() => act($, 'unfocus', () => nag.unfocus(), announceUnfocus($))} />
          <Button key="d" plain hotkey="d" label="done" onPress={() => act($, 'done', nag.done)} />
          <Button key="i" plain hotkey="i" label="ignore" onPress={() => act($, 'ignore', nag.ignore)} />
          <Button key="r" plain hotkey="r" label="重整" onPress={() => refreshNag($)} />
          <Button key="q" plain hotkey="q" label="關閉" onPress={() => $.ui.close({ id: NAG_PANE })} />
          {failure && list.length > 0 && <Text color="error" wrap="truncate-end">{failure}</Text>}
        </Box>
      </Box>
    )
  })
}
