# Installing nag

## Core install

Run the installer from a checkout of this repo:

```bash
./install.sh            # symlink the `nag` CLI + skill into place
./install.sh --dry-run  # preview without changing anything
```

It does two idempotent things and nothing else:

1. Symlinks `~/.local/bin/nag` → `bin/nag.js` (ensure `~/.local/bin` is on `$PATH`).
2. Symlinks `~/.claude/skills/nag` → `skills/nag` (the vendored skill).

Re-run it any time to **update** — it skips whatever is already correct, and backs up
(never overwrites) any real file sitting at a link target. That's the whole installer;
everything below is optional and only needed if you sync from a task source.

Paths:
- state: `~/.local/state/nag/todos.json`
- config: `~/.config/nag/config.json`

## hud plugin (Claude Code)

`hud/` is a Claude Code plugin that gives the model `mcp__hud__nag_*` tools, a
`/hud` pane for browsing todos, and a row above the prompt showing the focused todo
and rate-limit usage. It calls the `nag` CLI on `$PATH`, so run `./install.sh` first.

Load it by adding the folder to the `env` block of `~/.claude/settings.json`
(absolute path; join several plugin folders with `:`):

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "<abs>/nag/hud"
  }
}
```

New sessions pick it up; edits under `hud/` hot-reload. Tests: `claude plugin test hud`.

## Optional: task source setup (manual, per-machine)

These are deliberately **not** scripted — they involve per-machine secrets, your nvm
path and adapters, so they're documented rather than automated.

nag core is zero-dependency — no `npm install` needed for the CLI itself. An
individual adapter may pull its own dependencies; that's the adapter's concern.

### 1. Background sync (cron)

Cron runs with a minimal PATH, so it will NOT pick up your login `$PATH`. If `node`
is managed by nvm, both `nag` (a `#!/usr/bin/env node` script) and any adapter it
spawns (which spawns `node`) need the nvm bin dir on PATH explicitly. Resolve it once:

```bash
NODE_BIN=$(dirname "$(readlink -f "$(which node)")")   # e.g. ~/.nvm/versions/node/vX/bin
```

Then `crontab -e` and add (substitute the resolved dir):

```
*/10 * * * * PATH="<NODE_BIN>:$HOME/.local/bin:/usr/bin:/bin" nag sync >> $HOME/.local/state/nag/sync.log 2>&1
```

> On a node upgrade the nvm path changes — re-resolve `NODE_BIN` and update the entry.

Verify it works in a cron-like (stripped) environment, then check the log:

```bash
env -i HOME="$HOME" PATH="<NODE_BIN>:$HOME/.local/bin:/usr/bin:/bin" \
  bash -c 'nag sync >> $HOME/.local/state/nag/sync.log 2>&1'
tail -n 5 ~/.local/state/nag/sync.log
```

Expected: a `✓ <source>: N candidates` line (or `✗` with a clear reason if an adapter
isn't wired yet).

### 2. Source / adapter config

Sources are configured in `~/.config/nag/config.json` (not in this repo — holds
machine-specific config). Each source names a `cmd` that runs an adapter; the adapter
emits a JSON array of candidates on stdout, which `nag sync` merges into the store:

```json
{
  "sources": {
    "<name>": {
      "cmd": ["node", "<abs>/path/to/your-adapter.js"]
    }
  }
}
```

An adapter can read its own settings from its `sources.<name>` block (extra fields,
secrets via an `envFile`, etc.) — that's between the adapter and its config. nag core
only cares about `cmd` and the candidate JSON it prints.
