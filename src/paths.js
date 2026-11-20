import os from 'node:os'
import path from 'node:path'

export function statePath() {
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state')
  return path.join(base, 'nag', 'todos.json')
}

export function configPath() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(base, 'nag', 'config.json')
}
