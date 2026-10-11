# Shipped general configurations

`packages/cli/configurations/general/` holds the configurations that every repository gets: commits, coverage,
dependencies, docs, duplication, engineering, files, format, gspot, licenses, naming, prose, repository, secrets,
security, spelling, and structure. Each folder has a `manifest.toml`, the sources of the tool files gspot writes
(today `.eta` files), rule files (`rules/*.md`), and, in `prose/`, gspot's own Vale styles. The target: one check
per rule (no Vale style and check that report the same thing), no copied Red Hat or Microsoft word lists, plain
files or typed TypeScript functions instead of Eta (CFL-001), rule files in plain words with each rule said once,
and settings under their final names.

## Findings

### CFG-001: The root `prettier.config.mjs` crashes when Astro or Svelte is selected

- Where: `packages/cli/configurations/general/format/pointer.mjs.eta:4-15`, `packages/cli/configurations/general/format/manifest.toml:48`, `packages/cli/src/generation/documents/public.ts:291-307`, `packages/cli/src/parsers/schema/public.ts:149-157`
- Kind: fix-bug
- Problem: gspot writes `prettier.config.mjs` at the root of every JavaScript repository so editors find the Prettier settings. The file reads `.gspot/config/prettier.json` and runs `override.files.map(...)` and `override.excludeFiles.map(...)` on every override at run time. A Prettier plugin override (Astro, Svelte) has `files` as one string and no `excludeFiles` (`framework/astro/manifest.toml:55`, `framework/svelte/manifest.toml:57`), so the file throws `override.files.map is not a function`, and the editor's Prettier gets no settings. gspot's own format check does not notice, because it reads `prettier.json` directly.
- Fix: Write `prettier.config.mjs` from `prettierConfiguration` in `packages/cli/src/generation/formatting.ts`, the function that already writes `prettier.json` and computes every plugin and override path relative to its own target. The overrides come from the root `[[format.override]]` records and the plugin overrides of the selected configurations. The root file holds the finished object (`export default { ... };`) with no path rewriting at run time. Delete `pointer.mjs.eta`. Do with CFL-001 step 2.
- Size: small

### CFG-002: Shipped Vale styles point at a license file gspot never writes

- Where: first line of 33 files in `packages/cli/configurations/general/prose/styles/gspot/` (for example `ampm.yml.eta:1`, `contractions.yml.eta:1`); `packages/cli/configurations/general/prose/styles/LICENSES.md`; `packages/cli/configurations/general/prose/manifest.toml`
- Kind: fix-bug
- Problem: each style adapted from Microsoft or Red Hat starts with `# Adapted from Microsoft.X; see ../LICENSES.md.` gspot writes these styles to `.gspot/config/vale/styles/gspot/` in the user's repository, but no `[[tool_file]]` writes `LICENSES.md` there. The reference is broken, and the MIT notice ("shall be included in all copies or substantial portions") does not travel with the copies. After the deletes in IGN-002, CFG-005, and CFG-009, 19 adapted styles remain.
- Fix: Move `LICENSES.md` to `prose/vale/styles/LICENSES.md`; the `vale/` folder rule of CFG-025 writes it to `.gspot/config/vale/styles/LICENSES.md`. If Vale reports a file at the StylesPath root, put the notices in `vale/styles/gspot/LICENSES.md` and change the headers to `see LICENSES.md`.
- Size: small

### CFG-003: The Vale style `banned-headings` repeats the check `docs/headings`

- Where: `packages/cli/configurations/general/prose/styles/gspot/banned-headings.yml.eta`, `packages/cli/configurations/general/prose/manifest.toml:34-45,59-64`, `packages/cli/configurations/general/prose/vale.ini.eta:52-55`, `packages/cli/src/checks/general/docs.ts:236-263`, `packages/cli/src/checks/general/public.ts:37-46`
- Kind: delete
- Problem: two checks enforce one rule. Both run only at level `all` and read the same list (`BANNED_HEADINGS` plus `docs.banned_headings`), so a banned heading in a `.md` file gives two findings. The Vale style finds the phrase anywhere in a heading and also reads `.mdx` files and comment headings; `docs/headings` matches only a heading whose whole text equals a banned phrase. The Vale style is also the only style written per scope, and it is the only reason gspot writes a second Vale config and style folder for every scope. At the root that second config is a byte copy of `.gspot/config/vale.ini`.
- Fix: Keep the Vale style and delete the TypeScript check `docs/headings` (`checks/general/docs.ts:236-263`) with its `[[check]]` block in `docs/manifest.toml` and its tests. `bannedHeadingsStyle` in `packages/cli/src/generation/prose.ts` writes the style from `BANNED_HEADINGS` (`packages/cli/src/config/generation/prose.ts`) and the setting `docs.banned_headings`, which becomes root only. Then delete the per-scope Vale config: the second `vale.ini` `[[tool_file]]` (`prose/manifest.toml:39-45`), the scope branch of `valeCommand` (`checks/general/public.ts:37-46`, which finds the file by the string `'vale.ini.eta'`), and the scope StylesPath entry (`vale.ini.eta:52-55`). Delete the tests that pin the per-scope copies (`tests/cli/generation/vale.test.ts:120-150`, `tests/tools/configurations/general/prose/headings.test.ts`).
- Size: medium

### CFG-005: Shipped Vale styles contradict each other

- Where: `packages/cli/configurations/general/prose/styles/gspot/` (written to `.gspot/config/vale/styles/gspot/`):
  `negative-numbers.yml.eta`, `dash-spacing.yml.eta`, `dashes.yml.eta`, `bias-free.yml.eta:11,14`,
  `conscious-language.yml.eta:11-12`, `gendered-terms.yml.eta`, `contractions.yml`; `prose/vale.ini.eta:107`
