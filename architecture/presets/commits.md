# `commits`

Kind: repository. Selected by default.

## Tools

commitlint. The conventional rule set is written into the rendered configuration, so
`@commitlint/config-conventional` is not installed and the configuration works wherever the
commitlint binary runs (D-74).

## Generated configuration

`.gspot/commitlint.config.cjs` with a `.commitlintrc.json` stub that extends it. The rules:

- `type-enum` from `[tools.commitlint] types` (default: `feat`, `fix`, `refactor`, `perf`,
  `docs`, `test`, `build`, `ci`, `chore`, the corpus list); `type-case` lower; `type-empty`
  never.
- `scope-enum` from `[tools.commitlint] scopes`; when the setting is empty, the last segment of
  every scope path plus `root`, `hooks` and `deps`, and no enum at all when the repository has
  no scopes. `scope-empty: never` when an enum exists; `scope-case` kebab.
- `subject-empty` never; `subject-full-stop` never; `subject-case` never start, pascal or
  upper case, so `Add the page` and `add the page` both pass and `Add The Page` does not.
- `header-max-length` 72 and `body-max-line-length` 72, the corpus limits; `body-leading-blank`
  and `footer-leading-blank` always.
- `[tools.commitlint] rules` options render as written; `gspot ignore commits/commitlint --rule
<name>` renders the rule at level 0.

## Checks

| Id                   | Stage   | Command                                                                          |
| -------------------- | ------- | -------------------------------------------------------------------------------- |
| `commits/commitlint` | message | `commitlint --config .gspot/commitlint.config.cjs --edit <message file>`         |
| `commits/range`      | push    | `commitlint --config .gspot/commitlint.config.cjs --from <merge base> --to HEAD` |

The merge base is the one with the upstream branch, or the root commit when the branch has no
upstream. Neither check is cached: the message and the range change without any file changing.

## Settings

`tools.commitlint.types`, `tools.commitlint.scopes`, `tools.commitlint.rules` (per-rule options;
off is a `gspot ignore --rule`).

## Rule files

`general/agent/GIT.md`, `tool/commitlint/COMMITLINT.md`.
