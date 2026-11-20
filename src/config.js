import fs from 'node:fs'

export function loadConfig(file) {
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { sources: {}, ...cfg }
  } catch (err) {
    if (err.code === 'ENOENT') return { sources: {} }
    throw err
  }
}
