import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'hud',
  surface: 'terminal',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

const otherBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: 'other plugin row' }))

test('band draws a placeholder before the first quota reading', { timeoutMs: 20_000 }, async ($, on) => {
  otherBand(on)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /等首次回應/ })).toBeDefined()
  await ui.unmount()
})

test('band keeps the band another plugin draws beneath it', { timeoutMs: 20_000 }, async ($, on) => {
  otherBand(on)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /等首次回應/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^other plugin row$/ })).toBeDefined()
  await ui.unmount()
})
