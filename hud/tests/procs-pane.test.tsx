import { expect, test } from 'claude-code/testing'

const NOW = 1_800_000_000_000

const PS = [
  '  13489   13042    9117 214056 claude          claude --chrome -n orch-tools',
  '  20001   13489     300  4096 node            node server.js',
  '  20003   13489       1  2048 ps              ps -eo pid=,ppid=,etimes=,rss=,comm=,args=',
  '  40001       1    3600  8192 node            node orphan.js',
].join('\n')

const DEAD_RECORD = {
  owner: { pid: 39999, startedAt: NOW - 7_200_000, name: 'gone-session' },
  children: [{ pid: 40001, startedAt: NOW - 3_600_000, args: 'node orphan.js' }],
}

const PANE = {
  plugin: 'hud',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'hud-procs',
  props: {
    title: 'procs',
    isFocused: true,
    bodyColumns: 120,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const ran = (stdout = '') => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

test('procs pane lists the tree and kills a leftover', { timeoutMs: 20_000 }, async ($, on) => {
  const closed: string[] = []
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })

  const killed: string[] = []
  on('clock.now', () => ({ value: NOW }))
  on('process.run', ($, e) => {
    if (e.argv[0] === 'sh') return ran(`20003\n${PS}`)
    if (e.argv[0] === 'kill') killed.push(String(e.argv[1]))
    return ran()
  })
  on('env.get', () => ({ value: '/home/test' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', () => ({ value: [{ name: '39999.json', kind: 'file', size: 1, mtimeMs: NOW, isLink: false }] }))
  on('fs.read', () => ({ value: JSON.stringify(DEAD_RECORD) }))
  on('fs.write', () => ({ value: undefined }))

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'r' })

  expect(await ui.find({ type: 'Text', text: /node server\.js/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ps -eo/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /orch-tools/ })).toBeDefined()
  expect(await ui.find({ key: 'kill:40001' })).toBeDefined()

  await ui.press({ key: 'kill:40001' })
  expect(killed).toEqual(['40001'])

  await ui.press({ key: 'q' })
  expect(closed).toEqual(['hud-procs'])
  await ui.unmount()
})
