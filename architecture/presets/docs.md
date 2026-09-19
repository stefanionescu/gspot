# `docs`

Kind: concern. Requires: nothing. Documentation integrity: links, anchors, headings,
stale paths, and the agent files.

## Claims

Every `.md` file, `CLAUDE.md`, `AGENTS.md`, the rules directory, `README.md` at every scope.

## Tools

lychee; the integrity engine.

## Generated configuration

`.gspot/lychee.toml`: `offline = true`, `include_fragments = true`, `no_progress = true`,
excludes from `[tools.lychee] exclude` with reasons; a second profile for the online run.

## Checks

| Id                    | Stage           | Command                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/links`          | commit          | `lychee --config .gspot/lychee.toml --offline --include-fragments {files}`: every relative link resolves to a tracked file and every `#anchor` to a heading or an HTML id                                                                                                                                                                                               |
| `docs/links-external` | manual, network | `lychee --no-offline` with the online profile                                                                                                                                                                                                                                                                                                                           |
| `docs/headings`       | commit          | no heading from the banned list (`Table of contents`, `Project structure`, `Repository layout`, `Directory structure`, `File map`, `Codebase map`)                                                                                                                                                                                                                      |
| `docs/stale-paths`    | commit          | every path-shaped token in Markdown and comments (a token counts when its first segment is a tracked top-level entry or it ends in a file extension) names a tracked file, and every `mise run <task>`, `bun run <script>` or `npm run <script>` names a task or script that exists, unless it is in a code fence tagged `text` or matches `[tools.docs] paths_allowed` |
| `docs/readme-present` | commit          | every scope has a `README.md`; the root has a `LICENSE`                                                                                                                                                                                                                                                                                                                 |
| `docs/readme-shape`   | commit          | every `README.md` has one H1 (fenced code does not count), an opening paragraph before the first H2, a Contents list when it has more than six H2 headings, and no banned heading; the root README and each scope's README also have a section whose heading contains `install`, `setup`, `start` or `requirements`; content beyond this shape stays in the rule files  |

## Settings

`tools.docs.paths_allowed` (patterns, reason), `tools.docs.banned_headings` (add), `tools.lychee.exclude`
(url patterns, reason), `tools.docs.require_license` (default true).

The shape check is the whole of README enforcement. What a README says is the rule file's job
(`general/prose/DOCS-CONTENT.md`, `templates/docs/README.md` and `templates/docs/ADVANCED.md`,
which follow the short-README-plus-ADVANCED shape); gspot does not grade content.

## Rule files

`general/prose/DOCS.md`, `general/prose/DOCS-FORMAT.md`, `general/prose/DOCS-CONTENT.md`,
`general/prose/DOCS-MEDIA.md`, `general/prose/DOCS-SURFACES.md`, `general/prose/DOCS-REVIEW.md`,
`general/prose/WRITING.md`, `general/code/COMMENTS.md`; the templates under `templates/docs/`.
