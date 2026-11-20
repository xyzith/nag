# nag

給 Claude Code 用的個人跨專案待辦清單。在任何專案的 session 裡都能問「我該做什麼」、「記一下這件事」，
Claude 會讀寫同一份待辦；prompt 上方隨時顯示目前 focus 的那筆。

| 部分 | 位置 | 做什麼 |
|------|------|--------|
| CLI | `bin/nag.js` | 零依賴的 Node 指令，資料存在 `~/.local/state/nag/todos.json` |
| skill | `skills/nag` | 告訴 Claude 什麼時候該查、該記、該標完成 |
| hud plugin | `hud/` | 給 model 的 `mcp__hud__nag_*` 工具、`/hud` 面板、prompt 上方的 nag／背景作業／額度列 |

## 安裝

需要 Node 18 以上，`~/.local/bin` 要在 `$PATH` 上。

```bash
git clone git@github.com:xyzith/nag.git
cd nag && ./install.sh          # 建 ~/.local/bin/nag 和 ~/.claude/skills/nag 的 symlink
```

再把 hud plugin 加進 `~/.claude/settings.json` 的 `env`（絕對路徑，多個 plugin 用 `:` 串接）：

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/絕對路徑/nag/hud"
  }
}
```

開新的 Claude Code session 就會載入。之後 `git pull` 即更新，`install.sh` 可重複執行。

## 使用

**在 Claude Code 裡**直接用講的，skill 會判斷該呼叫哪個工具：

- 「我該做什麼」「待辦」→ 列出清單
- 「做第 3 個」「挖一個來做」→ 讀取該筆並把這個 session focus 在它上面
- 「記一下：…」→ 新增
- 「這筆做完了」→ 確認後標 done

`/hud` 打開待辦面板（點 prompt 上方的 📋 也可以）。`/hud procs`（或按 `p`、點 ⚙）打開背景作業面板：
列出各 session 底下還在跑的程式，session 結束後殘留的程式會標 ⚠ 並可直接 kill。

**在終端機**：

```bash
nag                      # 列出未完成的待辦
nag add --title "修 X" --desc "細節" --ref https://...
nag show 3               # 看第 3 筆（seq 編號固定不變，中間有跳號是正常的）
nag done 3
nag note --id 3 --text "卡在 Y"
nag help                 # 完整指令
```

## 從外部來源同步（選用）

`nag sync` 會跑 `~/.config/nag/config.json` 裡每個 source 的 `cmd`，把它輸出的 JSON 合併進清單：

```json
{ "sources": { "issues": { "cmd": ["node", "/絕對路徑/my-adapter.js"] } } }
```

adapter 是任何會在 stdout 印出這種陣列的程式：

```json
[{ "sourceKey": "唯一鍵", "title": "標題", "desc": "內容", "from": "誰交辦", "sourceMeta": { "url": "..." } }]
```

同一個 `sourceKey` 再次同步只會更新內容，不會重複新增；來源消失也不會自動標完成。
要定時同步就掛 cron，nvm 的 PATH 注意事項見 [docs/install.md](docs/install.md)。

## 開發

```bash
npm test                     # CLI 測試
claude plugin test hud       # plugin 測試
claude plugin validate hud
```

`hud/` 被 `CLAUDE_CODE_PLUGIN_DIRS` 載入時會 hot-reload，存檔後回到 session 就生效。
