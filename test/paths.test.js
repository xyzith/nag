import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statePath, configPath } from '../src/paths.js'

test('statePath honors XDG_STATE_HOME', () => {
  process.env.XDG_STATE_HOME = '/tmp/xdgstate'
  assert.equal(statePath(), '/tmp/xdgstate/nag/todos.json')
  delete process.env.XDG_STATE_HOME
})

test('configPath honors XDG_CONFIG_HOME', () => {
  process.env.XDG_CONFIG_HOME = '/tmp/xdgconf'
  assert.equal(configPath(), '/tmp/xdgconf/nag/config.json')
  delete process.env.XDG_CONFIG_HOME
})

test('statePath falls back to ~/.local/state', () => {
  delete process.env.XDG_STATE_HOME
  assert.ok(statePath().endsWith('/.local/state/nag/todos.json'))
})
