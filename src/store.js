import fs from 'node:fs'
import path from 'node:path'

export function loadStore(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 1, items: [] }
    throw err
  }
}

export function saveStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, file) // atomic on same filesystem
}
