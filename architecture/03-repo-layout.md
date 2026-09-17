# Repository Layout and Names

This document holds the tree of `gspot` itself and the reason behind every name in it. It ends with
the rule that keeps the distribution from becoming a fifth `quality/` folder.

The prose follows ISO 24495-1: sentences of at most 25 words, paragraphs of at most four sentences,
active voice, present tense, no modal verbs. gspot enforces that on this folder. See
03-repo-layout.md.

## The tree

```text
gspot/
├── architecture/               design documents. This folder.
├── reference-rules/            the forks' rule files, input to the corpus merge. Deleted once it lands.
├── src/
│   ├── commands/               one module per command; argument parsing and output only
│   ├── detect/                 extension counts, shebangs, manifest dependency reads
│   ├── settings/               gspot.toml and the preset files: parse, merge, resolve a selection
│   ├── run/                    task graph, execution, run report, SARIF
│   ├── coverage/               tracked files, file listings, statuses
│   └── structure/              the ast-grep runtime, the finding counter, the directory walk
├── presets/                    one folder per preset kind, one file per preset
│   ├── language/               typescript.toml  python.toml  bash.toml  ...
│   ├── framework/              nextjs.toml  express.toml  fastapi.toml  ...
│   ├── library/  tool/  database/  platform/
│   ├── repository/             secrets.toml  naming.toml  structure.toml  ...
│   └── rules/                  the Markdown the assembler installs into a consumer,
│                               under the same kind names
│       ├── general/            rules that hold for every file
│       ├── language/           TYPESCRIPT.md  PYTHON.md  ...  plus language/naming/
│       └── framework/ library/ tool/ database/ platform/ shared/
├── ast-grep/                   one rule file per structural rule per language
├── eslint-plugin/              phase 2, and only if editor feedback earns a second engine
│
│                               below this line: what gspot writes into gspot,
│                               identical to what it writes into any other repository
├── gspot.toml                  the selection
├── mise.toml                   emitted by the mise runner
├── rules/  CLAUDE.md  AGENTS.md    assembled from presets/rules/
└── .gspot/                     generated tool configs, coverage table, run reports
```

The split at the line is the point. Everything above it is the distribution. Everything below it is
output, written by gspot, in the same shape it writes into a consumer. gspot's own repository is the
first repository gspot manages.

Two names appear twice, deliberately. `presets/rules/` is the Markdown the distribution ships;
`rules/` at the root is what the assembler produced for this repository. Source and output, the same
relationship as `presets/language/typescript.toml` and `.gspot/generated/eslint.config.js`.

One package. Nothing here is published separately, so nothing here is a workspace. The ESLint plugin
would be the one exception, since ESLint resolves a plugin by name, except that flat config also
accepts a plugin object, so a generated config imports it from `gspot` like anything else.

## Names, and why

Every name below was chosen against a rule, not by habit. The rules are the ones gspot ships: no
abbreviations, no vague containers, one word means one thing, and no borrowed jargon that carries a
different meaning elsewhere.

### The seven preset kinds

Seven kinds, defined in [02-model.md](02-model.md). Five things that read like kinds are settings,
and two candidate kinds carried invented names.

| Kind          | Selects by                                            | Example              | Claims files by |
| ------------- | ----------------------------------------------------- | -------------------- | --------------- |
| `language:`   | a file extension present in the tree                  | `language:python`    | extension       |
| `framework:`  | a dependency or an import                             | `framework:nextjs`   | path convention |
| `library:`    | a dependency                                          | `library:zod`        | path convention |
| `tool:`       | the tool's own file                                   | `tool:docker`        | path convention |
| `database:`   | SQL dialect or a connection string                    | `database:postgres`  | path convention |
| `platform:`   | the platform's config file                            | `platform:supabase`  | path convention |
| `repository:` | the consumer, for a concern that spans every language | `repository:secrets` | the whole tree  |

Names rejected, and the reason:

| Rejected                      | Reason                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aspect:`                     | Borrowed from aspect-oriented programming, where it means something else. Here it meant "the bucket for anything not tied to a language", which is the vague-container pattern the shipped policy bans. `repository:` has prior art: MegaLinter names this exact class of linter `repository_*`. |
| `doctrine:`                   | Invented. Nobody calls agent rule files doctrine. The kind is also unnecessary: rules arrive with `[rules] install = true`, and language and framework presets contribute their own rule files. Deleting the kind removes a concept.                                                                         |
| `lang:`                       | An abbreviation. `unicorn/prevent-abbreviations` is in the shipped TypeScript rule set, so the distribution cannot use one in its own vocabulary.                                                                                                                                                |
| `runner:mise`                 | A preset and a setting for one choice. `runner = "mise"` in `gspot.toml` already decides it.                                                                                                                                                                                                       |
| `ci:github`, `cd:github`      | Same duplication. `[gate] hooks` and `[gate] ci` are settings.                                                                                                                                                                                                                                                  |
| `bridge:megalinter`           | `bridge` says nothing about what runs, and the bridge itself was cut; see 20-tooling.md.                                                                                                                                                                                                                   |
| `editorconfig` as a preset name | The preset derives every formatter setting from one block. It does not run one tool. It is `repository:formatting`.                                                                                                                                                                                |

### The rules tree

| Name               | Holds                                                  | Rejected name, and why                                                                                                                      |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules/general/`   | rules that hold for every file in every language       | `rules/core/`. `core` is term 1 in the shipped banned-terms list. `general` is `slopshop`'s own choice and it says what the directory does. |
| `rules/language/`  | one file per language                                  | `rules/lang/`. Abbreviation.                                                                                                                |
| `rules/framework/`, `rules/library/`, `rules/tool/`, `rules/database/`, `rules/platform/` | one folder per preset, under the kind the preset is | `rules/framework/` for all of them. A reader who opened `rules/framework/zod/` learned that Zod is a framework. |
| `rules/shared/` | blocks that more than one preset installs: `http/`, `i18n/` | none                                                                                                                                        |
| `rules/project/`   | the consumer's architecture, boundaries and vocabulary | `rules/local/`. "Local" reads as local development or localhost. "Project" says whose rules these are.                                      |

The four directories are **layers**, not tiers. A layer has a name, so nobody counts. The generated
index states that the more specific layer wins, which no reference `CLAUDE.md` does.

### Source modules