- Kind: delete
- Problem: Following one gspot style breaks another. Every Vale alert is a finding, so a user cannot pass both.
    - `negative-numbers` says "Form a negative number with an en dash" and rewrites `-2` to `–2`; `dashes` bans the en dash everywhere.
    - `dash-spacing` says "Remove the spaces around —"; `dashes` bans `—` and `–` outright, so every `dash-spacing` hit is already a `dashes` hit.
    - `bias-free` replaces `master/slave` with `master/subordinate`, while `conscious-language` flags `master`.
    - `bias-free` replaces `hangs` with "stops responding", while `vale.ini.eta:107` turns `alex.Suicide` off because "a process hangs" is fine.
    - `contractions` bans contractions, while six style messages use them ("Don't use ordinal numbers").
- Fix: Delete `negative-numbers` and `dash-spacing` with their sources and `[[tool_file]]` blocks. Remove the
  `master/slave`, `sanity check`, and `hangs` entries from `bias-free`; move its two other entries (`DMZ`,
  `spirit animal`) and the one entry of `gendered-terms` (`mans`) into `conscious-language`, then delete `bias-free`
  and `gendered-terms`. Rewrite the six messages without contractions ("Do not ...").
  Delete the test samples of every removed style and update the test vectors in
  `tests/config/tools/configurations/general/prose/rules.ts`. The copied `case-sensitive-terms` and
  `unneeded-adverbs`, with their overlaps, are deleted whole (IGN-002).
- Size: small

### CFG-008: The Vale style `us-english` repeats what `typos` already does

- Where: `packages/cli/configurations/general/prose/styles/gspot/us-english.yml.eta`, `prose/vale.ini.eta:46,73-77`, `spelling/typos.toml.eta:8`, `gspot.toml:432-436`
- Kind: delete
- Problem: `typos` runs with the configured English variant (default `en-us`) and reports British spellings. The Vale style `us-english` reports the same spellings again at level `all`. This repository needs a `spelling/typos` ignore for `us-english.yml.eta` because `typos` flags the very words the style lists.
- Fix: Delete `us-english.yml.eta`, its `[[tool_file]]`, `vale.ini.eta:46`, and the per-scope locale loop `vale.ini.eta:73-77`. Delete the ignore at `gspot.toml:432-436`. Update `tests/cli/generation/vale.test.ts:82-83` and `tests/cli/lifecycle/apply/rule-preview.test.ts:65`. Then the locale setting has one reader, `typos`, and becomes `spelling.locale` (TML-014).
- Size: small

### CFG-009: Pairs of Vale styles report the same words twice

- Where: `prose/styles/gspot/dates.yml.eta` and `numeric-dates.yml.eta`; `self-reference.yml.eta` and `topic-references.yml.eta:9-10`; `marketing.yml.eta` and `jargon.yml.eta`
- Kind: merge
- Problem: one word in a document gives two findings with two different messages.
    - `numeric-dates` (`\d{1,2}/\d{1,2}/\d{2}`) is a strict subset of `dates` (`\d{1,2}/\d{1,2}/\d{2,4}`); the test vector `Released 1/2/20.` is a hit for both.
    - "this section" is in `topic-references`; "this section describes" is in `self-reference`. `topic-references` also flags "this module" and "this assembly" (Red Hat documentation terms), which code comments use for code modules.
    - "leverage" is in `marketing` and in `jargon`.
      The other repeats go with deleted styles: "Previously" with `release-notes` (IGN-002), "sanity check" with `bias-free` (CFG-005), and the adverbs with `unneeded-adverbs` (IGN-002).
- Fix: Delete `numeric-dates.yml.eta`. Merge the `topic-references` tokens into `self-reference`, without `this module` and `this assembly`, and delete `topic-references.yml.eta`. Remove `leverage` from `jargon`. Delete each removed file's `[[tool_file]]` block and test vector.
- Size: small

### CFG-011: `naming/policy.json` carries two fields nothing reads

- Where: `packages/cli/configurations/general/naming/policy.json:2-6`, `packages/cli/src/parsers/schema/naming.ts:44-45`
- Kind: delete
- Problem: `"version": 1` and `"matching": { "whole_parts": true, "case_insensitive": true }` are required by the schema, but no code reads them. The readers (`checks/general/naming/contracts.ts:53-228`, `structure/folder-names.ts:15`) read only `groups`, `reserved`, `languages`, `allowed`, `overrides`, `allow_digits`, and `allow_repeated_words`.
- Fix: Delete both fields from the file (`naming/defaults.json` after CFG-035) and from `namingDefaultsSchema`.
- Size: small

### CFG-012: Structure checks share copy-pasted filler text

- Where: `packages/cli/configurations/general/structure/manifest.toml:88-134` (`private-before-public`, `import-comments`, `trivial-functions`, `env-owner`), `:85` (`test-placement` why); `packages/cli/configurations/general/gspot/manifest.toml:18,23` (`gspot/policy-layout` summary "Compares gspot.toml with the canonical policy writer."; `gspot/policy` help "Correct the gspot.toml key path named by the finding and retain a reason for each loosening.")
- Kind: rewrite-text
- Problem: four checks share one `example` ("A source file that violates this convention reports its original line. Correct the source and rerun the check."), one `why` ("Keep each responsibility in its declared owner."), and one `help`. The text says nothing about any of the checks, and `gspot explain` prints it. The summaries and help lines print under every finding and on the docs check pages, and use "native", "floors", "canonical", and "exception" ("Checks function statement floors and trivial source files.", "Checks native environment reads against architecture.roles.env.", help "Correct the finding. To record an exception, run ..."), saying "correct the finding" instead of how. The schema only asks for 12 characters (`sentence = z.string().min(12)`), so filler is accepted.
- Fix: `private-before-public` and `import-comments` (CKG-055) and `test-placement` (CKG-011) are deleted with their checks. Write real `why`, `help`, and `example` text for the other two. `trivial-functions`: "A function of one statement makes the reader jump for nothing." `env-owner`, whose ID becomes `structure/env-reads`: "Environment reads spread through the code hide which settings a program needs." Each `example` shows one real input and its finding. Summaries: `structure/trivial-functions` "Finds functions with too few statements and files that only forward to other code."; `structure/env-reads` "Finds environment reads outside the files listed in architecture.roles.environment_readers."; `gspot/settings-format` "Keeps gspot.toml formatted.". `gspot/settings` help: "Fix the gspot.toml key the finding names, and give each loosened value a reason." Every "To record an exception" becomes "To ignore it".
- Size: small

