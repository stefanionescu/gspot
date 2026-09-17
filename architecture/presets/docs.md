# docs

Kind: repository. Selected by default. Documentation integrity: links, anchors, headings,
stale paths, and the agent files.

## Claims

Every `.md` file, `CLAUDE.md`, `AGENTS.md`, the rules directory, `README.md` at every scope.

## Tools

lychee; the integrity engine.

## Generated configuration

`.gspot/lychee.toml`: `offline = true`, `include_fragments = true`, `no_progress = true`,
excludes from `[tools.lychee] exclude` with reasons; a second profile for the online run.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `docs/links` | commit | `lychee --config .gspot/lychee.toml --offline --include-fragments {files}`: every relative link resolves to a tracked file and every `#anchor` to a heading or an HTML id |
| `docs/links-external` | manual, network | `lychee --no-offline` with the online profile |
| `integrity/docs-headings` | commit | no heading from the banned list (`Table of contents`, `Project structure`, `Repository layout`, `Directory structure`, `File map`, `Codebase map`) |
| `integrity/stale-paths` | commit | every path-shaped token in Markdown and comments names a tracked file, unless it is in a code fence tagged `text` or matches `[tools.docs] path_exceptions` |
| `docs/readme-present` | commit | every scope has a `README.md`; the root has a `LICENSE` |
| `rules/check` | commit | the installed agent files match the assembled render; the managed block in `CLAUDE.md` and `AGENTS.md` is intact; every `enforced-by` names a check |

## Settings

`tools.docs.path_exceptions` (patterns, reason), `tools.docs.banned_headings` (add), `tools.lychee.exclude`
(url patterns, reason), `tools.docs.require_license` (default true).

## Rule files

`general/prose/DOCS.md`, `general/prose/DOCS-FORMAT.md`, `general/prose/DOCS-CONTENT.md`,
`general/prose/DOCS-MEDIA.md`, `general/prose/DOCS-SURFACES.md`, `general/prose/DOCS-REVIEW.md`,
`general/prose/WRITING.md`, `general/code/COMMENTS.md`; the templates under `templates/docs/`.
