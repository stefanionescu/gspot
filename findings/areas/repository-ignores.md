# This repository's ignore and allow entries

This repository's `gspot.toml` tells gspot and its tools what to skip here: 32 `[[ignore]]` records (65% of the file;
the 13 Vale records alone are 23.2 KB), 60 allowed words, 8 naming overrides, 6 allowed packages, knip entries, and
the architecture modules. The generated ignore files (`.prettierignore`, `.semgrepignore`, `.gspot/config/knip.json`)
come from it. Of 120 entries, 69 are needed, 45 are lazy (a small text or code change removes the need), and 6 are
dead. The target: only the needed `[[ignore]]` records stay, each with one plain, true reason; `allowed_words` shrinks
to `capitalisation`, `IIF`, `LICENCE`, `next-intl` and `udid` with one true reason; the Vale path lists go; and the
architecture modules use plain paths.

## Every `[[ignore]]` record

| #     | Check, lint rule                                                                | Result                                                                      |
| ----- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1, 2  | `dependencies/osv` GHSA-ch52-4w7c-c8xp, GHSA-vfj7-8cjw-p6xm                     | stay: no fixed release yet; both expire on 2026-11-08                       |
| 3     | `docs/lychee` on `docs/src/content/docs/**`                                     | stays: site links start with `/`, and only the built site has their targets |
| 4     | `docs/stale-paths` on `FINDINGS.md`, `findings/**`                              | goes (IGN-021)                                                              |
| 5     | `docs/stale-paths` on the shipped rules                                         | stays: paths in rules are examples for user projects                        |
| 6     | `github-actions/zizmor` self-repository                                         | goes (IGN-012)                                                              |
| 7     | `javascript/eslint` `n/no-sync` on `packages/cli/src/**`, `scripts/**`          | goes: the lint rule is off for every user (DEC-011)                         |
| 8     | `javascript/eslint` `restrict-dependency-ranges` on the plugin's `package.json` | stays: a published library uses ranges                                      |
| 9     | `prose/vale` on `FINDINGS.md`, `findings/**`                                    | goes (IGN-021)                                                              |
| 10    | `prose/vale` on `prose/styles/LICENSES.md`                                      | stays: license text stays word for word                                     |
| 11    | `prose/vale` on the prose test samples                                          | narrowed to one lint rule (IGN-011)                                         |
| 12-21 | `prose/vale`, one record per lint rule, 380 paths                               | go (IGN-002)                                                                |
| 22    | `security/codeql` `js/bad-code-sanitization` on `generation/fragments.ts`       | goes (IGN-024)                                                              |
| 23    | `security/codeql` `js/file-system-race` on 5 test files                         | stays: each test owns its temporary folder                                  |
| 24    | `security/codeql` `js/http-to-file-access` on the grammar download              | stays: the download is checked against a SHA-256 hash                       |
| 25    | `security/codeql` `js/incomplete-sanitization` on the `$/` rewrite              | goes (IGN-025)                                                              |
| 26    | `spelling/typos` on two Vale rule sources                                       | goes with the deleted styles (IGN-002)                                      |
| 27    | `spelling/typos` on the US English Vale rule                                    | stays: the file lists the British spellings it corrects                     |
| 28    | `spelling/typos` on the spelling test samples                                   | stays: deliberate misspellings for the spelling tests                       |
| 29    | `structure/lone-files` on `docs/src/pages/schema`                               | stays: Astro builds the URL `/schema/gspot.schema.json` from this folder    |
| 30    | `structure/prefix-collisions` on `docs/src/content.config.ts`                   | stays: Astro fixes this file name                                           |
| 31    | `structure/prefix-collisions` on the markdown and docker configurations         | stays: tool file names                                                      |
| 32    | `structure/prefix-collisions` on the ESLint plugin's rule files                 | stays: rule ids start with `no-`                                            |

Each record that stays gets a reason in one plain sentence, without "native", "contract", "owner" or "authored".

## Findings

### IGN-002: Nine Vale rules were turned back on for users, then silenced here with ten ignores on 380 paths

