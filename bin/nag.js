#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { statePath, configPath } from '../src/paths.js'
import { loadStore, saveStore } from '../src/store.js'
import { withLock } from '../src/lock.js'
import { loadConfig } from '../src/config.js'
import { addItem, findItem, markDone, ignoreItem, removeItem, addNote, addRef, setFocus, clearFocus, ensureSeq, updateItem } from '../src/model.js'
import { formatList, formatShow, formatStatus, shouldRenderMarkdown } from '../src/format.js'
import { fetchAll } from '../src/sync.js'
import { mergeSource } from '../src/merge.js'
import { claudeProjectsDir, sessionsForItem, resumeCommand } from '../src/resume.js'

const argv = process.argv.slice(2)
// Bare `nag` defaults to the list — the user's most-used view. Subcommands and
// `nag help` still dispatch normally; only the no-argument case is redirected.
const cmd = argv[0] || 'list'
const rest = argv.slice(1)

// Most values are `--flags` so the surface stays uniform and agents can probe it
// the conventional way (`nag <cmd> --help`). The exception: commands whose only
// required value IS the task subject (done/ignore/rm/show/focus) also accept it
// as a bare positional — `nag done 1` reads better than `nag done --id 1`. Both
// forms resolve through findItem (stable id or seq number); `--id` stays as an
// alias so existing scripts/skills keep working.
const USAGE = {
  list: 'usage: nag list [--all] [--json] [--color]',
  show: 'usage: nag show <id|seq> [--json] [--plain] [--no-focus] [--session <id>]   (--id also accepted)',
  add: 'usage: nag add --title <title> [--from <who>] [--desc <text>] [--ref <url>]...',
  done: 'usage: nag done <id|seq>   (--id also accepted)',
  ignore: 'usage: nag ignore <id|seq>   (--id also accepted)',
  rm: 'usage: nag rm <id|seq>   (--id also accepted)',
  focus: 'usage: nag focus <id|seq> [--session <id>]   (--id also accepted)',
  unfocus: 'usage: nag unfocus [--session <id>]',
  resume: 'usage: nag resume <id|seq> [--print] [--json]   (--id also accepted)',
  note: 'usage: nag note --id <id|seq> --text <text>',
  ref: 'usage: nag ref --id <id|seq> --url <url>',
  update: 'usage: nag update <id|seq> [--title <t>] [--desc <t>] [--from <who>] [--note <t>] [--status <open|done|ignored>] [--ref <url>]... [--clear-refs]   (--id also accepted)',
  sync: 'usage: nag sync [--source <name>]',
  status: 'usage: nag status [--session <id>] [--color] [--json]',
}

const HELP = `nag — personal cross-project TODO

usage: nag [command]
  (no command)   print open items (same as \`nag list\`)

  list           print open items (--all, --json, --color)
  show           show a task briefing and focus this session on it (<id|seq>, --json, --no-focus)
  add            capture a new task (--title <text>, --from <who>, --desc <text>, --ref <url>)
  done           mark a task done, also clears focus (<id|seq>)
  ignore         hide a task without completing it (<id|seq>)
  rm             delete a task (<id|seq>)
  focus          set this session's focused task (<id|seq>)
  unfocus        clear this session's focused task
  resume         reopen the Claude session focused on a task (<id|seq>, --print, --json)
  note           append a note to a task (--id <id|seq>, --text <text>)
  ref            attach a reference link to a task (--id <id|seq>, --url <url>)
  update         edit an existing task in place (<id|seq>, --title, --desc, --from, --note, --status, --ref, --clear-refs)
  sync           pull from synced sources (--source <name>; cron runs this every 10 min)
  status         one-line status (--session <id>, --color, --json)
  help           show this help

done/ignore/rm/show/focus/resume take the id as a bare positional (or --id); add -h/--help to any command for its usage.`

// Positionals are allowed only for the subject commands (which pass a bare id);
// everywhere else they're a mistake and rejected with the command's usage.
function parse(cmd, rest, options, allowPositionals = false) {
  try {
    return parseArgs({ args: rest, options, allowPositionals })
  } catch (err) {
    console.error(`${err.message}\n${USAGE[cmd] || ''}`.trim())
    process.exit(1)
  }
}

// Resolve the task subject from either `--id` or a single bare positional. The
// two forms are interchangeable but mutually exclusive — passing both, or more
// than one positional, is ambiguous and rejected with usage.
function idRef(values, positionals, cmd) {
  if (values.id != null && positionals.length) {
    console.error(`pass the id once — either --id or a positional, not both\n${USAGE[cmd]}`)
    process.exit(1)
  }
  if (positionals.length > 1) {
    console.error(`too many arguments\n${USAGE[cmd]}`)
    process.exit(1)
  }
  const v = values.id ?? positionals[0]
  if (v == null || v === '') {
    console.error(`missing id (pass --id <id|seq> or a bare <id|seq>)\n${USAGE[cmd]}`)
    process.exit(1)
  }
  return v
}

