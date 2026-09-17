# Handoff

Read this before anything else in `architecture/`. It says how to work on gspot, what is known
broken, what v0 is, and what must not be built yet.

## 1. Rules of engagement

These exist because they were violated, and the result was deleted.

**Detect, never assume a layout.** No document, manifest or rule may contain a path glob taken from
a reference repository. `paths = ["**/src/**/*.ts"]` is a defect: the next repository keeps its
source in `app/`, `lib/` or nowhere in particular. gspot asks the real tools which files they read
(see `05-coverage.md`) and asks the repository what it is (see section 3 below). Anything that
hardcodes structure is overfitting and gets cut.

**The reference repositories are evidence, not targets.** `yap-swift-app`, `yap-text-inference`,
`yap-landing` and `slopshop` exist to answer one question: which tools and rules are worth shipping,
and at what strictness. They do not define the shape of the output. A design that only works on
those four is worthless; the tool has to work on a repository nobody here has seen.

**No artefacts before the engine.** Do not generate preset manifests, ast-grep rule files, tool
lockfiles or sample trees until the code that consumes them runs and is tested on one preset. Generating
forty of anything from prose produces confident, wrong files that nobody reads.

**Do not crawl repositories to answer a design question.** Reading four full repositories to settle a
version number or a rule threshold costs more than the answer is worth. Read the one file that has
the answer.

**Scope is v0 (section 3). Anything past it waits.**

**`17-lifecycle.md` governs.** It is the adoption flow end to end: what gspot may know, what it
writes, every question, every no, and what happens to a repository that already has linting. Where
another document disagrees with it, it is right and the other is stale.

## 2. Known defects

Gathered from a full read of all 31 documents. Not yet fixed. Fix them before building on top of
the document they are in.

### Counts in prose

Numbers that summarised a list below them have been removed, because the number is the only part
that can go stale. A count that is a fact about a reference repository is kept and cited. If you add
a number to a sentence, the list it counts must be in the same paragraph, or it will be wrong within
a month.

### Numbers about the reference repositories

All four repositories have now been checked against the claims the documents make about them, and
the wrong ones are corrected. The verified figures for `yap-swift-app`, which most examples use:

| | |
| --- | --- |
| tracked files | 3,330 |
| `.ts` / `.swift` / `.sql` / `.sh` / `.png` / `.pgsql` | 836 / 724 / 85 / 99 / 982 / 9 |
| mise task files, git hooks, CI | 102, 3, none |
| rule corpus | 11 files, 13,940 lines |
| local ESLint rules | 19 |
| `lint:justify` suppressions, of which `N/A` | 23, 9 |
| Semgrep rules, invocations | 39, 0 |
| gitleaks baseline entries | 36 |

For `slopshop`: sixteen integrity checks under `quality/workspace/integrity/`, thirteen
`eslint-plugin-zod` rules, a 27-line `CLAUDE.md` with a 177-line `rules/general/GENERAL.md`, nine
files under `rules/nextjs/`, one extensionless tracked file, and CSS modules rather than a single
stylesheet.

A number about a reference repository is evidence and may stay in the prose, but check it before you
rely on it: the four that were checked had errors in every document that cited them.

### Corrupted source text

The rule corpus under `reference-rules/` was damaged by an unreviewed global find-and-replace before
this repository existed. Known substitutions:

| In the files | Should be |
| --- | --- |
| `item` | `object` (`z.item({...})` is not a Zod call) |
| `command` | `control` ("access command", "inversion of command", "command flow") |
| `configured` | `dynamic` ("configured SQL", "configured imports") |
| `project` | `custom` |
| `package coordinator` | `package manager` |
| `encodedBytes` | `base64` |

These survive into `reference-rules/merged/`, which is what the assembler ships. They must be
repaired before the corpus is used. No per-file list exists yet; producing one is a small, bounded
task and worth doing by hand.

### Open contradictions

- `reference-rules/comfyui-reactor-connector/` was deleted. The shell-rule citations that named it
  are now generic, but `framework:comfyui` still exists in `14-framework-presets.md` and
  `13-language-presets/javascript.md` still counts its files. Restore the fork or drop the preset.
- "The consumer declares gspot and nothing else" is stated as an absolute somewhere in the
  dependency discussion and is contradicted by the runner sections. Verify and resolve.

### Mechanisms that survived the cut and probably should not have

Not defects, but the cost has never been justified against `00-scope.md`:

