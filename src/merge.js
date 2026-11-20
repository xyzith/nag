import { genId } from './id.js'
import { nextSeq } from './model.js'

const now = () => new Date().toISOString()

// Merge a source's current candidate list into the store.
// Source-owned fields (title/desc/from/sourceMeta) are overwritten for that
// source's items; user-owned fields (note/ref) and other sources are untouched.
//
// NOTE: there is intentionally NO "source-gone" auto-done. A candidate
// disappearing (e.g. a transient empty/degraded sync, a 504, a filter change)
// must never silently mark items done — completion is the user's call (`nag done`).
export function mergeSource(store, candidates, sourceName) {
  for (const c of candidates) {
    const existing = store.items.find(
      (i) => i.source === sourceName && i.sourceKey === c.sourceKey,
    )
    if (existing) {
      if (existing.status === 'ignored' || existing.status === 'done') continue
      const desc = c.desc ?? ''
      const from = c.from ?? null
      const sourceMeta = c.sourceMeta ?? {}
      // Only stamp `updated` when the source-owned content actually changed.
      // A no-op re-sync (cron runs every 10 min) must not churn `updated`, or
      // every synced item would perpetually float to the top of the list.
      const changed =
        existing.title !== c.title ||
        existing.desc !== desc ||
        existing.from !== from ||
        JSON.stringify(existing.sourceMeta ?? {}) !== JSON.stringify(sourceMeta)
      if (changed) {
        existing.title = c.title
        existing.desc = desc
        existing.from = from
        existing.sourceMeta = sourceMeta
        existing.updated = now()
      }
    } else {
      const ts = now()
      store.items.push({
        id: genId(),
        seq: nextSeq(store),
        title: c.title,
        desc: c.desc ?? '',
        from: c.from ?? null,
        sourceMeta: c.sourceMeta ?? {},
        note: '',
        ref: [],
        status: 'open',
        source: sourceName,
        sourceKey: c.sourceKey,
        created: ts,
        updated: ts,
        doneAt: null,
      })
    }
  }

  return store
}