- Where: `gspot.toml:344-402` (ignores 12 to 21); `packages/cli/configurations/general/prose/vale.ini.eta`; the copied
  styles in `packages/cli/configurations/general/prose/styles/gspot/` and their output in
  `.gspot/config/vale/styles/gspot/` (`case-sensitive-terms.yml` 346 lines, `slash-alternatives.yml` 123 lines,
  `unneeded-adverbs.yml` 271 lines, `release-notes.yml`); `packages/cli/src/config/agent-rules.ts:11`
  (`INSTRUCTION_HEADING`, `'# Engineering Guidelines'`); `TESTING.md:95`, `PLAYWRIGHT.md:16`,
  `packages/cli/src/tools/contracts.ts:151`
- Kind: delete
- Problem: The shipped Vale settings used to turn off Google.Semicolons, Google.WordListCase, Microsoft.Adverbs,
  Microsoft.Auto, Microsoft.QuestionMarks, RedHat.CaseSensitiveTerms, RedHat.Slash, RedHat.NoGerundsInTitles and
  Harper.OkToOkay. Commit `0df1cdc36` turned them on for users and, in the same commit, added path lists so that this
  repository never sees them. Commit `0abcd119f` then replaced the six Microsoft and Red Hat rules with gspot's own
  copies (`gspot.unneeded-adverbs`, `gspot.auto-prefixes`, `gspot.question-marks`, `gspot.case-sensitive-terms`,
  `gspot.slash-alternatives`, `gspot.gerund-headings`), and `release-notes.yml` came along. The copies hold Red Hat and
  Hugging Face product data (JBoss, OpenShift, Ceph, `TheBloke/\w+`) that means nothing to gspot users, and they report
  ordinary words: `case-sensitive-terms.yml` rewrites `var` to `VAR`, `OS` to `operating system`, and lowercase code
  ids such as `posix` and `ssh`; `release-notes.yml` turns every sentence that starts with "Now" into "With this
  update"; `unneeded-adverbs.yml` reports `strictly` and `separately`. Every Vale alert fails the check. The ten ignores
  name 270 files in 380 path entries (22.5 KB, half of `gspot.toml`), with reasons that claim the text must stay: ignore
  12 hides 308 semicolons in 198 files, ignore 13 hides Google.WordListCase on 97 paths although its other half,
  Google.WordList, is already off as "Google product terminology", ignores 16 and 17 hide the gerund-heading rule on
  the "Engineering Guidelines" heading gspot writes into every `AGENTS.md`, ignore 18 hides three questions in
  `WORKING.md`, and ignores 14 and 21 each hide one word ("auto-mocks", `ok`). A real Vale run on the 270 files reports
  569 alerts, all from these nine rules. If gspot's own text cannot pass them, users will not either.
- Fix: Delete the six copied styles and `release-notes.yml`, with the Tengo script of `gerund-headings`, their
  `[[tool_file]]` entries and their test samples. Turn the three upstream rules off for every user again:
  `Google.Semicolons`, `Google.WordListCase` (with the same reason as `Google.WordList`) and `Harper.OkToOkay` join
  `VALE_OFF_RULES` in `packages/cli/src/config/generation/prose.ts`, each with its reason. Delete the ten ignore
  records and their 380 paths; no text rewrite is needed. Delete the `gspot.toml` entries that exist only for the
  copied styles: the allowed words `facter` and `ODF`, their ignore records, and the `slash-alternatives` path in the
  typos ignore. The `AGENTS.md` heading becomes `# Rules` (in `config/rules.ts`). If a few terms matter (for example
  `Node.js`, `YAML`), add them to an existing gspot rule.
- Size: large

### IGN-011: The prose test samples are ignored for all of Vale, but only one rule fires

- Where: `gspot.toml:339-342` (ignore 11); `tests/config/tools/configurations/general/prose/rules.ts`
- Kind: simplify
- Problem: The reason says the file holds "literal negative test vectors" with the defects Vale detects. Vale reads
  only comments in `.ts` files, so it never sees those strings. Without the ignore, Vale reports one alert,
  `rules.ts:96 gspot.session-identifiers` (`'Use resource?sessionId=12345678.'`), and the sample must keep the session
  id, because the test expects that rule to fire.
