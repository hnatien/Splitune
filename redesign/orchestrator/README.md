# Running the redesign orchestrator

`prompt.md` is the prompt for **one** Claude Code session acting as orchestrator. That session hands each step to an Opus worker on its own branch and worktree, reviews and merges the steps into the integration branch `impl/redesign`, and asks the owner at the review gates. `report.md` is the research behind the prompt; `research/` holds the source notes.

## Before you start

1. **Open a new session** in `D:\Projects\Splitune` (desktop app or CLI) with:
   - model **Opus 5.5**;
   - effort **high** or **xhigh**;
   - permission mode **Auto**, so background workers don't stall on permission prompts.
2. **Add deny rules (recommended)** to `.claude/settings.local.json` in the main checkout. The file stays local; don't commit it.

   ```json
   {
     "permissions": {
       "deny": [
         "Bash(git push --force:*)",
         "Bash(git push -f:*)",
         "Bash(git push origin dev:*)",
         "Bash(git commit --no-verify:*)",
         "Bash(git stash:*)",
         "Bash(git reset --hard:*)",
         "Bash(git clean:*)"
       ]
     },
     "env": { "UV_NO_SYNC": "1", "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1" }
   }
   ```

   The two environment variables:
   - `UV_NO_SYNC` protects the shared ML venv, which holds CUDA torch.
   - `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` stops workers from spawning sub-agents of their own. The name comes from the Claude Code docs as of November 2026; if your version doesn't recognise it, it does nothing.
3. **Have Docker running**, with the compose Postgres and SeaweedFS up. The orchestrator will also pull the Playwright image used for visual regression.

## How to run it

Paste the whole of `prompt.md` into the new session, or type:

> Read `git -C D:/Projects/Splitune show dev:redesign/orchestrator/prompt.md` and carry it out exactly.

## What happens

- **Setup.** The orchestrator creates a run folder, `.claude/worktrees/_redesign-run/` (ledger, log, reports and the owner's queue), and an integration worktree, `.claude/worktrees/redesign-int`, on `impl/redesign`. It then records a baseline.
- **The main checkout is never touched.** `impl/29-separation-improvements` and its uncommitted work stay as they are.
- **Steps** run from s31a to s45, at most 3 workers at a time. Each step is merged on its own, after verification and an independent review.
- **Gates you answer in chat:**

  | Gate | When | What you do | What it blocks |
  |---|---|---|---|
  | **G1** | After s31a + s31b | Approve the rewritten specs and step prompts | Every step from s32 on |
  | **G2** | After s33 | Approve the foundations look: Storybook screenshots next to the mockups | s34–s36 |
  | **G3** | s40a, s41a | Approve the separation config change, run `eval:regression` on the GPU machine, listen to the stems | Only those two merges |
  | **G4** | After each screen wave | Check on real devices | Not the other lanes; blocks the final merge |
  | **G5** | Before the final merge | Music-stand reading test, real pedals, iPad Safari/PWA, audio latency | The final merge |
  | **G6** | When you say "go" | The orchestrator merges `impl/redesign` into `dev`; you run the push yourself | — |

- **Cost:** a multi-agent run uses about 15× the tokens of a single session. The orchestrator pauses and asks you when a step runs longer than about 3 hours or reaches twice its expected size.