// A required flag is missing → print the command's usage rather than letting a
// blank value fall through to a cryptic "item not found: undefined".
function need(values, key, cmd) {
  const v = values[key]
  if (v == null || v === '') {
    console.error(`missing --${key}\n${USAGE[cmd]}`)
    process.exit(1)
  }
  return v
}

function resolveSession(values) {
  return values.session || process.env.CLAUDE_CODE_SESSION_ID || null
}

const file = statePath()

// Mutating commands: lock, load fresh, backfill seq, run fn, save — atomically.
function withStore(fn) {
  return withLock(file, () => {
    const store = loadStore(file)
    ensureSeq(store)
    const result = fn(store)
    saveStore(file, store)
    return result
  })
}

// Read-only access: load + in-memory seq backfill (no save, no lock).
function readStore() {
  const store = loadStore(file)
  ensureSeq(store)
  return store
}

async function main() {
  // Per-subcommand help: `nag <cmd> --help|-h` prints that command's usage line.
  // (Top-level `nag --help|-h|help` falls through to the help case below.)
  if (cmd !== 'help' && cmd !== '--help' && cmd !== '-h' && (rest.includes('--help') || rest.includes('-h'))) {
    console.log(USAGE[cmd] || HELP)
    return
  }

  switch (cmd) {
    case 'add': {
      const { values } = parse(cmd, rest, {
        title: { type: 'string' },
        from: { type: 'string' },
        desc: { type: 'string' },
        ref: { type: 'string', multiple: true },
      })
      const title = need(values, 'title', 'add')
      const item = withStore((store) =>
        addItem(store, {
          title,
          desc: values.desc || '',
          from: values.from || null,
          ref: values.ref || [],
        }),
      )
      console.log(`added ${item.id}: ${item.title}`)
      break
    }
    case 'list': {
      const { values } = parse(cmd, rest, {
        all: { type: 'boolean' },
        json: { type: 'boolean' },
        color: { type: 'boolean' },
      })
      const color = values.color === undefined ? !!process.stdout.isTTY : values.color
      console.log(formatList(readStore(), { all: values.all, json: values.json, color }))
      break
    }
    case 'show': {
      const { values, positionals } = parse(cmd, rest, {
        id: { type: 'string' },
        json: { type: 'boolean' },
        plain: { type: 'boolean' },
        'no-focus': { type: 'boolean' },
        session: { type: 'string' },
      }, true)
      const ref = idRef(values, positionals, 'show')
      const sid = resolveSession(values)
      let item
      if (!values['no-focus'] && sid) {
        item = withStore((store) => {
          const it = findItem(store, ref)
          setFocus(store, sid, it.id)
          return it
        })
      } else {
        item = findItem(readStore(), ref)
      }
      const md = formatShow(item, { json: values.json })
      const render = shouldRenderMarkdown({
        isTTY: process.stdout.isTTY,
        json: values.json,
        plain: values.plain,
        noColor: !!process.env.NO_COLOR,
      })
      if (render) {
        // Human on a TTY: render via the user's markdown viewer. leaf reads the
        // markdown on stdin and writes ANSI to our inherited stdout. If leaf isn't
        // on PATH (another machine) spawnSync sets r.error, or if it exits non-zero
        // — fall back to plain markdown either way.
        const r = spawnSync('leaf', ['--inline=ansi'], { input: md, stdio: ['pipe', 'inherit', 'inherit'] })
        if (r.error || r.status !== 0) console.log(md)
      } else {
        console.log(md)
      }
      break
    }
    case 'focus': {
      const { values, positionals } = parse(cmd, rest, { id: { type: 'string' }, session: { type: 'string' } }, true)
      const ref = idRef(values, positionals, 'focus')
      const sid = resolveSession(values)
      if (!sid) {
        console.log('focus: no session id (set CLAUDE_CODE_SESSION_ID or pass --session)')
        break
      }
      const item = withStore((store) => setFocus(store, sid, ref))
      console.log(`focus: ${item.title}`)
      break
    }
    case 'unfocus': {
      const { values } = parse(cmd, rest, { session: { type: 'string' } })
      const sid = resolveSession(values)
      if (!sid) {
        console.log('unfocus: no session id')
        break
      }
      withStore((store) => clearFocus(store, sid))
      console.log('unfocus')
      break
    }
    case 'resume': {
      const { values, positionals } = parse(cmd, rest, {
        id: { type: 'string' },
        print: { type: 'boolean' },
        json: { type: 'boolean' },
      }, true)
      const ref = idRef(values, positionals, 'resume')
      const item = findItem(readStore(), ref)
      const sessions = sessionsForItem(readStore(), item.id, claudeProjectsDir())
      if (values.json) {
        console.log(JSON.stringify({ id: item.id, seq: item.seq, title: item.title, sessions }, null, 2))
        break
      }
      if (sessions.length === 0) {
        console.error(`#${item.seq} ${item.title}: no session is focused on it`)
        process.exit(1)
      }
      const s = sessions[0]
      const command = resumeCommand(s, process.env.NAG_CLAUDE || 'claude')
      // Only hand over the terminal to a human: from a pipe, an agent's Bash
      // tool, or with --print, just emit the command line.
      if (values.print || !process.stdin.isTTY || !process.stdout.isTTY || process.env.CLAUDE_CODE_SESSION_ID) {
        console.log(command)
        break
      }
      if (!s.cwd) console.error(`warning: transcript for ${s.sessionId} not found; resuming from the current dir`)
      if (sessions.length > 1) console.error(`(${sessions.length} sessions focused on #${item.seq}; resuming the most recent)`)
      console.error(`resume #${item.seq} ${item.title}\n$ ${command}`)
      // Interactive shell (sources ~/.bashrc) so the user's `claude` alias/PATH applies.
      const r = spawnSync(process.env.SHELL || 'bash', ['-ic', command], { stdio: 'inherit' })
      if (r.error) throw r.error
      process.exit(r.status ?? 1)
    }
    case 'done':
    case 'ignore':
    case 'rm': {
      const { values, positionals } = parse(cmd, rest, { id: { type: 'string' } }, true)
      const ref = idRef(values, positionals, cmd)
      const fn = cmd === 'done' ? markDone : cmd === 'ignore' ? ignoreItem : removeItem
      const item = withStore((store) => fn(store, ref))
      console.log(`${cmd}: ${item.title}`)
      break
    }
    case 'note': {
      const { values } = parse(cmd, rest, { id: { type: 'string' }, text: { type: 'string' } })
      const ref = need(values, 'id', 'note')
      const text = need(values, 'text', 'note')
      withStore((store) => addNote(store, ref, text))
      console.log('note added')
      break
    }
    case 'ref': {
      const { values } = parse(cmd, rest, { id: { type: 'string' }, url: { type: 'string' } })
      const ref = need(values, 'id', 'ref')
      const url = need(values, 'url', 'ref')
      withStore((store) => addRef(store, ref, url))
      console.log('ref added')
      break
    }
    case 'update': {
      const { values, positionals } = parse(cmd, rest, {
        id: { type: 'string' },
        title: { type: 'string' },
        desc: { type: 'string' },
        from: { type: 'string' },
        note: { type: 'string' },
        status: { type: 'string' },
        ref: { type: 'string', multiple: true },
        'clear-refs': { type: 'boolean' },
      }, true)
      const ref = idRef(values, positionals, 'update')
      const patch = {}
      for (const k of ['title', 'desc', 'from', 'note', 'status']) {
        if (values[k] !== undefined) patch[k] = values[k]
      }
      if (values['clear-refs'] && values.ref) {
        console.error(`pass either --ref or --clear-refs, not both\n${USAGE.update}`)
        process.exit(1)
      }
      if (values['clear-refs']) patch.ref = []
      else if (values.ref) patch.ref = values.ref
      if (Object.keys(patch).length === 0) {
        console.error(`nothing to update — pass at least one field\n${USAGE.update}`)
        process.exit(1)
      }
      const item = withStore((store) => updateItem(store, ref, patch))
      console.log(`update: ${item.title}`)
      break
    }
    case 'sync': {
      const { values } = parse(cmd, rest, { source: { type: 'string' } })
      const config = loadConfig(configPath())
      // Fetch outside the lock (slow/network); merge inside (atomic) so a concurrent
      // edit is never clobbered. Skip the locked write entirely if nothing was fetched
      // (e.g. a source outage where every adapter errored) — no point taking the lock.
      const fetched = await fetchAll(config, values.source)
      if (Object.values(fetched).some((r) => !r.error)) {
        withStore((store) => {
          for (const [name, r] of Object.entries(fetched)) {
            if (!r.error) mergeSource(store, r.candidates, name)
          }
        })
      }
      for (const [name, r] of Object.entries(fetched)) {
        console.log(r.error ? `✗ ${name}: ${r.error}` : `✓ ${name}: ${r.count} candidates`)
      }
      break
    }
    case 'status': {
      const { values } = parse(cmd, rest, {
        session: { type: 'string' },
        color: { type: 'boolean' },
        json: { type: 'boolean' },
      })
      console.log(
        formatStatus(readStore(), {
          sessionId: resolveSession(values),
          color: values.color,
          json: values.json,
        }),
      )
      break
    }
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP)
      break
    default:
      console.log(HELP)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
