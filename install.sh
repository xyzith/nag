#!/usr/bin/env bash
# install.sh — install/update the nag CLI + skill (idempotent; re-run to update).
#
# Does ONLY the generic things: symlink the `nag` binary onto PATH and the
# vendored skill into ~/.claude/skills/.
# Source-specific setup (adapter config, cron) and the hud plugin are manual — see
# docs/install.md.
#
# Usage: ./install.sh [--dry-run]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=1; fi

BIN_DIR="$HOME/.local/bin"
BIN_LINK="$BIN_DIR/nag"
BIN_TARGET="$REPO_ROOT/bin/nag.js"
SKILLS_DIR="$HOME/.claude/skills"
SKILL_LINK="$SKILLS_DIR/nag"
SKILL_TARGET="$REPO_ROOT/skills/nag"
BACKUP_DIR="$HOME/.local/state/nag/backups"

done_msg() { printf '  \342\234\223 %s\n' "$1"; }   # ✓
skip_msg() { printf '  \302\267 %s\n' "$1"; }       # ·
warn_msg() { printf '  \342\232\240 %s\n' "$1"; }   # ⚠
run() { # echo the command, then run it (skip running in dry-run)
  printf '    $ %s\n' "$*"
  if [ "$DRY_RUN" -eq 0 ]; then "$@"; fi
}

# link <target> <link> <label>: idempotently point <link> at <target>, backing up
# any real (non-symlink) file/dir already there. Skips if already correct.
link() {
  local target="$1" link="$2" label="$3" dir
  dir="$(dirname "$link")"
  if [ -L "$link" ] && [ "$(readlink -f "$link")" = "$(readlink -f "$target")" ]; then
    skip_msg "$label already points to the repo"
    return
  fi
  run mkdir -p "$dir"
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    local n=1 base backup
    base="$(basename "$link")"
    while [ -e "$BACKUP_DIR/$base.bak.$n" ]; do n=$((n + 1)); done
    backup="$BACKUP_DIR/$base.bak.$n"
    run mkdir -p "$BACKUP_DIR"
    warn_msg "$link is a real path — backing up to $backup"
    run mv "$link" "$backup"
  fi
  run ln -sfn "$target" "$link"   # -n: replace a stale symlink, don't descend into it
  done_msg "$label linked"
}

echo "nag install — repo: $REPO_ROOT"
if [ "$DRY_RUN" -eq 1 ]; then echo "(dry-run: nothing will be changed)"; fi

echo "1. CLI symlink ($BIN_LINK -> $BIN_TARGET)"
if [ ! -e "$BIN_TARGET" ]; then
  warn_msg "binary not found at $BIN_TARGET — is the repo intact?"; exit 1
fi
link "$BIN_TARGET" "$BIN_LINK" "CLI"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) warn_msg "$BIN_DIR is not on \$PATH — add it so \`nag\` resolves" ;;
esac

echo "2. Skill symlink ($SKILL_LINK -> $SKILL_TARGET)"
if [ ! -d "$SKILL_TARGET" ]; then
  warn_msg "vendored skill not found at $SKILL_TARGET — run from a checkout with skills/nag/"; exit 1
fi
link "$SKILL_TARGET" "$SKILL_LINK" "skill"

cat <<EOF

Done. nag core is zero-dependency. Optional per-machine source setup is manual — see docs/install.md:
  - adapter config (~/.config/nag/config.json)
  - cron           (*/10 * * * * nag sync — mind the nvm-PATH caveat)

hud plugin: add "CLAUDE_CODE_PLUGIN_DIRS": "$REPO_ROOT/hud" to the env block of
~/.claude/settings.json (see docs/install.md).
EOF
