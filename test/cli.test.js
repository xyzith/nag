import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(here, '..', 'bin', 'nag.js')

function withTempEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nagcli-'))
  return { XDG_STATE_HOME: path.join(dir, 'state'), XDG_CONFIG_HOME: path.join(dir, 'cfg') }
}

function run(env, args) {
  return execFileSync('node', [cli, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' })
}

test('add then list shows the item', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'call PO'])
  const out = run(env, ['list'])
  assert.match(out, /call PO/)
})

test('add --from is recorded and shown by show', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'task', '--from', 'PM'])
  const json = JSON.parse(run(env, ['list', '--json']))
  const out = run(env, ['show', '--id', String(json[0].seq), '--json'])
  assert.equal(JSON.parse(out).from, 'PM')
})

test('show on a pipe (non-TTY) emits plain markdown unchanged', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'Render me', '--from', 'PM'])
  const json = JSON.parse(run(env, ['list', '--json']))
  const seq = String(json[0].seq)
  const out = run(env, ['show', seq])
  assert.match(out, /^# Render me$/m)        // raw markdown heading, not ANSI
  assert.match(out, /from: PM/)
  assert.doesNotMatch(out, /\x1b\[/)         // no ANSI escape codes on the pipe path
})

test('done removes item from default list', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'x'])
  run(env, ['done', '--id', '1'])
  assert.match(run(env, ['list']), /no items/)
})

test('status prints summary line', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'x'])
  assert.match(run(env, ['status']), /📋 1/)
})

test('show with --session auto-focuses and status shows the focused title', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'first'])
  run(env, ['add', '--title', 'second'])
  run(env, ['show', '--id', '2', '--session', 'S1'])
  const out = run(env, ['status', '--session', 'S1'])
  assert.match(out, /🎯/)
  assert.match(out, /second/)
})

test('show --no-focus does not set focus', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'first'])
  run(env, ['show', '--id', '1', '--no-focus', '--session', 'S1'])
  const out = run(env, ['status', '--session', 'S1'])
  assert.ok(!out.includes('🎯'))
})

test('focus then unfocus round-trips for a session', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'task'])
  run(env, ['focus', '--id', '1', '--session', 'S1'])
  assert.match(run(env, ['status', '--session', 'S1']), /🎯/)
  run(env, ['unfocus', '--session', 'S1'])
  assert.ok(!run(env, ['status', '--session', 'S1']).includes('🎯'))
})

test('done clears the focus and falls back to oldest title', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'only'])
  run(env, ['focus', '--id', '1', '--session', 'S1'])
  run(env, ['done', '--id', '1'])
  const out = run(env, ['status', '--session', 'S1'])
  assert.match(out, /📋 0/)
})

test('status --json reports count and focus for the session', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'a'])
  run(env, ['focus', '--id', '1', '--session', 'S1'])
  const out = JSON.parse(run(env, ['status', '--session', 'S1', '--json']))
  assert.equal(out.count, 1)
  assert.equal(out.focus.full, 'a')
})

test('item numbers are permanent — done in the middle leaves a gap, no renumber', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'one'])
  run(env, ['add', '--title', 'two'])
  run(env, ['add', '--title', 'three'])
  const before = JSON.parse(run(env, ['list', '--json']))
  assert.deepEqual(before.map((i) => i.seq), [3, 2, 1]) // newest first
  run(env, ['done', '--id', '2'])
  const after = JSON.parse(run(env, ['list', '--json']))
  assert.deepEqual(after.map((i) => i.seq), [3, 1]) // gap at 2, not renumbered to [2,1]
  assert.deepEqual(after.map((i) => i.title), ['three', 'one'])
})

test('every subcommand supports --help / -h with its own usage line', () => {
  const env = withTempEnv()
  assert.match(run(env, ['list', '--help']), /usage: nag list/)
  assert.match(run(env, ['show', '--help']), /usage: nag show <id\|seq>/)
  assert.match(run(env, ['done', '-h']), /usage: nag done <id\|seq>/)
  assert.match(run(env, ['note', '-h']), /usage: nag note --id <id\|seq> --text/)
})

test('a missing id exits non-zero and prints usage', () => {
  const env = withTempEnv()
  assert.throws(
    () => run(env, ['done']),
    (err) => /usage: nag done <id\|seq>/.test(err.stderr),
  )
})

test('a bare positional id works the same as --id', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'one'])
  run(env, ['add', '--title', 'two'])
  run(env, ['done', '1']) // positional, no --id
  const after = JSON.parse(run(env, ['list', '--json']))
  assert.deepEqual(after.map((i) => i.title), ['two'])
})

test('passing both --id and a positional is rejected as ambiguous', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'one'])
  assert.throws(
    () => run(env, ['done', '1', '--id', '1']),
    (err) => /usage: nag done <id\|seq>/.test(err.stderr),
  )
})

test('sync does not clobber items it did not fetch', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'manual task'])
  const cfgDir = env.XDG_CONFIG_HOME + '/nag'
  fs.mkdirSync(cfgDir, { recursive: true })
  const adapter = path.join(cfgDir, 'empty-adapter.js')
  fs.writeFileSync(adapter, 'console.log("[]")')
  fs.writeFileSync(cfgDir + '/config.json', JSON.stringify({ sources: { demo: { cmd: ['node', adapter] } } }))
  run(env, ['sync'])
  const items = JSON.parse(run(env, ['list', '--json']))
  assert.deepEqual(items.map((i) => i.title), ['manual task'])
})

test('update changes the title in place, keeping id and seq', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'typo'])
  const before = JSON.parse(run(env, ['list', '--json']))[0]
  run(env, ['update', '1', '--title', 'fixed'])
  const after = JSON.parse(run(env, ['list', '--json']))[0]
  assert.equal(after.title, 'fixed')
  assert.equal(after.id, before.id)   // same task, not a recreate
  assert.equal(after.seq, before.seq)
})

test('update --status open brings a done task back to the list', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'oops'])
  run(env, ['done', '1'])
  assert.match(run(env, ['list']), /no items/)
  run(env, ['update', '1', '--status', 'open'])
  assert.match(run(env, ['list']), /oops/)
})

test('update with no field flags exits non-zero and prints usage', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'x'])
  assert.throws(
    () => run(env, ['update', '1']),
    (err) => /usage: nag update/.test(err.stderr),
  )
})

test('show no longer accepts --stage', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'x'])
  assert.throws(
    () => run(env, ['show', '1', '--stage']),
    (err) => /Unknown option '--stage'|usage: nag show/.test(err.stderr),
  )
})

test('show usage line no longer mentions --stage', () => {
  const env = withTempEnv()
  assert.doesNotMatch(run(env, ['show', '--help']), /--stage/)
})

test('briefing is no longer a command', () => {
  const env = withTempEnv()
  assert.throws(
    () => run(env, ['briefing', '--consume']),
    (err) => err.status === 1 && /nag — personal cross-project TODO/.test(err.stdout),
  )
})

test('update rejects --ref together with --clear-refs', () => {
  const env = withTempEnv()
  run(env, ['add', '--title', 'x'])
  assert.throws(
    () => run(env, ['update', '1', '--ref', 'docs/a.md', '--clear-refs']),
    (err) => /usage: nag update/.test(err.stderr),
  )
})

test('update --help prints its own usage line', () => {
  const env = withTempEnv()
  assert.match(run(env, ['update', '--help']), /usage: nag update <id\|seq>/)
})
