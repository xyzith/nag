import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import type { BandParts, ProcsView } from '../../types'
import { openNagPane } from './nag-pane'
import { openProcsPane } from './procs-pane'
import { quotaSegments } from './status-format'

const band = atom({ plugin: 'hud', key: 'band' } as const, {
  nag: null,
  quota: [],
  now: 0,
} as BandParts)

const procs = atom({ plugin: 'hud', key: 'procs' } as const, {
  selfPid: null,
  selfRss: 0,
  tree: [],
  sessions: [],
  leftovers: [],
} as ProcsView)

export function registerBand(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const parts = await read($, band)
    const view = await read($, procs)
    const hasProcs = view.tree.length > 0 || view.leftovers.length > 0
    const quota = quotaSegments(parts.quota, parts.now)
    const dot = <Text dimColor> · </Text>
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {parts.nag && (
            <Button key="nag" plain onPress={() => openNagPane($)}>
              <Text wrap="truncate-end">{parts.nag}</Text>
            </Button>
          )}
          {parts.nag && dot}
          {hasProcs && (
            <Button key="procs" plain hotkey="p" onPress={() => openProcsPane($)}>
              {view.tree.length > 0 && <Text>⚙ {view.tree.length}</Text>}
              {view.leftovers.length > 0 && <Text color="error"> ⚠ 殘留 {view.leftovers.length}</Text>}
            </Button>
          )}
          {hasProcs && dot}
          {quota.length === 0 && <Text dimColor>額度：等首次回應後顯示</Text>}
          {quota.map((segment, at) => (
            <Text key={segment.kind}>
              {at > 0 && dot}
              <Text color={segment.level}>{segment.text}</Text>
              {segment.reset && <Text dimColor>({segment.reset})</Text>}
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