- Fix: The samples move to `tests/config/prose.ts`. Narrow the ignore to that path and to
  `rule = "gspot.session-identifiers"`, with the true reason "The sample for the session-identifier rule is a URL with
  a session id." The rest of the file is checked again.
- Size: small

### IGN-012: zizmor's self-repository finding has an automatic fix that gspot already supports

- Where: `gspot.toml:311-315` (ignore 6); the `uses: ./.github/actions/setup` steps in `.github/workflows/ci.yml`,
  `docs.yml` and `release.yml`
- Kind: delete
- Problem: zizmor asks for GitHub's `$/` form (same repository, same commit) instead of `./`. The reason says
  "Actionlint reads ./ natively". The pinned actionlint 1.7.12, run on its own, does reject `$/`, but gspot never runs
  it on its own: the `github-actions/actionlint` check copies the repository to a scratch copy and rewrites each `$/`
  reference to `./` before actionlint reads it. Nothing else runs actionlint here. Codex widened the ignore from 2 to
  4 workflows.
- Fix: Change each setup step that remains after the workflow rework from `uses: ./.github/actions/setup` to
  `uses: $/.github/actions/setup`, push, and check that the next CI run passes on GitHub (no local tool can prove
  that the runner accepts `$/`). Delete ignore 6. Leave `release.yml:98` as it is; zizmor does not flag it. The `$/`
  rewrite in the actionlint check stays while the pinned actionlint rejects `$/`; this repository's CI then uses it.
- Size: small

### IGN-014: 50 of the 60 allowed words have a placeholder instead of a reason

- Where: `gspot.toml:198-258`
- Kind: rewrite-text
- Problem: gspot requires a reason for every allowed word. 50 entries say only "Accepted spelling from this
  repository's previous prose vocabulary.", which is no reason.
- Fix: The root list becomes `allowed_words = { value = [...], reason = "..." }`, with one reason for the whole list.
  After IGN-015 to IGN-020 only five words stay; write one true reason that covers them (IGN-018).
- Size: small

### IGN-015: Two allowed words do nothing

- Where: `gspot.toml:201` (`axe`), `:236` (`optin`)
- Kind: delete
- Problem: No tool reports these words when they are removed. `optin` was for `patches/zod.patch` and `axe` for quotes
  in the old findings files; both are deleted.
- Fix: Delete the two words.
- Size: small

### IGN-016: 18 allowed acronyms skip the "spell it out once" rule for rare jargon

- Where: `gspot.toml` allowed words BCP, BOM, CDN, CORS, CRUD, DDL, HSTS, ICU, JWT, LFS, MVVM, OCSP, ORM, PEP, RFC,
  RLS, RTL, TCA
- Kind: rewrite-text
- Problem: gspot's acronym rule asks for "Full Name (ABC)" the first time an acronym appears in a file, and the shipped
  writing rule says "avoid unexplained abbreviations". These words exist only to skip that rule, mostly in the shipped
  rules (for example `SECURITY.md:28` HSTS, `NAMING.md:117` CRUD, `POSTGRES.md:15` DDL, `SWIFTUI.md:11` MVVM and TCA).
- Fix: Spell each one out on first use in each file, for example "HTTP Strict Transport Security (HSTS)" or "row level
  security (RLS)". Delete the 18 words.
- Size: medium

### IGN-017: Seven allowed words are code names that belong in code formatting

- Where: `gspot.toml` allowed words `"(?-i:PATH)"`, `HEAD`, `GET`, `NUL`, `STDOUT`, `BASH`, `PID`
- Kind: rewrite-text
- Problem: These are an environment variable, a Git ref, an HTTP method, a byte, a stream, a file name (`BASH.md`) and
  a process id, written as plain words. Vale does not check text in backticks. `(?-i:PATH)` is also a regular
  expression: Vale reads it as a pattern, but the generated heading-case, title-case and possessives rules turn it into
  the literal text "(?-i:PATH)", which never matches.
