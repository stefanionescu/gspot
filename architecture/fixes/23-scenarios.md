# Every Place a Developer Comes From

This file holds what a scenario pass found on 2026-09-19. The earlier rows came from reading the
code and from one real install. These come from asking what a stranger brings: another hook
tool, another CI system, another agent, no git at all, Windows line ends, a merge. Each row gets
one stated behavior and one planted case, so the answer is in a test and not in a guess.

The rows on installing sit in [08-frameworks.md](08-frameworks.md), and the rows on the release
in [22-launch.md](22-launch.md).

## K-269: no table says which tool gets a root pointer

Closes K-269 and K-270.

**What is wrong.** D-100 allows a root file only as a pointer, and no document lists the form
for each tool. Without a pointer an editor formats on save by other rules than the gate.
`.editorconfig` is called written whole in one document and a shared file in another.

**Target.** This table, held in the manifests by a `pointer` key, and tested for each row:

| Tool                                                                                        | Root pointer                                                      | Form                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Prettier                                                                                    | `prettier.config.mjs`                                             | re-export                         |
| commitlint                                                                                  | `commitlint.config.mjs`                                           | re-export                         |
| ESLint                                                                                      | none where the developer keeps a config; else `eslint.config.mjs` | re-export                         |
| stylelint                                                                                   | `.stylelintrc.json`                                               | `extends`                         |
| markdownlint-cli2                                                                           | `.markdownlint-cli2.jsonc`                                        | `config.extends`                  |
| yamllint                                                                                    | `.yamllint.yml`                                                   | `extends`                         |
| Ruff                                                                                        | `ruff.toml`                                                       | `extend`                          |
| basedpyright                                                                                | `pyrightconfig.json`                                              | `extends`                         |
| SwiftLint                                                                                   | `.swiftlint.yml`                                                  | `parent_config`                   |
| gitleaks                                                                                    | `.gitleaks.toml`                                                  | `[extend] path`                   |
| EditorConfig                                                                                | `.editorconfig`, the file itself                                  | written from `[format]`           |
| ShellCheck, shfmt, SwiftFormat, sqlfluff, hadolint, typos, taplo, osv-scanner, v8r, Semgrep | none                                                              | the check passes the path by flag |

**Files.** `presets/manifest-schema.ts`, the manifests of the twelve tools, `emit/pointers.ts`,
[03-configuration.md](../03-configuration.md).

**Logic.** A config in a manifest takes `pointer = { path, form }`. `pointers.ts` writes one
small file for each, with the mark. A pointer is never written over a file the developer keeps.
An existing `.editorconfig` is taken over like a Prettier file: `--format keep` carries its
values into `[format]`, and gspot writes the file from there.

It leaves the shared-file list of
K-36. The guide on editors names, for each tool with no pointer, the editor setting that reads
`.gspot/`.

**What goes.** The sentence that calls `.editorconfig` shared.

**Tests.** The pointer snapshot of each preset (T-36). A planted case formats a file through the
root pointer of Prettier and through `gspot check --fix`, and holds equal bytes.

**Done when.** That case passes.

## K-271: a folder with no git is half decided

**What is wrong.** Nothing says what `--staged`, `--changed`, `--since`, and the hooks answer in
a folder with no git. Both gitleaks checks read git history, so such a folder gets no secret
scan. Other version control systems are not named.

**Target.** gspot works in any folder. Git adds the hooks, the changed-file runs, and the
history scans. Without git, every check that needs no history runs over the files the walk
finds.

**Files.** `run/check-command.ts`, `presets/secrets/manifest.toml`, `doctor/changes.ts`,
`repository/tracked.ts`.

**Logic.** `--staged`, `--changed`, and `--since` exit 2 with one sentence: this folder is no git
repository, so run `gspot check`. The secrets preset gains `secrets/gitleaks-files`, which runs
`gitleaks dir`, with `needs_git = false`, and the two history checks take `needs_git = true`.
`doctor` prints one line when a `.git` folder appeared after `init`, with the commands that add
the hooks and the presets that need git. A Mercurial, Perforce, or jj folder without `.git` is
this same mode, and the walk honors `.gitignore` and `.hgignore`.

