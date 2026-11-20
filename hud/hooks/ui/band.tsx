import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import type { BandParts } from '../../types'
import { openNagPane } from './nag-pane'
import { quotaSegments } from './status-format'

const band = atom({ plugin: 'hud', key: 'band' } as const, {
  nag: null,
  quota: [],
  now: 0,
} as BandParts)

export function registerBand(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const parts = await read($, band)
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