- Fix: Write `` `PATH` ``, `` `HEAD` ``, `` `GET` ``, `` `NUL` ``, `` `stdout` ``, `` `language/bash/BASH.md` `` and
  `` `PID` `` (or "process id"). Delete the seven words, and `Bash` with them: it is needed only while `BASH` stays.
- Size: small

### IGN-018: Four needed words give false reasons

- Where: `gspot.toml:207` (`capitalisation`), `:223` (`IIF`), `:228` (`LICENCE`), `:254` (`udid`)
- Kind: rewrite-text
- Problem: The reasons point to "original findings" and "preserved findings", which are deleted, and to an "ESLint
  selector" that does not exist. typos flags `capitalisation` in the SQLFluff rule source and its tests, `IIF` in the
  ESLint option `IIFEs`, `LICENCE` in two tests, and `udid` in two init test samples.
- Fix: Keep the four words, with `next-intl` (the title of `NEXT-INTL.md`). Their reasons merge into the one reason of
  `allowed_words` and must be true: SQLFluff spells its rule group "capitalisation"; `IIF` is part of the ESLint option
  name `IIFEs`; tests check the British license file name `LICENCE`; `udid` is Apple's device id, used as a sample word
  in the init tests; `next-intl` is a package name.
- Size: small

### IGN-020: 25 common abbreviations belong in the shipped acronym list, not in this repository

- Where: `gspot.toml` allowed words ASCII, BSD, CPU, CRLF, CSV, ESM, GNU, HTTPS, INI, JSX, MIME, MIT, POSIX, README,
  SCSS, SDK, SHA, SSH, SVG, TLS, TSX, UTC, UTF, WASM, XML
- Kind: move
- Problem: Every reader knows these. Every gspot user who writes "README" or "UTF-8" hits the acronym rule and must add
  the same words with a reason.
- Fix: Add the 25 abbreviations to the shared acronym list in `packages/cli/src/config/generation/prose.ts`, from which
  the Vale builder writes the acronyms style (CFG-038). Delete them from `allowed_words`.
- Size: small

### IGN-021: The two findings-folder ignores are dead

- Where: `gspot.toml:301-304` (`docs/stale-paths`), `gspot.toml:329-332` (`prose/vale`)
- Kind: delete
- Problem: `FINDINGS.md` and the old Markdown files in `findings/` are deleted, so both records cover nothing the two
  checks read. Once the deletion is committed, gspot's own settings check reports `FINDINGS.md` as a pattern that
  matches no tracked file.
- Fix: Delete both records. If the new findings files are committed later, run the two checks on them before adding
  any ignore.
- Size: small

### IGN-022: A special architecture path exists because the program file sits outside its folder

- Where: `gspot.toml:85,120,135,145` (`[[architecture.modules]]` paths); `packages/cli/src/public.ts`,
  `packages/cli/src/config/tools/vale.ts`, `packages/cli/src/parsers/schema/configurations.ts`
- Kind: move
- Problem: Most modules use one plain pattern, but three need special ones: `commands` adds `public.ts` at the source
  root (it was `commands/program.ts` until commit `9a3851a9a`); `tools` uses `config/tools/!(vale).ts` while
  `configurations` adds `config/tools/vale.ts`; `parsers` uses `parsers/schema/!(configurations).ts` while
  `configurations` adds that file. Each special path means a file lives in one module's folder but belongs to another.
- Fix: Move `packages/cli/src/public.ts` back to `packages/cli/src/commands/program.ts` and update its importers
  (`packages/cli/src/main.ts:1`, `docs/src/content/reference/commands.ts:2` and the path string at `:76`,
  `tests/cli/commands/help.test.ts:2`, `tests/harness/gspot.ts:4`). `VALE_PACKAGES` and `VALE_PACKAGE_FOLDERS` stay in
  `packages/cli/src/config/tools/vale.ts`, and the `!(vale)` path goes, because `config/` becomes its own module. The
  parsers path goes with PAR-009. Then each area module lists only its own folder, for example
  `[[architecture.module]] name = "commands"`, `paths = ["packages/cli/src/commands/**"]`, beside one `config` module
  (`packages/cli/src/config/**`, may import nothing) and one `types` module (`packages/cli/src/types/**`, may import
  `config`).
