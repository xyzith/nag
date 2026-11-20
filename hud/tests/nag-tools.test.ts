import { expect, test } from 'claude-code/testing'

const ran = (stdout = '') => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

test('nag tools map to the nag CLI', { timeoutMs: 20_000 }, async ($, on) => {
  const calls: string[][] = []
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.exists', () => ({ value: false }))
  on('process.run', ($, e) => {
    calls.push([...e.argv.slice(1)])
    if (e.argv[1] === 'list') return ran(JSON.stringify([{ seq: 7, id: 'x', title: 't', from: '', source: 'manual', desc: 'long' }]))
    if (e.argv[1] === 'status') return ran(JSON.stringify({ count: 1 }))
    return ran('ok')
  })

  const listed = await $.tool.call({ tool: 'mcp__hud__nag_list' })
  expect(JSON.parse(String(listed.result))).toEqual([{ seq: 7, id: 'x', title: 't', from: '', source: 'manual' }])

  await $.tool.call({ tool: 'mcp__hud__nag_show', task: '7' })
  await $.tool.call({ tool: 'mcp__hud__nag_show', task: '7', focus: false })
  await $.tool.call({ tool: 'mcp__hud__nag_add', title: 'new', ref: ['https://a', 'https://b'] })
  await $.tool.call({ tool: 'mcp__hud__nag_update', task: '7', status: 'done', title: '' })

  expect(calls).toContainEqual(['show', '7', '--json', '--session', 'sess-1'])
  expect(calls).toContainEqual(['show', '7', '--json', '--no-focus'])
  expect(calls).toContainEqual(['add', '--title', 'new', '--ref', 'https://a', '--ref', 'https://b'])
  expect(calls).toContainEqual(['update', '7', '--status', 'done'])
})

test('a failing nag call comes back as an error result', { timeoutMs: 20_000 }, async ($, on) => {
  on('process.run', () => ({
    value: { exitCode: 1, stdout: '', stderr: 'no such task', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  const done = await $.tool.call({ tool: 'mcp__hud__nag_done', task: '999' })
  expect(done.isError).toBe(true)
  expect(String(done.result)).toContain('no such task')
})
