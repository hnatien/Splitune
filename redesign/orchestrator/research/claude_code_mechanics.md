# Claude Code mechanics for one orchestrator session coordinating many Opus worker agents (as of 2026-11-08)

Notes on sources. Most citations point to the official docs at code.claude.com, fetched on 2026-11-08. The pages came back in two forms:
- **Verbatim:** agent-teams, worktrees, headless, workflows, agents, context-window, agent-sdk/subagents, tools-reference, and the second half of sub-agents. Quotes from these are exact.
- **Summarised by the fetch tool (lossy):** the first half of sub-agents, model-config, hooks, permission-modes and settings-reference. Treat field names from these as reliable, but treat prose as paraphrase.

Two non-URL primary sources are labelled where they are used:
- **[Observed]:** the tool schemas exposed to this Claude Code desktop session on 2026-11-08.
- **[Bundled skill]:** the `workflow-authoring` skill that ships with Claude Code. It is the script-API reference Claude itself uses.

Community sources are labelled as such. The docs cite Claude Code versions up to v2.1.317. I did not check which version is installed on the target machine.

## 1. Subagents: the Agent tool (parameters, context, return value, nesting, concurrency, notifications, continuation, cost)

### Takeaway
The orchestrator spawns workers with the `Agent` tool. Its parameters are `description`, `prompt`, `subagent_type`, `model` (aliases only), `effort`, `isolation` and `name`, and `run_in_background` exists but background is already the default.
- **Context:** a non-fork worker starts fresh. It gets its own system prompt, the task prompt, CLAUDE.md and a git status snapshot. It does not see the orchestrator's conversation, and it returns only its final message plus an `agentId`.
- **Notifications and continuation:** background workers notify the parent in a later turn. `SendMessage` continues a finished worker with its full history.
- **Limits:** the default concurrency cap is 20, and nesting is allowed up to 3 levels below the main conversation.

### Cited Findings
**Parameters**
- The `Agent` tool "spawns a subagent in a separate context window. The subagent works through its task autonomously, then returns its result to the parent conversation. The parent doesn't see the subagent's intermediate tool calls or outputs, only that final result." With agent teams enabled, a call that carries a `name` can launch a teammate instead. Where fork mode is on, the tool can launch a fork that inherits the full parent conversation. — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Observed] In this session the Agent tool's input schema exposes:
  - `description` (3–5 words) and `prompt` (both required);
  - `subagent_type` (`"fork"` inherits context; any other type starts fresh; default `general-purpose`);
  - `model`, an enum of `sonnet | opus | haiku | fable`;
  - `effort`, an enum of `low | medium | high | xhigh | max`;
  - `isolation`, an enum of `worktree | remote`. `"remote"` is described as "launches the agent in a remote cloud environment (always runs in background; availability is gated)".
  - The schema shown to a subagent had no `name` or `run_in_background` field. That is a subagent's view, so the parent's schema may include them.
- **Per-invocation `model`:** it takes an alias only (`sonnet`, `opus`, `haiku`, `fable`). "Claude cannot pass a full model ID or `inherit` on this call." The model is chosen in this order: per-invocation `model`, then the frontmatter `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main conversation's model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides both the definition and the per-call value. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Per-invocation `effort`:** it applies to non-fork subagents only and requires v2.1.292+. It overrides the frontmatter `effort` and persists across resumes. `CLAUDE_CODE_EFFORT_LEVEL` takes precedence over both. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **`name`:** Claude "can give a subagent a name by passing a `name` parameter on the Agent tool call". The name lets it "message or resume it by name after it finishes" through `SendMessage`. In an interactive session with agent teams enabled, a named subagent launches as a teammate unless the call is a fork or passes `isolation` on the call itself. — [Subagents](https://code.claude.com/docs/en/sub-agents); [Agent teams](https://code.claude.com/docs/en/agent-teams)
- **`run_in_background`:** the parameter exists. The agent-teams limitations note that "A teammate's `run_in_background: true` request also fails". — [Agent teams](https://code.claude.com/docs/en/agent-teams)

**Foreground vs background, and notifications**
- "Claude Code runs subagents in the background by default". Foreground subagents show permission prompts inline. "Background subagents surface permission prompts in your main session. The prompt names which subagent is asking, and pressing Esc denies that one tool call without stopping the subagent." — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- Interactive terminal, VS Code and desktop sessions run subagents in the background by default "unless fork mode is off and you ask Claude to wait". In `claude -p` and the Agent SDK, Claude decides whether to wait. Frontmatter `background: true` keeps an agent in the background "even when Claude asks to wait for it". Ctrl+B moves a running task to the background. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- "A background subagent's results arrive as a completion notification in a later turn." — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- SDK view: the Agent tool result has `status: "async_launched"` and the report arrives later. When Claude waits, the call blocks and returns `status: "completed"`. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- "While fork mode is on, Claude also can't wait for a subagent in interactive terminal, VS Code, or desktop sessions on your machine. Fork mode is on by default from Claude Code v2.1.302". Turn it off with `CLAUDE_CODE_FORK_SUBAGENT=0`, or deny only forks with `"Agent(fork)"` in `permissions.deny`. — [Subagents](https://code.claude.com/docs/en/sub-agents)

**Context a subagent receives**
- **Non-fork subagent:** it gets "a fresh, isolated context". It receives:
  - its own system prompt (the markdown body), not the Claude Code system prompt;
  - the task message;
  - CLAUDE.md files (unless it is Explore or Plan, or sets `omitClaudeMd: true`);
  - a git status snapshot;
  - preloaded `skills`;
  - a sibling roster of named agents, if it has `SendMessage`.

  It does not receive the output style, auto memory, the parent's history, or skills the parent invoked. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- "The only content you pass from parent to subagent is the Agent tool's prompt string, so include any file paths, error messages, or decisions the subagent needs directly in that prompt." A subagent also inherits the main session's extended-thinking configuration. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- **Forks:** a fork "inherits the entire conversation so far … sees the same system prompt, tools, model, and message history as the main session". Its first request reuses the parent's prompt cache, so "a fork costs less than a fresh subagent for tasks that need the same context". Further details:
  - A fork can be given `isolation: "worktree"`.
  - "A fork can't spawn further forks."
  - Start one manually with `/subtask <task>`.
  - SDK: `subagent_type: "fork"` (v2.1.302+).

  — [Subagents](https://code.claude.com/docs/en/sub-agents); [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)

**Return value and output scanning**
- When a subagent completes, "the Agent tool result includes a text block containing `agentId: <id>`". Explore and Plan are one-shot and return no agentId. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- From v2.1.210, Claude Code scans the subagent's final message for instruction-shaped patterns. It neutralises imitated `<system-reminder>` tags and `Human:`/`Assistant:` turn markers, and prepends a `[harness: ...]` marker line for matches. It never removes text. An API error such as a rate limit "is never delivered as its result". — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- `SubagentHandback` is the tool that "Delivers a subagent's final report". It is provided only in auto mode, to non-fork local subagents, and "the classifier reviews the report before it's delivered" (v2.1.271+). — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Continuing a finished worker**
- "Claude resumes it with `SendMessage`, using the agent ID or name as the `to` field. `SendMessage` doesn't require agent teams. Resumed subagents keep their full history." Transcripts are stored at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`. They are deleted after `cleanupPeriodDays` (default 30). — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- A resumed subagent "takes a fresh slot without checking the limit". — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- After a restart, names given since the last compaction survive. Older names don't, so use the agent ID, which can be found in `agent-{agentId}.meta.json` under `~/.claude/projects/{project}/{sessionId}/subagents/` (v2.1.299+). — [Subagents](https://code.claude.com/docs/en/sub-agents)
- `TaskStop` "Stops a running background task by ID. It also accepts … a named background agent by agent ID or name". `ListAgents` lists the agents Claude can message (v2.1.224+). — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Nesting, concurrency and tool restrictions**
- Subagents can spawn subagents "up to three layers below the main conversation". `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes the depth, and `1` disables nesting. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary); confirmed in [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- The concurrency cap is "20 running subagents by default". Extra spawns fail with `Concurrent subagent limit reached`, and the error tells Claude not to retry. Change it with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (v2.1.217+). It applies only to Agent-tool spawns; workflow agents and teammates have their own limits. Sessions with ultracode active are exempt. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- These tools are always stripped from subagents: `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode` (unless `permissionMode: plan`), `ScheduleWakeup`, `WaitForMcpServers`, `Workflow`, and `Agent` at the depth limit. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- Background subagents keep a reduced built-in tool set: `Read`, `Grep`, `Glob`, `LSP`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, plus all MCP tools. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Tool resolution:** with no `tools` field, a subagent inherits every subagent-available tool. With `tools` only, it gets exactly those. With `disallowedTools` only, it gets every parent tool except those. If both are set, `disallowedTools` wins. "Launching the subagent doesn't itself prompt for permission". — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Cost**
- Each subagent "sends its own requests, which count toward the same usage limits". — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- "Claude Opus 5 delegates to subagents more readily than earlier models". With the `claude_code` system-prompt preset on Opus 5, "Claude Code adds a line to its system prompt telling Claude not to call the Agent tool unless it's asked to". Set depth, concurrency and spend limits as well. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- Anthropic's research system (published June 13, 2025) used about 4× the tokens of chat for single agents and about 15× for multi-agent runs. An Opus 4 lead with Sonnet 4 subagents beat single-agent Opus 4 by 90.2% on an internal research eval. Each subagent needed "an objective, an output format, guidance on tools and sources, and clear task boundaries". The authors say multi-agent is a poor fit where agents must share context or have many dependencies, "such as most coding tasks". — [Anthropic engineering: multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

### Inferences
- **Delegation must be explicit.** The orchestrator prompt should tell Opus to delegate each step to a named worker type in the background, because the `claude_code` preset on Opus 5 tells it not to use Agent unless asked. Spawn the 3–4 workers in a single message so they run concurrently, then wait for the completion notifications rather than polling.
- **Prompts must stand alone.** A worker sees only its prompt plus CLAUDE.md. Each worker prompt should carry the step file path (for example `docs/steps/sNN-…`), the branch name, the acceptance commands and the report format. It should not refer to "what we discussed".
- **Review-fix loops use `SendMessage`.** Have workers end with `agentId`-bearing reports, and continue a worker with `SendMessage` to its agent ID. This keeps the worker's history and avoids re-briefing a fresh agent.
- **Limit nesting in workers.** Restrict worker definitions with `disallowedTools: Agent`, or set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` for the session. Otherwise an Opus worker may fan out sub-subagents and multiply cost.

