import type { EngineInterface } from 'claude-code'

import type { QuotaWindow } from '../../types'

export async function readQuota($: EngineInterface): Promise<QuotaWindow[]> {
  const { rateLimits } = await $.session.usage()
  return rateLimits.map(limit => ({
    kind: limit.kind,
    percent: limit.percentUsed,
    resetsAt: limit.resetsAt ? Date.parse(limit.resetsAt) : null,
  }))
}