| Name             | Holds                                                              | Rejected name, and why                                                                                     |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/commands/`  | one module per command                                             | `src/cli/`. An abbreviation.                                                                                 |
| `src/detect/`    | what languages, frameworks and tools a directory holds             | `src/scan/`. `scan` already names what a security tool does.                                                 |
| `src/settings/`  | `gspot.toml` and the preset files: parse, merge, resolve           | `src/overlay/`. Borrowed from configuration-layering tools. The file holds settings.                        |
| `src/run/`       | the task graph and its execution                                   | `src/runner/`. `runner` already names the mise, bun and npm choice. One word, one meaning.                   |
| `src/coverage/`  | tracked files, file listings, statuses                             | `src/census/`. A population metaphor for something everyone calls coverage.                                  |
| `src/structure/` | the ast-grep runtime, the counter, the directory walk              | `src/engine/`. A vague container.                                                                            |

Six modules, one package. Split a module into two when the second job inside it outgrows a file, not
before. `src/structure/` is the one to watch: the ast-grep runtime and the directory walk share a
folder today and have nothing else in common.

### What no name in this tree contains

Checked against the shipped policy, because the distribution obeys it.

Banned containers and role words: `core`, `common`, `generic`, `misc`, `shared`, `util`, `utils`,
`helper`, `manager`, `handler`, `processor`, `service`, `wrapper`, `lib`, `stuff`, `thing`,
`details`, `info`, `object`, `data`, `base`.

Banned adjectives and hedges: `enhanced`, `advanced`, `improved`, `smart`, `modern`, `final`,
`latest`, `old`, `ensure`, `maybe`.

The reference repositories carry
`quality/lib/{diagnostics,files,json_config,languages,output,process,source}.py`,
`quality/eslint/{nodes,paths}.js`, `quality/hooks/lib.sh`, `quality/shared/`, `quality/workspace/`
and `quality/projects/`. Each is a name this tree refuses.

## Why a monorepo of packages

Three reasons, each from evidence.

1. **A published package cannot rely on hoisting.** `yap-swift-app/quality/` imports 17 npm packages
   and declares 2. The other 15 resolve from four manifests. One package per concern makes the graph
   checkable by `knip`.
1. **Presets must drop cleanly.** A consumer who selects `language:python` pulls no Swift grammar and
   no Next.js configuration. Optional peer dependencies per preset deliver that, and presets have to be
   separate packages for it to work.
1. **Rule files and the naming policy are data with three readers each**: the tool, the ESLint
   plugin, and the configuration emitters. Data versions and publishes on its own schedule.

A consumer still installs one name. `gspot` depends on `@gspot/settings` and resolves preset packages
from the selection.

## Distribution

| Surface       | Command                    | Reason                                                                                                            |
| ------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| npm registry  | `bun add -d gspot`         | Primary. Presets publish under the `@gspot` scope.                                                                  |
| mise          | `mise use npm:gspot@<version>` | Node arrives as a mise pin. In v0 that is how a Python-only repository installs gspot; the release asset without Node follows, D-34. |
| Single binary | `bun build --compile`      | The mise asset. Native grammar modules are the open constraint. D-34.                                             |

The Python case is concrete. `yap-text-inference` carries a `package.json`, a `bun.lock` and a bun
pin. It needs all three to run three JavaScript tools. Under gspot that repository pins Node through
mise, installs gspot from npm the same way, and keeps no `package.json` or `node_modules` of its own.

## What a consumer's tree looks like after init

```text
<repo>/
├── gspot.toml              written once by init, owned by the consumer forever
├── gspot.local.toml        untracked, optional, machine-local skips
├── .gspot/
│   ├── generated/          every rendered tool config. Tracked. Never edited.
│   ├── tools.lock          resolved versions, checksums, per platform
│   ├── coverage.json       the full path table. Tracked.
│   ├── baseline/           one file per rule with a baseline. Tracked.
│   └── run/                run reports. Untracked.
├── .mise/tasks/gspot/      emitted when runner = "mise"
├── CLAUDE.md               assembled, when [rules] install = true
├── AGENTS.md               assembled, when [rules] install = true
├── rules/                  assembled, when [rules] install = true
│   └── project/            the consumer's own, never overwritten
├── eslint.config.js        a stub that re-exports the generated config
└── .editorconfig           derived from one [format] block
```

Four properties hold.

- **A human edits `gspot.toml` and `rules/project/` only.** Every file under `.gspot/generated/`
  opens with a header naming the command that wrote it.
- **Generated configuration is tracked.** Editors, language servers and `bunx <tool>` all discover
  configuration by walking up from the file.
- **A hand edit fails the next run.** `gspot generate --check` re-renders and compares bytes.
- **`rules/project/` survives every upgrade.** It holds the project's own architecture, and an
  upgrade that rewrote it would be a defect.

## Self-hosting

gspot lints gspot with the presets it ships, at the strictness it ships, with no exemption block. This
is a release gate.

**The order is fixed: build the tool, then install it here.** Nothing at the root
of this repository is written by hand. `gspot.toml` is written by `gspot init`,
every tool configuration by `gspot generate`, every task and hook by the runner
emitter, and the rule files by the assembler. Until gspot can run, this
repository has no gate, and that is the honest state. A hand-written
configuration at the root would be the first exception to the rule the tool
exists to enforce.

### The selection

`gspot.toml` at the repository root, with no `[[exception]]` entries:

```toml
version = 1
runner  = "mise"
[rules]
install = true

[gate]
hooks = true
ci    = "github"

presets = [
  "language:typescript", "language:bash", "language:markdown", "repository:configuration",
  "repository:structure", "repository:naming", "repository:prose",
  "repository:formatting", "repository:spelling", "repository:secrets",
  "repository:vulnerabilities", "repository:dependencies",
  "repository:licenses", "repository:commits", "repository:duplication",
]

[[declare]]
as         = "vendored"
paths  = ["prose/styles/Google/**", "prose/styles/write-good/**",
          "prose/styles/proselint/**", "prose/styles/RedHat/**"]
reason = "Pinned upstream Vale packages, fetched by gspot install"