### CFG-013: CodeQL language names are validated as file paths

- Where: `packages/cli/configurations/general/security/manifest.toml:90-91`
- Kind: fix-bug
- Problem: `tools.codeql.languages` holds names such as `python` and `javascript-typescript`, but its declaration has `validation = { path = true }`, so the compiled schema treats each language as a relative path (`policy/schema/native/contracts.ts:182`). The CodeQL check compares the names with the languages CodeQL reports, not with files (`checks/general/security.ts:58-78`). The block also has an extra blank line.
- Fix: Declare `tools.codeql.languages` in TypeScript (POL-001) as a list of names with no `path_role`. The `[[setting]]` table, its `validation` line, and the blank line leave the manifest with it.
- Size: small

### CFG-015: `WORKING.md` says rule files hold only what no check enforces

- Where: `engineering/rules/agent/WORKING.md:39-40`; repeats of checks in `naming/rules/NAMING.md:25-30,80-82,94-95`, `engineering/rules/agent/SUPPRESSIONS.md:9-10,17-19`, `secrets/rules/SECRETS.md:9`, `prose/rules/DOCS-MEDIA.md:24`, `prose/rules/DOCS-CONTENT.md:36`, `engineering/rules/code/COMMENTS.md:22,41-42`, `engineering/rules/code/TESTING.md:49`, `files/rules/YAML.md:10-12`
- Kind: rewrite-text
- Problem: `WORKING.md` says "The rule files hold the decisions no check makes", but many lines repeat a check: NAMING.md repeats the banned groups of the naming defaults; SUPPRESSIONS.md repeats `gspot/suppressions`; SECRETS.md repeats gitleaks and trufflehog; DOCS-MEDIA and DOCS-CONTENT repeat `gspot.alt-text` and `gspot.link-text`; COMMENTS.md repeats `sonarjs/todo-tag` and Ruff `TD`/`FIX`; YAML.md repeats yamllint `truthy`.
- Fix: Keep these rule lines: a coding tool reads them before it writes code, while a check reports only afterwards, and gspot also writes rule files where no check runs (`RULES_ONLY_CLOSING` in `packages/cli/src/config/rules.ts`, today `RULES_ALONE`). Reword `WORKING.md:39-40` so it no longer claims that rule files hold only what no check enforces, for example: "A check reports what it finds as a finding, and `gspot explain <check>` describes the check." Merge only exact repeats between rule files.
- Size: medium

### CFG-016: "Run gspot check --staged" and "write tests when asked" are said three times

- Where: `engineering/rules/agent/WORKING.md:37,45-46`; `engineering/rules/agent/PLANNING.md:46-47`; `packages/cli/src/config/agent-rules.ts:4-5` (`CHECKS_INSTALLED`, written into AGENTS.md)
- Kind: delete
- Problem: AGENTS.md already says "Run `gspot check --staged` before committing", and only when checks exist (`agent-rules/contracts.ts:47` picks `CHECKS_INSTALLED` or `RULES_ALONE`). WORKING.md says it again, and PLANNING.md says it a third time without the condition, which is wrong where gspot writes only rules. "Write tests when the user asks or a check requires them" is in both WORKING.md and PLANNING.md.
- Fix: Delete `WORKING.md:37` and the last sentence of `PLANNING.md:47`. Delete "Add tests when the user asks or a check requires them, and update tests that the change breaks." from `PLANNING.md:46`; WORKING.md keeps the one copy.
- Size: small

### CFG-017: Five DOCS files repeat each other and sit in the wrong configuration

- Where: `prose/rules/DOCS.md`, `DOCS-CONTENT.md`, `DOCS-FORMAT.md`, `DOCS-MEDIA.md`, `DOCS-SURFACES.md`; `docs/manifest.toml`; `docs/manifest.toml:78`
- Kind: merge
- Problem: 183 lines in five files about one subject, with repeats:
    - troubleshooting starts from the symptom: `DOCS.md:25-26` and `DOCS-SURFACES.md:25-26`;
    - link instead of copy: `DOCS.md:13` and `DOCS-SURFACES.md:8`;
    - delete obsolete content: `DOCS.md:29` and `DOCS-FORMAT.md:23`;
    - keep required text out of collapsed panels: `DOCS-CONTENT.md:27-28` and `DOCS-FORMAT.md:21`;
    - alt text and color: `DOCS-MEDIA.md:23-25` and `engineering/rules/code/ACCESSIBILITY.md:16-21`.
      "Surfaces" is jargon for "reference pages". The files sit in `prose/`, while the `docs` configuration (links, headings, README shape) has no rule file.
- Fix: Merge the five into one `packages/cli/configurations/general/docs/rules/DOCS.md` with the sections "Before you write", "Pages", "Examples and procedures", "Reference pages", "Images and video", and "Links", each rule said once. Keep `WRITING.md` in `prose/`. Do after TCM-007, which deletes `UPSTREAM_GUIDES` and its test, so the merge needs no test edit.
- Size: medium

### CFG-018: Secret handling is spread over nine rule files

