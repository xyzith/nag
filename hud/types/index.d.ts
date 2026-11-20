export type NagItem = {
  id: string
  seq: number
  title: string
  desc: string
  from: string
  note: string
  ref: string[]
  status: string
  source: string
  sourceMeta?: Record<string, unknown>
  created: string
  updated: string
}

export type QuotaWindow = { kind: string; percent: number; resetsAt: number | null }

export type BandParts = {
  nag: string | null
  quota: QuotaWindow[]
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    hud: {
      items: NagItem[]
      selected: string | null
      focusTitle: string | null
      previewOffset: number
      error: string | null
      band: BandParts
    }
  }
}
