# Git

## Protected Files

Do not modify `AGENTS.md`, `CLAUDE.md`, or files under `rules/` unless the user
explicitly asks for rule changes.

## Working With Uncommitted Changes

When `git status` or the worktree shows changes you did not make, do not panic. Other agents or contributors may be working in parallel.

- Do not revert, stash, clean, or overwrite changes you did not make.
- Continue working if your changes do not conflict with uncommitted changes.
- Only stop and ask the user if a change you are about to make directly contradicts or overwrites an uncommitted worktree change.
- Build on top of uncommitted changes, or commit your own changes alongside them.
- If another agent is known to be committing those changes separately, leave them alone.