- Where: `secrets/rules/SECRETS.md`; `engineering/rules/code/CONFIGURATION.md:10-11,24-28`; `engineering/rules/code/CLI.md:23`; `files/rules/YAML.md:17`; `prose/rules/DOCS-CONTENT.md:18-19`; `prose/rules/WRITING.md:17`; `engineering/rules/code/ERRORS.md:29`; `engineering/rules/code/LOGGING.md:44-49`; `security/rules/SECURITY.md:52-54`
- Kind: merge
- Problem: SECRETS.md has four bullets, and the other secret rules are scattered: secrets come from the environment (SECRETS, CONFIGURATION, CLI); examples hold no real secrets (SECRETS, DOCS-CONTENT, WRITING, YAML); public build variables hold no secrets (CONFIGURATION). SECURITY.md has a heading "Secrets and disclosure" whose one bullet is about default users and debug endpoints.
- Fix: Put every secret rule once in SECRETS.md: read from the environment or a secret store in one module; no default value; never in a command-line flag; public build variables (`NEXT_PUBLIC_*`, `VITE_*`) are public; examples and sample files hold placeholders; never log a secret (keep a one-line pointer in LOGGING.md); a published package lists its files. Move the whole "Files and secrets" section of CONFIGURATION.md into SECRETS.md, with its line "Keep actual local overrides in an ignored file". Delete the copies at `CLI.md:23`, `YAML.md:17`, the second sentence of `DOCS-CONTENT.md:18-19`, and "and credentials" in `WRITING.md:17`. Rename SECURITY.md's "Secrets and disclosure" heading to "Builds".
- Size: small

### CFG-019: NAMING-FILES.md repeats NAMING.md and is not about files

- Where: `naming/rules/NAMING-FILES.md` (43 lines), `naming/rules/NAMING.md:7-8,46,128-131`
- Kind: merge
- Problem: half of NAMING-FILES.md ("Boundaries and external names") is about external names, not files, and NAMING.md already says it ("Required external names survive at the boundary ...", "Shape suffixes such as `Row`, `DTO` ... stay on the type"). Both files open with a sentence that only points to the other file.
- Fix: Move the "Files and directories" section into NAMING.md, merge the external-names paragraph into NAMING.md's one paragraph on that topic, delete the two pointer sentences, and delete NAMING-FILES.md.
- Size: small

### CFG-020: TESTING.md says several things twice and holds language-only lines

- Where: `engineering/rules/code/TESTING.md`
- Kind: simplify
- Problem: in 101 lines, mocking rules appear five times (lines 15, 20, 35, 89-92, 91), snapshot rules twice (23, 38), "assert the outcome and side effects" twice (41, 98-101), "no fixed sleeps" and "fake timers" twice (72, 82), and "do not depend on order" twice (61, 65). Lines 51 and 55-57 hold Python, Swift, pgTAP, and logging-test details in a general file. "Use partial mocks sparingly" and "whenever possible" are hedges the shipped `hedging` style rejects.
- Fix: Keep one "Mocks" section (mock only what leaves the process; never the code under test; reset mocks before each test), one "Assertions" section, and one "Test data" section. Move `test_<behavior>.py` to `language/python/rules/PYTHON.md`, `<Type>Tests.swift` to `testing/swift-tests/rules/SWIFT-TESTS.md` (CFL-040), the pgTAP names to `database/postgres/rules/POSTGRES.md`, and the logging-test line to LOGGING.md. Keep the test-ID lines in TESTING.md: they also serve Testing Library, React Native `testID`, and Swift UI tests, and gspot writes PLAYWRIGHT.md only when Playwright is a dependency. Target: about 60 lines.
- Size: small

### CFG-021: ERRORS, HTTP, CLI, LOGGING, SECURITY, and CONFIGURATION overlap

- Where: `engineering/rules/code/ERRORS.md:28-49`, `HTTP.md:12-13,23-28,33`, `CLI.md:11,27-28`, `LOGGING.md:13-14`, `security/rules/SECURITY.md:9-13,49-50`, `CONFIGURATION.md:9,21-22`, `engineering/rules/agent/WORKING.md:91`
- Kind: merge
- Problem:
    - ERRORS.md "At boundaries" (one function builds HTTP error bodies, client messages are generic) is HTTP advice and overlaps HTTP.md "Responses".
    - ERRORS.md says "Public error responses must not disclose" and again "Client-visible messages are generic"; "Put the failing value in its own field" and "values as arguments" say one thing.
    - Input validation is in SECURITY.md, HTTP.md, and CONFIGURATION.md.
    - Session cookies are in SECURITY.md, and CSRF for cookies is in HTTP.md.
    - "Diagnostics go to stderr" is in CLI.md and LOGGING.md; LOGGING.md's "`print` is for a CLI's own output" is a Python word.
    - "Group constants by domain" (CONFIGURATION.md) and "Group constants, types, and schemas by behavior" (WORKING.md) say one thing.
- Fix: Move the two HTTP bullets of ERRORS.md "At boundaries" (one function formats error responses; client messages are generic) into HTTP.md "Responses", and keep "Convert technical errors to user-facing messages at the presentation boundary" in ERRORS.md, because apps with a UI and no HTTP need it too. Delete the duplicate sentences in ERRORS.md "Error messages". Keep input validation in SECURITY.md and make HTTP.md say only where it happens ("once, at the edge, with a schema"). Move the CSRF line next to the cookie rules in SECURITY.md. Delete `LOGGING.md:13` and the command-line half of `LOGGING.md:14` (CLI.md holds the streams rule); keep "A service logs to stdout." Delete the first sentence of the CONFIGURATION.md constants bullet ("Group constants by domain ...") and keep its second sentence; WORKING.md keeps the one copy of the grouping rule (CFG-022).
- Size: small

### CFG-022: Some shipped rule text and settings fit only gspot's own repository