- Eleven `comfyui/*` checks including workflow-graph validation.
- Eight `library:` presets that are each one ESLint plugin and one Markdown file, plus a preset kind
  invented to hold them.
- Scope invalidation keyed on every preset file when gspot lints itself.

## 3. What v0 is

From `21-roadmap.md`, narrowed.

**Commands:** `init`, `generate`, `check`, `coverage`, `report`, `fix`. Nothing else.

**Vocabulary, settled.** One word, one meaning. A check declares what it `inspects`
(`format`, `syntax`, `types`, `security`, …, sixteen of them). A `[[declare]]` entry says what a
path is with `produced_by` when a task writes it, or a `reason` when it is not the project's to
fix. There is no `kind` and no `as`.
There is exactly one way to say
"this check does not apply here", and it is `[[exception]]` with a reason. A check takes `one-file`,
`file-list` or `project`. `scope` only ever means a subtree of the repository. `product` holds
facts the product owns; `project` only ever names the consumer's rule layer. The word `kind` is
not used for anything.

**Gate:** hooks, CI, both or neither. Two independent settings, `[gate] hooks` and `[gate] ci`.
Asked at `init`. Never created without a yes. Every check runs locally; nothing is CI-only.

**One language: TypeScript.** D-34 and D-05. gspot ships as an npm package. The only native
dependency is `@ast-grep/napi`, a prebuilt module Node loads. The tools gspot drives are written in
Go, Rust, Python and Swift; gspot invokes them and does not contain them. Do not add a second
language, a second toolchain or a second release artefact to the build.

**Detection.** Two mechanisms, both a few dozen lines of the language we are already writing:

1. *Languages*: count extensions over the tracked file list, and read the shebang of files without
   one. That is the whole mechanism. Do not reach for `linguist` or `enry`: they exist to classify
   every file on GitHub and disambiguate `.h` between C and C++, and `enry` is Go, which is a second
   toolchain for a question an extension map answers.
2. *Frameworks, libraries and tools*: read the dependency list in whatever manifest exists.
   `next` in `package.json` means Next.js. `fastapi` in `pyproject.toml` means FastAPI. Same for
   `Package.swift`, `go.mod`, `Cargo.toml`, `Gemfile`. A tool's own config file at a conventional
   path means that tool. This is reading a manifest, not parsing code.

Detection proposes; the person decides. It never silently enables anything.

**The install conversation.** `init` prints what it found, then asks:

1. These tools are already configured here. Replace them with gspot's configuration, keep them as
   they are, or keep them and add them to the gate as a `[[check]]`?
2. Install git hooks?
3. Set up CI? If a CI configuration exists, the proposal is to replace its lint job; if none exists,
   the proposal is no.

`--yes` takes every proposal. Every question has a flag. With no terminal and no flag, exit 2 and
name the flag.

**Done means:** a person runs one command in a repository nobody here has seen, answers three
questions, and gets a working gate. Not: a repository that looks like one of the four.

**How it is tested.** gspot orchestrates forty tools it did not write, so the testable surface is
not "does ESLint find bugs" but "does gspot hand it the right files and read its answer". Almost
everything is a pure function over data and gets an ordinary unit test: detection, settings merge,
config rendering as a snapshot, output parsing against recorded real tool output, coverage status
computation, task-graph ordering. Two things need a real tool and a real tree. The ignore-semantics
replay, which must agree with the tool it imitates, tested against the real binary on a small tree
per idiom. And the self-lint, `gspot check` on `gspot`, which proves the whole path end to end and
runs on every change. A preset for a language this repository does not contain is proven once by
hand against a real repository that has it. See `03-repo-layout.md`.

## 4. Do not build these yet

Each was generated once from prose and deleted. The reason is the same in every case: the thing that
consumes them does not exist, so there is nothing to check them against.

- **Preset manifests.** The shape is in `04-presets.md`. Write one, for one language, when the
  loader that reads it runs. Not forty from documents.
- **ast-grep rule files.** Write one when the structure engine can execute it against a fixture.
- **A tool lockfile with pinned versions and checksums.** Pin when `install` can verify.
- **Sample trees.** The only ones that exist are the small per-idiom trees the ignore replay needs,
  and they are written with the replay, in the same commit. There is no set of golden repositories:
  `gspot check` on `gspot` is the integration test.
- **CI emitters for providers nobody here uses.** One emitter, for one provider, until a second is
  asked for.

If a document promises one of these and a person asks for it, the answer is which phase it belongs
to, not a generated file.
