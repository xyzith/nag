import type { QuotaWindow } from '../../types'
import type { NagStatus } from '../sources/nag'

const QUOTA_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  seven_day_sonnet: 'son',
  seven_day_opus: 'opus',
}

export type QuotaLevel = 'success' | 'warning' | 'error'

export function resetIn(resetsAt: number | null, now: number): string | null {
  if (resetsAt === null || resetsAt < now) return null
  const minutes = Math.floor((resetsAt - now) / 60_000)
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)}d${hours % 24}h`
  return hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
}

export function quotaLevel(percent: number): QuotaLevel {
  if (percent >= 80) return 'error'
  return percent >= 50 ? 'warning' : 'success'
}

export function quotaSegments(windows: readonly QuotaWindow[], now: number) {
  return windows.map(window => ({
    kind: window.kind,
    level: quotaLevel(window.percent),
    text: `${QUOTA_LABELS[window.kind] ?? window.kind} ${Math.round(window.percent)}%`,
    reset: resetIn(window.resetsAt, now),
  }))
}

export function formatNag(status: NagStatus | null): string | null {
  if (status === null || status.count === 0) return null
  const title = status.focusShort ?? status.newestShort
  if (!title) return `📋 ${status.count}`
  const seq = status.seq === null ? '' : `#${status.seq} `
  return `📋 ${status.count} · ${status.focusShort ? '🎯 ' : ''}${seq}${title}`
}