- Where: `engineering/rules/agent/WORKING.md:87-92` ("Structural ownership"); `prose/vale.ini.eta:82-109` (comments); `engineering/manifest.toml:1` (`products`); `commits/rules/GIT.md:21-35`
- Kind: rewrite-text
- Problem:
    - "Do not impose a config or types folder on another project" makes sense only for work on gspot itself, whose repository has `config/` and `types/` folders. For a user, "another project" means nothing.
    - The comments gspot writes into every user's `vale.ini` justify turned-off upstream rules with gspot's own text ("the rule files allow parentheses", "the rule files describe tools as actors", "config is a reserved word in the naming policy"). Six upstream rules (`Google.Parens`, `Google.Passive`, `write-good.Passive`, `write-good.E-Prime`, `Google.Anthropomorphism`, `alex.Condescending`) are off for every user because gspot's own rule files trip them.
    - `products` in the engineering manifest adds `SARIF` and `Homebrew` to every user's accepted words; no shipped file uses them.
    - In this repository, GIT.md tells coding tools to branch and open pull requests, while this repository commits straight to main.
- Fix: In WORKING.md "Structural ownership", delete only "Do not impose a config or types folder on another project". Keep "Group constants, types, and schemas by the behavior they belong to" and "do not mirror the source tree in tests": they are general rules. Give each entry of `VALE_OFF_RULES` (`packages/cli/src/config/generation/prose.ts`, CFG-026) a reason a user can check ("flags 'kill' and 'abort', which name process actions"). Turn each of the six rules back on and fix gspot's own text, unless a user also gains from the rule being off; then write that reason. Remove `SARIF` and `Homebrew` from the engineering manifest's word list (`allowed_words` after CFL-010); if Vale then flags SARIF in gspot's own source comments, add it to this repository's root `allowed_words` with a reason. Keep GIT.md (commitlint enforces its commit-message rules here too) and add one line to this repository's AGENTS.md text (DCX-017): "Commit straight to main. Do not open branches or pull requests."
- Size: medium

### CFG-023: The rule files lean on three jargon words

- Where: all 27 rule files in this part; most in `naming/rules/NAMING.md` (17 uses), `engineering/rules/agent/WORKING.md` (11), `engineering/rules/code/TESTING.md` (11), `naming/rules/NAMING-FILES.md` (7)
- Kind: rewrite-text
- Problem: "owner/ownership" appears 30 times, "contract(s)" 25 times, and "boundary/boundaries" 28 times. These are gspot's internal words, not plain English. Examples: "Understand the contracts, data flow, and ownership boundaries", "Mock at the boundary owner", "Terminate TLS at the edge owner", "the process or a major owner is unusable", "A directory name alone proves no ownership".
- Fix: Rewrite with plain words: "owner" becomes "the module that does X" or "the file that holds X"; "contract" becomes "the promised behavior" or "the public interface"; "boundary" becomes "where data enters or leaves the program". For example "Mock at the boundary owner" becomes "Mock the module that talks to the network or the database."; "the process or a major owner is unusable" becomes "the process cannot go on and stops". TALKING.md stays as it is.
- Size: medium

### CFG-025: The prose manifest repeats one 5-line block 62 times

- Where: `packages/cli/configurations/general/prose/manifest.toml:47-418`
- Kind: simplify
- Problem: 372 of the manifest's 458 lines are copies of `[[tool_file]] source = "styles/gspot/X.yml.eta" target = ".gspot/config/vale/styles/gspot/X.yml" tool = "vale" generated_header = false`. A new style needs a new block, and a forgotten block drops the style without a message. `parseManifest` already finds Semgrep packs by listing a folder (`configurations/public.ts:91-120`).
- Fix: Put the plain Vale files under `prose/vale/` in the target layout: `prose/vale/styles/gspot/*.yml` (the styles with no Eta code, CFL-001) and `prose/vale/styles/LICENSES.md` (CFG-002). Teach `parseManifest` one rule: every file under `<configuration>/vale/` is a `vale` tool file whose target is `.gspot/config/vale/<same path>`, with no header. Delete the blocks of those files. `vale.ini`, the accepted words, and the nine styles built from settings are written by functions in `packages/cli/src/generation/prose.ts` (CFL-001, CFG-038).
- Size: medium

### CFG-026: `vale.ini.eta` is a 120-line program inside a text file

- Where: `packages/cli/configurations/general/prose/vale.ini.eta`
- Kind: simplify
- Problem: 116 of 123 lines are JavaScript in `<% %>`, with no type check, lint, or naming check. Small faults:
    - `gspot.alt-text` is set to `NO` in the level-`all` list (line 37) and again for every level (line 45), and it has a comment entry (lines 113-114).
    - StylesPath is written in two forms for the same folder, depending on the level (lines 50-56).
    - The comments are quoted strings inside comments (`# "typos owns spelling"`).
    - The comment on `Google.Contractions` ("the tool must not force contractions") contradicts the shipped `gspot.contractions` style, which bans contractions.
- Fix: `valeIniToolFile` in `packages/cli/src/generation/prose.ts` writes the file (CFL-001). The turned-off upstream rules and their reasons are one typed constant, `VALE_OFF_RULES` in `packages/cli/src/config/generation/prose.ts`, which also holds `Google.Semicolons`, `Google.WordListCase`, and `Harper.OkToOkay` (IGN-002). The per-scope and locale parts go (CFG-003, CFG-008). Set `gspot.alt-text` once, write StylesPath once in one form (GEN-024), write each reason once as a plain `#` line, and write the contractions reason as "gspot.contractions holds the contractions rule".
- Size: small

### CFG-027: `typos.toml.eta` calls a path rewrite that never changes anything

