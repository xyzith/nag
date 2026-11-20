import { randomBytes } from 'node:crypto'

// time-prefixed so ids sort roughly by creation; random suffix for uniqueness
export function genId() {
  const t = Date.now().toString(36)
  const r = randomBytes(4).toString('hex')
  return `${t}${r}`
}
