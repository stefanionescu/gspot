# What Codex did

From 2026-10-07 to 2026-10-10 Codex made 329 commits (`git log b36d7d0fc..HEAD`) and recorded 147 owner decisions in
`findings/progress.json`, which is deleted now (read the old copy with `git show HEAD:findings/progress.json`). The rule
was "every change simplifies", yet production source grew by 3,194 lines (7%) and tests by 10,747 lines (15%), and
most decisions from #37 on approve byte growth after the fact. Many of the changes were asked for by the earlier
audit, so the work was requested; nobody checked whether it needed that much code. The target: no byte ledger and no
approval records; every change deletes, merges, or replaces code with less code; owner decisions are dated plain
sentences in `AGENTS.md`; and the code that the decisions allowed is simplified by the records below and in the area
files they name.

## Findings

### DEC-001: The "size exception" process turned "every change simplifies" upside down

- Where: the old `findings/progress.json` decisions #37 to #147; commits that cite an "approved size exception", for
  example `cccfbf987`, `6fd79235d`, `52404404f`, `ce80ebd66`, `dc5630812`, `af5b3ec22`, `9bf9bfaf9`
- Kind: rewrite-text
- Problem: Instead of making each change smaller, Codex asked for approval of exact byte growth, one change at a time,
  often after the code was merged. About 100 decision records state a byte count; together they approve about 494 KB
  (an upper bound, since shared costs may be counted twice). The owner approved each one, so the rule had no effect.
  The approval text measures bytes and never asks whether the code is needed. Reading the code behind each decision:
  63 are justified (a real bug fix, or a change the earlier audit asked for), 24 are padding (defensive code, a
  one-caller option, a special case), 5 are partly padding, 2 needed an owner call, and 9 cannot be tied to any commit.
- Fix: Stop the byte ledger and keep the rule as written: each commit deletes, merges, or replaces code with less
  code. If a fix really needs more code (a real bug fix), the commit message says why in one sentence; no approval
  record is made. Simplify the code these decisions allowed through the records that name it (for example DEC-008,
  DEC-009, DEC-021, TTC-001, TTO-003, LIF-001, ARC-002).
- Size: large

### DEC-002: About 264 KB of growth was approved after the fact, and the records cannot say where it is

- Where: decisions #79, #88, #89, #93, #110, #121, #125, #128, #129, #131 and #136 of the old `findings/progress.json`;
  the old `findings/verification.json`
- Kind: delete
- Problem: These 11 decisions approve 263,388 bytes of growth that was already committed, grouped into "historical
  cohorts", "pools" and "packets". #110 alone approves "the frozen 544-owner historical implementation: 21,319 authored
  production and 131,400 total bytes". The records do not name the commits that added the code: 12 records point to
  one unrelated commit (`0fe695639`), the commit current when the record was closed. The proof is a file in `/tmp`.
  The parts the decisions name match findings of the earlier audit, so the work was asked for; only its size was
  never checked.
- Fix: Do not trust these approvals. Treat the code they cover like any other code, and simplify it in the review of
  each area. Do not move these records anywhere (DEC-026).
- Size: small

### DEC-008: The TypeScript check guards and hand-picks the files of its scratch copy

- Where: `packages/cli/src/checks/language/contracts.ts` (`assertOutputsInside`, `assertBuildInside`, `compilerFiles`,
  `compilerCopyInputs`), callers `tsc` and `checkjs` in `packages/cli/src/checks/language/public.ts:82-152` and
  `nextjsTsc` in `packages/cli/src/checks/framework/public.ts:97-138`; commits `6fd79235d`, `9f5dd012b`, `ce783aff9`,
  `d4b9f0ea3`, `777d4820e`; decisions #46, #76 and #138 (about 17.6 KB of production code)
