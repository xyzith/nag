import { expect, test } from 'claude-code/testing'

import type { NagItem } from '../types'

const ITEMS: NagItem[] = [1, 2, 3].map(seq => ({
  id: `id${seq}`,
  seq,
  title: `task ${seq}`,
  desc: `desc of ${seq}`,
  from: '',
  note: '',
  ref: [],
  status: 'open',
  source: 'manual',
  created: '2026-10-14T10:58:13.184Z',
  updated: '2026-10-15T04:49:35.303Z',
}))

const PANE = {
  plugin: 'hud',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'hud-nag',
  props: {
    title: 'nag',
    isFocused: true,
    bodyColumns: 120,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('pane draws the list and previews the selected item', { timeoutMs: 20_000 }, async ($, on) => {
  const calls: string[][] = []
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.exists', () => ({ value: false }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('process.run', ($, e) => {
    calls.push([...e.argv.slice(1)])
    const stdout =
      e.argv[1] === 'list'
        ? JSON.stringify(ITEMS)
        : e.argv[1] === 'status'
          ? JSON.stringify({ count: 3, focus: { full: 'task 2' } })
          : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  const closed: string[] = []
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })

  const appended: string[] = []
  on('session.append', ($, e, next) => {
    appended.push(JSON.stringify(e.message.content))
    return next(e)
  })

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'r' })

  expect(await ui.find({ key: 'item:id3' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /desc of 1/ })).toBeDefined()

  await ui.press({ key: 'j' })
  expect(await ui.find({ type: 'Markdown', text: /desc of 2/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /🎯 focus/ })).toBeDefined()

  await ui.press({ key: 'f' })
  expect(calls).toContainEqual(['focus', 'id2', '--session', 'sess-1'])
  expect(appended.some(text => text.includes('#2 task 2') && text.includes('desc of 2'))).toBe(true)
  expect(appended.some(text => text.includes('nag_done（task:'))).toBe(true)

  await ui.press({ key: 'd' })
  expect(calls).toContainEqual(['done', 'id2'])

  await ui.press({ key: 'q' })
  expect(closed).toEqual(['hud-nag'])
  await ui.unmount()
})
