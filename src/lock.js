import fs from 'node:fs'
import path from 'node:path'

const STALE_MS = 30_000
const ACQUIRE_TIMEOUT_MS = 10_000
const RETRY_MS = 50

// synchronous sleep with no dependencies
function napMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// Serialize read-modify-write of `file` across processes via an atomic lock dir.
export function withLock(file, fn) {
  const lockPath = `${file}.lock`
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  const start = Date.now()
  for (;;) {
    try {
      fs.mkdirSync(lockPath) // atomic; throws EEXIST when held
      break
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      let age = Infinity
      try {
        age = Date.now() - fs.statSync(lockPath).mtimeMs
      } catch {
        continue // lock vanished between mkdir and stat — retry now
      }
      if (age > STALE_MS) {
        try { fs.rmdirSync(lockPath) } catch {}
        continue // stale — evict and retry
      }
      if (Date.now() - start > ACQUIRE_TIMEOUT_MS) {
        throw new Error('could not acquire store lock (another nag process is writing)')
      }
      napMs(RETRY_MS)
    }
  }
  try {
    return fn()
  } finally {
    try { fs.rmdirSync(lockPath) } catch {}
  }
}
