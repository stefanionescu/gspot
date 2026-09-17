# commits

Kind: repository. Selected by default.

## Tools

commitlint, @commitlint/config-conventional.

## Generated configuration

`.gspot/commitlint.config.js` with a `.commitlintrc.json` stub: conventional config; `type-enum`
of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`;
`scope-enum` from `[tools.commitlint] scopes` (default: the scope paths plus `root`, `hooks`,
`deps`; with no `[[scope]]` in `gspot.toml` there is no enum and any scope passes);
`scope-empty: never` when scopes exist; `subject-case: lower-case`; `subject-max-length`
100; `header-max-length` 120; `body-max-line-length` 200.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `commits/commitlint` | message | `commitlint --config .gspot/commitlint.config.js --edit <file>` |
| `commits/range` | push | `commitlint --from <base> --to HEAD` over the pushed commits |

## Settings

`tools.commitlint.scopes`, `tools.commitlint.types`, `tools.commitlint.rules` (per-rule options; off is a `gspot ignore --rule`).

## Rule files

`general/agent/GIT.md`, `tool/commitlint/COMMITLINT.md`.