**What goes.** Nothing.

**Tests.** A planted folder with no `.git` and a planted secret holds the finding, and
`gspot check --staged` there exits 2 with the sentence.

**Done when.** Both pass.

## K-272: git cases no test holds

**What is wrong.** Eight cases meet code that assumes the common one. They are a repository with
no commit, one with no remote, a first push, and a deleted branch. They are also a shallow clone,
submodules, linked worktrees, and a config below the git root.

**Target.** One stated behavior for each:

| Case                            | Behavior                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- |
| no commit yet                   | `init` and `check` work; `--staged` compares with the empty tree                  |
| no remote, or no upstream       | `--changed` uses the default branch of the repository, and says which ref it took |
| first push of a branch          | the push hook checks the commits that no remote branch holds                      |
| a deleted branch                | the push hook passes and runs nothing                                             |
| a shallow clone                 | `--changed` says the history is cut, and names `git fetch --unshallow`            |
| submodules                      | not read; `init` and `doctor` say so once, with the path of each                  |
| a linked worktree               | shares the hooks of its repository; `check` there says `Run: gspot install` once  |
| `gspot.toml` below the git root | checks run from the config root; the hook at the git root changes folder first    |

**Files.** `repository/staged.ts`, `run/session.ts`, `emit/hooks.ts`,
`repository/tracked.ts`.

**Logic.** `session.ts` holds two roots: the config root and the git root. Every path in the
report is relative to the config root. The hook line is `cd <config root> && gspot check ...`
where the two differ.

**What goes.** The assumption that both roots are one.

**Tests.** Eight planted cases in a new `tests/repositories/git-cases.test.ts`.

**Done when.** They pass.

## K-273: generated files drift on Windows

**What is wrong.** With `core.autocrlf`, git checks `.gspot/` out with CRLF line ends, and
`integrity/generated-drift` compares bytes.

**Target.** The managed `.gitattributes` block holds two lines: `.gspot/** linguist-generated`
and `.gspot/** text eol=lf`.

**Files.** `emit/managed-blocks.ts`.

**Logic.** One more line in the block.

**What goes.** Nothing.

**Tests.** The Windows job of CI clones a planted repository with `autocrlf` on, and holds a
passing drift check.

**Done when.** It passes.

## K-274: a merge conflict under `.gspot/`

**What is wrong.** Two branches that both change the config conflict in generated files and in
the lockfile of gspot, and nothing says what to do.

**Target.** The generated files are outputs. After a merge of `gspot.toml`, `gspot apply` writes
each of them again, and `gspot install` writes the lockfile again.

**Files.** `run/check-command.ts`, `checks/integrity/generated-drift.ts`, and the guide on
teams.

**Logic.** A conflict marker in a file under `.gspot/` is one finding that names those two
commands, in place of a parse error for each tool.

**What goes.** Nothing.

**Tests.** A planted merge of two `gspot set` branches holds the finding, then a clean run after
the two commands.

**Done when.** It passes.

## K-275: hook tools `init` does not know

**What is wrong.** `init` knows husky, lefthook, and plain hook files. Most Python repositories
use the pre-commit framework, most husky setups call lint-staged, and some use
`simple-git-hooks`.

**Target.** `[hooks] tool` also takes `pre-commit` and `simple-git-hooks`, and `existing` reads a
lint-staged call.

**Files.** `repository/hook-calls.ts`, `emit/hook-managers.ts`, `policy/schema.ts`,
`presets/python/manifest.toml`.

**Logic.** For the pre-commit framework, gspot writes one `repo: local` hook into
`.pre-commit-config.yaml`, as a managed block, with `entry: gspot check --staged` and
`pass_filenames: false`. The takeover rows of the python manifest list the hooks of that file
that gspot replaces, such as ruff and black, under removal by hand. For lint-staged, the plan
proposes the gspot line in the husky hook, and lists the lint-staged entries that run a tool
gspot now runs. For `simple-git-hooks`, the line goes into its key of `package.json` after a yes,
as a task body does (D-116).

