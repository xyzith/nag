---
name: nag
description: Use when the user asks what to work on next, what's on their plate, their todos / 待辦, or to pull up a task to start ("我該做什麼", "接下來做什麼", "挖一個來做", "what should I work on"); when they ask to remember or jot down a task ("把這個加到 todo", "記一下這件事", "add this to my todo"); or right after finishing work that traces to one of their tracked todos.
---

# nag — personal cross-project TODO

`nag` is the user's local todo store (manual items plus synced sources). Reach it
through the `mcp__hud__nag_*` tools (the hud mod). This skill teaches WHEN to call them.

If those tools are not available (a session without the hud mod), use the CLI with
`--json` instead: `nag list --json`, `nag show <seq> --json [--no-focus]`, `nag add
--title …`, `nag done <seq>`. Never parse its plain-text output.

The user picks tasks by `seq` (permanent per task; gaps are normal), never by id.

## Flows

| User says | Do |
|-----------|----|
| 「我該做什麼」「待辦」「接下來做什麼」 | `nag_list` → present `seq · title · (from / source)`, let them pick |
| 「處理2」「做第N個」「挖一個來做」 | `nag_show` (focuses this session) → read `desc`, `ref`, `sourceMeta`, `note`; propose a plan and confirm scope, then work here |
| 「task 3 寫什麼」「先看一下不用做」 | `nag_show` with `focus: false` |
| 「這個先放著」「換別的」 | `nag_unfocus` |
| 「接回 #3 那個 session」「之前做 3 的對話」 | `nag resume 3` in Bash: inside a session it only prints `cd … && claude --resume <id>`; give that line to the user to run in a terminal (it can't take over this one) |
| 「記一下…」「add … to my todo」 | `nag_add`, echo back what was added |
| 「做完了」「這筆 done」 | confirm, then `nag_done` |

Briefings are thin (the real spec usually lives in the user's head), so always
propose a plan before starting. `nag_focus` only changes focus without a briefing.

## Mark done — ONLY when traceable

Suggest `nag_done` and confirm first, only when the finished work clearly maps to an
item: you opened it with `nag_show` this session, or its ticket key / branch matches
the item's `sourceMeta.ticketKey` / `sourceMeta.branch`. Otherwise say nothing.

## User-driven only

`nag_ignore`, `nag_note`, `nag_update` (and the CLI's `rm`, `sync`) run only when the
user explicitly asks. Never on your own initiative; surface the item and let them decide.
