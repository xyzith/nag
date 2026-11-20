# nag

A personal cross-project todo list for Claude Code.

- `bin/nag.js` — zero-dependency CLI (`nag list`, `add`, `show`, `focus`, `done`, `note`, `sync`, …). State lives in `~/.local/state/nag/todos.json`.
- `skills/nag` — the skill that tells Claude when to read or update the list.
- `hud/` — a Claude Code plugin: `mcp__hud__nag_*` tools, a `/hud` pane, and a row above the prompt with the focused todo and rate-limit usage.

Setup: `./install.sh`, then load `hud/` as described in [docs/install.md](docs/install.md).

Tests: `npm test` (CLI) and `claude plugin test hud` (plugin).