**What goes.** Nothing.

**Tests.** Three planted cases in `hooks.test.ts`, each with a commit that runs gspot once.

**Done when.** They pass.

## K-276: the GitHub job misses what real repositories need

**What is wrong.** The job has no `permissions` block. Its SARIF upload fails on a pull request
from a fork and on a private repository without code scanning. It ignores `merge_group`, cancels
runs of the default branch, and caches nothing under `.gspot/`.

**Target.** A job that passes on a fork, on a private repository, and in a merge queue.

**Files.** `emit/workflow.ts`, [10-hooks-ci-runners.md](../10-hooks-ci-runners.md).

**Logic.** `permissions` is `contents: read` for the workflow, and the upload step adds
`security-events: write` in a job of its own. That job runs only on a push to the repository
itself, and `[ci] sarif = false` turns it off. `on` gains `merge_group`. `cancel-in-progress` is
true for pull requests alone. One setup step, `gspot install`, follows a cache keyed on
`.gspot/bun.lock`, `.gspot/uv.lock`, and the mise file.

**What goes.** The `mise install` step.

**Tests.** The workflow snapshot, `zizmor` over it, and the planted CI case.

**Done when.** `config-files/actions-security` passes on the written workflow with no ignore.

## K-277: the GitLab job is one sentence

**What is wrong.** GitLab code quality reads the CodeClimate format and not SARIF. The default
clone depth is 20, so `--changed` finds no merge base. A self-hosted host has no `gitlab` in its
name.

**Target.** A job that shows findings in a merge request.

**Files.** `emit/gitlab.ts`, `run/report/write.ts`, `repository/existing-tooling.ts`.

**Logic.** Every run but the message run writes three files under `.gspot/`: `report.json`,
`report.sarif`, and `report.codequality.json` in the CodeClimate form. The job sets `GIT_DEPTH: 0` and runs `gspot install`. Its `rules` select merge request
pipelines and the default branch, and it declares the code quality artifact. The CI
system is found by `.gitlab-ci.yml` or `.github/workflows/`, never by the host name.

**What goes.** The host name test of D-133, which its text keeps as a second signal only for a
repository with no CI file.

**Tests.** The snapshot of the file, and `glab ci lint` in the `manual` job.

**Done when.** Both pass.

## K-278: every other CI system gets nothing

**What is wrong.** A team on Bitbucket, Jenkins, CircleCI, or Azure is not told what to run.

**Target.** gspot writes a file for GitHub and GitLab alone, and tells everybody else the three
lines.

**Files.** `lifecycle/init/plan.ts`, `output/plan-text.ts`, and one guide.

**Logic.** With `--no-ci`, or where the CI files of another system are found, the plan ends with
the lines to paste: install gspot at the pinned version, `gspot install`, and
`gspot check`, with `.gspot/report.*` kept as artifacts. The guide shows them in the syntax of the four systems, and
`docs/samples` parses each command.

**What goes.** Nothing.

**Tests.** A planted `bitbucket-pipelines.yml` holds the three lines in the plan.

**Done when.** It passes.

## K-279: only two agent files

**What is wrong.** The index of rule files goes into `CLAUDE.md` and `AGENTS.md`. A team on
Cursor, Copilot, or Gemini gets rule files that no agent is pointed at.

**Target.** `[rules] agents` lists the agent files gspot writes into, detected from what exists.

**Files.** `rules/managed-block.ts`, `emit/managed-blocks.ts`, `policy/schema.ts`,
`repository/existing-tooling.ts`.

**Logic.** `AGENTS.md` is always written, because most agents read it. `CLAUDE.md`,
`GEMINI.md`, and `.github/copilot-instructions.md` get a managed block where the file exists or
the person names it. Cursor gets `.cursor/rules/gspot.mdc`, a file with the mark, where
`.cursor/` exists. Every block holds the same list.

**What goes.** The fixed pair of file names in the code.

**Tests.** A planted repository with `.cursor/` and `GEMINI.md` holds all three, and `uninstall`
removes them.

**Done when.** It passes.