### Gaps
- I could not confirm the full Agent-tool schema the main (parent) session sees. The subagent-view schema lacked `name` and `run_in_background`, even though the docs mention both.
- There is a possible conflict on nesting. The background reduced tool list (from a lossy summary) does not include `Agent`, while the docs say nesting works up to depth 3 by default. Whether background subagents can spawn their own subagents needs a live test.
- I found no documented per-plan rate-limit numbers (requests or tokens per minute) for parallel Opus subagents.

## 2. Custom agent definitions (`.claude/agents/*.md`): frontmatter fields and selection

### Takeaway
A worker type is a Markdown file with YAML frontmatter in `.claude/agents/`. `name` and `description` are required. The optional fields are `tools`, `disallowedTools`, `model`, `effort`, `permissionMode`, `maxTurns`, `autoCompactWindow`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `isolation: worktree`, `color`, `initialPrompt` and `experimental`. The orchestrator selects a type by passing its name as `subagent_type`, or it is chosen automatically from `description`.

### Cited Findings
- **Supported fields:** only `name` and `description` are required. Multi-word fields are camelCase, and unknown fields are ignored. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
  - `name`: max 256 chars; cannot start with `-` or contain `:`.
  - `description`: when to delegate to this agent.
  - `tools` / `disallowedTools`: a comma-separated string or a YAML list.
  - `model`: `sonnet`, `opus`, `haiku`, `fable`, a full ID such as `claude-opus-5-5`, or `inherit`.
  - `effort`: `low|medium|high|xhigh|max`.
  - `permissionMode`: `default|acceptEdits|auto|dontAsk|bypassPermissions|plan` (`manual` is an alias of `default`).
  - `maxTurns`: when reached, the output is marked partial and can be resumed.
  - `autoCompactWindow`: an integer from 100000 to 1000000 (v2.1.296+).
  - `skills`: up to 32.
  - `mcpServers`.
  - `hooks`: `PreToolUse`, `PostToolUse`, `Stop`.
  - `memory`: `user|project|local`.
  - `background`: `true`.
  - `omitClaudeMd`: `true` (v2.1.271+).
  - `isolation`: `worktree`.
  - `color`.
  - `initialPrompt`.
  - `experimental.cacheTtl`: `5m|1h`.