- Where: `packages/cli/configurations/general/spelling/typos.toml.eta:14-20`
- Kind: simplify
- Problem: it calls `scopeIgnorePatterns([...], targetPath.startsWith('.gspot/') ? '' : scope)`. The typos file is always written under `.gspot/config/` (`targetInScope` puts scope copies in `.gspot/config/<scope>/`), so the second argument is always `''`, and `scopeIgnorePatterns(patterns, '')` returns the patterns unchanged. The four scope copies of `typos.toml` in this repository are byte for byte equal to the root one.
- Fix: `typosToolFile` (`packages/cli/src/generation/tool-file-sources/typos.ts`, CFL-001) writes the plain list from `TYPOS_IGNORE_PATTERNS` with no `scopeIgnorePatterns` call.
- Size: small

### CFG-028: v8r is told to ignore errors twice

- Where: `packages/cli/configurations/general/files/v8r.yml.eta:13` (`ignoreErrors: true`), `files/manifest.toml:112` (`--ignore-errors`)
- Kind: delete
- Problem: the same switch is set in the config file and on the command line.
- Fix: Delete `--ignore-errors` from the command. Keep `ignoreErrors: true` in the file `v8rToolFile` writes, with one comment that says why (files with no known schema). Confirm with one run that v8r 6.1.0 reads `ignoreErrors` from its config file.
- Size: small

### CFG-029: Taplo schema checks are turned off twice

- Where: `packages/cli/configurations/general/files/taplo.toml.eta:2` (`schema: { enabled: false }`), `files/manifest.toml:71` (`--no-schema`)
- Kind: delete
- Problem: the config file already turns schemas off for both taplo checks; the parse check also adds `--no-schema` to its command.
- Fix: Delete `--no-schema` from the `files/taplo` command.
- Size: small

### CFG-031: `jscpd.json` sets a reporter the check always overrides

- Where: `packages/cli/configurations/general/duplication/jscpd.json.eta:5`, `packages/cli/src/checks/general/public.ts:200`
- Kind: delete
- Problem: the file sets `"reporters": ["console"]`, but its only reader, gspot's own jscpd check, runs with `--reporters json`. `.gspot/config/jscpd.json` is not a file jscpd finds on its own.
- Fix: `jscpdToolFile` (CFL-001) writes no `reporters` key.
- Size: small

### CFG-035: `naming/policy.json` uses the word "policy" for something that is not gspot.toml

- Where: `packages/cli/configurations/general/naming/policy.json`; `NAMING_TERMS_FILE` (`config/configurations.ts:13`), `namingTerms()` (`configurations/public.ts:205`), `shippedNamingSchema`, `NamingTerms`
- Kind: rename
- Problem: this file holds the shipped naming defaults: banned groups, case per language, allowed names, and path rules. Four names cover it (policy, terms, shipped naming, naming), and "policy" also names the settings in `gspot.toml`.
- Fix: Rename the file to `naming/defaults.json`, `NAMING_TERMS_FILE` to `NAMING_DEFAULTS_FILE`, `namingTerms()` to `namingDefaults()`, `shippedNamingSchema` to `namingDefaultsSchema`, and `NamingTerms` to `NamingDefaults`.
- Size: small

### CFG-038: Three Vale styles keep three different lists of names whose case is fixed

- Where: `prose/styles/gspot/heading-case.yml.eta:6-91` (82 names plus `[words]`), `title-case.yml.eta:6-12` (3 names plus `[words]`), `acronyms.yml.eta:7-13` (6 acronyms)
- Kind: merge
- Problem: one concept, three hand-kept lists. `heading-case` holds gspot's own product list (Zustand, tRPC, Drizzle, Supabase, SwiftUI, ...), `title-case` knows only `nginx`, `tRPC`, and `iOS`, and `acronyms` knows six. The words of the selected configurations already hold every tool and product name.
- Fix: Build all three exception lists from one list: the words of the selected configurations (their tool names and manifest `allowed_words`, CFL-010), the root `allowed_words`, and one shared acronym list in `packages/cli/src/config/generation/prose.ts` (`API`, `CLI`, `CSS`, `HTML`, `HTTP`, `ID`, `JSON`, `SQL`, `UI`, `URL`, and the 25 common abbreviations of IGN-020). `headingCaseStyle`, `titleCaseStyle`, and `acronymsStyle` in `packages/cli/src/generation/prose.ts` write the three styles, so `acronyms` is built, not copied. Delete the hand lists.
- Size: small

### CFG-040: Vale style messages break gspot's own style

- Where: `prose/styles/gspot/numbered-units.yml.eta:3`, `date-ordinals.yml.eta:3`, `ordinal-adverbs.yml.eta:3`, `suspended-hyphens.yml.eta:3`, `product-centric-writing.yml.eta:6-7`
- Kind: rewrite-text
- Problem: the messages users read use contractions that `gspot.contractions` bans ("Don't spell out the number in '%s'."), hedges that `gspot.hedging` bans ("Whenever possible"), and grammar jargon ("transitive verb constructions").
- Fix: Rewrite each message plainly: numbered-units "Write the number in '%s' as digits."; date-ordinals "Write the day of a date as a plain number, not an ordinal."; ordinal-adverbs "Do not add -ly to an ordinal number."; suspended-hyphens "Write each compound in full instead of '%s'."; product-centric-writing "Use a person or a role as the subject, not '%s'."
- Size: small

### CFG-041: `percentage-numbers` has a broken character range

- Where: `packages/cli/configurations/general/prose/styles/gspot/percentage-numbers.yml.eta:8`
- Kind: fix-bug
- Problem: the token `\b[a-zA-z]+\spercent\b` uses `[a-zA-z]`, which also matches `[`, `\`, `]`, `^`, `_`, and the backtick. The typo comes from Microsoft's style.
- Fix: Write `[a-zA-Z]`.
- Size: small

### CFG-042: `straight-quotes` misses the common curly double quotes

- Where: `packages/cli/configurations/general/prose/styles/gspot/straight-quotes.yml.eta:10-11`
- Kind: fix-bug
- Problem: it swaps `‘ ’` and `‟ ″ ‶`, but not the common `“ ”`. It flags `″` (the double prime for inches and seconds), which is not a quote.
- Fix: Swap `“|”` to `"` and `‘|’` to `'`; drop `″` and `‶`.
- Size: small

