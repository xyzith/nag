import type { Register } from 'claude-code'

import { registerNagTools, serveNagTools } from './tools/nag-tools'
import { registerBand } from './ui/band'
import { startBandRefresh } from './ui/band-state'
import { openNagPane, registerNagPane } from './ui/nag-pane'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hud',
      description: '開啟 nag 待辦面板',
      immediate: true,
    })
    $.ui.status(undefined)
    await registerNagTools($)
    void startBandRefresh($)
    return next(e)
  })

  on('command.run', { command: 'hud' }, async $ => {
    await openNagPane($)
    return { text: 'nag 面板已開啟' }
  })

  serveNagTools(on)
  registerNagPane(on)
  registerBand(on)
}
