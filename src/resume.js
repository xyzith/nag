import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Claude Code keeps each session's transcript at
// <config>/projects/<encoded-cwd>/<sessionId>.jsonl. The encoded dir name is
// lossy (every non-alnum char → '-'), so the real cwd is read from the transcript.
export function claudeProjectsDir(env = process.env) {
  const base = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(base, 'projects')
}

export function findTranscript(sessionId, projectsDir) {
  let dirs
  try {
    dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const p = path.join(projectsDir, d.name, `${sessionId}.jsonl`)
    try {
      const st = fs.statSync(p)
      return { path: p, mtime: st.mtimeMs }
    } catch {}
  }
  return null
}

// The first recorded cwd is where the session started — the project dir
// `claude --resume` must run from. Later entries may differ after a `cd`.
export function transcriptCwd(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  for (const line of text.split('\n')) {
    if (!line.includes('"cwd"')) continue
    try {
      const cwd = JSON.parse(line).cwd
      if (typeof cwd === 'string' && cwd) return cwd
    } catch {}
  }
  return null
}

// All sessions whose focus points at the item, newest transcript first. Sessions
// with no transcript on this machine sort last (still listed, cwd unknown).
export function sessionsForItem(store, itemId, projectsDir) {
  const sids = Object.entries(store.focus || {})
    .filter(([, id]) => id === itemId)
    .map(([sid]) => sid)
  return sids
    .map((sid) => {
      const t = findTranscript(sid, projectsDir)
      return { sessionId: sid, transcript: t?.path || null, mtime: t?.mtime || 0, cwd: t ? transcriptCwd(t.path) : null }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

// POSIX single-quote escaping for the printed / spawned shell command.
export function shq(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`
}

export function resumeCommand({ sessionId, cwd }, claude = 'claude') {
  const run = `${claude} --resume ${shq(sessionId)}`
  return cwd ? `cd ${shq(cwd)} && ${run}` : run
}