[[declare]]
as         = "partial"
paths  = ["src/coverage/ignore-*/**"]
reason = "Trees built to be wrong, so the ignore replay has something to disagree with"

```

No `[[exception]]` entry is the commitment. The distribution cannot loosen a rule it ships without
an exception visible in review, and needing one is the signal that the rule is wrong.

### What self-application costs

The naming policy applies to gspot's own identifiers and paths. From
[12-structure-and-naming.md](12-structure-and-naming.md), the constraints this puts on the
implementation, each one a thing the reference repositories did and gspot cannot:

| Banned construct                                     | Reference example                                                                                                          | gspot must instead                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A utility bucket                                     | `quality/lib/{diagnostics,files,json_config,languages,output,process,source}.py`, seven files                              | Put each function with the concern that owns it. If no concern owns it, the function is speculative.           |
| `helper`, `util`, `manager` in a name                | `quality/hooks/lib.sh`, `quality/eslint/{nodes,paths}.js`                                                                  | Name the behaviour. `lib.sh` becomes `steps.sh` if it holds step execution.                                    |
| `common`, `shared`, `core` as a directory            | `quality/shared/`, dropped on the audited branch and still present in two other forks                                      | One folder per concern, which the reference audit already concluded was right                                  |
| A single-file folder                                 | `quality/nginx/`, `quality/hooks/`, `quality/prose/`, each with one file and each on an allowlist                          | Do not create the folder                                                                                       |
| A call-through file                                  | `api/eslint.config.js`, a one-line re-export of a file under `quality/`, violating the repository's own `no-trivial-files` | Stub configs are generated artifacts with a provenance header, exempt by construction rather than by allowlist |
| `policy` meaning four things                         | flat configs, constant tables, a loader, and rule wiring, all named `policy`                                               | One word, one meaning, enforced by the naming policy's duplicate-concept check and by review                   |
| Six `index.js`, six `run.sh`, three `environment.sh` | across one `quality/` tree                                                                                                 | The prefix-collision rule at threshold 2 fails this, and gspot ships that rule                                 |
| `.mjs` among `.js` in a `"type": "module"` package   | seven of 114                                                                                                               | One extension. `ls-lint` enforces it.                                                                          |
| Constants hoisted out of their only caller           | about sixty in `quality/config/security/*.sh`, three declared twice                                                        | Inline at the use site. The rule that forced the hoisting is not ported.                                       |
| A dead module                                        | `quality/functions/swift.js`, never imported                                                                               | `knip` plus the orphan rule in the preset loader                                                                 |

These are not hypothetical. Each row is something the design would do by default if the policy did
not apply to it, because each row is what a careful team did four times.

### Prose self-application

`repository:prose` runs over gspot's own Markdown, its own code comments, and this architecture
folder.

- **Vale reads every comment in every source file**, per [11-prose.md](11-prose.md), with
  every rule on. The distribution does not adopt its own strict style through
  a baseline; it ships clean.
- **`architecture/` is outside the gate.** It is design notes, not the product.
  The tool's own source, its rule files and its documentation are in scope.
- **`rules/` is in scope.** The corpus obeys the writing rules it states, which the reference corpus
  does not: 145 uses of `should` and 86 of `may` in one fork against a rule banning both.
- **Fenced code blocks are linted as code.** `@eslint/markdown` and the `md/fenced-code-lints` check
  extract every fence and run the owning language's checks. This folder contains TOML, YAML, JSON,
  Bash and TypeScript fences, and every one of them has to parse.

### ISO 24495 alignment

The instruction names ISO 24495. The standard (ISO 24495-1:2023, plain language principles and
guidelines) states four outcomes: readers can **find** what they need, **understand** it, **use**
it, and do so the first time. It is principle based, not rule based, and no Vale style package
implements it.

What Vale can do, verified: it has an `extends: readability` extension point supporting
Flesch-Kincaid, Gunning-Fog, Coleman-Liau and others with a grade threshold and a scope, plus
`extends: metric` for a custom formula, alongside `existence`, `substitution`, `occurrence`,
`consistency` and `conditional`.

So gspot ships `gspot`, a style that encodes the measurable consequences of the standard's
four principles:

| ISO 24495 principle                   | Measurable consequence                                                                                                                        | Vale rule                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Readers can find what they need       | Every document over a threshold has a contents list whose entries match its headings; headings are descriptive noun phrases, not single words | `md/toc-accurate`, plus `occurrence` on heading length                                                     |
| Readers can understand what they find | Sentence length at most 25 words; list items at most 20; paragraphs at most 4 sentences; one idea per paragraph                               | `occurrence` rules, already specified as `sentence-length`, `step-length`, `paragraph-length`              |
|                                       | Reading grade at or below a declared level, measured per paragraph                                                                            | `extends: readability`, Flesch-Kincaid, grade threshold per document class                                 |
|                                       | Plain words over inflated ones                                                                                                                | `substitution` with the `RedHat.SimpleWords` and `write-good.TooWordy` lists, plus the project reject list |
|                                       | Active voice, concrete actors                                                                                                                 | `Google.Passive`, `write-good.ThereIs`                                                                     |
| Readers can use what they find        | Instructions are imperative; conditions precede actions; no modals                                                                            | `gspot.modals`, plus an `existence` rule for a sentence that opens with a modal                      |
| Readers can evaluate it               | Present state only; no undated future claims; a version or date where a claim depends on one                                                  | `gspot.time-words`, `gspot.future`, `gspot.dates`                                      |

Stated honestly: **this is an alignment, not a certification.** ISO 24495-1 is a principles document
whose conformance is assessed by human review, and the readability metrics are proxies with known
weaknesses. `gspot` claims to enforce the measurable consequences of the four principles and
nothing more, and the style file says so in its own header. Anything else would be the
enforcement-on-paper pattern this whole design exists to remove.


### How this is tested

gspot cobbles together forty tools it did not write. That bounds what is worth testing: not whether
ESLint finds bugs, which is ESLint's problem, but whether gspot hands it the right files with the
right configuration and reads its answer correctly.

Almost everything gspot does is a pure function over data, and those are ordinary unit tests:

| Tested | Input | Assertion |
| --- | --- | --- |
| Detection | a file list plus manifest contents | the proposed preset selection |
| Settings merge | preset defaults, scope settings, root settings | the resolved value and its source |
| Config rendering | a resolved selection | the rendered file, byte for byte, as a snapshot |
| Output parsing | recorded real output from each tool | the finding list, including the zero-findings and tool-broke cases |
| Coverage statuses | a claim set and a path list | the status per path |
| Task graph | a selection and a stage | the node order and what runs in parallel |

Two things need a real tool and a real tree, and only two:

1. **Ignore-semantics replay.** gspot replays each tool's ignore rules to predict which files it
   reads. That prediction has to agree with the tool. One small tree per ignore idiom, run against
   the real binary, lives beside the test in `src/coverage/`. This is the test the reference set did
   not have when a `.sqlfluffignore` entry silently hid 58 of 83 files.
1. **The self-lint.** `gspot check` on `gspot`, with the presets shipped so far. It proves the whole
   path end to end: detect, resolve, render, invoke, parse, report. It is the first test to run after
   the first preset works, and it runs on every change after that.

The self-lint is the integration test and there is no separate set of golden repositories. A tree
built to mirror `yap-swift-app` proves the tool works on `yap-swift-app`, which is the overfitting
this design exists to avoid. What the self-lint cannot reach is a language gspot's own repository
does not contain, so a preset for Swift or SQL is proven by running it against a real repository
that has them, by hand, once, and recording the result in the pull request.

Plus a fourth, specific to this document:

| Assertion     | Fails when                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Self-gate** | `gspot check` on `gspot` fails, or `gspot.toml` contains an `[[exception]]` entry |

### When self-application fails

A rule too strict for gspot's own code is too strict to ship. When self-application fails, exactly
two responses are permitted:

1. **Fix gspot's code.** The default, and the answer in almost every case.
1. **Change the rule for everyone**, with the reason recorded in the decision log.

Adding an exemption for gspot is not a response. That is the move every reference repository made,
and it is how a lint package ends up with `eslint:recommended` plus six rules while shipping nine
plugins to its consumers.

## Ten rules for this repository's own code

### 1. A module exists because something imports it

**Observed:** `quality/functions/swift.js` is never imported; `functions/index.js` returns an empty
list for Swift. `quality/security/semgrep/{run,retry,projects}.sh` and
`quality/security/codeql/{run,scan,database,sarif-filter}.sh` are reachable from nothing.
`dotenv-linter` is configured and never runs. `codeql/api-false-positives.json` is never read
because the reader looks for `false-positives.json`.

**Rule:** a file lands in the same commit as its caller. `knip` plus the preset reader's orphan rule
enforce it, and a file written "for the next phase" is written in the next phase.

### 2. No utility bucket, ever

**Observed:** `quality/lib/{diagnostics,files,json_config,languages,output,process,source}.py`,
seven files. `quality/eslint/{nodes,paths}.js`. `quality/shared/`, `quality/workspace/`,
`quality/projects/` in one fork, deleted in the next and still referenced by eight dead globs.

**Rule:** every function lives with the concern that owns it. A function with no owning concern is
speculative and is not written. The banned-term policy blocks the names (`lib`, `util`, `common`,
`shared`, `core`, `helper`), and the review question is "which concern owns this", not "where should
this go".

### 3. A constant lives at its only use site

**Observed:** about sixty string constants in `quality/config/security/*.sh`, including
`CODEQL_SWIFT_LANGUAGE='swift'` and `LICENSE_CHECKER_ALLOW_MODE='only-allow'`, hoisted out of their
single caller to satisfy a check that forced scalar-only modules into `config/`. Three declared
twice, once in shell and once in JavaScript. `PACKAGE_JSON_LINT_MESSAGES`, a table of error strings,
in a config module.

**Rule:** a constant with one reader is inline. `config/` holds values a maintainer would tune, and
nothing else. Diagnostics carry their text where they are raised. The inverse check that caused this
is explicitly not ported, per [01-findings.md](01-findings.md).

### 4. One fact, one source, and the source is the conventional file

**Observed:** the Node version stated four ways: `mise.toml` pins 22.13.1, `.nvmrc` says 20, five
`engines.node` fields say `>=22.0.0 <23.0.0`, and `quality/config/repository.js` declares a
constant. The nginx image tag stated in `docker-compose.yml` and restated in
`quality/config/nginx.js`. Four Trivy settings living in a deploy script's config, read by a
scanner. `.editorconfig`, `.prettierrc.json` and markdownlint `MD007` agreeing about indentation by
hand, with a comment saying so.

**Rule:** a fact has one home. A preset that needs a product fact reads it through a declared
the check that needs it, per [07-config-generation.md](07-config-generation.md). A value two tools need
is derived from one block, never stated twice.

### 5. One concept, one implementation, one name

**Observed:** `--scope` parsing implemented three times in one tree (`shell/scope.js`,
`naming/policy.js`, `functions/index.js`). The project map spread over five config files.
`stripShellComments` copied byte-identical into a second file. The word `policy` naming four
different kinds of thing: flat configs, constant tables, a loader, and rule wiring. Six `index.js`,
six `run.sh`, three `environment.sh` in one tree. Eighteen structural rules implemented three times
across three repositories.

**Rule:** before writing a function, find the existing one. Before naming a module, check what the
word already means in this repository. The prefix-collision rule at threshold 2 catches the
file-name half automatically.

### 6. A check is not a check until a task runs it

**Observed:** 39 Semgrep rules, a pinned binary, a runner, a retry wrapper and an environment file,
with zero invocations from any hook, task, script or plugin. Coverage thresholds of 80 percent that
run only under an environment variable nothing sets. `[smells] mode = "block"` beside a command that
exits zero on 119 findings. `ios:lint` in no hook.

**Rule:** a check enters the graph in the same commit as its implementation, or it does not enter.
The preset reader refuses a check reachable from no task, which makes this mechanical rather than a
matter of discipline.

### 7. Exit zero means it ran

**Observed:** two checks that print a warning and return success when the Docker daemon is down, and
did so during the audit, in both hooks, with coverage reported as complete.

**Rule:** every check returns `ran`, `cached`, `skipped(reason)` or `failed`. A function that cannot
do its job returns a failure or a skip. There is no third path, and there is no `console.warn`
followed by `return`.

### 8. A parse error is a failure, not an empty result

**Observed:** a tree-sitter `ERROR` node on one line of one shell file silently removed four
functions from three checks. The previous implementation found them; the new one found none of them;
nothing reported a problem.

**Rule:** a function that parses input rejects malformed input loudly, naming the path and the
offset. An empty result is a valid answer only when the input is genuinely empty, and the difference
is asserted in a test.

### 9. Every glob matches something, and every path exists

**Observed:** eight globs under `shared/`, `workspace/` and `projects/` in `config/eslint.js`
pointing at deleted folders, so the exemptions they define never fire. `.prettierignore` naming a
moved file. `.gitignore` un-ignoring a deleted path. `ios/.swiftlint.yml` carrying a comment that
names a directory that no longer exists. Two `knip.json` files naming `eslint-config.js` where the
file is `eslint.config.js`. A README describing a layout two refactors old.

**Rule:** `gspot generate --check` asserts every glob matches at least one path and every referenced file
exists, on gspot's own tree, at pre-commit. A forward-looking glob is marked as such with a reason.

### 10. Delete the thing you replaced

**Observed:** `unused-functions.js` keeping a byte-identical copy of a function that moved. Half the
shell checks on tree-sitter and half still on a declaration regex, so two definitions of "a
function" coexist. `license-checker` 25.0.1 unmaintained in one place and
`license-checker-rseidelsohn` in another. markdownlint invoked twice per push. `madge` declared as a
dependency in another repository where `import-x/no-cycle` already covers cycles.

**Rule:** a replacement is complete in one commit, or it is not started. The `marketing` banned-term
group exists because incomplete replacements name themselves `enhancedX`, and this rule is the human
half of the same policy.

## Shape constraints

Beyond the ten rules, five constraints on the code's shape, chosen because the reference set
violated each one at cost.

| Constraint                                                                                                                                                                                                                               | Reason                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No file over 300 lines, no function over 60, no more than 5 parameters, cognitive complexity at most 8.**                                                                                                                              | The limits gspot ships. `quality/security/codeql/scan.sh` is 150 lines against a shell limit of 140, in the repository that set the limit.                                                                                                                               |
| **The preset manifest is data, not code.** A preset contributes through declared fields. When a preset needs behaviour the manifest cannot express, the manifest gains a field and every preset gets it, rather than that preset gaining a script. | `slopshop`'s `quality/` has sixteen application-specific integrity checks that grew because there was no declarative setting for them.                                                                                                                                       |
| **One adapter interface.** A rule never reaches past the adapter to the grammar.                                                                                                                                                    | Three repositories wrote per-language rule implementations and got three divergent behaviours for one rule name.                                                                                                                                                         |
| **The coverage check never imports a preset, and a preset never imports the coverage check.** Presets declare file listings; the coverage check runs them.                                                                                            | `quality/` imports nothing from the products, which is the one boundary the reference set got right, and it is worth keeping explicitly.                                                                                                                                 |
| **No dependency resolves by hoisting.** Every package declares what it imports.                                                                                                                                                          | `quality/` imports 17 npm packages and declares 2. Fifteen resolve through hoisting from four manifests, `syncpack` exists largely to keep those copies equal, and every `knip.json` lists the same plugins under `ignoreDependencies` to silence the resulting reports. |

## The rule that keeps this tree honest

One question, asked of every addition to this repository, in this order:

1. **Does a maintained tool already do this?** If yes, configure it.
   [12-structure-and-naming.md](12-structure-and-naming.md) has the search list.
1. **Can a declarative rule file do this?** ast-grep YAML, an esquery selector, a SwiftLint regex, a
   pylint regex, an ls-lint rule. If yes, write data.
1. **Can a documented plugin API do this?** An ESLint rule, a sqlfluff rule. If yes, write inside
   their framework.
1. **Only then**, write original code, record the search in the decision log, and expect to be asked
   why at the next release review.

The failure mode this guards against is specific and observed four times: a team with high standards
and a real problem writes a careful analyzer, then another team does it again, then the analyzers
diverge, and five years later nobody can say which one is right. The distribution exists so that
happens once, in configuration, in public.