- Size: small

### IGN-024: The CodeQL ignore on `fragments.ts` names code that is gone

- Where: `gspot.toml:404-408` (ignore 22); `packages/cli/src/generation/fragments.ts`
- Kind: delete
- Problem: The reason says "JSON.stringify emits whole literals into a standalone ESLint module". The file no longer
  calls `JSON.stringify` or any other code-building call; it was rewritten on 2026-10-08.
- Fix: Delete the record. If the next CodeQL run reports `js/bad-code-sanitization`, add a record on the file it names,
  with a reason that matches the code.
- Size: small

### IGN-025: The incomplete-sanitization ignore can go with an anchored pattern

- Where: `gspot.toml:422-426` (ignore 25); `packages/cli/src/checks/tool/public.ts:40-55` (`replaceReference`)
- Kind: simplify
- Problem: `replaceReference` replaces the first `$` in the value with an unanchored pattern without the `g` flag,
  `source.replace(/\$|\\x24|\\u0024|\\U00000024/u, ...)`. CodeQL reads that as "replaced only the first one", but the
  code means "the marker at the start".
- Fix: Anchor the pattern at the start of the value, after optional spaces (a block scalar starts with its indentation)
  and an optional quote: `SELF_REPOSITORY_MARKER = /^(\s*["']?)(\$|\\x24|\\u0024|\\U00000024)/u` in
  `packages/cli/src/config/checks/infrastructure/github-actions.ts`, and keep the first group in the replacement;
  `replaceReference` moves to `packages/cli/src/checks/infrastructure/github-actions.ts`. Delete the record. If CodeQL
  still reports after the change, keep the record with a plain reason.
- Size: small

### IGN-031: The generated ignore files repeat each pattern once per folder

- Where: `.prettierignore:14-57`, `.semgrepignore:16-59`; the generator behind
  `packages/cli/src/generation/documents/contracts.ts:155` (`scopeIgnorePatterns`)
- Kind: simplify
- Problem: Both files use Git ignore syntax, where `node_modules/` and `bun.lock` already match at every depth, so the
  44 lines such as `docs/bun.lock` and `tests/node_modules/` add nothing. Each file also lists lockfiles of five
  package managers this repository does not use, and `.prettierignore:61-65` names four `prettier.config.mjs` pointers
  that gspot never writes here.
- Fix: Write each pattern once, without a folder prefix. List a pointer file only in the folders where gspot writes
  it. Keep files that a selected configuration declares as generated by a tool (`docs/worker-configuration.d.ts`, which
  `wrangler types` writes later). Never make the list depend on which files exist today, or the generated file would
  change whenever such a file appears.
- Size: small

### IGN-034: Allowed words go to five tools and mean something different in each

- Where: `packages/cli/configurations/general/spelling/typos.toml.eta`,
  `packages/cli/configurations/general/prose/vocabularies/gspot/accept.txt.eta`, the heading-case, title-case and
  possessives Vale rules; `.gspot/config/typos.toml`
- Kind: simplify
- Problem: One allowed word becomes two typos allow-lists plus a third copy, a Vale vocabulary pattern, an escaped
  literal in two heading rules, and a word that the possessives rule now forbids ("Bash's"). So allowing a word also
  bans a form of it, and an entry written as a pattern, such as `(?-i:PATH)`, works in Vale and is a dead literal
  everywhere else. `typos.toml` holds the 60 words three times (183 of its 200 lines).
- Fix: Treat `allowed_words` entries as plain words only (reject patterns). Do not feed them into the possessives rule.
  Check whether typos needs `extend-identifiers` and the third copy besides `extend-words`; if not, write the list
  once.
- Size: small