### CFG-043: Rule options for unlisted commitlint and yamllint rules are dropped without a message

- Where: `commits/commitlint.config.cjs.eta:25-27`, `files/yamllint.yml.eta:18-19`, `packages/cli/src/policy/schema/tools.ts:69-78`
- Kind: fix-bug
- Problem: the schema accepts any rule name under `tools.yamllint.rules` (`.catchall`) and `tools.commitlint.rules` (`z.record`). The files copy a user's options only when the rule is already in their own list (`if (Object.hasOwn(rules, name))`). An option for `line-length` or `body-max-length` disappears with no message.
- Fix: Refuse unknown rule names in the declarations of `tools.yamllint.rules` and `tools.commitlint.rules`, and name the accepted rules in the error.
- Size: small

### CFG-044: Naming check examples suggest strange renames

- Where: `packages/cli/configurations/general/naming/manifest.toml:13,23`
- Kind: rewrite-text
- Problem: the example for `naming/identifiers` renames `userHelper` to `command`; the one for `naming/paths` renames `utils/format.js` to `app/`. Neither new name follows from the old one.
- Fix: "`export const userHelper = 1;` reports the banned term `helper`. Rename it after what it holds, such as `userCount`." and "`utils/format.js` reports `utils`. Move it into the folder of the feature it serves, such as `invoices/format.js`."
- Size: small

### CFG-045: Some manifest descriptions and setting summaries are wrong

- Where: `gspot/manifest.toml:5`; `engineering/manifest.toml:5`; `docs/manifest.toml:118`; `files/manifest.toml:145`; `structure/manifest.toml:142`; extra blank lines at `gspot/manifest.toml:48-49`, `secrets/manifest.toml:102-103`, `security/manifest.toml:91-92`, `structure/manifest.toml:63-64,239-240`, `prose/manifest.toml:419-420`
- Kind: rewrite-text
- Problem:
    - `gspot`: "The checks gspot runs on policy layout and generated files" leaves out `gspot/suppressions` and the Node tool.
    - `engineering`: "Shared instructions for coding agents, engineering work, and documentation" (the documentation rules are in `prose`).
    - `links.allowed_urls`: "Allowed URL patterns, each with a reason" (the value is a list of strings).
    - `tools.v8r.schemas`: "each entry has a pattern and a schema" (it is a map of pattern to URL).
    - `limits.file_lines` states the Bash (140) and SQL (400) defaults in its summary.
- Fix: Rewrite the two descriptions to match the code: `gspot` names the checks of `gspot.toml` and of generated files, `gspot/suppressions`, and Node as a system tool (INX-002); `engineering` says "Rules on how to work and how to write code. The `[rules]` setting turns them on or off." The setting summaries move to the TypeScript declarations (POL-001) and say what the values are: `docs.allowed_urls` is a list in the reason form, `[[tools.v8r.schema]]` holds records with `paths` and `url`, and the per-language defaults of `limits.file_lines` sit in its declaration, not in its summary. Delete the double blank lines.
- Size: small

### CFG-046: `format` declares a generated file in every scope but gspot writes it only at the root

- Where: `packages/cli/configurations/general/format/manifest.toml:2` (`generated = ["prettier.config.mjs"]`), `packages/cli/src/repository/selection/public.ts:153-170`
- Kind: fix-bug
- Problem: `generated` paths are prefixed with every scope that selects `format`, so `docs/prettier.config.mjs`, `tests/prettier.config.mjs`, and `packages/cli/prettier.config.mjs` appear in `.prettierignore`, `.gspot/config/prettierignore`, and every `typos.toml` (`.prettierignore:60-65` in this repository). Those files do not exist; the Prettier root file is written only at the root and only with `javascript`.
- Fix: Delete the `generated` key. Mark pointer files as generated where they are written (the generator already knows each pointer path, `pointerPaths`).
- Size: small

### CFG-047: `format` is always selected through `files`, so seven `requires = ["format"]` add nothing

- Where: `general/files/manifest.toml:5`; `language/{css,html,markdown,python,sql,swift}/manifest.toml` `requires = ["format"]`; `general/format/manifest.toml:4-6`
- Kind: simplify
- Problem: `files` is always selected and requires `format`, so every repository has `format` (`selectForScope` adds the always-selected general configurations everywhere, `repository/selection/public.ts:121-144`). The language `requires` lines and the "not always selected" flag on `format` only add steps for a reader.
- Fix: Set `always_selected = true` on `format` and delete the seven `requires = ["format"]` entries. Check that the selection order does not change any default (requirements come first today).
- Size: small

### CFG-048: SUPPRESSIONS.md says "use gspot ignore" twice and uses unclear words

- Where: `packages/cli/configurations/general/engineering/rules/agent/SUPPRESSIONS.md:13-14,21-22`
- Kind: rewrite-text
- Problem: lines 13-14 and 21-22 both say "record it with `gspot ignore`". "Change policy through `gspot ignore` within the user's request" is unclear.
- Fix: Keep one paragraph: "To accept a finding without changing the code, run `gspot ignore <check>` with a reason. Ask the user first."
- Size: small

### CFG-049: HTTP, accessibility, and command-line rules are written into every repository

