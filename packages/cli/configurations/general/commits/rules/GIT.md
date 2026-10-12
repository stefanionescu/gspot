# Git

## Working with uncommitted changes

Changes you did not make may belong to another agent or contributor working in parallel. Do not
revert, stash, clean, or overwrite them. Keep working beside them, and ask the user only when your
change overwrites or contradicts one.

## Commits

- Commit only when the user asks.
- One change per commit. Put a rename and a behavior change in two commits.
- The body says what changed and why.
- Footers reference issues with `Refs: #123` or `Closes: #123`, and breaking changes with `BREAKING CHANGE: ...`.
- Never bypass hooks with `--no-verify`.

## Branches

- Name branches `<type>/<kebab-summary>`, such as `feat/order-export` or `fix/session-expiry`.
- Never force-push a protected branch. Force-push your own branch only after a rebase you performed.
- Rebase onto the default branch before opening a pull request; do not merge the default branch into a feature branch.

## Files to keep out of commits

- Editor state such as `.vscode/`, `.idea/`, or `xcuserdata/`, except settings the team commits on purpose.

## Pull requests

- Use the commit subject as the title when the branch has one commit. Otherwise, write a sentence for the whole change.
- The description states what changed, why, and which checks verified it. It links the issue.
- A pull request does one thing. Unrelated fixes found on the way go in a separate branch.
