# `language:python`

Requirements R8 and R17. `yap-text-inference` has the fullest Python tool set of the reference
repositories and the largest bespoke layer, because **no cleanup of the kind `yap-swift-app`
attempted was ever done there**. This preset takes the tool set nearly whole, keeps every rule the
bespoke layer enforces, and writes **zero original Python code**.

The blocking constraint, verified: **Ruff has no plugin system as of September 2026.** Its own FAQ
states that it implements every rule natively and does not support custom or third-party rules, and
the plugin discussion is open with no implementation. That is why the bespoke files of bespoke Python exist
in the reference repository, and it means the replacement cannot be Ruff alone.

The replacement is off-the-shelf tools where there was one plus a codebase:

| Need Ruff cannot meet                           | Tool                                                                                                                 | Why it is the answer                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Banned identifier terms                         | **pylint** `bad-names` and `bad-names-rgxs`, reporting `disallowed-name` (C0104)                                     | The only maintained mechanism for banned identifier terms in Python. Configured from the same policy document as every other language. |
| Case conventions and length bounds per category | **pylint** `*-rgx` and `*-naming-style`, with `good-names-rgxs` for exemptions                                       | A selector per category, which Ruff's `N` family does not parameterize                                                                 |
| Six design metrics                              | **pylint** `max-locals`, `max-bool-expr`, `max-nested-blocks`, `max-public-methods`, `max-parents`, `max-attributes` | Ruff implements the other seven as `PL*`; these have no Ruff equivalent                                                                |
| Structural rules                                | **ast-grep** YAML with the Python grammar                                                                            | Declarative. Trivial function, call-through, header comments before imports, one declaration per file, `__all__` at the bottom.        |
| File and directory naming                       | **ls-lint**                                                                                                          | One config, shared with every other language in the repository                                                                         |

**pylint runs with `--disable=all` plus an explicit enable list**, restricted to the checks Ruff
does not implement. That detail is the whole trick: running both at defaults produces two findings
per issue with different codes, which is why the reference repository dropped pylint and wrote its
own checks instead. Enabling only the complement is non-duplicative and costs one extra process.

## Claims

```text
.py .pyi
pyproject.toml, setup.cfg, setup.py, requirements*.txt, uv.lock, pyrightconfig.json
```

## Tools

| Kind      | Tool                                                                               | Configuration                                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format          | `ruff format`                                                                      | `line-length` and `indent-width` from `[format]`, `quote-style = "double"`, `line-ending = "lf"`, `docstring-code-format = true`                                                                                                                                                                            |
| syntax, style   | `ruff check`                                                                       | The family selection below                                                                                                                                                                                                                                                                                  |
| types           | `basedpyright`                                                                     | `typeCheckingMode = "all"`, which adds `reportAny`, `reportExplicitAny`, `reportUnreachable`, `reportPrivateUsage` and `reportIgnoreCommentWithoutRule` on top of `strict`. The reference repository uses `strict`; `all` is the strictest Python type gate available and matches the no-warnings position. |
| structure       | **ast-grep** YAML rule files, plus a counter for line limits                       | Declarative. Replaces `quality/python/rules/`, the files.                                                                                                                                                                                                                                                    |
| naming          | **pylint** `bad-names-rgxs` and `*-rgx`, plus **ls-lint** for paths, plus Ruff `N` | Replaces `quality/repository/naming/`, 14 files. No extractor: pylint and ls-lint already extract.                                                                                                                                                                                                          |
| design metrics  | **pylint**, complement-only                                                        | `max-locals`, `max-bool-expr`, `max-nested-blocks`, `max-public-methods`, `max-parents`, `max-attributes`                                                                                                                                                                                                   |
| prose           | Vale, native Python grammar                                                        | Docstrings and comments                                                                                                                                                                                                                                                                                     |
| dead            | `vulture`                                                                          | `min_confidence = 80`                                                                                                                                                                                                                                                                                       |
| deps            | `deptry`, `uv lock --check`                                                        | deptry for unused, missing and misplaced; osv-scanner reads `uv.lock`                                                                                                                                                                                                                                       |
| boundaries      | `import-linter`                                                                    | Reads contracts emitted from `[[structure.contracts]]`. The reference repository already has nine contracts in this format.                                                                                                                                                                                 |
| docstring shape | `pydoclint`                                                                        | `--allow-init-docstring true`                                                                                                                                                                                                                                                                               |
| sast            | Ruff `S`, `semgrep`                                                                |                                                                                                                                                                                                                                                                                                             |
| license         | `pip-licenses`                                                                     | Policy from `[licenses]`                                                                                                                                                                                                                                                                                    |
| manifest        | `validate-pyproject`, `pyproject-fmt`                                              | Schema and formatting of `pyproject.toml`                                                                                                                                                                                                                                                                   |
| duplication     | `jscpd`                                                                            | Language set to Python                                                                                                                                                                                                                                                                                      |
| tests           | `pytest` with `pytest-randomly` and `pytest-timeout`                               | Random ordering catches inter-test coupling; a timeout catches a hang, which a CI job otherwise reports as a cancelled run                                                                                                                                                                                  |
| toolchain       | `uv`                                                                               | `uv run --extra <name>` inside the project environment. One environment per variant, and a tool that resolves imports (basedpyright, deptry, vulture, import-linter, pydoclint) runs once per variant. `uv tool run` is never used: it does not read `uv.lock`. |