- **Locations and precedence** (highest first): managed settings, then the `--agents` CLI JSON (session only), then `.claude/agents/` (project, found by walking up to the repo root, with the closest directory winning), then `~/.claude/agents/`, then plugin `agents/`. Both directories are scanned recursively, and identity comes from `name`, not the file path. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- `--agents` JSON example: `claude --agents '{"code-reviewer": {"description": "...", "prompt": "...", "tools": ["Read","Grep","Glob"], "model": "sonnet"}}'`. — [Subagents](https://code.claude.com/docs/en/sub-agents)
- **Selection:**
  - automatic, from `description` ("use proactively" encourages delegation);
  - explicit in natural language;
  - `@"code-reviewer (agent)"` or `@agent-<name>`;
  - the whole session via `claude --agent <name>` or `"agent": "<name>"` in settings.
  - An agent running as the main thread can allowlist which types it spawns with `tools: Agent(worker, researcher)`.
  - A startup warning appears if the combined descriptions exceed 15,000 tokens.

  — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- Example worktree-isolated agent from the docs: frontmatter `name: refactorer`, `description: ...`, `isolation: worktree`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- **Hot reload:** Claude Code watches `~/.claude/agents/` and `.claude/agents/` and "picks up a new or edited agent file within a few seconds". However, the first file in a newly created `agents` directory needs a session restart, and so do files under `--add-dir`. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- **Worktrees read through:** when a worktree has no `.claude/agents` of its own (for example because it is gitignored), Claude Code loads the main checkout's `.claude/agents`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- **Persistent memory paths:** `memory: user` uses `~/.claude/agent-memory/<name>/`, `project` uses `.claude/agent-memory/<name>/`, and `local` uses `.claude/agent-memory-local/<name>/`. The first 200 lines or 25KB of `MEMORY.md` are injected. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Built-in types:**
  - `general-purpose`: all subagent tools.
  - `claude`: catch-all.
  - `Explore`: read-only, no CLAUDE.md or git status, and "On subscription, Console, or gateway setups it runs on the `opus` alias".
  - `Plan`: read-only.
  - `statusline-setup`: Sonnet.
  - `claude-code-guide`: Haiku.

  Disable one with `permissions.deny: ["Agent(Explore)"]`. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Version control:** check project subagents into version control. — [Subagents](https://code.claude.com/docs/en/sub-agents)

### Inferences
- A suitable worker file is `.claude/agents/redesign-implementer.md` with:
  - `model: opus` (or `claude-opus-5-5` to pin);
  - `effort: high` or `xhigh` (see §7);
  - `isolation: worktree`;
  - `disallowedTools: Agent`;
  - `maxTurns` as a safety stop;
  - optionally `hooks:` with a `Stop` gate;
  - a body stating the worker contract: branch naming `impl/<NN>-<short-name>`, the lint, typecheck and test commands, and the report format.

  A read-only `redesign-reviewer` with `tools: Read, Grep, Glob, Bash` could do adversarial review.
- `permissionMode` in frontmatter is ignored when the orchestrator runs in `auto`, `acceptEdits` or `bypassPermissions` (see §5). Don't rely on it for safety; use deny rules and hooks.
- Creating `.claude/agents/` for the first time mid-session needs a restart, so create the agent files before launching the orchestrator session.

### Gaps
- The exact YAML for frontmatter `hooks` beyond the docs example (`hooks: PreToolUse: - matcher: "Bash" hooks: - type: command command: ...`) was not fully extracted.

## 3. Git worktree isolation (`isolation: "worktree"`, `--worktree`, manual `git worktree add`, dependencies, Windows)

### Takeaway
`isolation: worktree` gives each worker a temporary git worktree under `.claude/worktrees/`.
- **Base branch:** the worktree is branched from the remote default branch (`origin/HEAD`) unless `worktree.baseRef: "head"` is set.
- **Cleanup:** it is removed automatically only if unchanged. Otherwise a periodic sweep removes it once it holds no work.
- **Contents:** it contains only tracked files. `.worktreeinclude` copies gitignored files such as `.env`, but `node_modules` and `.venv` must be installed or synced per worktree.
- **Splitune:** it does not push, so its local `dev` is ahead of `origin`. `baseRef: "head"` is essential there, or workers start from stale code.

### Cited Findings
**Location, branch and base**
- `claude --worktree <name>` (`-w`) creates `.claude/worktrees/<name>/` at the repo root "on a new branch named `worktree-<name>`". With no name, Claude generates one such as `bright-running-fox`. Interactive runs require workspace trust, and `claude -p --worktree` skips the trust check. Add `.claude/worktrees/` to `.gitignore`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- "Each subagent gets a temporary worktree that Claude Code removes automatically when the subagent finishes without changes; a worktree with changes stays on disk until the periodic sweep … can remove it without losing work." — [Worktrees](https://code.claude.com/docs/en/worktrees)
- "Subagent worktrees use the same base branch as `--worktree`, so they branch from your repository's default branch unless `worktree.baseRef` is set to `"head"`." — [Worktrees](https://code.claude.com/docs/en/worktrees)
- `worktree.baseRef` has two values:
  - `"fresh"` (default): "branch from the repository's default branch on the remote". Claude Code fetches the default branch if it was not fetched in the last 24h, with the fetch capped at 5s and never prompting. It falls back to local `HEAD` if there is no remote or `origin/HEAD`.
  - `"head"`: "branch from your current local `HEAD` … Use this when isolating subagents that need to operate on in-progress work. Inside a worktree, `"head"` resolves to that worktree's `HEAD`".
  - You cannot set it to a branch name; "create it with git directly".

  — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Enforcement**
- Isolation is enforced by four checks:
  - Edit, Write and NotebookEdit calls targeting the main checkout are blocked.
  - Bash, PowerShell and Monitor commands whose working directory resolves to the main checkout are blocked.
  - Git redirects into the main checkout (`git -C`, `--git-dir`, `GIT_DIR`, `GIT_WORK_TREE`, or `cd` then git) are blocked.
  - Command-shape checks cannot be turned off.

  Limitations:
  - "None of them tracks which files a shell command writes", so `cp` or a redirect into the main checkout is not refused.
  - "For PowerShell commands, Claude Code applies only the working-directory check."
  - The same enforcement covers every subagent spawned from an isolated session.

  — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Inside the worktree, Bash and PowerShell commands run there, and "`cd` doesn't persist across calls". — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Instruction files:** "A subagent in its own worktree takes the instruction files it starts with from your main conversation, not from its worktree … the subagent also doesn't load the `CLAUDE.md` file or `.claude/rules/` directory at the worktree's root as it reads files there, even if those differ on the worktree's branch." — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Shared with the main checkout**
- The `.git` directory is shared, so commits in a worktree land in the shared repository.
- Plugins are shared.
- Permission approvals are shared: choosing "don't ask again" saves to the main checkout's `.claude/settings.local.json`. However, "On Windows and in the other cases where Claude Code doesn't use the repository root, the rule stays with that worktree."
- Untracked `.claude/skills`, `.claude/agents` and `.claude/commands` read through from the main checkout.

  — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Dependencies**
- "A worktree is a fresh checkout, so initialize your development environment there: ask Claude to install dependencies, or run your project's setup yourself". — [Worktrees](https://code.claude.com/docs/en/worktrees)
- `.worktreeinclude` (at the project root, `.gitignore` syntax): "Only files that match a pattern and are also gitignored are copied". It applies to `--worktree`, subagent and desktop worktrees, but not when a `WorktreeCreate` hook replaces creation. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Two more settings keys exist: `worktree.symlinkDirectories` ("symlinks large directories into each worktree instead of duplicating them") and `worktree.sparsePaths` ("checks out only the directories you need"). — [Settings reference](https://code.claude.com/docs/en/settings-reference) (lossy summary; value format not extracted)
- Claude Code skips repository-local git filter drivers such as `git lfs install --local` when creating worktrees, so LFS files arrive as pointers until `git lfs pull` is run. Creation fails outright for `includeIf` in `.git/config`. — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Cleanup and locks**
- On interactive exit, a clean unnamed worktree is removed with its branch, and a worktree with work prompts keep or remove. "Non-interactive runs with `-p` have no exit prompt, so Claude doesn't clean up their worktrees" and their locks stay until a later stale-lock sweep. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- The periodic sweep removes subagent and background-session worktrees older than `cleanupPeriodDays`. It keeps any worktree with changed or untracked files or unpushed commits, and any worktree you created with `git worktree add`. While an agent runs, "Claude Code holds a `git worktree lock` on its worktree". For manual cleanup, run `git worktree remove [--force]`, and `git worktree unlock` it first if it is locked. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- **Windows:** "removing a worktree doesn't delete files outside it. If a folder inside the worktree is a link to somewhere else, such as an NTFS junction or a directory symlink, Claude Code deletes only the link." — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Creation is refused if `.claude`, `.claude/worktrees` or the worktree directory itself is a symlink. Network-path worktrees are never resumed. — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Manual worktrees and related tools**
- Manual alternative: `git worktree add ../project-feature-a -b feature-a`, then start `claude` there. You can also check out an existing branch with `git worktree add ../project-bugfix fix-issue-456`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- `EnterWorktree` creates or switches worktrees mid-session. Entering a path outside `.claude/worktrees/` prompts, and only `bypassPermissions` skips that prompt. Hooks keep `${CLAUDE_PROJECT_DIR}` at the original root, while the hook input `cwd` follows the worktree. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Background sessions refuse edits in the main checkout until they enter a worktree. `claude --bg --worktree` or `worktree.bgIsolation: "none"` changes that. — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Community-reported Windows issues** (aggregator mirrors of GitHub issues, reported around v2.1.92; current status unknown)
- `isolation="worktree"` falsely reports "not in a git repository" on Windows and runs unisolated. — [claudeissues #40164 (community)](https://claudeissues.com/issue/40164-bug-isolation-worktree-fails-on-windows-falsely-reports-not-in-a-git-repository)
- Worktree-isolated subagents' Edit/Write calls leaked into the parent checkout on Windows. — [claudeissues #57847 (community)](https://claudeissues.com/issue/57847-worktree-isolated-subagents-leak-edit-write-into-parent-checkout-windows)
- Isolation fails when the session working directory contains a space. — [claudeissues #61572 (community)](https://claudeissues.com/issue/61572-enterworktree-agent-isolation-worktree-fails-on-windows-when-session-cwd-contain)
- Worktree removal failed with Windows file-lock `IOException`. — [GitHub #57767 (community)](https://github.com/anthropics/claude-code/issues/57767)
- The worktree is based on `main` instead of HEAD. This is now documented default behaviour (`baseRef: "fresh"`). — [claudeissues #41368 (community)](https://claudeissues.com/issue/41368-bug-agent-isolation-worktree-bases-branch-on-main-instead-of-current-head-window)

### Inferences
- **Set `"worktree": { "baseRef": "head" }` for Splitune.** The integration branch is `dev` and nothing is pushed, so `origin/HEAD` lags local merges. `"fresh"` would base workers on stale remote code. The orchestrator must be on the intended base commit, normally local `dev` with earlier steps merged, when it spawns each wave.
- **Branch naming.** Docs give `worktree-<name>` only for `--worktree`, and the subagent worktree branch name was not confirmed. Have each worker's first action be `git switch -c impl/<NN>-<short-name>` (or `git branch -m impl/<NN>-<short-name>`) inside its worktree. The orchestrator can then `git merge impl/<NN>-…` from the main checkout, because `.git` is shared. The sweep keeps worktrees with unpushed commits, so remove them with `git worktree remove` after merging.
- **Dependencies per worktree.**
  - Each worker needs `pnpm install --frozen-lockfile`. pnpm's content-addressable store makes this mostly hard-linking (general pnpm behaviour, not from Claude docs).
  - Each worker also needs `pnpm --filter @splitune/web generate` before web typecheck or test.
  - `uv sync` (or skip Python) applies only if the step touches `services/ml`. Because `.venv` is absent in a fresh worktree, `uv run --no-sync` will fail there until synced.
  - Add `.env` (and any other gitignored config) to `.worktreeinclude`.
  - Symlinking `node_modules` via `worktree.symlinkDirectories` is possible, but risky with pnpm's symlinked layout and Windows link privileges. Test it before relying on it.
- **Integration tests.** Tests needing compose Postgres and SeaweedFS will share the same local services across parallel workers. Keep parallel workers to UI-only test suites, or serialise integration tests.
- **The Windows issues are serious.** Above all, the reported edit leak into the parent checkout is a reason to:
  - check `git -C D:/Projects/Splitune status` in the main checkout after each wave;
  - avoid spaces in the repo path (`D:\Projects\Splitune` has none);
  - keep the orchestrator's main checkout clean before spawning.

### Gaps
- I could not confirm what the parent receives when a worktree-isolated subagent finishes with changes: the worktree path, the branch name, or both. I also could not confirm the branch naming for subagent worktrees. Earlier releases reportedly returned path and branch in the result, but that was not seen in current docs.
- The exact value formats for `worktree.symlinkDirectories` and `worktree.sparsePaths` were not extracted.
- Whether the community-reported Windows bugs are fixed in current versions is unknown.

## 4. Other orchestration options and when each fits

### Takeaway
Claude Code offers five parallel approaches: subagents, agent view (background sessions), agent teams (experimental), dynamic workflows (the `Workflow` tool) and projects. Headless `claude -p` and the Agent SDK serve programmatic orchestration. For 12–14 dependent implementation steps with 3–4 parallel workers and human-quality review between waves, the simplest robust choice is an interactive orchestrator session spawning worktree-isolated subagents. Workflows fit one well-scoped fan-out per wave. Agent teams are a poor fit because they are experimental, lack worktree isolation, and are in-process only on Windows Terminal.

### Cited Findings
**Overview**
- The five approaches are subagents, agent view (`claude agents`, research preview), agent teams ("Experimental and disabled by default"), projects, and dynamic workflows. `/batch` is "a skill that has Claude split one large change into 5 to 30 worktree-isolated subagents". — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- To check on running work, use `/tasks` (background items, including finished subagents), `/workflows` and `claude agents`. — [Run agents in parallel](https://code.claude.com/docs/en/agents)

**Dynamic workflows (`Workflow` tool)**
- "A dynamic workflow is a JavaScript script that orchestrates many subagents at once … a runtime executes it in the background". It is available on all paid plans (on Pro, enable it in `/config`). It is triggered by asking for a workflow or by the keyword `ultracode` in a typed prompt; the keyword does not trigger from `-p` prompts. — [Workflows](https://code.claude.com/docs/en/workflows)
- Comparison: with subagents, Claude decides turn by turn and intermediate results land in its context. With workflows, "The script" decides and intermediate results live in "Script variables". Workflows scale to "Dozens to hundreds of agents per run" and are "Resumable in the same session". — [Workflows](https://code.claude.com/docs/en/workflows)
- **Script API** [Bundled skill]: `agent(prompt, {label, phase, schema, model, effort, isolation: 'worktree', agentType})`. Further details:
  - It returns a string, or a validated object when `schema` is given, or `null` on skip or terminal error.
  - `isolation: 'worktree'` is "EXPENSIVE (~200-500ms setup + disk per agent), use ONLY when agents mutate files in parallel".
  - `agentType` selects a custom subagent type, such as one defined in `.claude/agents/`.
  - Other functions: `pipeline(items, stage1, ...)` (no barrier), `parallel(thunks)` (barrier), `phase()`, `log()`, `args`, `budget`, and `workflow(nameOrRef, args)` (one level of nesting).
  - Workflow agents "get the same CLAUDE.md files injected".
  - Resume with `Workflow({scriptPath, resumeFromRunId})`.
- The docs also document `stallMs` on `agent()`, for example `agent(prompt, { stallMs: 1800000 })`. — [Workflows](https://code.claude.com/docs/en/workflows)
- **Limits:**
  - "No mid-run user input … For sign-off between stages, run each stage as its own workflow".
  - No filesystem or shell access from the script itself.
  - No `import()`.
  - "Up to 16 concurrent agents by default, fewer when Claude Code has fewer CPUs" (the bundled skill says `min(16, available CPUs - 2)`), adjustable with `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` (1–256).
  - 4,096 items per `parallel()` or `pipeline()` call, and 1,000 agents per run.
  - `Date.now()`, `Math.random()` and `new Date()` throw.

  — [Workflows](https://code.claude.com/docs/en/workflows)
- **Approval:** auto mode prompts on first launch only, Manual and acceptEdits prompt on every run, and bypass never prompts. In `-p` and the SDK, allow the launch with a `Workflow` or `Workflow(<name>)` allow rule, auto mode, bypass, a PreToolUse hook, or a host callback. Saved workflows live in `.claude/workflows/` or `~/.claude/workflows/` and run as `/<name>`. — [Workflows](https://code.claude.com/docs/en/workflows)
- **Usage limits:** when a run hits a usage limit in an interactive subscription session with `autoContinueAtUsageLimit` on, it pauses and resumes after the reset (v2.1.271+). It does not pause in `-p`, the SDK or background sessions. A `Large workflow` warning appears above 25 agents or a projected 1.5M tokens. The Workflow tool is never available to subagents. — [Workflows](https://code.claude.com/docs/en/workflows); [Subagents](https://code.claude.com/docs/en/sub-agents)

**Agent teams**
- Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (in `env` in settings.json or the shell). Teammates need an interactive session: "In non-interactive mode with the `-p` flag, including Agent SDK sessions, Claude doesn't spawn teammates". — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Enabling teams changes ordinary delegation: "a subagent that Claude names launches as a teammate, so teams can form even when you didn't ask for one". — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- **Limitations:**
  - no `/resume` for in-process teammates;
  - task status can lag;
  - one team per session;
  - no nested teams;
  - in-process teammates cannot run background subagents;
  - no per-teammate permission mode at spawn (teammates start in the lead's mode, including `bypassPermissions`);
  - "Split-pane mode isn't supported in VS Code's integrated terminal, Windows Terminal, or Ghostty".

  Docs recommend 3–5 teammates and 5–6 tasks per teammate. "Agent teams don't isolate teammates in worktrees, so partition the work". — [Agent teams](https://code.claude.com/docs/en/agent-teams); [Run agents in parallel](https://code.claude.com/docs/en/agents)
- **Team hooks:** `TeammateIdle`, `TaskCreated` and `TaskCompleted`; exit code 2 blocks and sends feedback. Mailboxes live at `~/.claude/teams/{team}/inboxes/{agent}.json`, and tasks at `~/.claude/tasks/{team}/`. — [Agent teams](https://code.claude.com/docs/en/agent-teams)

**Headless (`claude -p`)**
- **Output and continuation:**
  - `--output-format text|json|stream-json`. `json` includes `result`, `session_id`, `total_cost_usd` and per-model cost; `--json-schema` gives `structured_output`.
  - `stream-json` needs `--verbose` and supports `--include-partial-messages`. Subagent messages carry `parent_tool_use_id`, and `--forward-subagent-text` adds their text and thinking.
  - `--resume <session_id>` and `--continue`.

  — [Headless](https://code.claude.com/docs/en/headless)
- **Permissions:**
  - `--allowedTools` uses rule syntax, for example `"Bash(git diff *)"`; the space before `*` matters.
  - With v2.1.302+, `-p` starts in Manual mode, where calls needing approval are denied unless approved.
  - `--permission-mode auto|dontAsk|acceptEdits`.
  - `--permission-prompts none` (v2.1.259+) denies anything that would prompt and tells Claude not to retry.

  — [Headless](https://code.claude.com/docs/en/headless)
- **Bare mode and budget:**
  - `--bare` skips CLAUDE.md, hooks, skills, subagents, MCP and auto memory. It requires `ANTHROPIC_API_KEY` (no subscription OAuth) and disables background tasks. It "will become the default for `-p` in a future release".
  - `--max-budget-usd` caps spend.
  - SIGTERM exits with 143.

  — [Headless](https://code.claude.com/docs/en/headless)
- **Background work at exit:** a `-p` run stays open for background subagents and workflows. It stops other background work after 10 minutes of idle waiting by default (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). — [Headless](https://code.claude.com/docs/en/headless)

**Agent SDK**
- Agents are defined in the `agents` option of `query()`, and `"Agent"` must be in `allowedTools` to auto-approve. Packages: `@anthropic-ai/claude-agent-sdk` (TypeScript) and `claude_agent_sdk` (Python).
- `AgentDefinition` fields: `description`, `prompt`, `tools`, `disallowedTools`, `model`, `skills`, `memory`, `mcpServers`, `initialPrompt`, `maxTurns`, `autoCompactWindow` (TS only), `background`, `omitClaudeMd` (TS only), `effort`, `permissionMode`.
- Limits: `maxBudgetUsd` / `max_budget_usd`, plus the env vars `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`. "the TypeScript SDK replaces the subprocess environment with it, so spread `process.env`".
- To resume a subagent, resume the same session (`resume: sessionId`) and name the agentId in the prompt. The `Workflow` tool is in the TS SDK v0.3.149+.

  — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)

**Desktop app**
- Desktop worktree sessions read settings, hooks, skills, agents and `.mcp.json` from the main checkout root, while CLAUDE.md and `.claude/rules/` load from the worktree. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- [Observed] This desktop-app session also exposes session-management tools: `mcp__ccd_session__start_session`, `mcp__ccd_session_mgmt__send_message`, `list_sessions`, `set_session_model`, `set_session_permission_mode`, and `mcp__ccd_host__clean_up_worktrees`. These suggest a desktop orchestrator could start and message separate sessions. I fetched no public documentation for them.

### Inferences
- **Recommended pattern.** One interactive orchestrator session on the main checkout spawns background, worktree-isolated subagents of a custom `opus` implementer type, 3–4 per wave. It waits for the completion notifications, reviews each branch (or uses a reviewer subagent), merges into `dev`, then starts the next wave. This keeps human checkpoints, which workflows cannot provide mid-run, and avoids agent-team experimental limits on Windows.
- **Where workflows fit.** A workflow can run one wave as `pipeline(steps, implement (isolation:'worktree', agentType:'redesign-implementer'), verify)`. The orchestrator then reviews between waves, since workflows have no mid-run input.
- **When headless or the SDK fit.** Prefer them only if the run must be unattended and scripted. Avoid `--bare` for this repo, because it drops CLAUDE.md and the hooks the gates depend on.

### Gaps
- I fetched no detailed doc on agent view (`claude agents`, `claude --bg`) or on desktop-app parallel sessions.
- The `ccd_*` session tools are undocumented in the sources I read.

## 5. Permissions and safety for unattended runs (modes, allow/deny rules, hooks, sandboxing)

### Takeaway
Use explicit `permissions.deny` rules for anything that must never happen, such as `git push`, `git merge` into `dev` by workers, or force operations. Deny rules hold in every mode, including `bypassPermissions`. Pre-approve the pnpm, uv and git commands workers need in `permissions.allow`, because background workers' prompts bubble up to the orchestrator. Auto mode allows `git push` to any branch by default. Sandboxing is not available on native Windows, so hooks and deny rules are the main enforcement.

### Cited Findings
**Modes**
- The modes and what runs without asking:
  - `default` (Manual): reads only.
  - `acceptEdits`: reads, edits, and `mkdir`/`touch`/`rm`/`rmdir`/`mv`/`cp`/`sed` in the working directory.
  - `plan`: reads only.
  - `auto`: everything, with a classifier.
  - `dontAsk`: pre-approved tools only; anything else is denied.
  - `bypassPermissions`: everything.

  "Deny rules block in every mode, including `bypassPermissions`. Allow rules have no effect in `bypassPermissions`." — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)
- **Auto mode:**
  - It "blocks anything that escalates beyond your request". Examples blocked by default: `curl | bash`, force push, `git reset --hard`, production deploys.
  - Allowed by default: "pushing to any branch of the repository you're working in", explicitly including the default branch.
  - "If the classifier blocks an action 3 times in a row or 20 times total, auto mode pauses and Claude Code resumes prompting".
  - It drops broad allow rules such as `Bash(*)` and `Agent` allow rules on entry.
  - From v2.1.283 it is the built-in starting mode for interactive terminal and VS Code sessions.
  - Anthropic API models supported: Opus 4.6+, Sonnet 4.6+, Haiku 5.5, Fable.

  — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)
- **Setting the mode:** `--permission-mode <mode>` or `--dangerously-skip-permissions` (= `bypassPermissions`). `permissions.defaultMode` in settings works, but "In `.claude/settings.json` and `.claude/settings.local.json`, `"auto"` and `"bypassPermissions"` don't take effect". — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)
- **Subagent inheritance:** "When the main conversation is in `bypassPermissions`, `acceptEdits`, or auto mode, the subagent runs in that same mode and Claude Code ignores the `permissionMode` you set". In plan mode, subagents stay in plan. In `default` or `dontAsk`, the subagent's setting applies, with exceptions. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)
- **Classifier on subagents:** in auto mode the classifier checks subagent work at delegation, at each action and at finish. In workflows, the `agent()` prompt "doesn't count as a request from you" for the classifier. Messages between agents are treated as untrusted, so "A teammate can't approve a permission prompt or supply consent on your behalf". — [Permission modes](https://code.claude.com/docs/en/permission-modes); [Workflows](https://code.claude.com/docs/en/workflows); [Agent teams](https://code.claude.com/docs/en/agent-teams)
- **Protected paths:** writes are never auto-approved outside bypass. Directories include `.git`, `.vscode`, `.husky`, `.claude` (with exceptions). Files include `.gitconfig`, `.npmrc`, `.pre-commit-config.yaml` and `.mcp.json`. — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)

**Rules**
- Rule syntax: `Bash(git diff *)` is a prefix match. "The space before `*` is important: without it, `Bash(git diff*)` would also match `git diff-index`." — [Headless](https://code.claude.com/docs/en/headless)
- Settings keys: `permissions.allow`, `ask`, `deny`, `defaultMode`, `additionalDirectories`, `blockWritesOutsideWorkingDirectories` and `blockReadsOutsideWorkingDirectories`. Files: user `~/.claude/settings.json`, project `.claude/settings.json`, local `.claude/settings.local.json`, and managed. — [Settings reference](https://code.claude.com/docs/en/settings-reference) (lossy summary)
- `blockWritesOutsideWorkingDirectories` removes or refuses `EnterWorktree` and `ExitWorktree`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- "Bash deny rules also turn off the PowerShell tool" unless `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` is set explicitly. — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Hooks**
- **Events:** `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `TeammateIdle`, `WorktreeCreate`, `WorktreeRemove`, `SessionStart`, `SessionEnd`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `InstructionsLoaded`, `FileChanged`, `CwdChanged`, and others. — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)
- **Format:** `"hooks": { "<Event>": [ { "matcher": "Bash", "hooks": [ { "type": "command", "if": "Bash(rm *)", "command": "...", "args": [], "timeout": 600, "shell": "powershell" } ] } ] }`.
  - `type` is one of `command|http|mcp_tool|prompt|agent`.
  - `if` uses permission-rule syntax on tool events and is best-effort.
  - Default timeouts: 600s for command, 30s for prompt, 60s for agent.
  - `onFailure` is `continue|block` (v2.1.295+).

  — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)
- **Exit codes and output:**
  - Exit `0` means success, and stdout is parsed as JSON.
  - Exit `2` is a blocking error with stderr as the reason. "Exit 1 is not a block".
  - PreToolUse JSON: `hookSpecificOutput.permissionDecision` is `allow|deny|ask|defer`, with `permissionDecisionReason` and `updatedInput`.
  - Top-level `"decision": "block"` with `reason` applies to Stop, SubagentStop, PostToolUse and others.
  - `continue: false` with `stopReason` stops Claude.
  - `additionalContext` is capped at 10,000 chars.

  — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)
- **Stop / SubagentStop:** exit 2 or `"decision": "block"` "prevents Claude from stopping, and the conversation continues". `last_assistant_message` is provided. Input includes `agent_id` and `agent_type`, plus `cwd`, which "follows Claude into a worktree". — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)
- **Subagent-scoped hooks:** frontmatter `hooks:` work in subagent definitions. The docs example uses a `PreToolUse` Bash validator that exits 2 to block. "On Windows, write the validation script in PowerShell and add `shell: powershell`". — [Subagents](https://code.claude.com/docs/en/sub-agents)
- **Windows hooks:**
  - `shell: "powershell"` runs a hook in PowerShell regardless of the PowerShell tool setting.
  - Exec form "requires a real `.exe`. `.cmd` and `.bat` shims fail; run them through `node` or use shell form".
  - Example: `"command": "powershell.exe", "args": ["-NoProfile","-ExecutionPolicy","Bypass","-File","${CLAUDE_PROJECT_DIR}/.claude/hooks/x.ps1"]`.
  - Without Git Bash, PreToolUse failures with other exit codes can block, so set `onFailure`.

  — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)
- The `git push` blocking example from the hooks fetch (`matcher: "Bash"`, `if: "Bash(git push *)"`, returning `permissionDecision: "deny"`) was constructed by the fetch tool from the documented format; it is not a docs example. The docs recommend the permission system for hard denies. — [Hooks](https://code.claude.com/docs/en/hooks) (lossy summary)

**Sandboxing and unattended runs**
- `sandbox.enabled` turns on Bash sandboxing on "macOS, Linux, and WSL2". The PowerShell tool's preview limitation is "On Windows, sandboxing is not supported". — [Settings reference](https://code.claude.com/docs/en/settings-reference) (lossy summary); [Tools reference](https://code.claude.com/docs/en/tools-reference)
- `bypassPermissions` "offers no protection against prompt injection or unintended actions"; use it only in isolated containers or VMs. — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)
- Workflow agents "use your permission rules … To avoid prompts on a long run, add the tools the agents need to your allow rules before starting." — [Workflows](https://code.claude.com/docs/en/workflows)

### Inferences
- **Suggested project `.claude/settings.json` for the run:**
  - `permissions.deny`: `Bash(git push *)`, `PowerShell(git push *)` (PowerShell rule syntax unverified), `Bash(git reset --hard *)`, and `Bash(git checkout dev *)` / `Bash(git merge *)` for workers. Workers have their own deny via `disallowedTools` or a frontmatter hook, because the orchestrator itself must merge.
  - `permissions.allow`: `Bash(pnpm *)` (auto mode drops package-manager run rules, so list specific ones such as `Bash(pnpm --filter * test*)`), `Bash(uv run --no-sync *)`, and `Bash(git switch -c impl/*)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git status*)`, `Bash(git diff *)`.
  - `"worktree": {"baseRef": "head"}`.
- **Quality gate in the worker definition.** Use a `Stop` hook (`shell: powershell` on Windows) that runs `pnpm lint` and `pnpm typecheck` in the hook input's `cwd`, and exits 2 with the failure text if either fails. Guard against infinite loops (see Gaps).
- **pnpm in hooks.** `pnpm` is a `.cmd` shim on Windows, so hook commands invoking it must use shell form or `node <pnpm path>`, not exec form.
- **The repo's own gate.** The repo's gitleaks pre-commit hook still runs on worker commits. Workers must never pass `--no-verify`; add a deny rule for `Bash(git commit --no-verify*)`.

### Gaps
- I could not confirm the `stop_hook_active` loop-prevention field for Stop and SubagentStop in the current docs; the relevant section was truncated. Verify it before writing a blocking Stop gate.
- The exact PowerShell permission-rule syntax (`PowerShell(...)`) was not extracted.
- The full `SubagentStop` input schema was not extracted.

## 6. Context management (compaction, CLAUDE.md/AGENTS.md loading into subagents, keeping the orchestrator small)

### Takeaway
Subagents keep reads and logs out of the orchestrator's context; only the final report and an `agentId` trailer return. Compaction re-injects the project-root CLAUDE.md, auto memory and the plan-mode plan, and background subagents keep running through it. Subagents load CLAUDE.md from the main conversation, not from their worktree. In Splitune, CLAUDE.md takes precedence over AGENTS.md: AGENTS.md is read only when there is no CLAUDE.md, unless it is imported with `@AGENTS.md`.

### Cited Findings
**Compaction**
- What survives compaction:
  - Project-root CLAUDE.md and unscoped rules are re-injected from disk.
  - Auto memory is re-injected.
  - "The plan Claude wrote in plan mode" is re-injected from disk.
  - Up to five recently modified files are re-read.
  - Invoked skill bodies are re-injected (5,000 tokens per skill, 25,000 total).
  - "Background commands and background subagents: Keep running. Claude Code reminds Claude which ones are still running so it doesn't start a duplicate".
  - Path-scoped rules and nested CLAUDE.md reload only on demand.

  — [Context window](https://code.claude.com/docs/en/context-window)
- **Controls:** `/compact <focus>`, `/rewind` with "Summarize from here", `/autocompact 500k`, `/clear`, and `/context` for a live breakdown. `SessionStart` hooks matching the `compact` source re-add context. — [Context window](https://code.claude.com/docs/en/context-window)
- **Subagent compaction:** "Main-conversation compaction doesn't affect subagent transcripts". Subagents auto-compact on their own (`compact_boundary` entries in their transcripts). `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` and `autoCompactWindow` apply. — [Subagents](https://code.claude.com/docs/en/sub-agents)

**Instruction files**
- **CLAUDE.md loading:** CLAUDE.md and CLAUDE.local.md files above the working directory load at launch; subdirectory files load on demand. Target "under 200 lines per CLAUDE.md file". `@path` imports go up to "four hops" deep, and imports don't reduce context cost. — [Memory](https://code.claude.com/docs/en/memory)
- **AGENTS.md:** "By default, Claude reads `AGENTS.md` only when you have no `CLAUDE.md` in your working directory or above it" (v2.1.277+). The `claude-md-and-agents-md` setting loads both, and `@AGENTS.md` in CLAUDE.md works everywhere. On Windows, prefer the `@AGENTS.md` import over a symlink. — [Memory](https://code.claude.com/docs/en/memory)
- **Subagents:** they receive CLAUDE.md files (except Explore, Plan and `omitClaudeMd: true`) but not auto memory. Worktree subagents take their instruction files from the main conversation, not the worktree branch. Workflow agents "get the same CLAUDE.md files injected". — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary); [Worktrees](https://code.claude.com/docs/en/worktrees); [Bundled skill]
- **Teammates:** they load CLAUDE.md, MCP and skills like a regular session, but not the lead's history. — [Agent teams](https://code.claude.com/docs/en/agent-teams)

**Keeping the orchestrator small**
- "Subagents report results back … Lower: results summarized back to main context". — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- "A workflow script holds the loop, the branching, and the intermediate results itself, so Claude's context holds only the final answer." — [Workflows](https://code.claude.com/docs/en/workflows)
- To preserve subagent output verbatim, instruct the parent to do so, because it "may summarize it". — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- **Context window size:** Opus 4.7 and later run with a 1M-token window by default. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` sets the auto-compact boundary. — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)

### Inferences
- **Durable orchestration state.** Keep the orchestrator's plan in plan mode, or in a file it re-reads such as `docs/status.md` or a run-ledger file, because the plan-mode plan and CLAUDE.md survive compaction. The ledger should record each step's state, branch name and worker `agentId`.
- **Short reports.** Ask workers for a short fixed-format report: branch, commit SHAs, files changed, the exact commands run with pass/fail, and open issues. Ask for at most about 30 lines. Workers should not paste diffs or logs.
- **Don't duplicate CLAUDE.md.** Splitune's CLAUDE.md loads into every worker automatically. Worker prompts should cite only step-specific rules, such as "follow docs 26–28; add stories", rather than paste CLAUDE.md.
- **Watch the CLAUDE.md edits.** The repo has both a modified `AGENTS.md` and `CLAUDE.md` in its working tree. Workers get the main checkout's CLAUDE.md, not the branch copy, so instruction edits made on a worker branch won't affect other workers until merged.
- **Record agent IDs.** A worker's name may not survive a restart that crosses a compaction, so record agent IDs.

### Gaps
- Default auto-compact thresholds per model were not extracted; that part of the model-config page was not read.

## 7. Model IDs, aliases, effort levels, and Opus for workers vs orchestrator

### Takeaway
On the Anthropic API, `opus` resolves to Opus 5.5 (`claude-opus-5-5`). `fable` (and `best`) resolve to Fable 5.1 (`claude-fable-5-1`), which sits above Opus. Effort levels are `low|medium|high|xhigh|max`. Opus 5.5 defaults to `medium`, so set `effort` explicitly for implementation workers. A subagent inherits the session's effort only when it runs on the same model as the session.

### Cited Findings
**Aliases**
- Alias resolution on the Anthropic API: `opus` is Opus 5.5, `sonnet` is Sonnet 5.5 and `haiku` is Haiku 5.5. On Bedrock and Agent Platform `opus` is Opus 5.5, and on Foundry it is Opus 4.6. `best` maps to `fable` where available, otherwise `opus`. `fable` is Fable 5.1 unless `ANTHROPIC_DEFAULT_FABLE_MODEL` is set. `opusplan` uses opus in plan mode and sonnet to execute. — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)
- Full IDs quoted in the docs: `claude-opus-5-5`, `claude-fable-5-1`, `claude-fable-5`, `claude-haiku-5-5`, `claude-sonnet-5`, `claude-opus-4-6`, `claude-sonnet-4-6`. The page does not spell out Sonnet 5.5's ID. — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)
- [Observed] This session runs as "Opus 5.5", exact ID `claude-opus-5-5`.
- **Setting the model**, in priority order: `/model`, `--model`, `ANTHROPIC_MODEL`, the `model` setting, then `ANTHROPIC_DEFAULT_MODEL`. `ANTHROPIC_DEFAULT_OPUS_MODEL` pins what `opus` resolves to. — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)

**Effort**
- Opus 5.5, Sonnet 5.5, Haiku 5.5, Opus 5, Fable and Opus 4.7/4.8 support `low, medium, high, xhigh, max`.
- Defaults: "Opus 5.5, Sonnet 5.5, and Haiku 5.5 default to `medium`", Opus 4.7 defaults to `xhigh`, and others default to `high`.
- Resolution order: `CLAUDE_CODE_EFFORT_LEVEL`, then an in-session pick, then `--effort`, then settings (`modelSettings` / `effortLevel`), then the model default.
- `max` isn't accepted in the `effortLevel` settings key.

  — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)
- **Subagents and effort:** "a subagent or teammate runs at the session's level … only when it runs on the main conversation's model". To give one its own level, set `effort` in its definition. — [Model config](https://code.claude.com/docs/en/model-config) (lossy summary)
- `ultracode` (`/effort ultracode`, or `claude --effort ultracode`, which also sets `xhigh`) makes Claude plan a workflow for every substantive task. It lifts the concurrent-subagent limit and suppresses the large-workflow warning. — [Workflows](https://code.claude.com/docs/en/workflows)
- **Model choice in the research system:** an Opus lead with Sonnet subagents outperformed single-agent Opus by 90.2% on research, and token usage explained about 80% of performance variance. — [Anthropic engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- **Docs guidance:** "Control costs by routing tasks to faster, lower-cost models like Haiku". Built-in Explore runs on the `opus` alias on subscription setups. — [Subagents](https://code.claude.com/docs/en/sub-agents) (lossy summary)

### Inferences
- **Orchestrator:** Opus 5.5 at `high` (or `xhigh`), since it reviews and merges.
- **Implementers:** `model: opus` and `effort: high`, or `xhigh` for hard steps. Pin `claude-opus-5-5` in frontmatter if reproducibility matters, because aliases can move to newer releases.
- **Read-only scouts and reviewers:** these can use `sonnet` to save cost, though the brief asks for Opus workers.
- **Ultracode:** do not enable it for this run. It would turn every request into workflows and lift concurrency caps.

### Gaps
- No Anthropic guidance specific to Opus 5.5 orchestrators was found, beyond the Opus 5 note that it "delegates to subagents more readily" and the effort defaults.
- The exact Sonnet 5.5 model ID was not found.

## 8. Documented limits and gotchas (rate limits, concurrency caps, Windows, long-running commands, background notifications)

### Takeaway
The hard numbers are:
- 20 concurrent subagents;
- 3 levels of nesting;
- `min(16, CPUs-2)` concurrent workflow agents, 1,000 agents per run and 4,096 items per call;
- Bash default timeout 2 min and max 10 min, with foreground commands auto-moved to the background at timeout;
- in unattended sessions, background commands capped at 30 min by default and 2 h max (10 min in text-prompt `-p` runs);
- 200 WebSearch calls per interactive session.

On Windows, the important ones are: no sandbox, PowerShell-tool quirks, worktree approvals saved per worktree, `.cmd` shims failing in hook exec form, and several community-reported worktree-isolation bugs.

### Cited Findings
**Commands and timeouts**
- `BASH_DEFAULT_TIMEOUT_MS` defaults to two minutes. `BASH_MAX_TIMEOUT_MS` is the ceiling, ten minutes out of the box. The PowerShell tool follows the same rules. — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- "When a foreground command reaches its timeout without finishing, Claude Code moves it to the background instead of stopping it, unless the command starts with `sleep`". The result reads `Command did not complete within its 120s timeout and was moved to the background`. — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- "A command that a foreground subagent started stops when that subagent's run ends … A command that the main conversation or a background subagent started keeps running after a final response". — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- **Background-command time limit:** it applies in unattended sessions (`-p`, SDK, CI, cloud). The default is 30 minutes and the maximum 2 hours. In text-prompt `-p` runs both are 10 minutes. "A local session you work in from a terminal, the desktop app, or the VS Code extension has no time limit on background commands". It requires v2.1.285+. — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- **`Monitor` tool:** it runs a background command and feeds output lines back to Claude. Its default watch timeout is 5 minutes in `-p`. — [Tools reference](https://code.claude.com/docs/en/tools-reference); [Headless](https://code.claude.com/docs/en/headless)
- `TaskOutput` was "Removed in v2.1.277". Claude now reads a background task's output file with `Read`. — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Task tools**
- Task-tracking tools (`TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate`) are on by default only on Opus 4.7, Sonnet 4.6, Haiku 4.5 and earlier models. On newer models, opt in with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` or by naming them in `--allowedTools` or `--tools`. They are always present in background and cloud sessions. — [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Usage limits**
- WebSearch: 200 calls per interactive session, shared by subagents (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`). — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- Usage limits pause workflows only in interactive subscription sessions with `autoContinueAtUsageLimit`. Subagent API errors such as rate limits are never delivered as the subagent's result. — [Workflows](https://code.claude.com/docs/en/workflows); [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- Stalled workflow agents restart automatically, up to 5 restarts. `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` "also applies to subagents outside workflows". — [Workflows](https://code.claude.com/docs/en/workflows)
- **Prompt cache TTL:** subagent and workflow requests get a 5-minute cache by default, including on subscriptions. `subagentPromptCacheTtl: "1h"` extends it, at a higher write cost. — [Workflows](https://code.claude.com/docs/en/workflows); [Settings reference](https://code.claude.com/docs/en/settings-reference)

**Windows**
- The PowerShell tool is on by default for claude.ai and Console accounts on Windows with Git Bash installed (`CLAUDE_CODE_USE_POWERSHELL_TOOL`). Its preview limitations: PowerShell profiles are not loaded, and there is no sandboxing on Windows. It treats exit code 1 from `grep`, `rg`, `git diff` and `robocopy` 1–7 as non-failures. — [Tools reference](https://code.claude.com/docs/en/tools-reference)
- **Worktree approvals on Windows:** "On Windows … the rule stays with that worktree". Approvals don't propagate to the main checkout's settings.local.json. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- **Background-mode `bypassPermissions`:** background sessions need `skipDangerousModePermissionPrompt` in user or managed settings. — [Permission modes](https://code.claude.com/docs/en/permission-modes) (lossy summary)

**Teams**
- The agent-teams limitations from §4 apply, including that "Split-pane mode isn't supported in … Windows Terminal". — [Agent teams](https://code.claude.com/docs/en/agent-teams)

### Inferences
- **Long test suites.** Long suites such as `pnpm test`, Storybook `test:stories` in Chromium/WebKit and Playwright `e2e` may exceed the 2-minute default. They will auto-background. In a foreground worker they die when the worker ends, so worker prompts should pass an explicit long `timeout` (up to 10 min) or run the narrower `pnpm --filter @splitune/web …` targets. Keep workers in the background, the default, so their background commands persist until done.
- **Pre-seed approvals.** Approvals given inside worktrees on Windows don't carry back to the main checkout. Pre-seed `permissions.allow` in the checked-in `.claude/settings.json` (or user settings) before the run, rather than relying on "don't ask again" answers.
- **CPU limits.** Parallel Storybook or Playwright runs across 3–4 worktrees on one Windows machine will compete for CPU, independent of the agent cap. Consider letting the orchestrator run browser test suites serially after each wave.

### Gaps
- I found no documented numeric API rate limits (RPM or TPM) or subscription session and weekly limits for parallel Opus agents in the sources fetched.
- There is no official Windows-specific known-issues list for worktree isolation; only community issue mirrors were found, and their fix status is unknown.
- I did not establish the Claude Code version installed on the target machine. Several behaviours above are gated on v2.1.2xx–v2.1.31x.
