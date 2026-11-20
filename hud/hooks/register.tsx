import type { Register } from 'claude-code'

import { registerNagTools, serveNagTools } from './tools/nag-tools'
import { registerBand } from './ui/band'
import { startBandRefresh } from './ui/band-state'
import { openNagPane, registerNagPane } from './ui/nag-pane'
import { openProcsPane, registerProcsPane } from './ui/procs-pane'
import { recordEngineTasks, refreshProcs, startProcsRefresh } from './ui/procs-state'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hud',
      description: '開啟 hud 面板：nag 待辦（預設）或 procs 背景作業',
      argumentHint: '[procs]',
      immediate: true,
    })
    $.ui.status(undefined)
    await registerNagTools($)
    void startBandRefresh($)
    void startProcsRefresh($)
    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    if (e.args.trim() === 'procs') {
      await openProcsPane($)
      return { text: 'procs 面板已開啟' }
    }
    await openNagPane($)
    return { text: 'nag 面板已開啟' }
  })

  on('classic.Stop', async ($, e, next) => {
    await recordEngineTasks($, e.background_tasks ?? [])
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await refreshProcs($)
    return next(e)
  })

  serveNagTools(on)
  registerNagPane(on)
  registerProcsPane(on)
  registerBand(on)
}