Every one of those is already in `yap-text-inference/pyproject.toml`. The preset's contribution is
that the configuration is generated, the structural layer is shared with the other languages, and
the coverage is proved.

## The Ruff selection

The reference selection is 58 families with three ignores, and it is close to maximal. The preset
adopts it, with the ignores justified:

```text
select = A ANN ARG ASYNC B BLE C4 C90 COM D DTZ E EM ERA EXE F FA FBT FIX FLY
         FURB G ICN INP ISC LOG N PERF PGH PIE PL PT PTH PYI Q RET RSE RUF S SIM
         SLF SLOT T10 T20 TC TD TRY UP W YTT
ignore = COM812   # conflicts with the formatter
         D203     # conflicts with D211, pick one
         D213     # conflicts with D212, pick one
fixable = ALL
```

Thresholds, from the reference set, which are the tightest of the three repositories and consistent
with the TypeScript ones:

```text
mccabe.max-complexity = 8          # matches cognitive_complexity = 8
pylint.max-args       = 5
pylint.max-bool-expr  = 4
pylint.max-branches   = 8
pylint.max-locals     = 10
pylint.max-public-methods = 12
pylint.max-returns    = 4
pylint.max-statements = 30
```

Not selected, and stated so the gap is visible: `ERA001` commented-out code is in the `ERA` family
and is on; `S` is selected and `bandit` also runs. The overlap is accepted until a repository proves that
Ruff `S` reports every finding bandit does there, which is D-09.

## Required inspections

```text
.py              format syntax style types structure naming prose spelling
.pyi             format syntax types spelling
pyproject.toml   format syntax schema spelling
requirements*.txt syntax spelling deps
```

`interrogate` at `--fail-under 100` with every ignore flag off, and `pydoclint`, provide docstring
coverage and shape. Ruff `D` does not replace interrogate: it skips private and nested
definitions.

## Public and private

Two structure rules, both ast-grep, both new: no reference repository checks either, and the rule
file already states both.

- `private-prefix`: every top-level function, class, constant and type alias is either listed in
  `__all__` or starts with one underscore. PEP 8 defines the prefix; nothing standard checks that it
  agrees with `__all__`, and basedpyright `reportPrivateUsage` only enforces the other direction.
- `private-before-public`: every `_` definition sits above the first public one. Python resolves
  names at call time, so the order carries no runtime meaning. It is fixed so a reader meets the
  helpers before the code that uses them, the same order the TypeScript and Bash presets require.

## Totality

### The variant problem

`yap-text-inference` has four mutually exclusive dependency extras (`local`, `vllm`, `trt`,
`llmcompressor`) plus a `modelopt` group, with ten declared conflicts, and three separate typecheck
configurations (`quality/config/typecheck/{trt,vllm,llmcompressor}.json`) plus a base
`pyrightconfig.json`. A file that only imports `tensorrt_llm` cannot be type checked in the `local`
environment.

The preset models this rather than ignoring it:

```toml
[[python.variant]]
name    = "local"
extras  = ["local"]
paths   = ["src/**", "config/**", "tests/**", "quality/**", "docker/**",
           "!src/engines/trt/factory.py", "!src/engines/vllm/factory.py",
           "!src/server/trt.py", "!src/server/vllm.py", "!src/quantization/vllm/quantize.py",
           "!src/scripts/guard.py", "!src/server/listeners.py", "!src/telemetry/cuda.py"]

[[python.variant]]
name    = "trt"
extras  = ["trt"]
paths   = ["src/engines/trt/factory.py", "src/server/trt.py",
           "src/scripts/guard.py", "src/server/listeners.py", "src/telemetry/cuda.py"]
platform = "linux"

[[python.variant]]
name    = "vllm"
extras  = ["vllm"]
paths   = ["src/engines/vllm/factory.py", "src/server/vllm.py",
           "src/scripts/guard.py", "src/server/listeners.py", "src/telemetry/cuda.py"]
platform = "linux"

[[python.variant]]
name    = "llmcompressor"
extras  = ["llmcompressor"]
paths   = ["src/quantization/vllm/quantize.py"]
platform = "linux"
```

Consequences:

- One type-check task per variant, each with its own resolved environment.
- **The coverage check unions the variant path sets and requires every `.py` file to appear in at
  least one.** A file in no variant is `partial` for `types`. The reference repository routes nine source
  files out of the root `pyrightconfig.json` into three variant configs and asserts with an
  integrity script that every file belongs to one. The coverage check is that script.
- A file in two variants is type checked twice, which is correct and which catches
  conditional-import mistakes. Three files above are in both GPU variants for that reason.
- `platform = "linux"` marks a variant whose extras only resolve there. On macOS those type
  checks report `skipped (platform)` and pass, per [09-gates.md](09-gates.md).

