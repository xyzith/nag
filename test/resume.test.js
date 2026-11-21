import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sessionsForItem, transcriptCwd, resumeCommand, shq } from '../src/resume.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(here, '..', 'bin', 'nag.js')

function fakeProjects(sessions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nagres-'))
  const projects = path.join(dir, 'projects')
  for (const [i, { sid, cwds, mtime }] of sessions.entries()) {
    const pd = path.join(projects, `-proj-${i}`)
    fs.mkdirSync(pd, { recursive: true })
    const f = path.join(pd, `${sid}.jsonl`)
    const lines = [JSON.stringify({ type: 'mode', sessionId: sid }), ...cwds.map((cwd) => JSON.stringify({ type: 'user', cwd }))]
    fs.writeFileSync(f, lines.join('\n') + '\n')
    if (mtime) fs.utimesSync(f, mtime, mtime)
  }
  return { dir, projects }
}

test('transcriptCwd returns the first recorded cwd', () => {
  const { projects } = fakeProjects([{ sid: 's1', cwds: ['/a b', '/a b/sub'] }])
  assert.equal(transcriptCwd(path.join(projects, '-proj-0', 's1.jsonl')), '/a b')
})

test('sessionsForItem lists focused sessions newest first, missing transcripts last', () => {
  const { projects } = fakeProjects([
    { sid: 'old', cwds: ['/old'], mtime: 1000 },
    { sid: 'new', cwds: ['/new'], mtime: 2000 },
  ])
  const store = { items: [], focus: { old: 'X', new: 'X', gone: 'X', other: 'Y' } }
  const out = sessionsForItem(store, 'X', projects)
  assert.deepEqual(out.map((s) => [s.sessionId, s.cwd]), [['new', '/new'], ['old', '/old'], ['gone', null]])
})

test('resumeCommand quotes cwd and omits cd when unknown', () => {
  assert.equal(shq("it's"), `'it'\\''s'`)
  assert.equal(resumeCommand({ sessionId: 'abc', cwd: '/x y' }), `cd '/x y' && claude --resume abc`)
  assert.equal(resumeCommand({ sessionId: 'abc', cwd: null }), 'claude --resume abc')
})

test('nag resume prints the command off-TTY and fails when nothing is focused', () => {
  const { dir } = fakeProjects([{ sid: 'sess-1', cwds: ['/work/proj'] }])
  const env = { ...process.env, XDG_STATE_HOME: path.join(dir, 'state'), XDG_CONFIG_HOME: path.join(dir, 'cfg'), CLAUDE_CONFIG_DIR: dir }
  delete env.CLAUDE_CODE_SESSION_ID
  const run = (args) => execFileSync('node', [cli, ...args], { env, encoding: 'utf8' })
  run(['add', '--title', 'a'])
  run(['add', '--title', 'b'])
  run(['focus', '1', '--session', 'sess-1'])
  assert.equal(run(['resume', '1']).trim(), 'cd /work/proj && claude --resume sess-1')
  const r = spawnSync('node', [cli, 'resume', '2'], { env, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no session is focused/)
})
