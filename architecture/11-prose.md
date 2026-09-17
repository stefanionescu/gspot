# Prose Linting With Vale

Requirement R6. The `yap-swift-app` plan for this is the most carefully verified document in the
reference set: every tool fact in it was checked against Vale 3.21.0 on 2026-09-16. This design
adopts it, with four changes that make it installable rather than project-specific.

## The verified Vale behaviour, unchanged

These facts drive the design and were established by testing, not by reading documentation.

| Fact                                                                                               | Consequence                                                             |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Exit code 1 only on `error` level alerts                                                           | The runner fails on any printed alert instead of trusting the exit code |
| No global option forces every rule to `error`                                                      | Same                                                                    |
| TypeScript, JavaScript and Swift comments parse natively                                           | Passed as files                                                         |
| Only comments are linted in code, never strings                                                    | Error and log message text needs a different owner                      |
| Markdown code spans, code blocks and front matter are skipped                                      | Backticked paths and identifiers pass in documentation                  |
| Shell and SQL have no Vale grammar                                                                 | Piped through stdin under a borrowed grammar                            |
| `.mjs` is not recognised, so the whole file is linted as prose                                     | Piped through stdin as `.js`                                            |
| A `[formats]` code-to-code mapping silently skips the file                                         | Never used                                                              |
| Shell piped as `--ext=.rb` lints full-line and trailing comments only                              | Chosen for shell. Python also flags heredoc lines, so it is rejected.   |
| SQL piped as `--ext=.lua` lints `--` comments, including inside PL pgSQL bodies, and skips strings | Chosen for SQL. Misses `/* */`, which the reference tree has none of.   |
| In-text directives such as `<!-- vale off -->` work in Markdown only                               | Code comments have no inline way out, which is a feature                |
| Backtick spans and URLs inside code comments are linted as prose                                   | Needs `TokenIgnores`, verified at install                               |
| The qlty Vale plugin is pinned to 3.13.0 and runs on every file type                               | Not used. It would lint shell and YAML as whole files.                  |

## The standard: ASD-STE100 at the sentence, ISO 24495 at the document

Two standards, one style, no overlap. The reference corpus already names both:
`TALKING.md` says "use ASD-STE100", and the documentation rules cite ISO
24495-1. They govern different levels and are enforced together.

| Level | Standard | What it gives | Enforced by |
| --- | --- | --- | --- |
| Sentence | **ASD-STE100** (Simplified Technical English) | Concrete, mechanisable writing rules: at most 20 words in an instruction and 25 in a description, one instruction per sentence, active voice, present tense, no modal verbs, no gerund as a verb, one approved meaning per word | Vale `occurrence` and `existence` rules in the `gspot` style |
| Document | **ISO 24495-1** (plain language) | Reader-first structure: readers find what they need, understand it, use it. Contents lists, descriptive headings, one idea per paragraph, a reading-grade ceiling | Vale `readability` and the markdown structure checks |

STE's approved-word dictionary is copyrighted and is not vendored, which the
reference plan already concluded. `RedHat.SimpleWords` and `write-good.TooWordy`
approximate it, and the project vocabulary supplies the technical terms STE
leaves to the domain.

The two do not conflict. STE is the stricter subset at the sentence, and ISO
24495 covers what STE does not: how a document is organised so the sentence can
be found. Everything gspot writes or ships is held to both: rule files, comments,
generated documentation, terminal output, error messages, and this design.

## Four changes from the reference plan

### 1. One style

One Vale style, `gspot`, holds every rule at error level. The reference plan
proposed one project style with 28 rule files; the design keeps the rules and
drops the idea of splitting them by strictness, because adoption is per rule
through baselines and a second style only duplicates that. Rule names say what
they check: `dashes`, `symbols`, `placeholders`, `file-paths`, `modals`,
`hedging`, `time-words`, `sentence-length`, `paragraph-length`, `readability`.

`time-words` is the rule the reference corpus calls "present state only": no
`currently`, `previously`, `will be`, `planned`. A comment that describes what
the code used to do, or will do, rots. The name says what the rule matches.

### 2. Vocabulary is an setting

The reference plan commits a 45-term `accept.txt` naming Supabase, SwiftUI, WebRTC, Mixpanel,
Telegram and the rest. Those are one project's proper nouns.

gspot ships a base vocabulary of tool and platform names (the ones the presets install: ESLint,
Prettier, Ruff, SwiftLint, Vale, mise, typos, Docker, TypeScript, Python, Swift), and the consumer
adds its own:

```toml
[prose.vocabulary]
add.accept = ["Supabase", "WebRTC", "Mixpanel", "pgTAP"]
add.reject = ["utilise", "leverage"]
```

`Vale.Terms` enforces exact casing on the accept list, which is why `iOS`, `macOS`, `npm`, `knip`
and `nginx` belong there rather than in a spell checker.

### 3. Package fetching is a installed step

The reference plan lists six style packages by pinned release URL in `.vale.ini`, fetched by
`vale sync` during setup, and git-ignored. That is right, and it becomes a tool installer concern: the
URLs and their checksums live in `.gspot/tools.lock` alongside every other binary, `gspot install`
fetches them, and a checksum mismatch fails. A lint run never reaches the network.

Pinned packages, with the reference plan's version choices kept:

| Package      | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `Google`     | Base developer-documentation style                    |
| `Microsoft`  | Second opinion, heavily pruned                        |
| `write-good` | Weasel words, passive voice, wordiness                |
| `proselint`  | Annotations (`TODO`, `FIXME`, `XXX`, `HACK`), hedging |
| `alex`       | Insensitive language                                  |
| `RedHat`     | Simple words, contractions                            |
| `Harper`     | 547 grammar rules. Adopted last, spelling rules off.  |

### 4. Coverage integration

The reference plan has a coverage table. gspot turns it into claims, so prose coverage is measured
by the same machinery as everything else.

| Files                                              | Method                             | Kind claimed             |
| -------------------------------------------------- | ---------------------------------- | ------------------------------ |
| Markdown, MDX                                      | native                             | `prose`                        |
| TypeScript, TSX, JavaScript `.js`, `.cjs`          | native                             | `prose`                        |
| Swift                                              | native                             | `prose`                        |
| Python                                             | native (Vale has a Python grammar) | `prose`                        |
| SQL, PL pgSQL                                      | stdin as `.lua`                    | `prose`                        |
| Shell, including extensionless task and hook files | stdin as `.rb`                     | `prose`                        |
| JavaScript `.mjs`                                  | stdin as `.js`                     | `prose`                        |
| YAML, TOML, JSON, xcconfig, plist                  | **no method**                      | declared, not claimed          |
| String literals in any language                    | **no method**                      | declared, adjacent owner named |

The last two rows are the honest part. Under the coverage check they are explicit:

```toml
[[declare]]
as         = "partial"
paths  = ["**/*.yml", "**/*.yaml", "**/*.toml"]
reason = "Vale has no comment-only mode for these formats"
owner  = "platform"
```

Except that this declaration is wrong, and the coverage check makes that visible: those files get
`format`, `syntax` and `schema` from `repository:configuration`, so they are `covered` without prose. The
declaration is needed only for the `prose` inspection specifically, which is why required inspections are per
extension and `prose` is simply absent from the `repository:configuration` required inspections. No declaration required, no
pretence of coverage either.

## The runner

Vale cannot be pointed at the tree, because half the file types need stdin with a borrowed grammar.
`@gspot/prose` owns that dispatch.

```text
for each path claimed by repository:prose:
    if extension is native:            vale <path>
    elif extension maps to a grammar:  vale --ext=<mapped> < <path>
    else:                              not claimed
```

Two properties the reference plan specifies and this design keeps:

1. **Column fidelity for piped files.** When a file goes through stdin, the reported line and column
   must point into the real file. Vale reports positions in the stream it read, and the stream is
   the file verbatim, so positions carry. The fallback path in the reference plan (replacing
   backtick spans and URLs with spaces of equal length when `TokenIgnores` fails inside code
   comments) preserves columns for the same reason, and the install check decides which path is
   needed.
1. **Any alert fails.** The runner parses `--output=JSON` and fails on a non-empty result, rather
   than trusting the exit code, which is 1 only for `error` level.

## Install checks

The reference plan's step 1 becomes a `gspot doctor --prose` assertion, run at install and in CI,
because every one of these is a behaviour that a Vale version bump can change:

```bash
printf '// Use `staged code` and https://example.com/staged here.\n' | vale --output=line --ext=.ts
printf 'x = 1 # staged\necho "$#"\n'                                  | vale --output=line --ext=.rb
printf -- '-- zzprobe\n'                                              | vale --output=line --ext=.lua
vale ls-config
```

Pass criteria: nothing inside backticks or a URL is reported; `$#` in shell is not read as a
comment; every rule the config disables shows as off; a decorative glyph is flagged and an arrow is
not. A failing install check fails `gspot install`, with the failing behaviour named.

## Rules disabled, and why

The reference plan's disable list is adopted whole, because each entry was justified against a
written rule. Grouped:

| Group                         | Examples                                                                                                                                                                                                                                                                                                                                                   | Reason                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Spelling                      | `Vale.Spelling`, `Google.Spelling`, `proselint.Spelling`, `RedHat.Spelling`                                                                                                                                                                                                                                                                                | `typos` owns spelling, and two spell checkers disagree            |
| Replaced by a gspot rule      | `Google.Headings`, `Google.EmDash`, `Microsoft.Dashes`, `Microsoft.SentenceLength`, `Google.Acronyms`                                                                                                                                                                                                                                                      | The gspot version carries this repository's exceptions and limits |
| Contradicts the writing rules | `Google.Contractions`, `Microsoft.Contractions` (both encourage contractions), `Google.Colons` (lowercases after a colon), `Google.Parens` (discourages parentheses, which replace banned dashes), `Microsoft.Negative` (asks for an en dash), `proselint.Typography` (asks for typographic characters), `write-good.E-Prime` (bans every form of "to be") | Named conflicts                                                   |
| Vendor vocabulary             | `Google.WordList`, `Microsoft.Terms`, `RedHat.TermsErrors` and siblings                                                                                                                                                                                                                                                                                    | Product-specific term lists for other products                    |
| Duplicates                    | `Microsoft.Passive` against `Google.Passive`, `RedHat.OxfordComma` against `Microsoft.OxfordComma`, and about twenty more                                                                                                                                                                                                                                  | Each defect reports once                                          |

`TokenIgnores` is adopted verbatim, because each pattern exists for a tool syntax that prose rules
must not touch:

```text
(`[^`\n]+`)                      code spans
(https?://\S+)                   URLs
(eslint-(?:disable|enable)[^\n]*)
(@ts-expect-error[^\n]*)
(swiftlint:(?:disable|enable)[^\n]*)
(shellcheck (?:disable|source)=[^\n]*)
(nosemgrep[^\n]*)
(# noqa[^\n]*)
(# type: ignore[^\n]*)
(MARK: -)                        Swift section markers
(@(?:param|returns|throws|example|see) \S+)
```

## Adjacent enforcement

Prose rules that live in strings or in syntax Vale never sees. Each gets an owner that is not Vale,
taken from the reference plan and extended:

| Rule                                                      | Owner                                                                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error messages start with a capital                       | ESLint `no-restricted-syntax`: `NewExpression[callee.name=/Error$/] > Literal.arguments[value=/^[a-z]/]`, and the `TemplateLiteral` equivalent. Ruff `EM` family for Python.     |
| Client-facing messages carry no interpolated identifiers  | ESLint `no-restricted-syntax`: `ThrowStatement NewExpression > TemplateLiteral[expressions.length>0]`                                                                            |
| Log messages are stable, with values in the fields object | ESLint `no-restricted-syntax` on logger call template literals; Ruff `G` family for Python                                                                                       |
| No types in JSDoc tags                                    | `jsdoc/no-types`                                                                                                                                                                 |
| Swift uses `///` and not `/** */`                         | SwiftLint `custom_rules` regex on `/\*\*`                                                                                                                                        |
| Shell and SQL doc-comment header shape                    | The structure engine's doc-comment rule                                                                                                                                          |
| Commit message prose                                      | commitlint, plus a Vale pass over the commit body at `commit-msg`                                                                                                                |
| Prompt text and other long string literals                | Declared out of scope. 248 em dashes in one migration and its TypeScript sources are all inside prompt strings, and rewriting a prompt to satisfy a dash rule changes behaviour. |

That last row is a real decision, not an omission: prompt strings are product data. The coverage
check records them as prose-uncovered with a declared reason, which is the correct answer rather
than either silence or a broken rule.

## Rollout, as a preset behaviour

The reference plan's rollout is a ten-step manual sequence. As a preset it is a baseline
configuration:

1. `gspot init` with `repository:prose` enables `gspot` at error severity, with a baseline
   measured at install for every rule that has findings.
1. `gspot` is off. Enabling it measures a baseline per rule family, and each count can only fall.
1. The fix order from the reference plan is the suggested order for working the baselines down,
   mechanical families first and the taste-dependent ones last.
1. The two tooling conventions the gate rejects are preset decisions rather than project work: shell
   function headers use `# name: Description.` and not `# name - Description.`, and suppression
   metadata uses `reason: X.` and not a dash-delimited form. Both are what the structure
   engine emits and validates, so a repository adopting gspot gets the compatible form from the
   start. The 181 existing headers and 30 suppressions in the reference repository are a one-time
   migration `gspot fix` performs.