That single rule replaces `quality/repository/integrity/typecheck.py`, and the mutually exclusive
extras are why "one resolved environment" is not possible here: there are four.

### Other habitual exclusions

| Habit                                                   | Reference evidence                                        | gspot                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `__init__.py` files are trivial and unlinted            | 24 `__init__.py` files under `quality/`                   | Claimed. `INP` and the structure engine's `trivial-file` rule apply, with a package-marker exemption for a genuinely empty `__init__.py` |
| Tests are excluded from the strict rule set             | Not in this repository, which includes `tests` in pyright | Claimed by every tool. The `PT` family is on. The one relaxation is Ruff `D` off for `tests/**` through the generated per-file ignores. |
| `deptry` per-rule ignores grow without bound            | `DEP002` lists 38 packages                                | Each ignore becomes an `[[exception]]` entry with a reason, listed in every run report.                                                   |
| `vulture` `ignore_names` and Ruff `extend-ignore-names` | Both present and empty, waiting to be filled              | `structure.add.entry_points` with a reason per symbol, and the Ruff list generated from it                                               |

## Original code: zero

The full mapping. This is the R17 deliverable.

## The bespoke layer that goes away

`yap-text-inference/quality/` is 139 files, 100 of them Python. What survives and what does not:

| Path                                                                              | Fate                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality/python/rules/{module_length,function_length}.py`                         | pylint `max-module-lines`, Ruff `PLR0915`                                                                                                                                                                                                                   |
| `quality/python/rules/{prefix_collisions,single_file_folders}.py`                 | The shared directory walk, the one piece of original code, shared with every language                                                                                                                                                                       |
| `quality/python/rules/all_at_bottom.py`                                           | ast-grep rule file                                                                                                                                                                                                                                          |
| `quality/python/rules/imports/{boundary,cycles,graph}.py`                         | `import-linter` contracts                                                                                                                                                                                                                                   |
| `quality/python/rules/imports/{deferred,exports,layout}.py`                       | Ruff `TC`, plus ast-grep rule files for the export rules and for the length-sorted import layout. Ruff `I` cannot express that layout, so `I` stays off and the rule file owns it. |
| `quality/python/rules/runtime_singletons.py`                                      | Kept as a `[[check]]` in `gspot.toml`.                                                                                                                                                                                                                      |
| `quality/repository/naming/**` (14 files)                                         | pylint regexes plus ls-lint, rendered from the shared policy document. No extractor.                                                                                                                                                                        |
| `quality/shell/**` (19 files)                                                     | `language:bash`, shared. All nineteen become ast-grep rule files, tool configuration, or the shared counter. `complexity.py` reproduces as three ast-grep rules plus the finding counter, so even the one file with no off-the-shelf tool needs no original code. |
| `quality/repository/functions/**` (6 files)                                       | Structure engine                                                                                                                                                                                                                                            |
| `quality/repository/integrity/**` (7 files)                                       | Coverage plus `gspot generate --check`, except `config.py`, the assertion that `config/**` holds only constants, which becomes the ast-grep rule `declarative-config`.                                                                                        |
| `quality/repository/licenses/**`                                                  | `repository:licenses`                                                                                                                                                                                                                                       |
| `quality/security/**` (10 runners)                                                | `repository:secrets`, `repository:vulnerabilities`                                                                                                                                                                                                          |
| `quality/config/security/*/environment.sh` (7 files)                              | Deleted. Constants inline in their runner, per the findings rule.                                                                                                                                                                                           |
| `quality/lib/{diagnostics,files,json_config,languages,output,process,source}.py`  | Deleted. A utility bucket by another name.                                                                                                                                                                                                                  |
| `quality/config/typecheck/*.json`                                                 | `[[python.variant]]`                                                                                                                                                                                                                                        |
| `quality/config/naming/{policy.json,rules.py,schema.py}`                          | The shared naming policy document, plus its emitter                                                                                                                                                                                                        |
| `quality/config/python/{limits.py,rules.py,schema.py,imports.json,packages.json}` | The `[limits]` block plus `[[structure.contracts]]`                                                                                                                                                                                                         |
| `quality/config/duplication/{bash,python}.json`                                   | `repository:duplication`, one config                                                                                                                                                                                                                        |

**Total: 100 files of Python, none surviving as bespoke code.** What no tool expresses is a `[[check]]` until a rule file replaces it. The one piece of original code Python touches is the
directory walk for single-file folders and prefix collisions, which is written once in TypeScript
and shared by every language.

## Python-only repositories

`yap-text-inference` carries `package.json`, `bun.lock` and a `bun` pin solely to run
`markdownlint-cli2`, `prettier` and `jscpd`. A Python repository under gspot with the mise runner
pins Node as one more tool and installs gspot from npm through mise; the repository keeps no
`package.json`, `bun.lock` or `node_modules` of its own. Markdown linting, duplication detection
and prose come from gspot, and every Python tool comes from `uv run` against a pinned `uv.lock`.
The single binary that drops the Node pin follows, per D-34.
See [../08-tasks-and-tools.md](../08-tasks-and-tools.md).
