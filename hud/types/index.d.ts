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

export type ProcRow = { pid: number; ppid: number; etimes: number; rss: number; comm: string; args: string }

export type TreeRow = { pid: number; depth: number; etimes: number; rss: number; args: string }

export type SessionSummary = {
  pid: number
  name: string | null
  etimes: number
  rss: number
  childCount: number
  childRss: number
  isSelf: boolean
}

export type Leftover = { pid: number; args: string; etimes: number; rss: number; ownerName: string | null }

export type EngineTask = { id: string; type: string; status: string; description: string }

export type ProcsView = {
  selfPid: number | null
  selfRss: number
  tree: TreeRow[]
  sessions: SessionSummary[]
  leftovers: Leftover[]
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
      procs: ProcsView
      tasks: EngineTask[]
    }
  }
}
