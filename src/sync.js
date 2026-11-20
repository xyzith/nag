import { execFile } from 'node:child_process'

export function runAdapter(cmd) {
  const [bin, ...args] = cmd
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err)
      try {
        resolve(JSON.parse(stdout))
      } catch (e) {
        reject(new Error(`adapter output is not valid JSON: ${e.message}`))
      }
    })
  })
}

// Fetch a source's current candidates. Does NO store I/O — the caller merges
// the result under a lock, after this slow network call has finished.
export async function fetchSource(sourceName, config) {
  const src = config.sources?.[sourceName]
  if (!src?.cmd) return { error: `source not configured: ${sourceName}` }
  try {
    const candidates = await runAdapter(src.cmd)
    return { count: candidates.length, candidates }
  } catch (err) {
    return { error: `adapter '${sourceName}' failed: ${err.message}` }
  }
}

export async function fetchAll(config, only) {
  const names = only ? [only] : Object.keys(config.sources || {})
  const results = {}
  for (const name of names) results[name] = await fetchSource(name, config)
  return results
}
