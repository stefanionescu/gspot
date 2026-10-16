# Git

Read this rule before you commit, push, tag, or open a pull request.

## Working with uncommitted changes

Changes you did not make may belong to another agent or contributor working in parallel. Do not revert, stash,
clean, or overwrite them. Keep working beside them, and ask the user only when your change overwrites or contradicts
one.

## Commits

- Commit only when the user asks.
- One change per commit. Put a rename and a behavior change in two commits.
- The body says what changed and why.
- Footers reference issues with `Refs: #123` or `Closes: #123`, and breaking changes with `BREAKING CHANGE:...`.
- Never bypass hooks with `--no-verify`.
- Never add `[skip ci]`, `[ci skip]`, `[no ci]`, or another marker that stops CI.
- Never force-push the default branch or a protected branch.

## Branches and pull requests

When the repository works with branches and pull requests, follow these instructions. When the repository commits straight
to the default branch, skip it.

- Name branches `<type>/<kebab-summary>`, such as `feat/order-export` or `fix/session-expiry`.
- Force-push your own branch only after a rebase you performed.
- Rebase onto the default branch before you open a pull request. Do not merge the default branch into a feature
  branch.
- Use the commit subject as the title when the branch has one commit. Otherwise, write one sentence for the whole
  change.
- The description states what changed, why, and which checks verified it. It links the issue.
- A pull request does one thing. Put unrelated fixes in a separate branch.

## Releases

- Publish a package only through the release task or workflow, from a commit that CI tested.
- Tag every published version. The tag names the commit you published.
- After you publish a version, change its code only under a new version number.

## Files to keep out of commits

- Editor state such as `.vscode/`, `.idea/`, or `xcuserdata/`, except settings the team commits on purpose.
