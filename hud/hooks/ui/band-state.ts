import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { BandParts } from '../../types'
import { cliNag } from '../sources/nag'
import { readQuota } from '../sources/quota'
import { formatNag } from './status-format'

const QUOTA_EVERY_MS = 5_000
const NAG_EVERY_MS = 30_000

const band = atom({ plugin: 'hud', key: 'band' } as const, {
  nag: null,
  quota: [],
  now: 0,
} as BandParts)

async function patch($: EngineInterface, load: () => Promise<Partial<BandParts>>) {
  try {
    const changes = await load()
    await update($, band, parts => ({ ...parts, ...changes }))
  } catch {}
}

export function refreshNagStatus($: EngineInterface) {
  return patch($, async () => ({ nag: formatNag(await cliNag($).status()) }))
}

function refreshQuota($: EngineInterface) {
  return patch($, async () => ({ quota: await readQuota($), now: await $.clock.now() }))
}

export async function startBandRefresh($: EngineInterface) {
  await Promise.all([refreshQuota($), refreshNagStatus($)])
  $.clock.every(QUOTA_EVERY_MS, () => refreshQuota($))
  $.clock.every(NAG_EVERY_MS, () => refreshNagStatus($))
}