- Where: `engineering/rules/code/HTTP.md`, `ACCESSIBILITY.md`, `CLI.md`; `engineering/manifest.toml` (no rule conditions); `packages/cli/src/agent-rules/public.ts:50`
- Kind: move
- Problem: every always-selected configuration's rules are written with no condition. A backend with no UI gets ACCESSIBILITY.md, a Swift app gets HTTP.md, a web app gets CLI.md, and AGENTS.md lists them all. CLI.md has to start with "These rules apply to command-line programs the project ships" to excuse itself.
- Fix: Add a `[rules]` condition (the manifest table named `agent_rules` today) in `engineering/manifest.toml` for `ACCESSIBILITY.md`: write it when the repository has UI files (tags or file names such as `*.html`, `*.tsx`, `*.vue`, `*.svelte`, `*.swift`). Keep HTTP.md and CLI.md without a condition: many HTTP services have no dependency to detect (Bun.serve, Deno, Flask, Django, Go servers), and a missing rule costs more than one extra line in the AGENTS.md list.
- Size: small

### CFG-050: GIT.md is written even where the commits configuration does not apply

- Where: `packages/cli/src/agent-rules/public.ts:50`, `packages/cli/configurations/general/commits/manifest.toml:4-5`
- Kind: fix-bug
- Problem: `commits` has `when = { git = true }`, so its checks skip a folder with no Git. Its rule file GIT.md is still written, because `selectRuleFiles` takes every always-selected configuration from every shipped manifest and ignores `when`.
- Fix: Delete the `shared` line (`agent-rules/public.ts:50`) and use only the manifests the caller gives. Both callers give `everyManifest(scopes)`, which already holds every always-selected configuration that applies: `selectForScope` adds them (`repository/selection/public.ts:122-144`) and adds `commits` only when the repository has Git (`commands/public.ts:52-54`).
- Size: small

### CFG-051: GENERATED.md and other short rules use hard phrases

- Where: `gspot/rules/GENERATED.md:9-10`, `engineering/rules/agent/TASKS.md:13`, `engineering/rules/code/LOGGING.md:24`, `prose/rules/DOCS-FORMAT.md:8`, `prose/rules/DOCS-MEDIA.md:33`, `prose/rules/WRITING.md:7`
- Kind: rewrite-text
- Problem: "A directory name alone proves no ownership."; "A required command failure stops dependent work and produces a nonzero task status."; "a major owner is unusable"; "Platform-owned components need useful text when the secondary renderer cannot show them."; "Keyboard alternatives and platform variants keep a consistent order."; "follows `ISO 24495-1:2023`, plain language" (a standard number with no explanation).
- Fix: "A folder named `generated/` does not make its files generated."; "When a step fails, the task stops and exits with an error."; "the process cannot go on"; "A component that some viewers cannot show needs a text alternative."; "List keyboard shortcuts and platform steps in the same order each time."; "Write in plain language (ISO 24495-1): short sentences and common words."
- Size: small

### CFG-052: Example env file names are listed in two places

- Where: `packages/cli/configurations/general/secrets/manifest.toml:2` (`untracked_files` with `example|template|sample`), `:130-134` (`secrets.env_examples`)
- Kind: simplify
- Problem: the setting lets a user name `.env.defaults` as an example file, but the fixed `untracked_files` pattern then reports it as a tracked secret file.
- Fix: Build the allowed suffixes of `untracked_files` from `secrets.env_examples`, so there is one list.
- Size: small

### CFG-053: Small format faults in rule files

- Where: `engineering/rules/code/ERRORS.md:22-24` (blank line inside a list), `secrets/rules/SECRETS.md:5-7` ("# Secrets" then "## Secrets in code and configuration" for the only section), `files/rules/YAML.md:16` (repeats COMMENTS.md: "Comments explain a value that is not obvious")
- Kind: rewrite-text
- Problem: a list split by a stray blank line; a heading that repeats the title; a comment rule already in COMMENTS.md.
- Fix: Delete the blank line, delete the inner heading, and delete `YAML.md:16`.
- Size: small

## Layout

```text
packages/cli/configurations/general/
  docs/          manifest.toml, rules/DOCS.md                 (the five DOCS files of prose/, merged)
  format/        manifest.toml                                (always selected)
  naming/        manifest.toml, defaults.json, rules/NAMING.md (NAMING-FILES.md merged in)
  prose/         manifest.toml, rules/WRITING.md,
                 vale/styles/LICENSES.md,
                 vale/styles/gspot/*.yml                      (plain styles; the vale/ folder rule writes each one)
  dependencies/  manifest.toml, syncpack.json, rules/DEPENDENCIES.md
  secrets/       manifest.toml, gitleaks.toml, rules/SECRETS.md (every secret rule)
  structure/     manifest.toml                                (no folder-names, config-logic, test-placement,
                                                               private-before-public, or import-comments)
packages/cli/src/generation/
  prose.ts                  vale.ini, accept.txt, and the nine styles built from settings: acronyms, alt-text,
                            banned-headings, heading-case, item-length, paragraph-length, possessives,
                            sentence-length, title-case
  formatting.ts             .editorconfig, prettierignore, prettier.json, prettier.config.mjs
  tool-file-sources/        commitlint, osv-scanner, lychee, jscpd, taplo, v8r, yamllint, semgrep, typos
packages/cli/src/config/generation/
  prose.ts                  VALE_OFF_RULES, the styles kept at level recommended, BANNED_HEADINGS, the shared
                            acronym list
  formatting.ts             fixed EditorConfig sections and the prettierignore header
  tool-file-sources.ts      fixed values of the smaller tool files
```

Vale styles that go: `auto-prefixes`, `case-sensitive-terms`, `gerund-headings` with `no-gerunds-in-titles.tengo`,
`question-marks`, `slash-alternatives`, `unneeded-adverbs` (IGN-002); `release-notes` (IGN-002); `dash-spacing`,
`negative-numbers`, `bias-free` and `gendered-terms` (merged into `conscious-language`, CFG-005); `numeric-dates`
and `topic-references` (merged into `self-reference`, CFG-009); `us-english` (CFG-008). The empty `site/` folder
goes (INS-047).