- Kind: simplify
- Problem: An ordinary TypeScript scope is checked in place (`tsc --noEmit -p` against the repository). Three cases
  copy the project to a scratch copy, because the compiler or `next typegen` would write into the repository: a project
  with references (`tsc -b`), the JavaScript check, and Next.js. That copy has a reason, and a test proves that no
  build output lands in the repository. What is extra is how the copy is chosen and guarded: gspot builds a TypeScript
  program in memory to compute the exact set of source files to copy, refuses a project that "imports source outside
  its scope", and checks that no build output lands outside the copy. The guards cover states that a normal repository
  never reaches.
- Fix: Keep in-place checks for ordinary scopes and the scratch copy for the three cases. Delete
  `assertBuildInside`, `assertOutputsInside`, the "imports source outside its scope" throw, `compilerFiles` and
  `compilerCopyInputs`, and copy the scope with `copyIntoScratch(checkInput(session, planned))`, as `nextjsTsc` already
  does when no tsconfig exists. The unit tests of the copied file set go with them. Keep the reference-build test;
  delete only its assertions on internal functions (TTC-029). One real run must show that the plain copy is fast
  enough for a large monorepo.
- Size: large

### DEC-009: `init` runs Prettier in a child program to guess three format settings

- Where: `packages/cli/src/parsers/tool/format.ts` (a separate program), `packages/cli/src/parsers/tool/public.ts`
  (`readFormatConfiguration`), `packages/cli/src/config/parsers/tool/format.ts` (`FORMAT_RESULT = '\u001E'`,
  `FORMAT_PROGRAMS`), `packages/cli/src/parsers/schema/format.ts`, `packages/cli/src/commands/init/public.ts`
  (`readFormatTables`), `packages/cli/package.json:72` (`"prettier": "3.8.1"` in `dependencies`), `scripts/build.ts:37`, `gspot.toml:270`, `.gspot/config/knip.json:126,164`; commits `cccfbf987`
  (#42) and `ce768c0a5` (#45)
- Kind: simplify
- Problem: At `init`, gspot reads the repository's Prettier and EditorConfig settings to get three values: tab width,
  line width and quote style. The feature was asked for (gspot's defaults reformat a typical JavaScript repository),
  but the build is heavy: Prettier became a runtime dependency of the CLI, it runs in a child program so that a
  JavaScript Prettier config cannot break the JSON output, and the child marks its answer with an ASCII
  record-separator byte. That is four files, a second build entry, a large dependency, and a private protocol for three numbers that the user can also set in `gspot.toml`. The child calls `await check('', { ...options, parser: 'json' })` and throws the result away with no comment, and it is the only child program with a source-or-dist path switch (`import.meta.url.endsWith('.ts')`).
- Fix: Keep the feature and make it small. Delete the child program, `FORMAT_RESULT`, `FORMAT_PROGRAMS`, its build entry in `scripts/build.ts:37`, its knip entries (`gspot.toml:270`, `.gspot/config/knip.json:126,164`), and the `prettier` runtime dependency. `readFormatConfiguration` becomes `readFormatOptions` in
  `packages/cli/src/commands/init/format.ts`: it reads `.editorconfig` with a small INI read, and `.prettierrc`,
  `.prettierrc.json` and the `prettier` key of `package.json` as JSON. A Prettier file or a `prettier` dependency
  still means the project uses Prettier; when its settings are in a JavaScript file, use Prettier's own defaults
  (`PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false }`), and a project that uses Prettier gets them for the options it does not set. `PRETTIER_FILES`, `EDITORCONFIG_FILE`, and `PRETTIER_DEFAULTS` go to `packages/cli/src/config/commands/init.ts`. The schema moves beside it as `formatOptionsSchema` (today `formatConfigurationSchema`), without `.nullable()`, which only served the child program.
- Size: medium

### DEC-011: `n/no-sync` is on for every user and off for all of gspot's own source

- Where: `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:222` (`'n/no-sync': 'error'`);
  `gspot.toml:317-321` (`[[ignore]]` for `javascript/eslint`, `n/no-sync`, paths `packages/cli/src/**` and
  `scripts/**`); seven `eslint-disable-next-line n/no-sync` comments in `tests/cli/commands/apply.test.ts`,
  `tests/cli/execution/fixers/policy-layout.test.ts`, `tests/cli/lifecycle/hooks.test.ts` (2) and
  `tests/cli/platform/claims.test.ts` (3); commit `ca2975ca5`
- Kind: delete
- Problem: Before Codex the shipped lint rules had `'n/no-sync': 'off'`. Following the earlier audit, Codex turned it
  on for every user and added one `[[ignore]]` for gspot's own source. But gspot's own CLI code cannot follow a rule
  it ships (232 lines call synchronous file functions, because a CLI reads and writes files in order), and the tests
  need seven inline disables.
- Fix: Set `'n/no-sync': 'off'` again for every user, in the lint rule tables of
  `packages/cli/src/config/generation/eslint-rules.ts`, with a reason that holds for any repository. Run `gspot apply`.
  Delete the `[[ignore]]` record and the seven inline disables (the two in `hooks.test.ts` go with their tests,
  TEL-003).
- Size: small

### DEC-021: `wrangler.toml` validation imports Ajv by hand

- Where: `packages/cli/src/checks/platform/cloudflare.ts` (`wrangler`), `packages/cli/src/types/checks/cloudflare.ts`
  (`SchemaCompiler`); commit `e612fce45`, decision #48
- Kind: simplify
- Problem: The check finds the Ajv that the `files` configuration installs for v8r, imports it through a file URL,
  checks the import with a Zod `z.custom` guard, reads `wrangler/config-schema.json` and compiles it. gspot already
  runs v8r, a JSON Schema validator that takes a schema path and reads TOML files.
- Fix: Run v8r with `--schema` pointing at Wrangler's `config-schema.json`, as a command declared in the Cloudflare
  manifest. The schema lives in the user's own Wrangler install, which gspot finds at run time, so the manifest
  command needs a placeholder for that path; adding it is part of this fix. Delete `SchemaCompiler` and its file, the
  dynamic import and the Zod guard. Keep the name and date checks (`WRANGLER_FIELDS`); the function becomes
  `cloudflareWrangler`.
- Size: small

### DEC-025: Test "moves" and "consolidations" that add code

- Where: commits `502287f97` (#57, +1,133 bytes for a "mechanical" move), `e895a73c3` (#113, +1,489 bytes for a
  "test-owner move"), `2b3bacbfd` (#60, tests +5,238 bytes against −57 bytes of code); #59 and #119 (commits not
  found)
- Kind: simplify
- Problem: A pure move of a test should not change its size, and a merge should make it smaller. These commits did
  the opposite and asked for size approvals. `502287f97` copied 12 lines of Git setup from
  `tests/cli/execution/copy/entries.test.ts` into a new test in `tests/cli/repository/revisions/push.test.ts`;
  `e895a73c3` copied the `test.each(CASES)` loop of the Next.js test file into
  `tests/cli/checks/library/translations.test.ts`; much of the `2b3bacbfd` growth is `__proto__` key tests that exist
  only for the zod patch.
- Fix: For #57, put the shared Git setup in one function in `tests/setup/git.ts`. For #113, call the one shared case
  runner (`runCheckSample`) from both files instead of a second copy of the loop. For #60, delete the `__proto__` tests
  with the zod patch (ROOT-004). Keep the `describe` blocks of `c84681573`: the earlier audit and the shipped testing
  rule ask for them, and their growth is indentation. Rule for later work: a move commit shows zero growth.
- Size: medium

### DEC-026: `progress.json` was not a useful record; the decisions list in `AGENTS.md` replaces it

- Where: the old `findings/progress.json` (1 MB) and `findings/verification.json` (500 KB); `AGENTS.md:94-103`
- Kind: delete
- Problem: The file was meant to record owner decisions and became Codex's private work log: 1,092 finding IDs, 252
  checkpoints, 1,648 "assignments", and evidence hashes that point to 386 files in `/tmp`, outside the repository. Its
  "commit" fields name the commit current at closing time, not the commit that did the work (DEC-002). Decisions #30
  to #147 approve byte counts, not product choices. No program reads it; it grew from 95 KB to 1 MB in four days and
  needed a second file to stay under the file-size check.
- Fix: Do not restore `progress.json`, `verification.json` or a per-record ledger. The decisions list in `AGENTS.md` is
  the one record of owner decisions: each item is one plain sentence with a date ("2026-10-06: gspot ships only as
  JavaScript on npm."), added only for a product choice, never for a byte count or a single fix. DCX-017's new text for
  that part of `AGENTS.md` carries the list; fill in each date from Git history before applying it. Commit messages
  and Git history record what changed and why. A later review is a normal Markdown report, deleted when the work is
  done.
- Size: small

### DEC-028: The decision texts are jargon that the owner cannot check

- Where: the old `findings/progress.json`, `decisions[*]` (`id`, `scope`, `decision`, `evidence`)
- Kind: rewrite-text
- Problem: Most decisions are written in Codex's private words: across the 147 records, "native" appears 159 times,
  "owner" 92, "freeze" 83, "exact" 79 and "verified" 55, and more than 1,000 places glue a word to a number
  ("its4397-byte", "exact65"). For example, #143: "Each canonical shard string owns its index and total, used by the
  name and native flag."
- Fix: The old records are gone (DEC-026); do not rewrite them. Write each later decision as plain sentences, so that
  the reader sees at once whether the change is needed. For example, #143 becomes "Split the tool tests into 16 CI jobs
  per operating system, because Windows jobs passed the 60-minute limit", and #51 becomes "In the ESLint rules, put the
  rules for level `all` inside an `if all` block; the output does not change". For both, the answer is no.
- Size: small

### DEC-029: The commit history is full of bookkeeping and jargon

- Where: `git log b36d7d0fc..HEAD`
- Kind: rewrite-text
- Problem: 56 of the 329 commits only update the ledger ("account for ten verified findings"). Many messages read like
  test-count receipts ("Validation: 1092 unique IDs and 1648 unchanged assignments ..."), and the words "native" (502
  times), "owner" (284), "ledger" (82) and "checkpoint" (38) run through the messages.
- Fix: Add one sentence to the new `AGENTS.md` text (DCX-017): "A commit message says what changed and why, in plain
  words. Do not list test, ledger, or byte counts." The existing history stays as it is.
- Size: small

### DEC-030: About 37,800 `gspot-*` entries are left in the machine's `/tmp`

- Where: `/tmp/gspot-*` on the owner's machine (outside the repository)
- Kind: delete
- Problem: Codex wrote its "freeze", "proof" and "receipt" files and its test runs' folders into `/tmp`. They are the
  only copy of the evidence the old ledger cites, and nothing in the repository needs them. They take disk space, and
  macOS may delete them on a restart anyway.
- Fix: Delete them with `rm -rf /tmp/gspot-*` at a time when no gspot command and no test run is active: gspot's own
  scratch folders use the same `gspot-` prefix.
- Size: small

### DEC-034: Two shipped lint rules disagree, so the source needs disable comments

- Where: `packages/cli/src/parsers/output/contracts.ts:79` and `packages/cli/src/parsers/sql/public.ts:30`
  (`eslint-disable-next-line @typescript-eslint/no-misused-spread`); commit `e58770319`, decision #24
- Kind: simplify
- Problem: `unicorn/prefer-spread` asks for `[...text]` instead of `Array.from(text)`, and
  `@typescript-eslint/no-misused-spread` reports `[...text]` on strings. Both are on, so code that counts Unicode
  characters needs a disable comment, and users of the shipped lint rules hit the same conflict. Decision #24 chose
  `[...text]` and kept `unicorn/prefer-spread`.
- Fix: Keep `[...text]` and `unicorn/prefer-spread`. Count characters in one helper, `codePointLength(text)`, with one
  suppression and its reason, and use it in both places (PAR-053). Then check whether the `allow` option of
  `@typescript-eslint/no-misused-spread` accepts the string type; if it does, set it in the shipped TypeScript lint
  rules, so users do not hit the conflict either, and delete that last suppression.
- Size: small
