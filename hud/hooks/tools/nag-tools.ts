import type { EngineInterface, On } from 'claude-code'

import { cliNag } from '../sources/nag'
import { refreshNag } from '../ui/nag-pane'

const TASK = { type: 'string', description: 'The task seq number the user sees (e.g. "610"), or its id.' }

const TOOLS = [
  {
    name: 'nag_list',
    description: "List the user's open nag todos as JSON (seq, id, title, from, source, sourceMeta).",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'nag_show',
    description:
      'Full briefing of one todo (desc, note, ref, sourceMeta). focus=true (default) also focuses this session on it: use it when the user picks a task to start; pass focus=false to only read it.',
    inputSchema: {
      type: 'object',
      properties: { task: TASK, focus: { type: 'boolean' } },
      required: ['task'],
    },
  },
  {
    name: 'nag_add',
    description: 'Capture a new todo the user dictated. Echo back what was added.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        from: { type: 'string', description: 'Who or what it came from.' },
        desc: { type: 'string' },
        ref: { type: 'array', items: { type: 'string' } },
      },
      required: ['title'],
    },
  },
  {
    name: 'nag_focus',
    description: 'Change which todo this session is focused on, without reading its briefing.',
    inputSchema: { type: 'object', properties: { task: TASK }, required: ['task'] },
  },
  {
    name: 'nag_unfocus',
    description: 'Clear this session\'s focus (the user set the task aside: 「先放著」「換別的」).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'nag_done',
    description:
      'Mark a todo done (also clears focus). Only after the user confirms, and only for work that traces to the item.',
    inputSchema: { type: 'object', properties: { task: TASK }, required: ['task'] },
  },
  {
    name: 'nag_ignore',
    description: 'Hide a todo without completing it. Only when the user explicitly asks.',
    inputSchema: { type: 'object', properties: { task: TASK }, required: ['task'] },
  },
  {
    name: 'nag_note',
    description: 'Append a note to a todo. Only when the user explicitly asks.',
    inputSchema: {
      type: 'object',
      properties: { task: TASK, text: { type: 'string' } },
      required: ['task', 'text'],
    },
  },
  {
    name: 'nag_update',
    description:
      'Edit a todo in place (title, desc, from, note, status open|done|ignored). Only when the user explicitly asks.',
    inputSchema: {
      type: 'object',
      properties: {
        task: TASK,
        title: { type: 'string' },
        desc: { type: 'string' },
        from: { type: 'string' },
        note: { type: 'string' },
        status: { type: 'string', enum: ['open', 'done', 'ignored'] },
      },
      required: ['task'],
    },
  },
] as const

type Input = Record<string, unknown>

const text = (value: unknown) => (typeof value === 'string' ? value : '')

async function answer($: EngineInterface, name: string, input: Input): Promise<string> {
  const nag = cliNag($)
  const task = text(input.task)
  switch (name) {
    case 'nag_list':
      return JSON.stringify(
        (await nag.list()).map(({ seq, id, title, from, source, sourceMeta }) => ({ seq, id, title, from, source, sourceMeta })),
      )
    case 'nag_show':
      return nag.show(task, input.focus !== false)
    case 'nag_add':
      return nag.add({
        title: text(input.title),
        from: text(input.from) || undefined,
        desc: text(input.desc) || undefined,
        ref: Array.isArray(input.ref) ? input.ref.map(String) : [],
      })
    case 'nag_focus':
      await nag.focus(task)
      return `focused ${task}`
    case 'nag_unfocus':
      await nag.unfocus()
      return 'focus cleared'
    case 'nag_done':
      await nag.done(task)
      return `done ${task}`
    case 'nag_ignore':
      await nag.ignore(task)
      return `ignored ${task}`
    case 'nag_note':
      return nag.note(task, text(input.text))
    case 'nag_update': {
      const fields = Object.fromEntries(
        ['title', 'desc', 'from', 'note', 'status'].flatMap(key => (text(input[key]) ? [[key, text(input[key])]] : [])),
      )
      return nag.update(task, fields)
    }
    default:
      throw new Error(`unknown tool ${name}`)
  }
}

export async function registerNagTools($: EngineInterface) {
  for (const tool of TOOLS) await $.tool.register({ ...tool, inputSchema: { ...tool.inputSchema } })
}

export function serveNagTools(on: On) {
  on('tool.call', { tool: /^mcp__hud__nag_/ }, async ($, e) => {
    const name = e.tool.replace('mcp__hud__', '')
    try {
      const result = await answer($, name, e as unknown as Input)
      await refreshNag($)
      return { result }
    } catch (err) {
      return { result: String(err), isError: true }
    }
  })
}
