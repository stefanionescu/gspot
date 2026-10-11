# The documentation site, READMEs, and AGENTS.md

This area is everything a person reads about gspot: the documentation site (an Astro Starlight site for
generativespotting.com on Cloudflare Workers), the root README, the npm READMEs of the CLI and the ESLint plugin,
`docs/README.md`, and the hand-written part of `AGENTS.md`. It also holds the site code: the components,
`docs/src/config/`, `docs/src/types/`, the styles, and the code that builds the reference pages from the CLI at build
time. The target is 24 hand-written pages with one job each, which teach only the 14-command CLI, the final
`gspot.toml` keys, and the two install paths (a package manager, or mise), in plain words and with one copy of each
fact; and site code with no copies of Starlight parts and no build step that hides findings. Line numbers are those
at commit `c3def5bf6`.

## Findings

### DOC-002: The site build deletes unused CSS, so the unused-CSS check can never fail

- Where: `docs/astro.config.ts:71-93`, `docs/package.json:19` (`purgecss`), `.gspot/config/docs/purgecss.config.mjs`
- Kind: delete
- Problem: The `site/purgecss` check reports CSS selectors that no built page uses. It reads the output of
  `bun --bun astro build`, and that build runs an `unused-css` hook that rewrites every built CSS file without the
  unused selectors. So the check always passes, and dead source CSS stays hidden (DOC-039). The hook also copies the
  PurgeCSS word-splitting rule by hand, in a second form beside the generated `.gspot/config/docs/purgecss.config.mjs`.
- Fix: Delete the `unused-css` integration, the `join`, `PurgeCSS`, `fileURLToPath`, and `writeFile` imports that only
  it uses, and the `purgecss` devDependency in `docs/package.json`. Run the site check and delete the dead source CSS
  it reports. If it then reports only CSS that Starlight ships, add one `[[ignore]]` of `site/purgecss` for the
  `docs/` paths with that reason: a framework's CSS cannot be fixed here. Visitors then download Starlight's full CSS;
  no size check covers that.
- Size: small

### DOC-005: An example on the gspot.toml page fails because it needs a reason

- Where: `docs/src/content/docs/guides/policy.md:89`
- Kind: fix-bug
- Problem: `gspot set limits.min_function_statements 1` sets the limit below its default of 2, which loosens the check,
  so gspot refuses it without `--reason`. The page says two lines above that loosening needs a reason.
- Fix: Write `gspot set limits.min_function_statements 1 --reason "Our event handlers are one line by design."`, or drop
  the line and keep only the per-language example that raises the number.
- Size: small

### DOC-006: The docs say a failed fix gives exit code 1; the code gives 2

- Where: `docs/src/content/docs/reference/runtime.md:9`, `packages/cli/src/config/commands/help.ts:53` (shown on the
  generated `reference/commands/check` page and in `gspot check --help`)
- Kind: fix-bug
- Problem: Both say exit `1` means "findings remain, or a fix (correction) failed". A failed fixer makes the run
  incomplete, which is exit `2` (`isIncomplete`, `packages/cli/src/execution/report.ts:16-19`).
- Fix: Do after CLX-012. The exit-codes page (`reference/exit-codes.md`, DCP-006) says "1: findings remain." and "2:
  the run could not finish: a tool is missing, a fixer failed, a report is invalid, or the input is invalid."
  `gspot check --help` prints the same two lines, as CLX's target help writes them.
- Size: small

### DOC-008: The Security page tells readers to select configurations that are always selected

- Where: `docs/src/content/docs/guides/security.md:6`, `:24`, `:42`, `:47`
- Kind: fix-bug
- Problem: "Five configurations carry security checks. Select the ones your repository needs" and "With the `security`
  configuration, ...". But `secrets`, `dependencies`, and `security` are always selected, and `gspot remove` refuses
  general configurations. Only `docker` and `github-actions` depend on your files. The gspot.toml page says the
  opposite (`policy.md:49`).
- Fix: Line 6: "These configurations hold security checks. `secrets`, `dependencies`, and `security` are always
  selected. `docker` and `github-actions` are selected when gspot finds their files." Lines 24 and 47: drop "With the
  `security` configuration,". Line 42: "With the `swift` configuration, Semgrep also runs ...".
- Size: small

### DOC-009: The hooks page turns hooks on with `gspot set` and stops, but Git uses them only after `gspot install`

- Where: `docs/src/content/docs/guides/hooks.md:48-53`
- Kind: fix-bug
- Problem: The page shows `gspot set hooks.enabled true` and stops. Only `gspot install` points Git at `.gspot/hooks/`
  (`core.hooksPath`); `set` and `apply` only write the hook scripts, and they print no reminder when hooks are turned
  on (DOC-085). A reader thinks hooks are on when they are not.
- Fix: "To turn hooks on, run `gspot set hooks.enabled true`, then `gspot install`. `gspot install` points Git at the
  hooks." The `hooks.push_files` line goes (TML-002 deletes the key).
- Size: small

### DOC-010: The CI page runs `gspot apply` after `gspot set`, which already applied

- Where: `docs/src/content/docs/guides/ci.md:42-45`
- Kind: fix-bug
- Problem: `gspot set` writes the setting and applies it (`savePolicy` writes every generated file). The extra
  `gspot apply` does nothing and teaches a wrong habit.
- Fix: No page runs `gspot apply` after `gspot set`. `gspot set ci.enabled true` and `gspot set ci.setup_command npm ci`
  write the workflow themselves (the `ci.md` text in "Changes by file").
- Size: small

### DOC-011: gspot deletes `CLAUDE.md`, so Claude Code users cannot point it at `AGENTS.md`

- Where: `packages/cli/src/lifecycle/ownership/claude-file.ts:24-41`, `packages/cli/src/lifecycle/public.ts:103`
  (`moveClaudeFile`), `docs/src/content/docs/guides/agents.md:12-14`
- Kind: delete
- Problem: The agents page says Claude Code reads `CLAUDE.md`, not `AGENTS.md`, and tells readers to configure their
  agent to read `AGENTS.md`. The usual way for Claude Code is a `CLAUDE.md` that points to `AGENTS.md`, but `init` and
  `apply` move the text of any `CLAUDE.md` into `AGENTS.md` and delete the file, even a pointer-only file or a
  symbolic link. The advice cannot work, and the page does not say what does.
- Fix: Delete the code that moves and deletes `CLAUDE.md` (`claude-file.ts`, the `moveClaudeFile` call, and their
  tests). gspot never touches `CLAUDE.md`. The agents page tells Claude Code users to put `@AGENTS.md` in their own
  `CLAUDE.md` (the `agents.md` text in "Changes by file").
- Size: small

### DOC-014: The TypeScript quickstart output does not match the real output, and a step is missing from its code block

- Where: `docs/src/content/docs/guides/quickstart/typescript.md:128-137`, `:187`, `:193`
- Kind: fix-bug
- Problem: (1) Step 3 says "Run `npx gspot check`", but the block below holds only `git add` and `git commit`. (2) The
  excerpt prints "gspot explain <rule>"; gspot prints the rule in backticks (`docs/src/config/example.json:72`). (3)
  "The level `all` adds the level `all` conventions" says nothing. (4) The output block ends with an empty line.
- Fix: The page becomes `guides/quickstart/javascript-typescript.mdx` and builds its blocks from `example.json`
  (DCP-002, DCX-013). On it, the step-3 block starts with `npx gspot check`; the help line comes from the recorded
  output exactly as gspot prints it; the level sentence is DCX-013's; the output block has no timings and no empty
  last line. Separately, help text that gspot prints in a terminal should not carry Markdown backticks
  (`packages/cli/configurations/language/javascript/manifest.toml:481`); when that text changes, record the example
  again.
- Size: small

### DOC-015: "errored" is not a status gspot prints, and the report description is wrong

- Where: `docs/src/content/docs/guides/findings.md:82-85`
- Kind: rewrite-text
- Problem: The page says the report lists "failed, missing, errored, and skipped checks". The statuses are `passed`,
  `failed`, `missing`, `error`, and `skipped`, and the report prints every check, not only the bad ones. A failed
  fixer also makes the run incomplete.
- Fix: "The report prints one line per check with its status: `passed`, `failed`, `missing` (the tool is not
  installed), `error`, or `skipped`. Then it prints the totals. A skipped check did not run, so it did not pass. If a
  check is `missing` or `error`, or a fixer failed, the summary line ends in `(incomplete)` and gspot exits 2." This
  page is the one home of the skipped-check sentence; other pages link here.
- Size: small

### DOC-016: `--changed --base` is shown where `--base` alone does it

- Where: `docs/src/content/docs/guides/findings.md:50-57`, `docs/src/content/docs/guides/hooks.md:44-46`
- Kind: simplify
- Problem: `--base` turns on `--changed` by itself (`.implies({ changed: true })`). The pages write both and then
  explain that "`--changed` is boolean", which is jargon. The CLI's own example is `gspot check --base origin/main`.
- Fix: Use `gspot check --base origin/main` in both places. Replace `findings.md:57` with "`--changed` checks the files
  changed since your upstream branch, or the default branch when there is no upstream. `--base <branch>` picks another
  branch. `--staged` checks only staged files."
- Size: small

### DOC-018: An environment variable and a hand-kept table exist only for "Edit page" links that point at TypeScript code

- Where: `docs/src/content/revision.ts`, `docs/src/content/reference/page.ts:1,12-17`, `docs/src/config/reference.ts:14-23`
  (`COMMAND_OWNERS`), `docs/src/content/reference/commands.ts:10-12`, every `referencePage(..., owner)` call,
  `docs/src/types/reference.ts` (`ReferencePage.data.editUrl`), `.github/workflows/docs.yml:52-53`
- Kind: delete
- Problem: Each generated reference page links "Edit page" to the source file of its text. For that the site needs the
  variable `GSPOT_DOCS_REVISION` (with its own format check), a CI step that sets it, a hand-kept table of which file
  registers each command, and a build-time file check that fails when the table is out of date. The link helps only a
  contributor who wants to change CLI text; a reader of `gspot check` lands in
  `packages/cli/src/commands/check/command.ts`. This repository bans environment switches and one-caller options.
- Fix: Set `editUrl: false` in `referencePage` and drop its `owner` parameter (10 calls in 6 files). Delete
  `docs/src/content/revision.ts`, `COMMAND_OWNERS`, the `access` import and call in `commands.ts`, and the "Name the
  source commit" step in `.github/workflows/docs.yml`.
- Size: small

### DOC-020: Dead type `SchemaNode`

- Where: `docs/src/types/reference.ts:13-20`
- Kind: delete
- Problem: Nothing uses it.
- Fix: Delete the type and its comment.
- Size: small

### DOC-021: Dead CSS variable `--brand-tangerine`

- Where: `docs/src/theme.css:10`
- Kind: delete
- Problem: Defined, never used.
- Fix: Delete line 10.
- Size: small

### DOC-022: Two fields of `example.json` have no reader, and the homepage types one of them by hand

- Where: `docs/src/config/example.json:2` (`version`), `:70` (`fix.correction`), `docs/src/components/home/Hero.astro:78-85`
- Kind: delete
- Problem: No code reads `version` or `fix.correction`. The homepage "3. Fix" tab writes the same fix text by hand as
  two list items ("Delete `src/utils.ts`" and "Call `calculateTotal` directly").
- Fix: Delete `version` and `fix.correction`. The two list items in `Hero.astro` stay as the one copy of the fix text.
- Size: small

### DOC-023: `src/env.d.ts` repeats a line Astro already generates

- Where: `docs/src/env.d.ts`
- Kind: delete
- Problem: The file holds `/// <reference types="astro/client" />`. `docs/tsconfig.json:12` already includes
  `.astro/types.d.ts`, whose first line is the same reference; `astro check` writes that file.
- Fix: Delete `docs/src/env.d.ts`. Run `astro check` once to confirm.
- Size: small

### DOC-024: The command reference code handles nested subcommands gspot does not have, and checks for duplicates three times

- Where: `docs/src/content/reference/commands.ts:10`, `:46-59`; `docs/src/content/reference/collection.ts:35-38`, `:109`
- Kind: simplify
- Problem: `commandPages` walks the command tree recursively and builds paths like `commands/a/b.md`, and
  `commandPage` splits names on spaces to find a "root command". gspot's commands are flat. Page IDs are also checked
  for duplicates in three places, though command, configuration, check, and rule names are unique by construction.
- Fix: Loop once over `program.commands` (the `.includes` filter at line 51 goes too, because `program.commands` never
  holds the help command). Drop `ancestors`, `rootCommand`, and the recursion. Keep only the check at
  `collection.ts:109`, which catches a hand-written page that collides with a generated one; delete the other two.
- Size: small

### DOC-025: Build-time guards repeat what the schemas already enforce

- Where: `docs/src/content/reference/checks.ts:30-31`, `docs/src/content/reference/plugin.ts:37-38`,
  `docs/src/content/reference/commands.ts:23`
- Kind: delete
- Problem: `checkPage` throws when a check has no example, but the manifest schema already requires `example` to be a
  non-empty string. The plugin rule type already requires `example: string`. `commandPage` falls back to "required"
  or "optional" when an argument has no description, but every argument has one.
- Fix: Delete the two example guards and use `argument.description()` directly in `commandPage`. Keep the `find` and
  its `throw` in `Hero.astro`: `example.agent.files` is a plain array, so with `noUncheckedIndexedAccess` and no
  non-null assertions, TypeScript needs that check.
- Size: small

### DOC-026: The same "tool name" expression is written twice

- Where: `docs/src/content/reference/collection.ts:63-65`, `docs/src/content/reference/checks.ts:7-8`
- Kind: merge
- Problem: Both turn `check.tool` (a string, list, or record) or `check.command[0]` into one display string.
- Fix: Export one `toolLabel(check)` from `checks.ts` and call it from `collection.ts`.
- Size: small

### DOC-027: Each command has two different one-line summaries on the site

- Where: `docs/src/content/reference/commands.ts:37-39`, `:60-63`
- Kind: simplify
- Problem: The commands index uses `command.summary()`; each command page uses the first sentence of
  `command.description()`. The same command is described two ways, and the code needs a sentence splitter and a
  comment.
- Fix: Use `command.summary()` for the page description too; every command sets it. Delete the split and its comment.
- Size: small

### DOC-029: The gspot.toml reference intro repeats the Settings intro and overstates the JSON Schema

- Where: `docs/src/content/reference/policy.ts:65`, `docs/src/config/reference.ts:2` (`SETTINGS_INTRO`)
- Kind: rewrite-text
- Problem: Both intros say "Any limit can be set for one language as `limits.<language>.<name>`." The gspot.toml intro
  also says the JSON Schema "defines full validation for editors". It does not: rules such as "a reason must have a
  matching setting" cannot be written in JSON Schema; gspot itself is the full check.
- Fix: Do after POL-035 (one "gspot.toml reference" page). `SETTINGS_INTRO` becomes `GSPOT_TOML_INTRO`, the one intro:
  "Every table and key of `gspot.toml`, with its default. A value that loosens a check is written
  `{ value = ..., reason = "..." }`. Any limit can be set for one language as `limits.<language>.<name>`. A scope
  inherits the root and every scope that contains it: a single value replaces the inherited one, and a list adds to
  it. A command (a list of arguments) replaces the inherited one as a whole. Every path is relative to the repository
  root. Editors can use the JSON Schema that the `#:schema` line names to check the file as you type; gspot checks it
  fully when it runs. See [Monorepos](/guides/monorepos/)." (CFR-001, CFR-002, CFR-003) The page has no legend of
  reason rules: its column "Reason needed when" says it for each setting (NMU-020).
- Size: small

### DOC-031: Page-building code lives inside Astro's `content/` folder, with vague file names

- Where: `docs/src/content/reference/*.ts`, `docs/src/content/revision.ts`
- Kind: move
- Problem: `src/content/` is where Astro expects content. Here it holds code beside `content/docs/` (the pages).
  `page.ts` holds Markdown helpers (`table`, `cell`, `section`), not a page, and `plugin.ts` and `policy.ts` carry
  retired names.
- Fix: Move `docs/src/content/reference/` to `docs/src/reference/`. Rename `page.ts` to `markdown.ts`, `plugin.ts` to
  `eslint-plugin.ts`, and `policy.ts` to `gspot-toml.ts`. `schema.ts` moves into the CLI as
  `packages/cli/src/settings/schema/gspot-toml.ts`, with `buildJsonSchema` (CFR-001). Delete `revision.ts` (DOC-018).
  Update every import of the old path: `docs/src/content.config.ts:3`, `tests/cli/commands/help.test.ts:8`,
  `tests/cli/policy/expiry.test.ts:6`, `tests/cli/policy/schema.test.ts:10-11`, and the path in `docs/README.md:9`
  (`docs/src/pages/schema/gspot.schema.json.ts:3` goes with the schema route, CFR-001).
- Size: small

### DOC-032: The site's TypeScript settings name three CLI type files by path

- Where: `docs/tsconfig.json:5,9,13-15`
- Kind: simplify
- Problem: The site imports CLI code, so `tsconfig.json` lists three files from `packages/cli/src/types/`.
  `types/parsers/pg.d.ts` no longer exists (deleted in `310a53817`). `types/platform/assets.ts` is an ordinary module
  that normal imports reach. Only `types/checks/general/spdx.d.ts` holds `declare module` lines that an import cannot
  pull in. `allowJs` has no JavaScript file to act on under `src/`, and `baseUrl: ".."` is likely not needed, because
  the inherited `paths` work from the root `tsconfig.json`.
- Fix: Delete the `pg.d.ts` and `assets.ts` lines and keep only the `.d.ts` file, as the glob
  `"../packages/cli/src/types/**/*.d.ts"`, which matches it wherever the types layout puts it. Remove `allowJs`. Remove
  `baseUrl`, and put it back only if the type check fails.
- Size: small

### DOC-033: A build workaround for the Markdown engine is explained in jargon and hidden from Knip

- Where: `docs/astro.config.ts:13-18`, `docs/package.json:13` (`satteri`), `gspot.toml:280-282`, `.gspot/config/knip.json:158`
- Kind: delete
- Problem: The comment on the `vite` settings says nothing to a newcomer. `satteri` (Astro's Markdown engine) is a
  direct dependency only so that Bun finds it in one place, and Knip is told to ignore it. Nothing in `docs/` imports
  it; Astro does.
- Fix: Delete the `environments.prerender` line, the `satteri` dependency, and the Knip ignore, then build. If the
  build breaks, keep them and rewrite the comment: "Astro's Markdown engine is a compiled Node.js add-on. Bun must find
  it in `docs/node_modules`, so we list it as a dependency and keep Vite from bundling it." Also explain `oxc.target`:
  "Compile the CLI code we import down to ES2022."
- Size: small

### DOC-034: The README images are three static badges and two 367 KB banners that differ in two colors

- Where: `docs/assets/readme/badges/{docs,license,npm}.svg`, `docs/assets/readme/banner/{dark,light}.svg`, `README.md:1-5`
- Kind: delete
- Problem: The badges are drawings, not live status: "docs: source", "license: Apache-2.0" (the README has a License
  section), and "npm: unreleased" (false on release day). Each banner wraps the same base64 PNG; the two files differ
  only in background and text color, so the repository carries 734 KB for one logo. These images serve only the root
  README, yet they sit inside the site package `docs/`.
- Fix: Delete `docs/assets/readme/` and `README.md:1-5`. The README starts with a plain `# gspot` heading (the README
  text in "Changes by file").
- Size: small

### DOC-035: Logo files sit in deep folders with unclear names

- Where: `docs/public/brand/identity/mark/default.png`, `docs/public/brand/identity/mark/light.svg`,
  `docs/public/brand/identity/social.png`
- Kind: rename
- Problem: The images sit up to three folders deep under `docs/public/`. `light.svg` is not a light variant; it is the
  flat vector logo (favicon and 404 page). `default.png` is a 96 px glossy copy used only in the header. A newcomer
  cannot tell which is which.
- Fix: `light.svg` becomes `docs/public/logo.svg`, and `social.png` becomes `docs/public/social.png`. Delete
  `default.png`: the header uses `logo.svg` too (`SiteTitle.astro:15`: `url(/logo.svg)`). Update
  `astro.config.ts:37,43,54` (through `LOGO` and `SOCIAL_IMAGE` in `docs/src/config/site.ts`, DCP-016),
  `SiteTitle.astro:15`, and `404.md:20`. With the homepage pictures gone (DCX-010), `docs/public/brand/` is deleted.
- Size: small

### DOC-037: The homepage shows the install commands twice

- Where: `docs/src/components/home/Hero.astro:23-41`, `:49-58`
- Kind: simplify
- Problem: The left column has three install tabs (npm, mise, and a global install). The right column's "1. Set up"
  tab shows the npm install again, half from `example.commands.install` and half typed by hand. The first tab also
  types the npm command by hand.
- Fix: The left column shows one block, the npm block of the Install page, built from `example.commands` (`install`,
  `init`, `install_tools`, `check`), and a link to `/guides/install/`. The mise and global tabs go (INX-005, INX-009).
  The right column drops "1. Set up" and starts at "Commit". No command is typed by hand.
- Size: small

### DOC-038: The homepage shows "0.0s" timings that look fake

- Where: `docs/src/components/home/Hero.astro:8,75,87`, `docs/src/config/example.json:72,115`
- Kind: rewrite-text
- Problem: The summary under the example reads "27 checks passed, 2 checks failed, 2 checks skipped, 5 findings, 0.0s
  (failed)". The test replaces every time with `0.0s` so that it can compare text, and the page shows that test value
  to visitors.
- Fix: In `Hero.astro`, strip the time and show only the failed checks and the findings, such as "2 checks failed, 5
  findings". Keep the recorded text as it is for the test.
- Size: small

### DOC-039: The theme CSS has dead rules and the same rules twice

- Where: `docs/src/theme.css:61-64`, `:84-91`, `:128-131`, `:138-150`, `:176-186`, `:188-190`, `:205-208`, `:253-259`;
  `docs/src/pages/index.astro:43-46`
- Kind: delete
- Problem: (1) `.starlight-aside`, `.sl-markdown-content details`, `.landing details`, and the `summary` rules inside
  `.sl-markdown-content` or `.landing` style elements that no page has (Starlight draws `<summary>` only in the sidebar
  and the mobile table of contents). (2) `body { font-size: 1rem; line-height: 1.75 }` adds nothing: Starlight sets
  the body line height from `--sl-line-height` (1.75), and 1rem is the browser default. (3) There are two
  `prefers-reduced-motion` blocks. (4) There are two landing margin resets, `theme.css:205-208` and
  `index.astro:44-45`, which cover different elements. (5) The table header rule sits 60 lines from the other table
  rules. The build-time purge (DOC-002) hides the dead rules.
- Fix: Delete `.starlight-aside`, the two `details` rules, the `summary` rule at `:145-150`, `summary` in the selector
  list at `:84-86` (keep `a, button`), `summary` in the motion block, and the `body` block. Merge the two motion
  blocks. Merge the two landing resets into one rule in `home.css` that keeps every element both rules cover (DCX-007
  moves the landing rules there). Move `:188-190` next to `:116-126`. Keep `home.css:69-72` and `:120-122`: Expressive
  Code sets its own code size, so they are not duplicates.
- Size: small

### DOC-040: Filler and wrong comments in the site config

- Where: `docs/src/config/home.ts:3`, `docs/src/config/navigation.ts:3`, `docs/src/config/reference.ts:1`, `:49`,
  `docs/src/types/components.ts:9`
- Kind: rewrite-text
- Problem: "Features grounded in supported check and instruction behavior." and "Navigation follows the reader's
  setup, daily use, and configuration tasks." tell a reader nothing. "Introduce setting inheritance and the reason
  requirements of each direction." is jargon. `REFERENCE_JSON_INDENT` says it formats "published JSON examples and the
  schema endpoint", but only the schema route uses it, and that route goes (CFR-001).
- Fix: Delete the first two comments. The third becomes "Intro text of the gspot.toml reference." Delete
  `REFERENCE_JSON_INDENT`.
- Size: small

### DOC-043: README links open source files whose own links break on GitHub

- Where: `README.md:4`, `:15`, `:37`, `:67`, `:71-75`
- Kind: rewrite-text
- Problem: The README links to `docs/src/content/docs/guides/*.md`. Those pages use site links such as
  `/guides/install/`, which GitHub reads from the repository root, where no such file exists. So every link inside
  them is broken on GitHub.
- Fix: Do after NMU-012 (`guides/policy.md` becomes `guides/gspot-toml.md`). Link each README item to
  `https://generativespotting.com/guides/<page>/`, as the README text in "Changes by file" does. The links work once
  the site is first deployed, with the first stable release.
- Size: small

### DOC-046: The docs README explains the reference pages in jargon

- Where: `docs/README.md:8-9`
- Kind: rewrite-text
- Problem: "Reference pages come from the CLI contracts in `docs/src/content/reference/`." That folder holds the code
  that builds the pages; the data comes from the CLI commands, the configuration manifests, the gspot.toml schema, and
  the ESLint plugin rules.
- Fix: "The pages in `src/content/docs/` are written by hand. The code in `src/reference/` builds the reference pages
  at build time from the CLI's commands, its configuration manifests, the gspot.toml schema, and the ESLint plugin
  rules. Do not write reference pages by hand." (the path after DOC-031). Keep "Asset licenses".
- Size: small

### DOC-049: "init needs a clean working tree" is said six times

- Where: `guides/install.md:29`, `guides/existing-repository.md:32-33`, `guides/quickstart/typescript.md:111`,
  `guides/troubleshooting.md:65-67`, `guides/quickstart/python.md:23`, `guides/quickstart/swift.md:44`
- Kind: merge
- Problem: The same rule and reason, six ways.
- Fix: Say it once on the Install page with its reason: "Commit your work first: `gspot init` stops when there are
  uncommitted changes, so that Git keeps a copy of every file it replaces." The JavaScript-and-TypeScript quickstart
  says "Add gspot and commit, because `gspot init` stops on uncommitted changes:"; other pages say at most "Commit
  first (see Install)". Keep the Troubleshooting entry, which matches the error text.
- Size: small

### DOC-050: "An edited generated file is kept and named" is said four times, once with advice that does not work

- Where: `guides/generated-files.md:39-41`, `guides/troubleshooting.md:42-45`, `guides/upgrade.md:41`, `guides/policy.md:131`
- Kind: merge
- Problem: The same fact on four pages, with different advice each time. `troubleshooting.md:44-45` says to run
  `gspot apply` again, which keeps the edited file.
- Fix: Keep it on Generated files: "If you edit a generated file, `gspot apply` keeps your edit and names the file.
  Move the change into `gspot.toml`, delete the edited file, and run `gspot apply`." Troubleshooting keeps one line
  that links there. Delete it from `upgrade.md` and `policy.md`.
- Size: small

### DOC-051: The lines for another hook manager are explained three times, under three names

- Where: `guides/existing-repository.md:43`, `guides/hooks.md:22-33`, `guides/join.md:45`, `guides/remove.md:24`
- Kind: merge
- Problem: Three explanations of the same three lines, called "integration lines", "three integration lines", and "all
  three integration lines". The CLI prints "add these gspot lines to them" (`lifecycle/install/contracts.ts:85`).
- Fix: Keep the full text on Git hooks and link to it from the other pages. Call them "gspot hook lines" everywhere.
  The lines use the repository's start command, and the commit-msg line is `gspot check --message-file "$1"` (CLX-006;
  the `hooks.md` entry in "Changes by file").
- Size: small

### DOC-053: "The license check waits until you list licenses" is said five times

- Where: `guides/quickstart/typescript.md:132`, `guides/quickstart/python.md:46`, `guides/quickstart/swift.md:60`,
  `guides/dependency-licenses.md:10`, `guides/policy.md:49`
- Kind: merge
- Problem: Each quickstart stops to explain the license settings, in three wordings.
- Fix: Keep the explanation on Dependency licenses. The JavaScript-and-TypeScript and Python quickstarts get one line:
  "The license check stays off until you list allowed licenses ([Dependency licenses](/guides/dependency-licenses/))."
  The Swift page drops its license sentences (DCX-014). Delete it from `policy.md:49`.
- Size: small

### DOC-055: The gspot.toml page explains detection twice, in jargon

- Where: `guides/policy.md:36-41`, `:127-131`
- Kind: merge
- Problem: "Reconcile project changes" (`:127-131`) repeats `:36-41`, which says gspot "deactivates language and
  framework configurations whose evidence disappeared". Line 131 is four unrelated short sentences.
- Fix: Delete `:127-131`. Rewrite `:36-41` as the section "When files of a language appear or go": "When files of a
  language or framework appear or go away, run `gspot apply`, then `gspot install`. `apply` adds the configuration when
  its files appear and turns it off when they go; your settings, ignores, and command checks for it stay in
  gspot.toml. It never undoes your own `gspot add` or `gspot remove`; those stay in `configurations` and
  `removed_configurations`."
- Size: small

### DOC-056: The TypeScript example is copied into the README by hand and never tested there

- Where: `README.md:39-67`, `guides/quickstart/typescript.md:139-197`, `docs/src/config/example.json`
- Kind: merge
- Problem: The README holds a third copy of the example that nothing checks; the quickstart holds a second copy that a
  test compares with `example.json`.
- Fix: Do after PAR-047 (the quickstart builds its blocks from `example.json`, and the quickstart test goes). Cut the
  README example to one sentence and a link: "The JavaScript and TypeScript quickstart shows gspot refusing a commit
  with a file that only passes a call on."
- Size: small

### DOC-058: 27 hand-written pages, several of which repeat each other or do two jobs

- Where: `docs/src/content/docs/guides/*`, `docs/src/content/docs/reference/runtime.md`, `docs/src/config/navigation.ts`
- Kind: merge
- Problem: Some pages are one step of the same task and repeat each other (Requirements, Install, Runners, and Add to
  an existing repository), which causes most of the repeats in this file. Others do two jobs (Remove, gspot.toml).
- Fix: Move to the 24 pages under "Target pages" (23 in the sidebar, plus the 404 page). Install takes Requirements,
  Runners, and Add to an existing repository (DCP-009). Join, the three quickstarts, Upgrade, Remove, and the
  exit-codes page stay their own pages (DCP-001, DCP-002, DCP-005, DCP-006): moving to a new version and taking gspot
  out are opposite tasks, and a lookup is not a repair. Sections move to the page whose job they serve (DCP-004,
  DCP-007, DCP-008). Tests, Security, and Dependency licenses stay how-to pages; their text does not move into
  configuration manifest notes, because each is one task across several configurations. Change every link that
  breaks ("Link changes"); the site link check catches any that are missed.
- Size: medium

### DOC-060: Plain English: Requirements (`requirements.md`)

- Where: `docs/src/content/docs/guides/requirements.md:10`, `:19`, `:25`, `:27`
- Kind: rewrite-text
- Problem: Jargon ("applicable configurations", "applicable checks, fixers, or generators"), a command without
  `gspot`, and a sentence about the mise file and a runner suggestion that go (INX-001, INX-003).
- Fix: The page becomes the "What you need" section of Install (DCP-009).
    - L10: "Run `gspot init --dry-run` to see which tools your repository needs. gspot installs only what its checks and
      fixers need. File types count too: Markdown files in a Python repository still need Node.js for the Markdown
      checks." (A dry run never asks, so it needs no `--yes`.)

    - L19: "Program tools need mise, whichever way you install gspot. Without mise, `gspot install` installs the npm
      tools, and the Python tools only when uv is on your `PATH`; it prints one line that names every missing program,
      uv included. Checks whose program is missing report it and fail (exit 2) until you install it. `gspot doctor`
      names them." (INX-006; no file name and no mise version)

    - L25: "The Bash checks need Bash 4.4 or newer. macOS comes with Bash 3.2, so install a newer Bash." (Only the Bash
      checks need it, not the zsh checks.)

    - L27: delete; the error message already names the path.

- Size: small

### DOC-061: Plain English: Install (`install.md`)

- Where: `docs/src/content/docs/guides/install.md:10`, `:29`, `:49`, `:71`, `:73`
- Kind: rewrite-text
- Problem: Jargon ("Exact development dependency in its declared package manager", "After acceptance,
  initialization ... lockfiles"), a runner question (`:49`), and lockfile text (`:71`, `:73`) for steps that `init`
  no longer takes.
- Fix:
    - L10: "a dev dependency, pinned to one version".
    - L29: "Commit your work first: `gspot init` stops when there are uncommitted changes, so that Git keeps a copy of
      every file it replaces." (DOC-049)

    - L49: delete (no runner question, no conf.d file, no trust step; INX-001, INX-003).
    - L71: "When you accept the plan, `init` writes the files and ends with `run gspot install`. It installs nothing and
      runs no check." (DCX-002)

    - L73: "If `gspot install` fails, see [Troubleshooting](/guides/troubleshooting/)." The lockfile advice lives only
      there (DCX-011).

- Size: small

### DOC-062: Plain English: the three quickstarts

- Where: `guides/quickstart/typescript.md:229`, `guides/quickstart/python.md:29`, `:46`, `:74`,
  `guides/quickstart/swift.md:50`, `:60`, `:96`
- Kind: rewrite-text
- Problem: Jargon ("no applicable input or unmet optional condition", "Initialization prepares lockfiles and installs
  applicable tools").
- Fix:
    - TS L229: "The report also lists the checks it skipped and why. A skipped check did not run, so it did not pass."
    - Python L29, Swift L50: "`init` writes the files and installs nothing. Install the tools and check the setup:"
      (DCX-002)

    - Python L46: DOC-053's line. Swift L60: delete (DCX-014).
    - Python L74, Swift L96: "Stage the file and run `git commit`. The pre-commit hook refuses the commit and prints
      the same finding."

- Size: small

### DOC-063: Plain English: Add to an existing repository (`existing-repository.md`)

- Where: `docs/src/content/docs/guides/existing-repository.md:27-30`, `:43`, `:44`
- Kind: rewrite-text
- Problem: Jargon ("an authored hook folder", "three integration lines"), and Ruff detail that does not belong on a
  general page.
- Fix: The page becomes the "Read the plan" section of Install (DCP-009).
    - L27-30 (Ruff `requires-python`, editor formatting): delete; it belongs on the Python configuration page.
    - L43: "If Husky, Lefthook, or your own hooks folder already runs your Git hooks, gspot leaves them alone and prints
      three gspot hook lines for you to add (see Git hooks). Until you add them, gspot checks do not run on commit or
      push."

    - L44: "The plan's 'no longer runs' list names folders of lint scripts and dependency files that list only lint
      tools. Check that nothing else uses them, then delete them." (INX-007 deletes the item on duplicate mise pins.)

- Size: small

### DOC-064: Plain English: Join a repository (`join.md`)

- Where: `docs/src/content/docs/guides/join.md:6`, `:45`
- Kind: rewrite-text
- Problem: Jargon, and a rule stated as advice although gspot enforces it.
- Fix:
    - L6: "`gspot init` refuses to run where `gspot.toml` exists; use `gspot install`."
    - L45: "`gspot install` installs the tools and turns on the Git hooks in your copy (unless another hook manager runs
      them; see Git hooks). If it fails, see Troubleshooting. If it changes a lockfile under `.gspot/`, commit that
      file."
- Size: small

### DOC-065: Plain English: Fix findings (`findings.md`)

- Where: `docs/src/content/docs/guides/findings.md:25-26`
- Kind: rewrite-text
- Problem: "Namespaced ESLint rule IDs work as printed in the report" is jargon, and the page does not say what
  `gspot explain` prints for a lint rule.
- Fix: "ESLint plugin rules work as the report prints them." Then: "The output links the rule's documentation, prints
  the `gspot ignore <check> --rule <rule> --reason "..."` command that ignores its findings, and names the
  `tools.<tool>.rules` setting that changes its options." (`explain` prints no `--reason` for lint rule options.)
- Size: small

### DOC-066: Plain English: Git hooks (`hooks.md`)

- Where: `docs/src/content/docs/guides/hooks.md:6`, `:14`, `:16`, `:42`, `:48`, `:55`
- Kind: rewrite-text
- Problem: Jargon ("a message hook can have no applicable check", "To accept a finding in saved policy, record an
  ignore"), and the page does not say who turns the hooks on.
- Fix:
    - L6: "gspot writes three Git hooks, and `gspot install` turns them on when `hooks.enabled = true`, which
      `gspot init` sets. To turn them off, run `gspot set hooks.enabled false`, then `gspot install`." (`init` asks no
      hook question, CLX-001.)

    - L14: "At level `recommended`, no check reads commit messages, so the commit-msg hook finds nothing. Level `all`
      adds the commit message check (`commits/commitlint`)."

    - L16: "Some checks, such as the type checker, read the whole project. They can report a problem in a file you did
      not change."

    - L42: "You cannot run the pre-push checks by hand; they need the data Git sends during a push. Run `git push`, or
      check a branch with `gspot check --base origin/main`."

    - L48: delete (TML-002 deletes `hooks.push_files`).
    - L55: "To stop a finding for good, add an ignore ([Ignore a finding](/guides/exclude/#ignore-a-finding))."

- Size: small

### DOC-067: Plain English: CI (`ci.md`)

- Where: `docs/src/content/docs/guides/ci.md:13`, `:32`, `:36`, `:47`
- Kind: rewrite-text
- Problem: Jargon ("GitHub receives a workflow", "Select platforms that support the applicable checks"), "runner" for
  the CI machine (gspot's word for the program that starts it), and a CI path without mise that goes (INS-003).
- Fix: The `ci.md` text in "Changes by file" holds these lines.
    - L13: "For GitHub, gspot writes `.github/workflows/gspot.yml`."
    - L32: "Pick only systems where your checks can run; for example, Xcode checks need macOS. On pushes to the default
      branch, the job also runs the manual checks your configurations select."

    - L36: "The job installs mise, runs gspot at the version in `.gspot/version`, and gspot installs its tools." The
      generated CI always installs the tools with mise (INS-003).

    - L47: "gspot quotes each argument, so spaces, quotes, and `$` reach the command as plain text."
    - "runner" for the machine becomes "CI machine".

- Size: small

### DOC-068: Plain English: Coding agents (`agents.md`)

- Where: `docs/src/content/docs/guides/agents.md:10`, `:26`, `:28`
- Kind: rewrite-text
- Problem: Jargon ("The selection follows applicable configurations and the chosen level", "Conditional agent rules
  are written only when their inputs match").
- Fix: L10: "gspot writes the rules that fit your languages, frameworks, and level." L26: "Do not edit files under
  `.gspot/`." L28: "To keep a finding, add an ignore with a reason (`gspot ignore`)." (The `agents.md` text in
  "Changes by file" holds them.)
- Size: small

### DOC-069: Plain English: gspot.toml (`policy.md`)

- Where: `docs/src/content/docs/guides/policy.md:3`, `:6-7`, `:31-34`, `:49-52`, `:85`, `:99`, `:101-104`,
  `:109-112`, `:123-125`
- Kind: rewrite-text
- Problem: Jargon, and two wrong claims: "General checks are selected automatically" (not every general configuration
  is always selected: `licenses`, `format`, and `coverage` depend on your files), and "in every language it checks"
  (six languages).
- Fix:
    - L3 (description): "Choose configurations and a level, and change settings in gspot.toml." (The ignores move to
      the Exclude page, DCP-007.)

    - L6-7: "the exceptions" becomes "the ignores".
    - L31-34: "gspot selects its general configurations (secrets, spelling, and so on) by itself, even when you write
      the list yourself."

    - L49-52: "Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger`
      also gets the Swagger lint rules." The license sentence goes (DOC-053).

    - L85: "in TypeScript, JavaScript, Python, Swift, Bash, and SQL".
    - L99: "A command (a list of arguments) always replaces the inherited one as a whole."
    - L101-104: "A value that loosens a check needs a reason, and gspot writes it next to the value:
      `limits.function_lines = { value = 80, reason = "..." }`. This covers a raised limit, a lowered coverage, and an
      item you add to an allow-list, such as `allowed_words` or `dependencies.allowed_registries`, that the shipped list
      lacks. `gspot unset` removes the value and its reason together." (CFR-002, CLX-002)

    - L109-112: "Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com`. To allow another host you
      reviewed, run `gspot set dependencies.allowed_registries <host> --reason "..."`. A host you allow in a scope
      applies to that folder and the folders inside it."

    - L123-125: "It also shows a diff for each generated file you edited."

- Size: small

### DOC-071: Plain English: Monorepos (`monorepos.md`)

- Where: `docs/src/content/docs/guides/monorepos.md:60-61`, `:69`, `:87`
- Kind: rewrite-text
- Problem: Jargon ("Authored paths are relative to the scope that declares them", "does not consume source files
  owned by a child scope", "preserves authored scope policy and deactivates its absent configuration").
- Fix:
    - L60-61: "Paths you write are relative to the repository root. A configuration's default paths apply inside the
      scope that selects it." (CFR-003)

    - L69: "Files inside a child scope are checked only by that child."
    - L87: "If a project's files go away, `gspot apply` turns its configurations off but keeps its settings in
      gspot.toml. They apply again when the files come back."

- Size: small

### DOC-073: Plain English: Generated files (`generated-files.md`)

- Where: `docs/src/content/docs/guides/generated-files.md:6`, `:37`, `:53-56`
- Kind: rewrite-text
- Problem: Jargon ("App settings remain authored", "recording ownership", "conflicts").
- Fix:
    - L6: "Your app's own settings stay yours." (gspot does write a few install keys into shared files such as
      `bunfig.toml`, so "does not touch" would be false.)

    - L37: "Some tools have no pointer. gspot passes them their tool file when it runs them; give your editor the same
      path."

    - L53-56: "`.gspot/state/` records which files gspot wrote, so it can tell them from your edits. Do not delete the
      `.gspot/` folder to clean up. In a fresh clone, gspot checks that each generated file matches what it would write;
      if one differs, gspot leaves it alone and reports it." (The generated files stay committed, GEN-022.)

- Size: small

### DOC-074: Plain English: Command checks (`command-checks.md`)

- Where: `docs/src/content/docs/guides/command-checks.md:95-100`, `:111-118`; `guides/findings.md:72`
- Kind: rewrite-text
- Problem: "output contracts", a list of five formats meant for gspot's own manifests, and "correction" where the CLI
  says "fix".
- Fix: On the `[[command_check]]` examples (DCX-003):
    - L95: "read other output styles".
    - L96-100: one line: "gspot also reads the JSON of Semgrep, TruffleHog, typos, markdownlint, and Knip; see the
      [gspot.toml reference](/reference/gspot-toml/#command_check)." The format name is `trufflehog` (NMU-039).

    - L111: heading "Add a fix command"; L114-118: "correction(s)" becomes "fix command(s)"; the anchor in
      `findings.md:72` becomes `#add-a-fix-command`.

    - L118: "If the fix command exits with one of the `exit_codes`, gspot reads that as 'findings are left'."

- Size: small

### DOC-075: Plain English: Reuse templates (`templates.md`)

- Where: `docs/src/content/docs/guides/templates.md:6`, `:14`, `:34`
- Kind: rewrite-text
- Problem: Jargon ("declarations, and integrations", "authored tables", "atomically").
- Fix:
    - L6: "A template is a copy of your gspot.toml, without scopes, that another repository can start from."
    - L14: "It copies only what you wrote, not the defaults."
    - L34: "Export can write anywhere, but not over `gspot.toml` or a file gspot generates."
- Size: small

### DOC-076: Plain English: Upgrade and Remove

- Where: `guides/upgrade.md:6`; `guides/remove.md:13`
- Kind: rewrite-text
- Problem: "Read the release notes" has no link, and the Remove page does not say that general configurations cannot
  be removed ("General configurations follow repository inputs and the selected level").
- Fix:
    - upgrade L6: "Commit first, so you can go back. Read the [release
      notes](https://github.com/stefanionescu/gspot/releases) of the version you pick." (DCX-015)

    - remove L13, on the gspot.toml page under "Choose configurations" (DCP-004): "You cannot remove a general
      configuration such as `secrets`. Change the level with `gspot set level`, or turn off one of its checks with
      `gspot ignore`."

- Size: small

### DOC-078: Exit codes and environment variables: jargon and missing rows

- Where: `docs/src/content/docs/reference/runtime.md:3`, `:12`, `:14-17`
- Kind: rewrite-text
- Problem: "configure execution from the environment" and "exact exit contract" are jargon. The variable list leaves
  out `NO_COLOR`, which gspot reads, and says `GITHUB_TOKEN` is for "supported GitHub release downloads", although
  template downloads use it too. The page does not list the exit codes after Ctrl-C.
- Fix: On `reference/exit-codes.md` (DCP-006):
    - Description: "What gspot's exit codes mean, and the environment variables it reads." L12: "Each command page
      lists its own exit codes."

    - Exit-code rows: DOC-006's rows 1 and 2, and "130 or 143: `gspot check` was stopped (Ctrl-C or SIGTERM)."
    - `NO_COLOR`: "Any non-empty value turns color off."
    - `GITHUB_TOKEN`: "Lets gspot read a template from a private GitHub repository, and lets tool installs download from
      GitHub without hitting the rate limit."

    - `GSPOT_JOBS`: "A whole number, 1 or more, that limits how many checks run at once. Any other value uses every
      processor core." (EXG-056)

    - Add the `--json` error codes once NMU-032 renames them.

- Size: small

### DOC-079: Plain English: Tests, Licenses, Security

- Where: `guides/testing.md:33-34`, `:46`, `:66-69`; `guides/dependency-licenses.md:10`; `guides/security.md:17`,
  `:42-43`; `guides/troubleshooting.md:25-26`
- Kind: rewrite-text
- Problem: Jargon, a sentence that hints at an older behavior ("New repositories choose their license policy
  explicitly"), and one wrong claim: Semgrep runs no outside iOS rule pack.
- Fix:
    - testing L33-34: "reports `.only` tests, skipped tests, and broken test calls, at both levels."
    - testing L46: "Vitest finds its own `vitest.config.ts` as usual."
    - testing L66-69: "If you use swift-snapshot-testing, gspot also checks that no test is left recording, and that
      every `__Snapshots__` folder is named after a Swift test file next to it."

    - licenses L10: "gspot does not choose allowed licenses for you."
    - security L17 and troubleshooting L25-26: "If a check's tool is missing, the check shows `missing` and the run
      ends as incomplete (exit 2)."

    - security L42-43: "Semgrep also runs the Swift security lint rules that gspot ships with the swift configuration."

- Size: small

### DOC-080: Generated reference pages use jargon, retired words, and wrong labels

- Where: `docs/src/content/reference/configurations.ts:49`, `:80`, `:95-107`; `checks.ts:13`; `policy.ts:123-124`;
  `collection.ts:85-86`; `docs/src/config/reference.ts:44` (`DETECTION_LABELS`)
- Kind: rewrite-text
- Problem: Section titles and fixed text on every configuration page use jargon ("Selected by default. Tool
  requirements depend on applicable checks.", "Declared tool pins", "Generated tool files", "You install", "Rule
  exclusions", "file tags"). "Rules for coding agents" and "agent rules" are retired names: "rules" means the Markdown
  files for coding agents, and a linter's rule is a "lint rule". "Platforms" on check pages means operating systems.
  Two settings pages describe one file.
- Fix:
    - `configurations.ts:49`: "tool files or agent rules" becomes "tool files or rules".
    - `configurations.ts:80`: "Always selected."
    - `configurations.ts:95-107`: "You install" becomes "Tools you install yourself", "Declared tool pins" becomes
      "Tools and versions", "Generated tool files" becomes "Files gspot writes", "Rule exclusions" becomes "Lint rules
      turned off", and "Rules for coding agents" becomes "Rules".

    - `DETECTION_LABELS`: "file tags" becomes "files marked" (for example "files marked `shebang:node`").
    - `checks.ts:13`: "Platforms" becomes "Operating systems".
    - `policy.ts:123`: "Every setting, with its type, its default, the configuration that declares it, and when a change
      needs a reason."

    - `policy.ts:124`: columns "Key | Type | Reason needed when | Default | Meaning | Configuration" (NMU-020).
    - `collection.ts:85-86`: one page, "gspot.toml reference", described as "Every table and key of gspot.toml, with
      examples." (POL-035)

    - The ESLint plugin pages follow DCP-015, the label of gspot's own settings follows DCP-018, and the `-C` sentence
      of the commands index goes with DCX-001.

- Size: small

### DOC-083: The Generated files table misses two things gspot writes

- Where: `docs/src/content/docs/guides/generated-files.md:11-24`
- Kind: fix-bug
- Problem: The table leaves out `.gspot/.yarnrc.yml` (Yarn settings for the npm tool project, written only for Yarn 2
  or newer). The git-ignored list mentions "Vale style packages" but not their folder `.gspot/vale/`.
- Fix: Add `.gspot/.yarnrc.yml` ("Yarn settings for the npm tools, when the repository uses Yarn 2 or newer") and name
  `.gspot/vale/` in the git-ignored list.
- Size: small

### DOC-085: Turning hooks on with `gspot set` or `gspot apply` prints no reminder to run `gspot install`

- Where: `packages/cli/src/lifecycle/public.ts:111-112`
- Kind: fix-bug
- Problem: Git runs gspot's hooks only after `gspot install` sets `core.hooksPath`. When `gspot set hooks.enabled true`
  (or `apply` after a hand edit) writes the hook scripts, nothing says that one more step is needed. The note "Git
  hooks changed. Run: gspot install" is printed only when hook files are removed (`report.removed`); written hook
  scripts land in `report.written`, which the condition does not read. A user who turns hooks on believes commits are
  checked when they are not.
- Fix: Print the same note when any path under `.gspot/hooks/` was written or removed. One condition, no new message.
- Size: small

### DCP-001: The Python and Swift quickstarts use a runner prompt and a trust block that go

- Where: `docs/src/content/docs/guides/quickstart/python.md:6-8`, `:23-37`; `guides/quickstart/swift.md:6-8`, `:44-58`
- Kind: rewrite-text
- Problem: Both pages run `gspot init --configurations python` (or `swift`), tell the reader to choose mise as the
  runner at the prompt, and then run a block of `mise trust .mise/conf.d/gspot-tools.toml` and `mise install`. The
  runner prompt, the `runner` setting, and the conf.d file go (CLX-001, INX-003, INX-001), and `gspot install` runs
  mise for `.gspot/mise.toml` itself (INX-006).
- Fix: Keep one page per language: a Python reader and a Swift reader never need the other half, and the commands
  differ (uv and Ruff against SwiftPM and SwiftLint; the Swift page runs only on macOS). Both pages use the mise path:
  `mise use node@24 npm:@gspothq/cli@<version>`, `git add mise.toml`, `git commit -m "build: Add gspot"`,
  `mise exec -- gspot init --yes --configurations python` (or `swift`), then `mise exec -- gspot install` and
  `mise exec -- gspot check`. No runner choice, no `mise trust` or `mise install` line, no `doctor` line. One sentence:
  "Replace `<version>` with the version you install, such as `0.1.0`." (`mise use` saves the version as typed, so
  `@latest` would not pin it.) The e2e test runs the same commands (`QUICKSTART_COMMANDS`). Apply DOC-062 to each page;
  DOC-053's license line goes on the Python page only (DCX-014).
- Size: small

### DCP-002: One quickstart for JavaScript and TypeScript

- Where: `docs/src/content/docs/guides/quickstart/typescript.md`
- Kind: rename
- Problem: The quickstart covers TypeScript only, though a JavaScript user runs exactly the same commands. Every
  TypeScript project is also a JavaScript project (`typescript/manifest.toml:30`, `requires = ["javascript"]`);
  `javascript/eslint` lints both kinds of files with the gspot plugin, which turns `gspot/no-trivial-files` on for all
  files; `naming/paths` bans `utils` in any language. Only three findings in the recorded output are TypeScript-only
  (`explicit-module-boundary-types`, `no-explicit-any`, `no-unsafe-argument`).
- Fix: Rename to `guides/quickstart/javascript-typescript.mdx`, title "Quickstart: JavaScript and TypeScript". Keep the
  TypeScript example, recorded in `docs/src/config/example.json` and replayed by the homepage-example integration
  test. The page is `.mdx` because it builds its blocks from `example.json` (PAR-047). Add the short section "In a
  JavaScript project" (text in DCX-013). Run the example once with `.js` files before writing that section, to
  confirm it.
- Size: small

### DCP-004: The Remove page does two jobs

- Where: `guides/remove.md:6-15` (remove one configuration) and `:17-27` (remove gspot); `guides/policy.md:31-41`
- Kind: move
- Problem: The first half of `remove.md` is about choosing configurations (`gspot remove nextjs`, `gspot add nextjs`,
  `removed_configurations`). That is the job of the gspot.toml page, which already tells readers to run `gspot add` or
  `gspot remove` (`policy.md:33-34`). A reader who wants to drop the Next.js checks does not look under "Remove gspot",
  and `remove` has one meaning in the CLI: configurations.
- Fix: Move `remove.md:6-15` into the gspot.toml page, section "Choose configurations": "To stop checking a language or
  framework, run `gspot remove nextjs`. gspot writes it into `removed_configurations`, so detection does not add it
  back; `gspot add nextjs` brings it back. gspot refuses to remove a configuration that another selected configuration
  needs. You cannot remove a general configuration such as `secrets`; change the level with `gspot set level`, or
  ignore one of its checks. When the tools change, gspot tells you to run `gspot install`." (DOC-076) `remove.md` keeps
  only "Remove gspot from a repository", with this first line: "To stop checking one language or framework instead,
  see [gspot.toml](/guides/gspot-toml/#choose-configurations)."
- Size: small

### DCP-005: Join a repository teaches the trust block and a global npm install

- Where: `docs/src/content/docs/guides/join.md`
- Kind: rewrite-text
- Problem: Join is the page every teammate follows after a clone. Its commands differ from Install's, because a
  teammate must never run `gspot init` (it exits 2 where `gspot.toml` exists, `commands/init/public.ts:134-139`), and
  it has its own table (the clean install of each package manager). But its mise block starts with
  `mise trust .mise/conf.d/gspot-tools.toml` and `mise install`, and it has a "With a global npm install" section; both
  go (INX-001, INX-005).
- Fix: Keep `guides/join.md` ("Join a repository") in "Get started". Install has no "After you clone" section; it
  ends with one line that links Join. The steps: the package manager's frozen install, then `gspot install` and
  `gspot check` with the start command (Yarn: `yarn exec gspot`); with mise, `mise exec -- gspot install` and
  `mise exec -- gspot check`. No `mise trust` or `mise install` line and no global install. Without mise: "install the
  program tools yourself; `gspot doctor` lists them". Apply DOC-064 and DOC-051.
- Size: small

### DCP-006: The exit-codes page has a file name that says nothing, and repeats a Troubleshooting example

- Where: `docs/src/content/docs/reference/runtime.md`
- Kind: rename
- Problem: The page (an exit-code table, an environment-variable table, and one `GSPOT_JOBS` example) is a lookup for
  CI authors, but its file name `runtime` says nothing about its content. Its `GSPOT_JOBS` example repeats
  `troubleshooting.md:52-57`.
- Fix: Rename to `reference/exit-codes.md`; keep the title "Exit codes and environment variables" and keep it as its
  own page in the Reference group (a lookup is not a repair, so it does not merge into Troubleshooting). Apply DOC-006
  and DOC-078. Delete its `GSPOT_JOBS` example; Troubleshooting ("A check is slow") keeps the example in both forms,
  so it has one home. The generated commands index links this page.
- Size: small

### DCP-007: Ignoring a finding is taught on two pages

- Where: `guides/policy.md:54-74`, `guides/exclude.md:28-34`, `:46-48`
- Kind: move
- Problem: The same `gspot ignore javascript/eslint --rule no-console ...` example sits on the gspot.toml page and the
  Exclude page. A reader with an unwanted finding finds three of the four tools on the Exclude page and the fourth
  (ignore) split across both. The Exclude page also documents `ignore_file`, which TML-004 deletes.
- Fix: Keep the file `guides/exclude.md` (the shipped naming list bans "and" in file names) and change its title to
  "Exclude files and ignore findings". Move `policy.md`'s "Ignore one finding" section there as "Ignore a finding"
  (anchor `#ignore-a-finding`). The gspot.toml page keeps settings only and links here once. The "Native ignore files"
  text goes from every page.
- Size: small

### DCP-008: `test_files` sits on the Exclude page, but it excludes nothing

- Where: `guides/exclude.md:20-26`; `guides/testing.md`
- Kind: move
- Problem: The page itself says that `test_files` "does not exclude those files". It tells gspot which files are tests,
  for the test rules; a reader sets it while setting up tests.
- Fix: Move the "Test files" section to `testing.md` ("Tests and coverage").
- Size: small

### DCP-009: Requirements, Runners, and Add to an existing repository are steps of Install and repeat it

- Where: `guides/requirements.md`, `guides/runners.md`, `guides/existing-repository.md`, `guides/install.md`
- Kind: merge
- Problem: No reader comes only for requirements, only to pick a runner, or only to learn what init replaces: each is
  one step of "set up gspot in my repository". The pages repeat each other: the Node.js 24.2 and Bun 1.4.2 versions
  (`requirements.md:6`, `runners.md:10`), the mise npm backend `npm:@gspothq/cli` (`requirements.md:19`,
  `install.md:49`, `runners.md:10`), "mise is proposed when available; explicit choice wins" (`requirements.md:19`,
  `runners.md:18`), the clean working tree (`install.md:29`, `existing-repository.md:32`), and "init writes and
  installs, then run a check" (`install.md:71-82`, `existing-repository.md:48-55`). The install table's "Prefix for
  later commands" column is the runner choice again.
- Fix: One Install page with the sections of "Changes per target page", item 2. Delete `requirements.md`,
  `runners.md`, and `existing-repository.md`. The `runner` setting goes (INX-003), so the runner text of `runners.md`
  goes; its one remaining fact becomes the Install section "How hooks start gspot" (anchor `#how-hooks-start-gspot`):
  when the root `package.json` lists `@gspothq/cli`, the hooks start gspot through the package manager
  (`npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, `bun run --no-install gspot`); otherwise they run
  `mise exec -- gspot`. "Private registries" (`runners.md:36-40`) moves to Install whole. The hooks-off and CI-off text
  (`runners.md:34`) moves to Git hooks and CI (DCX-001). The tool-location paragraphs (`runners.md:24,28`) go,
  because Generated files lists the tool projects. The Ruff paragraph goes (DOC-063).
- Size: medium

### DCP-011: "Settings for one integration" is a filler link list

- Where: `guides/policy.md:135-140`
- Kind: delete
- Problem: Four links to pages that the sidebar already lists, under a heading with a retired word ("integration").
- Fix: Delete the section.
- Size: small

### DCP-012: The Git hooks page repeats the Join steps

- Where: `guides/hooks.md:18-20`
- Kind: merge
- Problem: "Prepare the clone" says to run `gspot install` after cloning; Join a repository is the page for that.
- Fix: Heading "After you clone", then one sentence: "`gspot install` points Git at the hooks in your copy; see [Join a
  repository](/guides/join/)." The block on other hook managers stays here as its one full home (DOC-051).
- Size: small

### DCP-014: The docs `config/` files import from `types/`

- Where: `docs/src/config/home.ts:1`, `docs/src/config/navigation.ts:1`, `docs/src/types/components.ts`
- Kind: simplify
- Problem: In this repository, `config/` imports only from `config/`. Both docs config files import a type from
  `types/components.ts` only to annotate one constant. `types/components.ts` is named after a kind of file, not a
  topic, and its `Sidebar` type is not a component type.
- Fix: Drop both annotations and their imports. The shapes are still checked where the values are used:
  `pages/index.astro` passes `FEATURES` to `Features.astro` (its `Props`), and `astro.config.ts` passes `SIDEBAR` to
  `starlight()`. Delete `Sidebar`, which then has no user, with its `@astrojs/starlight` type import. Rename
  `types/components.ts` to `types/home.ts`; it keeps only `FeatureProps`, without `image` (DCX-010).
- Size: small

### DCP-015: The ESLint plugin reference lives at `/reference/plugin/` and says "preset"

- Where: `docs/src/content/reference/plugin.ts:44,48,52,58,63,67,71`, `docs/src/config/navigation.ts:65`,
  `packages/eslint-plugin/src/create-rule.ts:7`, `packages/cli/configurations/language/javascript/manifest.toml:241,315`,
  `packages/eslint-plugin/README.md:70,105`, `tests/cli/commands/explain/command.test.ts:42`
- Kind: rename
- Problem: "plugin" alone is a retired name outside `packages/eslint-plugin/`, and "preset" is a retired name for a
  level. The URL and the page text use both. Neither package is published, so the URL can change without breaking
  anyone.
- Fix: Build the pages under `reference/eslint-plugin/`. The column "Preset" becomes "Level"; "No preset turns this
  rule on" becomes "No level turns this rule on"; the cell "Explicit selection" becomes "none". `plugin.ts:48` goes
  (PLG-017). In the same change, update the rule URL in `create-rule.ts`, the manifest `rule_url` and notes link, the
  two README links, and the explain test.
- Size: small

### DCP-016: The site address and the repository link are typed in three files

- Where: `docs/astro.config.ts:12,26,43,54,64,67`, `docs/src/pages/index.astro:34-35`, `docs/src/content/reference/page.ts:13`
- Kind: move
- Problem: `https://generativespotting.com` and `https://github.com/stefanionescu/gspot` are typed inline in three
  files, and `astro.config.ts` also types the logo path, the social image and its size, and the font list.
- Fix: New `docs/src/config/site.ts` with `SITE_URL`, `REPOSITORY_URL`, `LOGO` (`'/logo.svg'`), `SOCIAL_IMAGE`
  (`'/social.png'`), `SOCIAL_IMAGE_SIZE` (`{ width: 1200, height: 630 }`), and `FONT_PACKAGES`
  (`['geist', 'geist-mono']`); `astro.config.ts` and `index.astro` import them. The `page.ts` URL goes with DOC-018.
  The CLI keeps its own schema URL, `SCHEMA_URL_PREFIX` in `packages/cli/src/config/settings/file.ts`, because the
  docs `config/` may not import the CLI, and the CLI may not import the docs.
- Size: small

### DCP-017: The reference folder names are typed in six files

- Where: `docs/src/content/reference/{checks,collection,commands,configurations,plugin,policy}.ts`,
  `docs/src/config/navigation.ts:58-65`
- Kind: move
- Problem: `/reference/configurations/`, `/reference/checks/`, `/reference/commands/`, `/reference/plugin/`, and the
  page keys `configurations/...`, `checks/...`, `plugin/...` are typed in each builder and again in the sidebar. The
  rename of DCP-015 alone touches five places.
- Fix: `REFERENCE_FOLDERS = { commands: 'commands', configurations: 'configurations', checks: 'checks', eslintPlugin: 'eslint-plugin' }` in `docs/src/config/reference.ts`; the builders and the sidebar take page keys and links from it.
- Size: small

### DCP-018: The settings reference names gspot's own settings "Repository policy"

- Where: `docs/src/content/reference/policy.ts:76`
- Kind: rename
- Problem: The "Configuration" column says "Repository policy" for settings that gspot itself declares. "policy" is a
  retired word for settings.
- Fix: The label becomes "gspot".
- Size: small

### DCX-001: Ten pages teach flags and forms that the 14-command CLI deletes

- Where: `guides/ci.md:9-10` (`--ci`), `ci.md:29` (`set --replace`), `guides/runners.md:18` (`--runner`),
  `runners.md:32` (`--no-runner`), `runners.md:34` (`--no-hooks`, `--no-ci`), `guides/install.md:71` and
  `guides/existing-repository.md:50-51` (`--no-install`), `install.md:73` and `guides/troubleshooting.md:35`
  (`--refresh-lockfiles`), `guides/findings.md:54` (`--skip`), `findings.md:46` and `guides/monorepos.md:91-98` (`-C`),
  `guides/policy.md:38` and `monorepos.md:76` (`--scope-configurations`), `policy.md:71` (`ignore --remove`),
  `policy.md:97-99` (`set --default`, `--replace`, `--remove`), and the generated commands index text at
  `docs/src/content/reference/commands.ts:69` ("`-C <dir>` starts in another folder")
- Kind: rewrite-text
- Problem: CMD-092 deletes these flags, adds `gspot unset` and `gspot unignore`, and makes `init` install nothing. It
  names no docs lines, so nothing tells the implementer where the old forms are or what replaces each one.
- Fix (old form, then the new form):
    - `gspot init --ci github` or `--ci gitlab`: `gspot set ci.enabled true`; for GitLab, also
      `gspot set ci.provider gitlab` (TML-015). `init` proposes CI in its plan and asks only "Continue?" (CLX-001).
      `set` writes the workflow itself, so no `gspot apply` follows (DOC-010).

    - `gspot set ci.platforms linux macos windows --replace`: `gspot set ci.operating_systems linux macos windows`
      (NMU-007). To replace a list you wrote, run `gspot unset ci.operating_systems` first.

    - `gspot init --runner mise` and `--no-runner`: delete the sentences. There is no runner setting (INX-003); hooks
      start gspot from where the repository pins it.

    - `--no-hooks` and `--no-ci`: delete the sentences. Turn hooks off with `gspot set hooks.enabled false`, then
      `gspot install`. Turn CI off with `gspot set ci.enabled false` (TML-015).

    - `--no-install`: delete it; `init` never installs (DCX-002).
    - `--refresh-lockfiles`: "To make new lockfiles, delete them and run `gspot install`." (CMD-015), on the
      Troubleshooting page only. Install gets one line that points there (DOC-061).

    - `gspot check --skip security/semgrep`: delete the line. `--only` and `gspot ignore` already do this job.
    - `-C`: `findings.md:46` becomes "Paths are relative to the current folder." `monorepos.md:89-99` becomes "gspot
      uses the nearest `gspot.toml` in the current folder or a folder above it. To use the one in `api/`, run gspot from
      there: `cd api && gspot check`." (CLX-009) Delete the sentence in `commands.ts:69`.

    - `--scope-configurations`: on Monorepos, `gspot init` proposes one scope for each project, and a configuration
      that init did not detect is added with `gspot add <configuration> --scope <path>`. In `policy.md:38`, delete the
      flag from the sentence.

    - `gspot ignore ... --remove`: `gspot unignore javascript/eslint --rule no-console --paths "scripts/**"`.
    - `--default`, `--replace`, and `--remove` on `set`: `gspot unset <setting>` removes your value.
      `gspot unset <setting> <item...>` removes list items. To replace a whole list, run `gspot unset <setting>`, then
      `gspot set <setting> <items...>`.

- Size: medium

### DCX-002: The pages say `init` installs tools, and the setup blocks skip `gspot install`

- Where: `README.md:29-35`, `docs/src/components/home/Hero.astro:24-39`, `guides/install.md:71`,
  `guides/existing-repository.md:50-51`, `guides/quickstart/typescript.md:128-129`, `guides/quickstart/python.md:29`,
  `guides/quickstart/swift.md:50`, `guides/templates.md:41-45`, `guides/monorepos.md:73-77`
- Kind: rewrite-text
- Problem: `init` never installs tools: it writes the files and prints "run gspot install" (CMD-092). The pages
  describe installing inside init. The root README block ends with `npx gspot init` and `npx gspot doctor`, so
  `doctor` reports every tool missing. The templates block runs `doctor` and `check` right after `init --from`.
- Fix: Put `gspot install` (with the repository's start command) after every `init` in the README, the Hero block,
  `install.md`, `templates.md`, and `monorepos.md`. After `init`, every block runs `gspot install` and `gspot check`,
  the quickstarts too (no `doctor` line). There is no `mise trust` or `mise install` line, because `gspot install`
  runs mise for `.gspot/mise.toml` itself (INX-001, INX-006). The prose:
    - `install.md:71`: "When you accept the plan, `init` writes the files and ends with `run gspot install`. It installs
      nothing and runs no check."

    - `existing-repository.md:48-55`: delete; the Install page says it once.
    - `typescript.md:128-129`: see DCX-013.
    - `python.md:29` and `swift.md:50`: "`init` writes the files and installs nothing. Install the tools and check the
      setup:".

- Size: small

### DCX-003: Pages still use names and keys that other findings rename or delete

- Where, with the new name:
    - `agent_rules.*` becomes `rules.*`, and "agent rules" becomes "rules" (NMU-011, IGN-002): `guides/agents.md:3,6,8,10,14,19,33,36`,
      `guides/templates.md:16`, `docs/src/config/home.ts:22-23`.

    - `hooks.push_files` is deleted (TML-002): `guides/hooks.md:48-53` drops the line.
    - `ci.files` is deleted (TML-002): `guides/ci.md:20-24` drops the line.
    - `ci.setup` becomes `ci.setup_command` (TML-014): `guides/ci.md:40-47`.
    - `ci.platforms` becomes `ci.operating_systems` (NMU-007): `guides/ci.md:26-29`.
    - `dependencies.registry_hosts` becomes `dependencies.allowed_registries` (TML-014): `guides/policy.md:110`.
    - `docs.require_license` is deleted; a missing LICENSE file is accepted with an `[[ignore]]` of the missing-license
      rule: `guides/policy.md:106-107` goes.

    - `tools.semgrep.registry` becomes `tools.semgrep.registry_packs`: `guides/security.md:31`.
    - `[licenses.exceptions."pkg@ver"]` becomes a `[[licenses.allowed_package]]` record with `name`, `version`, and
      `reason`; the reason names the license, and there is no `license` field (TML-009):
      `guides/dependency-licenses.md:3,10,21-34`, `policy.md:138`, the three quickstarts.

    - `coverage.overrides` becomes a `[[coverage.target]]` record with `name`, `lines`, and `reason` (TMF-004), written by hand, because `gspot set` writes no record lists (DT1-002): `guides/testing.md:9,74`.
    - `[scope.api]` becomes a `[[scope]]` record with `path = "api"` (POL-006): `guides/monorepos.md:14-31`.
    - `[check."project/notes"]` becomes a `[[command_check]]` record with `name = "notes"` and an `output` inline table
      on one line: `guides/command-checks.md:31-44,82-95`.

    - `[scope.api.reasons]` and `[reasons]` keys become the reason form next to the value,
      `limits.function_lines = { value = 80, reason = "..." }` (CFR-002): `monorepos.md:23-24`, `policy.md:101-104`.

    - `[[naming.overrides]]` becomes `[[naming.override]]`, with `allowed_names` and a required `reason` (TMF-005):
      `guides/exclude.md:36-44`, and the TypeScript quickstart's recorded help line (`:191`).

    - The root `exclude` key and the `[[generated]]` and `[[vendored]]` records are deleted (TMF-003, CFR-005), with
      their `generator` field: `guides/exclude.md:6-18`.

    - `ignore_file`, `finding_count_pattern`, and `crash_pattern` leave the command check (TML-004):
      `guides/command-checks.md:105-127`, `guides/exclude.md:46-48`.

    - `template` and `selection` are deleted (TML-011): `guides/templates.md:18-29`.
    - `format = "trufflehog-json"` becomes `format = "trufflehog"` (NMU-039): `command-checks.md:97`.
    - `team.template.toml` becomes `gspot.template.toml` (NMU-038): `templates.md:11,34,41,42,63,66,69`.
    - "correction" becomes "fix", and "Corrected note" becomes "Fixed note" (NMU-014): `command-checks.md:62,111-118`,
      `findings.md:72`, `python.md:76`, `swift.md:98`, `reference/runtime.md:9`.

    - "Platform limits" (meaning the operating system) becomes "Operating system limits" (NMU-007): `requirements.md:21`.
    - "integration lines" becomes "gspot hook lines" (DOC-051): `hooks.md:22,33`, `join.md:45`,
      `existing-repository.md:43`, `remove.md:24`.

    - The `swift.xcode_*` settings become `xcode.project`, `xcode.scheme`, and `xcode.destination` (POL-033, TML-014).
      The swift configuration declares them, so its own checks read them without the xcode configuration:
      `testing.md:78`.

- Kind: rename
- Problem: Each of these findings renames or deletes the thing in code but names few or none of the docs lines. If the
  code changes and the pages do not, every example on these lines fails.
- Fix: Change each line in the same commit as its rename. The exact page text is in "Changes by file".
- Size: medium

### DCX-004: `docs/src/config/reference.ts` keeps three constants that go, and reference values are typed in the builders

- Where: `docs/src/config/reference.ts`, `docs/src/content/reference/collection.ts:101,103,114,122`,
  `docs/src/content/reference/schema.ts` (`JSON_SCHEMA_DIALECT`), `docs/src/content/reference/plugin.ts:40,50,53,67,69`
- Kind: move
- Problem: `config/reference.ts` holds `COMMAND_OWNERS` (only for the edit links, DOC-018), `CONFIGURATION_GROUPS` (a
  docs copy of the CLI's group labels), and `REFERENCE_JSON_INDENT` (only the schema route uses it, and the route
  goes). Meanwhile `collection.ts` types the collection name `'gspot-reference'`, the key `'reference-ids'`, and the
  folder `'src/content/docs'` inline, and `plugin.ts` types the `gspot/` rule prefix five times. In this repository,
  every package keeps its fixed values in `config/`.
- Fix: Delete `COMMAND_OWNERS` (DOC-018), `CONFIGURATION_GROUPS` (import the CLI's `GROUP_LABELS` in `collection.ts`,
  never in `config/`; NMU-009, LAY-002), and `REFERENCE_JSON_INDENT` (DOC-040). Add
  `REFERENCE_COLLECTION_NAME = 'gspot-reference'`, `REFERENCE_IDS_KEY = 'reference-ids'`, and
  `PAGES_FOLDER = 'src/content/docs'` to `config/reference.ts`. `JSON_SCHEMA_DIALECT` moves with `buildJsonSchema` into
  the CLI, to `packages/cli/src/config/settings/schema.ts` (CFR-001). Take the `gspot/` rule prefix from the ESLint
  plugin's `config/`, not from a docs copy. The docs `config/` and `types/` folders stay ("Site layout").
- Size: small

### DCX-005: `Header.astro` is a copy of Starlight's own header

- Where: `docs/src/components/starlight/Header.astro`, `docs/astro.config.ts:59`
- Kind: delete
- Problem: Starlight 0.42's default header already has the same three parts: the site title, search, and, on wide
  screens, the social links and the theme picker. It already picks up the site's own `SiteTitle` through Starlight's
  component overrides. The copy adds only a grid layout and a 44 px search button on phones, and it is a forked
  layout to keep up on every Starlight upgrade. On phones, Starlight's search button already hides its text.
- Fix: Delete `Header.astro` and the `Header` line in `astro.config.ts`. Add one rule to `navigation.css`, which
  already sizes the other phone controls to 2.75rem:
  `site-search button[data-open-modal] { min-width: 2.75rem; min-height: 2.75rem; }`. Build, then check one page at
  375 px width.
- Size: small

### DCX-006: `Search.astro` makes the search button's screen-reader name worse

- Where: `docs/src/components/starlight/Search.astro`, `docs/astro.config.ts:61`
- Kind: delete
- Problem: The script copies the button's `textContent` into `aria-label`. The built button has no spaces between its
  parts, so the name becomes "SearchCtrlK" (or "Search⌘K" on a Mac) instead of "Search". The shortcut already reaches
  assistive technology through `aria-keyshortcuts="Control+K"`, and the visible label "Search" already matches
  Starlight's `aria-label`, which is what WCAG 2.5.3 asks for. No site check reads accessible names.
- Fix: Delete `Search.astro` and its line in `astro.config.ts`. Do not report it upstream.
- Size: small

### DCX-007: Every page loads the homepage CSS

- Where: `docs/src/theme.css:3,192-208`, `docs/src/home.css`, `docs/src/pages/index.astro:43-46`
- Kind: move
- Problem: `theme.css` is Starlight's `customCss`, so every page downloads it. Line 3 imports `home.css` (215 lines of
  hero, demo, and footer styles that only `index.astro` and `Hero.astro` use). Lines 192-208 hold rules for
  `.landing`, which exists only on the homepage. The build-time purge (DOC-002) hides this today.
- Fix: Delete `@import './home.css'` from `theme.css`, and add `import '../home.css';` to the frontmatter of
  `pages/index.astro`. Move `theme.css:192-208` into `home.css`, merged with the `index.astro` reset (DOC-039). Keep
  `theme.css:152-174`: the `html:not([data-has-sidebar])` rules also style the 404 page, which has no sidebar.
- Size: small

### DCX-008: Two meta tags in `astro.config.ts` repeat what is already there

- Where: `docs/astro.config.ts:49` (`twitter:card`), `:50-56` (`twitter:image`)
- Kind: delete
- Problem: Starlight already writes `twitter:card = summary_large_image` on every page, and X reads `og:image` when no
  `twitter:image` is present.
- Fix: Delete both entries. The social image URL is then written once.
- Size: small

### DCX-009: The `starlight-llms-txt` plugin has no reader

- Where: `docs/astro.config.ts:6,68`, `docs/package.json:14`
- Kind: delete
- Problem: The plugin writes `/llms.txt`, `/llms-full.txt`, and `/llms-small.txt`. No page links to them, and coding
  agents get gspot's rules inside the repository (`AGENTS.md` and `.gspot/rules/`), not from the website.
- Fix: Delete the import, the plugin entry, and the dependency.
- Size: small

### DCX-010: The three homepage pictures are pictures of text

- Where: `docs/public/brand/home/{finding,policy,agents}.svg`, `docs/src/config/home.ts:9,17,24`,
  `docs/src/components/home/Features.astro:13-15,33-34`
- Kind: delete
- Problem: Each SVG draws a few lines of monospace text. All three have `alt=""`, so screen readers skip them, and the
  card text already says the same thing. "Stop bad commits" shows a picture of `gspot.toml`, and `finding.svg` shows a
  `no-trivial-functions` finding at `src/utils.ts:8:8` that the example cannot produce (that rule skips exported
  functions). The repository's docs rule says to add media only when it explains something text cannot show clearly
  (`.gspot/rules/general/prose/DOCS-MEDIA.md`).
- Fix: Delete the three files, the `image` fields, the `<div class="illustration">` block, and its two CSS rules.
  Change `grid-row: span 4` to `span 3` and the `subgrid` spans to match. Delete `docs/public/brand/home/`.
- Size: small

### DCX-011: Troubleshooting says the same thing twice in two places, and one heading names a cause, not a symptom

- Where: `guides/troubleshooting.md:37-40` and `:73-75`; `:22-26` and `:77-79`; `:30-35`
- Kind: merge
- Problem: "The gspot version differs from the pin" and "This repository pins gspot" are the same error with the same
  advice. "A tool is missing" and "A hook cannot find an executable tool" are the same fix. "The policy and the
  lockfiles disagree" is not something a reader sees; the text is about `gspot install` failing, and it quotes
  GitHub's text instead of gspot's. The repository's docs rule says to start troubleshooting with a symptom the reader
  sees (`DOCS-SURFACES.md`).
- Fix:
    - One section, "This repository pins gspot X, and you are running gspot Y" (the message of INS-009): "Install the
      version the repository pins, as [Join a repository](/guides/join/) shows. To move the repository to a new
      version, see [Upgrade gspot](/guides/upgrade/)."

    - One section, "A tool is missing", that also covers hooks: "Run `gspot install`. It installs the program tools with
      mise; without mise, install the programs that `gspot doctor` lists (see [What you
      need](/guides/install/#what-you-need)). A missing tool makes the run incomplete (exit 2), which also stops a commit
      in the hook."

    - `:33` becomes the heading "`gspot install` fails", with: "If `gspot install` says 'GitHub refused a tool
      download', set `GITHUB_TOKEN` to a token that can read public releases and run it again. Otherwise fix the error
      and run `gspot install` again. To make new lockfiles, delete them and run `gspot install`." (CMD-015; the text
      makes no promise that the lockfiles stay as they were, because `gspot install` writes straight into `.gspot/`.)

- Size: small

### DCX-012: A page documents an `init` refusal that cannot happen

- Where: `guides/existing-repository.md:35-36`
- Kind: delete
- Problem: "If init cannot read one of these files, the plan names it and init stops with exit code 2 before it writes
  anything." That branch is dead code: `init` lists a tool file only after it has read it, and CMD-091 deletes the
  branch.
- Fix: Delete the two lines.
- Size: small

### DCX-013: The JavaScript-and-TypeScript quickstart: what its content needs

- Where: `guides/quickstart/typescript.md`
- Kind: rewrite-text
- Problem: The page covers TypeScript only. It says init "installs the tools, and installs the Git hooks", which init
  does not do (DCX-002). It says init "detects TypeScript, Markdown, and npm", but npm is the package manager, not a
  configuration. The output block is a hand copy with changing timings (`1.0s`, `0.0s`), against "Keep volatile output
  out of examples" (`DOCS-CONTENT.md`).
- Fix: The page is `guides/quickstart/javascript-typescript.mdx` (DCP-002).
    - Title "Quickstart: JavaScript and TypeScript". Description: "Set up gspot in a small TypeScript project and see it
      refuse an agent's commit. The same steps work in a JavaScript project."

    - After the intro, the short section "In a JavaScript project": "The steps are the same. Without TypeScript files,
      `init` selects `javascript` but not `typescript`: `javascript/tsc` checks the JSDoc types, and the three `any`
      findings do not appear."

    - The setup block is the npm path of Install plus the level line: `npm install --save-dev --save-exact @gspothq/cli`, `git add -A`, `git commit -m "build: Add gspot"`, `npx gspot init --yes`,
      `npx gspot set level all`, `npx gspot install`, `npx gspot check`. The level line stays: `gspot/no-trivial-files`
      and the `utils` naming finding run only at level `all`, so without it no commit is refused. `example.json`
      `commands` gains `install_tools` (`npx gspot install`) and `check` (`npx gspot check`); `install` keeps the npm
      line.

    - `:128-130`: "`init` selects the TypeScript, JavaScript, and Markdown configurations and writes `gspot.toml` and
      the tool files under `.gspot/`. `set level all` turns on more checks, including the ones for files and functions
      that only pass calls on. `install` installs the tools for that level and turns on the Git hooks."

    - Every code block is built from `example.json` with Starlight's `<Code>` (PAR-047). The output block shows the five
      finding lines built from `example.findings` (`file:line:column  rule  message`), with no status rows or timings.
      Then delete the quickstart test in `tests/cli/docs.test.ts`.

    - The other fixes on this page: DOC-014, DOC-053, DOC-062 (`:229`), and the "Continue" links
      (`/guides/gspot-toml/`, "the level, limits, and ignores").

- Size: small

### DCX-014: The Swift quickstart talks about license checks the example cannot have

- Where: `guides/quickstart/swift.md:60`
- Kind: delete
- Problem: "If the repository also has npm or Python dependency manifests, those select the general `licenses`
  configuration..." The example is a Swift package with no npm or Python dependency file, so the license check is
  never selected (only npm and Python packages are checked, `dependency-licenses.md:6`).
- Fix: Delete the three license sentences in `swift.md:60`. The sentence on findings that follows them becomes "Fix
  the findings before you commit."
- Size: small

### DCX-015: The upgrade page runs `apply` twice for mise users and mixes three install paths in one flow

- Where: `guides/upgrade.md:10-39`
- Kind: simplify
- Problem: mise users run `apply --dry-run` and `apply` with the new version (`:23-24`), then the "Regenerate and
  verify" block runs `apply --dry-run` and `apply` again (`:34-35`). npm users get one `npm install` line, and pnpm,
  Yarn, and Bun users get only "use the equivalent". The page tells readers to commit first, so `git diff` already
  shows every change; the `--dry-run` steps add nothing. It also has a global-install block, and gspot no longer
  writes a mise pin of its own (INX-002, INX-005).
- Fix: One short block per install path (package manager, mise), each ending with `apply`, `install`, and `check`. The
  mise block starts with `mise use npm:@gspothq/cli@<version>` (INX-002). No global block. The full text is in
  "Changes by file"; it includes DOC-076 and the `<version>` placeholder.
- Size: small

### DCX-017: The hand-written part of `AGENTS.md` contradicts the folder rule and the 14-command CLI

- Where: `AGENTS.md:84`, `:86`, `:88`, `:90`, `:92`, `:94`, `:101`, `:102`, `:109`
- Kind: rewrite-text
- Problem:
    - Line 84 lists where the `config/` and `types/` rule applies, but leaves out `docs/` and `scripts/`, and does not
      state the import rules.

    - Line 90 says the test `config/` and `types/` folders mirror the tests; the tests' rule is "no mirror of the test
      tree".

    - Line 92 names paths that planned renames move (`policy/schema/`, `lifecycle/ownership/...`).
    - Line 101 says every change "keeps every CLI command", but CMD-092 adds `unset` and `unignore` and deletes many
      flags.

    - Lines 88, 94, and 102 point to `findings/progress.json` and `findings/review/glossary.md`, which are deleted.
    - Line 109 says "native consumers".

- Fix: Replace lines 82-103 with the text under "AGENTS.md replacement text". It writes types by hand in `types/` and
  checks each schema with `satisfies`, keeps the commit rules (CFG-022, DEC-029), and dates each owner decision
  (DEC-026). Line 109 becomes "Verify a forced major version with the packages that use it before changing it."
- Size: small

### DCX-018: The managed block tells agents to run bare `gspot`, which fails in npm, pnpm, Yarn, and Bun repositories

- Where: `packages/cli/src/config/agent-rules.ts:4-5` (`CHECKS_INSTALLED`), `packages/cli/src/agent-rules/contracts.ts:50-62`
- Kind: fix-bug
- Problem: Every generated `AGENTS.md` says "Run `gspot check --staged` before committing." With a dev dependency,
  `gspot` is not on `PATH`, so an agent that follows the line gets "command not found". `guides/agents.md:28` tells
  people to add a prefix, but agents read the block, not the guide.
- Fix: The block prints the same start command as the hooks, picked by the one function that also writes them: when
  the root `package.json` lists `@gspothq/cli`, the command of the package manager that `selectNpmClient` finds
  (`npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, `bun run --no-install gspot`); otherwise
  `mise exec -- gspot`. The commands come from the `RUNNERS` table, keyed by `RUNNER_NAMES`. There is no `runner`
  setting and no bare `gspot` row (INX-003, INX-005). `managedBlock` takes that start command. The sentence in
  `config/` (`CHECKS_CLOSING`, today `CHECKS_INSTALLED`) holds a `{command}` mark that `managedBlock` replaces: "Run
  `{command} check --staged` before committing. Change settings with `{command} set`, `{command} unset`,
  `{command} ignore`, or `{command} unignore`." (NMU-031)
- Size: small

### DCX-020: Retired words are still on the pages

- Where: every guide page. The line list, from
  `grep -rn -i -E "\b(authored|applicable|native|contracts?|policy|initialization|intact|precedence|deactivates?|evidence|inputs|executable|correction|consumers?|exceptions?)\b" docs/src/content/docs`:
    - `agents.md`: 3, 10, 14, 16, 26, 28, 36
    - `ci.md`: 6, 32, 36, 38, 51, 61
    - `command-checks.md`: 28, 29, 31, 52, 95, 103, 111, 114, 118, 125, 127
    - `dependency-licenses.md`: 3, 10, 21, 24, 29, 33, 34
    - `exclude.md`: 6, 14, 18, 34, 46
    - `existing-repository.md`: 18, 43
    - `findings.md`: 26, 72, 76, 78
    - `generated-files.md`: 6, 18, 23, 41, 46
    - `hooks.md`: 14, 22, 33, 55
    - `install.md`: 10, 39, 49, 71, 73, 82
    - `join.md`: 20, 45
    - `monorepos.md`: 12, 33, 61, 87, 89, 91
    - `overview.md`: 12, 14, 21, 22
    - `policy.md`: 3, 7, 24, 32, 39, 49, 51, 52, 66, 99, 102-104, 125, 129, 131, 135, 138
    - `quickstart/python.md`: 29, 46, 74
    - `quickstart/swift.md`: 35, 50, 60, 96
    - `quickstart/typescript.md`: 132, 229, 234
    - `remove.md`: 13, 21, 22, 24, 25
    - `requirements.md`: 3, 10, 12, 14, 16, 19
    - `runners.md`: 10, 18, 24, 26, 28, 32, 34
    - `security.md`: 38
    - `templates.md`: 3, 6, 14, 26, 47, 53, 59, 72
    - `testing.md`: 46
    - `troubleshooting.md`: 3, 12, 17, 24, 31, 33, 35, 67, 69, 71, 77, 83
    - `upgrade.md`: 6, 20, 41, 43
    - `reference/runtime.md`: 3, 9, 12, 17

- Kind: rewrite-text
- Problem: The DOC records rewrite many of these lines one by one. Others have no record, for example
  `agents.md:16`, `ci.md:6,61`, `command-checks.md:28-31,52`, `findings.md:76-78`, `monorepos.md:12,33,89-91`,
  `templates.md:3,47,59,72`, `troubleshooting.md:3,12,17,31,33,67-71,83`, and `upgrade.md:6,43`. Without one word map,
  each rewrite picks its own word.
- Fix: Apply one map to every listed line that no record rewrites:
    - "policy" becomes "`gspot.toml`" (the file) or "settings" (what it holds).
    - "initialization" or "initialize" becomes "`gspot init`" or "set up".
    - "authored" becomes "your own".
    - "applicable" becomes "needed", or goes.
    - "executable tools" becomes "program tools". Explain the term once, on the Install page: "command-line programs
      such as ShellCheck, Gitleaks, and typos".

    - "correction" becomes "fix", and "native" becomes "the tool's own".
    - "exception" becomes "ignore" (for a finding) or "allowed package" (for a license).
    - "accept a finding" becomes "ignore a finding". "Accept the plan" stays, because the CLI asks exactly that.
    - "intact" becomes "as a whole", "precedence" becomes "wins", "deactivates" becomes "turns off", "evidence" and
      "inputs" become "files", and "consumers" becomes "repositories that used it".

    - "contracts" goes: say what the thing is, for example "the lint rules for the frameworks and libraries your
      project declares".

- Size: medium

### DCX-021: Four pages describe the mise file as `.mise/conf.d/gspot-tools.toml`, written only for the mise runner

- Where: `guides/generated-files.md:21`, `guides/runners.md:10`, `guides/requirements.md:19`, `guides/ci.md:36,49-59`
- Kind: rewrite-text
- Problem: The pages say the mise file appears "when mise is selected" and pins gspot and Node.js, and that CI without
  mise must install the tools by hand. gspot writes `.gspot/mise.toml` with only the program tools, whenever the
  selected checks need one, in every repository; it never pins gspot or Node.js (INX-001, INX-002). The generated CI
  always installs the tools with mise (INS-003).
- Fix: `generated-files.md:21`: "`.gspot/mise.toml` | The program tools gspot installs with mise." This is the only
  page that names the file. On Install, "What you need" says that `gspot install` installs the program tools with
  mise, without naming the file (DOC-060). `ci.md` takes the text in "Changes by file".
- Size: small

## Target pages

Paths are under `docs/src/content/docs/`. "From" names the current pages whose text the target page holds. The
sidebar groups, in order: Get started, Daily use, Configure, Topics, Troubleshooting (top level), and Reference.

| Sidebar group | Label                                 | Path                                                              | Job                                                                                                                                         | From                                                                                    |
| ------------- | ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Get started   | What gspot does                       | `guides/overview.md`                                              | Explain what gspot does, the two levels, and the words the docs use                                                                         | `overview.md`                                                                           |
| Get started   | Install                               | `guides/install.md` (title "Install gspot")                       | Set up gspot in a repository: what you need, how to install, the init plan, installing the tools, how hooks start gspot, private registries | `install.md` + `requirements.md` + `runners.md` + `existing-repository.md`              |
| Get started   | Quickstart: JavaScript and TypeScript | `guides/quickstart/javascript-typescript.mdx`                     | Walk through a new JavaScript or TypeScript project: set up, see an agent's commit refused, fix it                                          | `quickstart/typescript.md`                                                              |
| Get started   | Quickstart: Python                    | `guides/quickstart/python.md`                                     | The same walk-through for a Python project, with mise and Ruff                                                                              | `quickstart/python.md`                                                                  |
| Get started   | Quickstart: Swift                     | `guides/quickstart/swift.md`                                      | The same walk-through for a Swift package, with mise and SwiftLint                                                                          | `quickstart/swift.md`                                                                   |
| Get started   | Join a repository                     | `guides/join.md`                                                  | Set up gspot in a fresh clone of a repository that already uses it                                                                          | `join.md`                                                                               |
| Daily use     | Fix findings                          | `guides/findings.md`                                              | Run checks, read a finding, fix it by hand or with `--fix`, read the report                                                                 | `findings.md`                                                                           |
| Daily use     | Git hooks                             | `guides/hooks.md`                                                 | What each hook checks; turn hooks on or off; another hook manager                                                                           | `hooks.md` + the hooks part of `runners.md:34`                                          |
| Daily use     | CI                                    | `guides/ci.md`                                                    | Turn the generated CI job on or off; run gspot in your own pipeline                                                                         | `ci.md` + the CI part of `runners.md:34`                                                |
| Daily use     | Coding agents                         | `guides/agents.md`                                                | Write rules for coding agents and the AGENTS.md block                                                                                       | `agents.md`                                                                             |
| Configure     | gspot.toml                            | `guides/gspot-toml.md`                                            | Change settings: configurations, level, limits, hand edits                                                                                  | `policy.md` (without "Ignore one finding") + `remove.md:6-15`                           |
| Configure     | Exclude files and ignore findings     | `guides/exclude.md` (the file keeps its name)                     | Make gspot stop reporting something: hide files, mark generated or copied files in `.gitattributes`, ignore a finding, allow a name         | `exclude.md` (without test files and ignore files) + `policy.md:54-74`                  |
| Configure     | Monorepos                             | `guides/monorepos.md`                                             | Give folders of one repository their own configurations and settings                                                                        | `monorepos.md`                                                                          |
| Configure     | Command checks                        | `guides/command-checks.md`                                        | Run your own command as a check                                                                                                             | `command-checks.md` (without the `ignore_file`, count-failures, and crash-pattern text) |
| Configure     | Reuse templates                       | `guides/templates.md`                                             | Export your setup and start another repository from it                                                                                      | `templates.md`                                                                          |
| Configure     | Generated files                       | `guides/generated-files.md`                                       | Which files gspot writes, which to commit, which not to edit                                                                                | `generated-files.md`                                                                    |
| Configure     | Upgrade gspot                         | `guides/upgrade.md`                                               | Move a repository to a new gspot version                                                                                                    | `upgrade.md`                                                                            |
| Configure     | Remove gspot                          | `guides/remove.md`                                                | Take gspot out of a repository                                                                                                              | `remove.md:17-27`                                                                       |
| Topics        | Tests and coverage                    | `guides/testing.md`                                               | Set the least coverage; tell gspot which files are tests                                                                                    | `testing.md` + `exclude.md:20-26`                                                       |
| Topics        | Dependency licenses                   | `guides/dependency-licenses.md`                                   | Allow licenses and single packages for the license check                                                                                    | `dependency-licenses.md`                                                                |
| Topics        | Security                              | `guides/security.md`                                              | The security checks; run Semgrep and CodeQL                                                                                                 | `security.md`                                                                           |
| (top level)   | Troubleshooting                       | `guides/troubleshooting.md`                                       | Fix a command that failed                                                                                                                   | `troubleshooting.md`                                                                    |
| Reference     | Commands                              | `reference/commands/` (generated)                                 | Every command, its flags, and its exit codes                                                                                                | code                                                                                    |
| Reference     | Configurations                        | `reference/configurations/` (generated)                           | Every configuration                                                                                                                         | code                                                                                    |
| Reference     | Checks                                | `reference/checks/` (generated)                                   | Every check                                                                                                                                 | code                                                                                    |
| Reference     | ESLint plugin                         | `reference/eslint-plugin/` (generated; today `reference/plugin/`) | Every plugin rule                                                                                                                           | code (DCP-015)                                                                          |
| Reference     | gspot.toml reference                  | `reference/gspot-toml` (generated)                                | Every table and key of gspot.toml                                                                                                           | code; `reference/settings` merges in (POL-035)                                          |
| Reference     | Exit codes and environment variables  | `reference/exit-codes.md`                                         | Look up exit codes and the environment variables gspot reads                                                                                | `reference/runtime.md`                                                                  |
| (no sidebar)  | Page not found                        | `404.md`                                                          | Send a lost reader to the homepage or Install                                                                                               | `404.md`                                                                                |

Hand-written pages: 24 (23 in the sidebar, plus the 404 page), from 27 today. Deleted as files: `requirements.md`,
`runners.md`, and `existing-repository.md` (merged into Install).

## Changes per target page

The finding IDs give the exact wording; this list says what each page cuts, adds, moves, or rewrites. Every page
teaches only the 14-command CLI, the final `gspot.toml` keys, and the two install paths (a package manager, or mise).

1. **What gspot does** (`guides/overview.md`)
    - Replace the body with the `overview.md` text in "Changes by file": the jargon goes; "rules" are the Markdown files
      for coding agents, and a "lint rule" is one linter instruction (NMU-011).

    - Words list: the gspot.toml link says "gspot.toml" (NMU-012); the runner item says that hooks start gspot through
      the package manager or mise, and links `/guides/install/#how-hooks-start-gspot`; a plugin link goes to
      `/reference/eslint-plugin/`.

    - "Continue": one line that links Install and the three quickstarts; no Requirements link.

2. **Install** (`guides/install.md`), sections in this order:
    1. "What you need" (from `requirements.md`): Git; Node.js 24.2 or newer, said once (Bun can install and start
       gspot, but the checks run on Node.js; INS-012); the package manager, or mise; the tool table;
       `gspot init --dry-run` shows the tools (DOC-060). Program tools (gitleaks, typos, ShellCheck, ...) need mise on
       both paths. Without mise, `gspot install` installs the npm tools, and the Python tools only when uv is on
       `PATH`; it prints one line that names every missing program, uv included, and exits 0. Checks whose program is
       missing report it and fail (exit 2) until it is installed; `gspot doctor` names them. "Operating system limits"
       stays whole (Swift, Xcode, Docker, Bash 4.4; NMU-007). Delete `requirements.md:27` (DOC-060).
    2. "Choose how to install": one table with two rows (INX-009, DOC-061): a repository with `package.json` adds gspot
       as an exact dev dependency and starts it with `npx gspot`, `pnpm exec gspot`, `yarn exec gspot`, or `bunx gspot`;
       any other repository pins gspot with mise and starts it with `mise exec -- gspot`.
    3. "Repository with package.json": the npm block (`npm install --save-dev --save-exact @gspothq/cli`,
       `git add package.json package-lock.json`, `git commit -m "build: Add gspot"`, `npx gspot init`,
       `npx gspot install`, `npx gspot check`) and the table for pnpm, Yarn (`yarn exec gspot`), and Bun; "commit
       first" said once, with its reason (DOC-049).
    4. "Repository without package.json": `mise use node@24 npm:@gspothq/cli@<version>`, `git add mise.toml`,
       `git commit -m "build: Add gspot"`, `mise exec -- gspot init`, `mise exec -- gspot install`,
       `mise exec -- gspot check`; one sentence: "Replace `<version>` with the version you install, such as `0.1.0`."
       (`mise use` saves the version as typed, so `@latest` would not pin it; INX-002.)
    5. "Read the plan" (from `existing-repository.md`): the dry run; what init replaces; "What init leaves alone" stays
       whole (DOC-063 wording, "gspot hook lines", DOC-051). Delete the Ruff paragraph (DOC-063), the sentence on an
       unreadable tool file (DCX-012), and the "Run the checks" section.
    6. "Install the tools and check": init asks only "Continue?" (`--yes` answers it), writes the files, installs
       nothing, and ends with "run gspot install" (CLX-001, DCX-002); `gspot install` installs the tools and turns on
       the Git hooks; `gspot check` runs the checks. "If `gspot install` fails, see Troubleshooting." (DOC-061) No
       `--no-install`, `--refresh-lockfiles`, `mise trust`, or `mise install` text.
    7. "How hooks start gspot" (anchor `#how-hooks-start-gspot`, from `runners.md`): one sentence: when the root
       `package.json` lists `@gspothq/cli`, hooks run `npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, or
       `bun run --no-install gspot`; otherwise `mise exec -- gspot` (DCP-009).
    8. "Private registries" (from `runners.md:36-40`), whole, in plain words.
    9. Last line: "Cloned a repository that already uses gspot? See Join a repository." No "After you clone" section
       (DCP-005).
3. **Quickstart: JavaScript and TypeScript** (`guides/quickstart/javascript-typescript.mdx`)
    - Rename (DCP-002); build each file block and the output from `docs/src/config/example.json` with Starlight's
      `<Code>` (PAR-047); then the quickstart test goes.

    - Add the short "In a JavaScript project" section (DCX-013: `javascript/tsc` checks the JSDoc types).
    - Setup block: `npm install --save-dev --save-exact @gspothq/cli`, commit, `npx gspot init --yes`,
      `npx gspot set level all`, `npx gspot install`, `npx gspot check` (DCX-013).

    - The step-3 code block starts with `npx gspot check`; the exact help line; no empty last output line; a plain
      level sentence (DOC-014). The init sentence says that init writes the files and `npx gspot install` installs the
      tools and hooks (DCX-002).

    - The license line (DOC-053), the "commit first" pointer (DOC-049), and the skipped-check sentence (DOC-062).
    - Links: Requirements becomes Install; `/guides/policy/` becomes `/guides/gspot-toml/`; "exceptions" becomes
      "ignores".

4. **Quickstart: Python** (`guides/quickstart/python.md`)
    - One `<version>` sentence: "Replace `<version>` with the version you install, such as `0.1.0`." (INX-002)
    - Setup block (the mise path, DCP-001): `mise use node@24 npm:@gspothq/cli@<version>`, `git add mise.toml`,
      `git commit -m "build: Add gspot"`, `mise exec -- gspot init --yes --configurations python`; no runner choice
      (INX-003). The e2e test runs the same commands.

    - After init: `mise exec -- gspot install`, `check`, then `check --fix` and `check` (`QUICKSTART_COMMANDS`). No
      `doctor` line: `gspot install` already names missing programs. No `mise trust` or `mise install` line (INX-001,
      INX-006).

    - The license paragraph becomes DOC-053's line; rewrite lines 29 and 74 (DOC-062).
    - "Read Requirements and Install first" becomes "Read Install first".

5. **Quickstart: Swift** (`guides/quickstart/swift.md`): the same changes as Python, with `--configurations swift`. It
   keeps "This example runs on macOS" and the scaffold source and test blocks. It drops its license sentences: a
   Swift package selects no license check (DCX-014).
6. **Join a repository** (`guides/join.md`)
    - First line: "`gspot init` refuses to run where `gspot.toml` exists; use `gspot install`" (DOC-064).
    - Keep the table of package managers (INX-009): the frozen install, then `install` and `check` with the start
      command; Yarn rows use `yarn exec gspot`. The mise block is `mise exec -- gspot install` and
      `mise exec -- gspot check`, with no `mise trust` or `mise install` line. Delete "With a global npm install"
      (INX-005). "Without mise, install the program tools yourself; `gspot doctor` lists them."

    - The last paragraph follows DOC-064; "integration lines" becomes "gspot hook lines", with a link to Git hooks
      (DOC-051).

7. **Fix findings** (`guides/findings.md`)
    - Delete `gspot check --skip ...` and the `-C` sentence (DCX-001); `--base` alone (DOC-016); the report text
      (DOC-015); DOC-065 wording; delete "`--dry-run` requires `--fix`" (`--dry-run` turns on `--fix`, CLX-007).

    - "When a rule does not fit": links to `/guides/exclude/#ignore-a-finding` and `/guides/gspot-toml/#change-a-limit`;
      the anchor `#add-a-fix-command` (DOC-074).

8. **Git hooks** (`guides/hooks.md`)
    - First lines: gspot writes three Git hooks, and `gspot install` turns them on when `hooks.enabled = true`, which
      `gspot init` sets (DOC-066).

    - "Prepare the clone" becomes one sentence with a link to Join (DCP-012).
    - The lines for other hook managers use the repository's start command, and the commit-msg line is
      `gspot check --message-file "$1"` (CLX-006).

    - After `gspot set hooks.enabled true`, add `gspot install` (DOC-009); the `hooks.push_files` line goes (TML-002);
      add "Turn hooks off: `gspot set hooks.enabled false`, then `gspot install`" (DCX-001); DOC-066 wording; `--base`
      alone (DOC-016); the ignore link goes to `/guides/exclude/#ignore-a-finding`.

9. **CI** (`guides/ci.md`)
    - Replace `gspot init --ci github|gitlab` with: `gspot init` proposes a CI workflow in its plan; turn CI on later
      with `gspot set ci.enabled true`, and for GitLab also `gspot set ci.provider gitlab` (TML-015, CLX-001). `set`
      writes the workflow, so no `gspot apply` follows (DOC-010).

    - Delete the `ci.files` text (TML-002).
    - `ci.platforms ... --replace` becomes `gspot set ci.operating_systems linux macos windows`; to replace a list you
      wrote, run `gspot unset ci.operating_systems` first (NMU-007). GitHub only.

    - `gspot set ci.setup_command npm ci`, with no `gspot apply` after it (TML-014, DOC-010). The generated job installs
      mise and runs gspot at the version in `.gspot/version`, and gspot installs its tools (INS-003, DOC-067).

    - "Your own pipeline": install mise and the project's runtime, then run `install`, then `check`, with the
      repository's start command (INX-005). No global install and no `doctor` step: `check` fails with exit 2 and names
      each missing program. The generated job has the same two steps (INS-003). When init finds another lint job or
      another CI system, it writes no workflow; that pipeline takes the same steps.

    - Add "Turn CI off": `gspot set ci.enabled false` (TML-015).

10. **Coding agents** (`guides/agents.md`): `[agent_rules]` becomes `[rules]`, and "agent rules" becomes "rules";
    replace the CLAUDE.md paragraphs with DOC-011's text (gspot never touches `CLAUDE.md`; put `@AGENTS.md` in your
    own `CLAUDE.md`); DOC-068 wording.
11. **gspot.toml** (`guides/gspot-toml.md`, renamed from `policy.md`; title "gspot.toml", NMU-012)
    - Description: "Choose configurations and a level, and change settings in gspot.toml."
    - Sections: See the current choices; Choose configurations (with the moved `remove.md:6-15`, DCP-004); The level;
      Change a limit (DOC-005's reason); Other ways to write a setting (`--scope`, and `gspot unset` in place of
      `--default`, `--replace`, and `--remove`, DCX-001); Edit the file by hand; When files of a language appear or go
      (DOC-055).

    - A value that loosens a check is written in the reason form `{ value = ..., reason = "..." }`, and `gspot unset`
      removes the value and its reason together (DOC-069); no `[reasons]` text. The registry setting is
      `dependencies.allowed_registries`. There is no `docs.require_license` sentence: a missing LICENSE file is
      accepted with `gspot ignore docs/required-files --rule missing-license --reason "..."`. "Edit the file by hand"
      says "gspot.toml is TOML 1.0. Keep each inline table on one line." (CFR-007), and the `#:schema` line carries the
      version (CFR-001).

    - Move out "Ignore one finding" (DCP-007). Delete "Reconcile project changes" (DOC-055), "Settings for one
      integration" (DCP-011), the `--scope-configurations` mention, and the license sentence (DOC-053).

    - Links: `/reference/settings/` becomes `/reference/gspot-toml/`.

12. **Exclude files and ignore findings** (`guides/exclude.md`; the file keeps its name and its title changes, DCP-007)
    - Opening: "gspot reads the files Git tracks, plus untracked files that `.gitignore` does not hide." Then the ways
      to make gspot stop reporting something: hide files with `.gitignore`; mark generated and copied files in
      `.gitattributes`; ignore a finding; allow a name.

    - Sections: Mark generated and copied files (`linguist-generated` and `linguist-vendored` in `.gitattributes`,
      CFR-005); Ignore a finding (moved from `policy.md:54-74`: the one example, `--rule`, `--paths`, `--until`, the
      required reason, `gspot unignore`, OSV advisory ignores, and the `gspot check --verbose` line); Allow a name
      (`[[naming.override]]` with `paths`, `categories`, `allowed_names` or `allow_digits`, and its required `reason`,
      TMF-005).

    - Delete "Exclude build output" (TMF-003: no root `exclude` key) and the `generator`, `[[generated]]`, and
      `[[vendored]]` text (CFR-005). Move out "Test files" (DCP-008); delete "Native ignore files" (TML-004).

    - "policy reference" becomes "gspot.toml reference"; "accept" becomes "ignore".

13. **Monorepos** (`guides/monorepos.md`): scopes as `[[scope]]` records with `path` (POL-006), and "Quote a key that
    contains slashes" goes; a setting that loosens a check uses the reason form inside the `[[scope]]`, such as
    `limits.function_lines = { value = 80, reason = "..." }` (CFR-002); "Paths you write are relative to the
    repository root. A configuration's default paths apply inside the scope that selects it." (CFR-003). The
    TypeScript-and-Python example says that `gspot init` proposes one scope for each project, and a configuration
    that init did not detect is added with `gspot add pytest --scope services/api` (DCX-001). "A policy below the Git
    root" becomes "A gspot.toml below the Git root" and says to run gspot from that folder: `cd api && gspot check`
    (CLX-009); DOC-071 wording.
14. **Command checks** (`guides/command-checks.md`): `[[command_check]]` records with `name` and an `output` inline
    table on one line; the fix-command wording and anchor (DOC-074); delete the sections "Count failures in the
    output" and "Native exclusions" and the `crash_pattern` paragraph (TML-004 takes `ignore_file`,
    `finding_count_pattern`, and `crash_pattern` out of the command check); "policy reference" becomes "gspot.toml
    reference".
15. **Reuse templates** (`guides/templates.md`): DOC-075 wording; `gspot/unmatched-paths` becomes
    `gspot/unused-entries` (the glossary name); the file name `gspot.template.toml` in examples (NMU-038). Delete
    "Export writes these template fields", the `template` and `selection` text (TML-011), and the `export --dry-run`
    sentence (CLX-004). A template carries the hooks, CI, and rules settings, and nothing about how gspot starts
    (INX-004). The `init --from` block ends with `gspot install` and `gspot check` (DCX-002).
16. **Generated files** (`guides/generated-files.md`): DOC-073 and DOC-083; the one home of "an edited generated file
    is kept" (DOC-050); "agent rules" becomes "rules". The only page that names the mise file: "`.gspot/mise.toml`: the
    program tools gspot installs with mise" (DCX-021). Add INX-012's sentence: "gspot updates the files in `.gspot/`
    when you upgrade gspot. Tell dependency bots to skip that folder, for Renovate: `"ignorePaths": [".gspot/**"]`."
17. **Upgrade gspot** (`guides/upgrade.md`): the text of DCX-015: `npm install --save-dev --save-exact '@gspothq/cli@<version>'` (or the same with pnpm, Yarn, or Bun), or `mise use npm:@gspothq/cli@<version>`; then
    `gspot apply`, `gspot install`, and `gspot check` with the start command; then commit (INX-002). DOC-076's first
    line; keep the `<version>` placeholder; no edited-file sentence (DOC-050); "policy" becomes "gspot.toml". No
    global section (INX-005).
18. **Remove gspot** (`guides/remove.md`): only "Remove gspot from a repository", with the pointer line first
    (DCP-004). The steps end with `npm uninstall @gspothq/cli` (or your package manager's remove command) or
    `mise unuse npm:@gspothq/cli`, then deleting `gspot.toml` and `.gspot/`; there is no step for a mise file outside
    `.gspot/` (INX-001). "integration lines" becomes "gspot hook lines" (DOC-051); "authored" becomes "your own".
19. **Tests and coverage** (`guides/testing.md`): add "Test files" (DCP-008); DOC-079 wording; `/reference/settings/`
    becomes `/reference/gspot-toml/`. A Swift target's coverage limit is a `[[coverage.target]]` record with `name`,
    `lines`, and, when `lines` is below `coverage.lines`, `reason`, written by hand in `gspot.toml` (TMF-004; `gspot set` writes no record lists, DT1-002). `testing.md:78` names `xcode.project` and `xcode.scheme` (TML-014). The
    noun "floor" becomes "the least coverage".
20. **Dependency licenses** (`guides/dependency-licenses.md`): `[[licenses.allowed_package]]` records with `name`,
    `version`, and `reason`; the reason names the license, and there is no `license` field (TML-009); DOC-079's line
    10; the one home of the license note (DOC-053).
21. **Security** (`guides/security.md`): DOC-008 and DOC-079; `tools.semgrep.registry` becomes
    `tools.semgrep.registry_packs`; the ignore link goes to `/guides/exclude/#ignore-a-finding`.
22. **Troubleshooting** (`guides/troubleshooting.md`)
    - The headings "gspot.toml has an error" and "The working tree has uncommitted changes" (POL-064);
      "Initialization needs a terminal" becomes the heading "There is no terminal to ask in", and its text says that
      a dry run needs no terminal: `gspot init --dry-run` (CLX-001).

    - "A tool is missing" (one section, DCX-011): run `gspot install`; without mise, install the programs that
      `gspot doctor` lists, with a link to `/guides/install/#what-you-need` (DOC-079); no `mise install` line.

    - "`gspot install` fails" (in place of "The policy and the lockfiles disagree", DCX-011): the GitHub download
      text, then "Fix the error and run `gspot install` again. To make new lockfiles, delete them and run
      `gspot install`." (CMD-015)

    - "npm exec cannot find gspot": "Run your package manager's install, then `gspot install`." (INX-005) The runner
      sentence goes (INX-003).

    - "A generated file has local edits": one line that links Generated files (DOC-050).
    - "A check is slow": add the Windows form of the `GSPOT_JOBS` example; "small CI runner" becomes "small CI
      machine". The example lives only here (DCP-006).

23. **Exit codes and environment variables** (`reference/exit-codes.md`, renamed from `runtime.md`, DCP-006): DOC-006's
    rows; the row "130 or 143: `gspot check` was stopped (Ctrl-C or SIGTERM)"; DOC-078's description and rows; no
    `GSPOT_JOBS` example.
24. **Page not found** (`404.md`): the logo path `/logo.svg` (DOC-035); keep the `head` lines, with a YAML comment
    that says why.

### Generated reference pages

- **Commands index**: delete the `-C <dir>` sentence (DCX-001); add a link to Exit codes and environment variables.
- **gspot.toml reference**: one page (POL-035), with the intro `GSPOT_TOML_INTRO` (DOC-029) and the column "Reason
  needed when" (NMU-020). The page links the versioned schema `https://unpkg.com/@gspothq/cli@<version>/gspot.schema.json`
  (CFR-001). Sidebar label "gspot.toml reference"; the label of gspot's own settings is "gspot" (DCP-018).
  `reference/settings` goes.
- **ESLint plugin**: the URL `reference/eslint-plugin/`, the column "Level", and "none" for a rule that no level turns
  on (DCP-015).
- **Configurations**: the labels of DOC-080.

## Link changes

Every link that a rename or deletion in this file breaks, with its replacement.

| Old target                                                                                | New target                                                                | Where                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/requirements/`                                                                   | `/guides/install/#what-you-need`                                          | `docs/src/components/home/Hero.astro:21` (the Hero becomes the npm block and a link to `/guides/install/`), `guides/overview.md:32`, `guides/quickstart/python.md:6`, `guides/quickstart/swift.md:6`, `guides/quickstart/typescript.md:7`, `guides/install.md:6` (delete), `packages/cli/README.md:9` (the README is written by hand) |
| `/guides/runners/`                                                                        | `/guides/install/#how-hooks-start-gspot`                                  | `guides/overview.md:27` (the runner item)                                                                                                                                                                                                                                                                                             |
| `/guides/runners/`                                                                        | `/guides/install/#what-you-need`                                          | `guides/troubleshooting.md:25` (the merged "A tool is missing" section points where program tools come from)                                                                                                                                                                                                                          |
| `/guides/policy/`                                                                         | `/guides/gspot-toml/`                                                     | `guides/overview.md:22`, `guides/quickstart/typescript.md:234`, `guides/findings.md:78` (`#change-a-limit`), `packages/cli/README.md:38`                                                                                                                                                                                              |
| `/guides/policy/#ignore-one-finding`                                                      | `/guides/exclude/#ignore-a-finding`                                       | `guides/findings.md:76`, `guides/hooks.md:55`, `guides/security.md:38`                                                                                                                                                                                                                                                                |
| `/guides/quickstart/typescript/`                                                          | `/guides/quickstart/javascript-typescript/`                               | `Hero.astro:90`, `guides/overview.md:32`, `docs/src/config/navigation.ts:12` (slug), `packages/cli/README.md:37`                                                                                                                                                                                                                      |
| `docs/src/content/docs/guides/quickstart/typescript.md` (repository path)                 | `https://generativespotting.com/guides/quickstart/javascript-typescript/` | `README.md:67,73` (the README text in "Changes by file")                                                                                                                                                                                                                                                                              |
| `/guides/command-checks/#add-a-correction-command`                                        | `/guides/command-checks/#add-a-fix-command`                               | `guides/findings.md:72`                                                                                                                                                                                                                                                                                                               |
| `/reference/settings/`                                                                    | `/reference/gspot-toml/`                                                  | `guides/policy.md:19`, `guides/testing.md:31`, `docs/src/content/reference/policy.ts:55`, `docs/src/config/navigation.ts:66` (entry deleted)                                                                                                                                                                                          |
| `/reference/gspot-toml/#check`                                                            | the anchor the page writes for `[[command_check]]` (`#command_check`)     | `guides/command-checks.md:95,103`                                                                                                                                                                                                                                                                                                     |
| `/reference/gspot-toml/#generated`                                                        | none: the section goes (CFR-005)                                          | `guides/exclude.md:18`                                                                                                                                                                                                                                                                                                                |
| `/reference/plugin/` and `/reference/plugin/<rule>/`                                      | `/reference/eslint-plugin/` and `/reference/eslint-plugin/<rule>/`        | `guides/overview.md:24`, `docs/src/content/reference/plugin.ts:67`, `docs/src/config/navigation.ts:65`, `packages/eslint-plugin/src/create-rule.ts:7`, `packages/cli/configurations/language/javascript/manifest.toml:241,315`, `packages/eslint-plugin/README.md:70,105`, `tests/cli/commands/explain/command.test.ts:42`            |
| `/reference/runtime` (slug)                                                               | `/reference/exit-codes`                                                   | `docs/src/config/navigation.ts:68`; the commands index adds a link                                                                                                                                                                                                                                                                    |
| `/schema/gspot.schema.json` and `https://generativespotting.com/schema/gspot.schema.json` | `https://unpkg.com/@gspothq/cli@<version>/gspot.schema.json`              | `docs/src/content/reference/policy.ts:65`, `packages/cli/src/config/commands/init.ts:21` (`JSON_SCHEMA_URL`, which becomes `SCHEMA_URL_PREFIX` in `config/settings/file.ts`), `gspot.toml:1`, `docs/src/config/example.json:45` (recorded again); the ignore at `gspot.toml:443-446` goes                                             |
| `generativespotting.com/reference/configuration/` (CLI error text)                        | `generativespotting.com/reference/gspot-toml/`                            | `packages/cli/src/policy/public.ts:45` (NMU-001, `SETTINGS_REFERENCE_URL`)                                                                                                                                                                                                                                                            |

Unchanged paths: `/guides/install/`, `/guides/join/`, `/guides/upgrade/`, `/guides/remove/`, `/guides/exclude/` (the
file keeps its name), `/reference/configurations/...` (including the `#details` links in the TypeScript and JavaScript
manifests), `/reference/checks/...`, and `/reference/commands/...`. No link to `/guides/existing-repository/` or
`/reference/runtime/` exists outside the sidebar. The root `README.md` and `packages/cli/README.md` are written by hand,
with the new links. The site link check catches any link this table misses.

## Site layout

```text
docs/
  astro.config.ts  package.json  wrangler.jsonc  tsconfig.json  README.md  (and the two generated pointer files)
  public/logo.svg  public/social.png  public/licenses/turborepo.txt
  src/
    content.config.ts
    theme.css  home.css  navigation.css
    components/home/{Hero,Features}.astro
    components/starlight/SiteTitle.astro
    pages/index.astro
    config/
      example.json      the recorded example: the Hero, the JavaScript-and-TypeScript quickstart, its integration test
      home.ts           FEATURES, the three homepage cards
      navigation.ts     SIDEBAR
      reference.ts      GSPOT_TOML_INTRO, DETECTION_LABELS, SCHEMA_TYPE_LABELS, CHECK_RUN_LABELS, REFERENCE_FOLDERS,
                        REFERENCE_COLLECTION_NAME, REFERENCE_IDS_KEY, PAGES_FOLDER
      site.ts           SITE_URL, REPOSITORY_URL, LOGO, SOCIAL_IMAGE, SOCIAL_IMAGE_SIZE, FONT_PACKAGES
    types/
      home.ts           FeatureProps (without image)
      reference.ts      ReferencePage, SettingVariant
    reference/{checks,collection,commands,configurations,eslint-plugin,gspot-toml,markdown}.ts
    content/docs/       the 24 hand-written pages
```

Deleted: `src/env.d.ts`, `src/content/revision.ts`, `src/components/starlight/{Header,Search}.astro`,
`src/pages/schema/gspot.schema.json.ts`, `public/brand/`, and `assets/readme/`. `src/types/components.ts` becomes
`src/types/home.ts`, and `src/content/reference/schema.ts` moves into the CLI.

`config/` imports nothing; `types/reference.ts` imports `SettingDeclaration` from the CLI's `types/settings/tables.ts`,
a type from another package. User-facing page text stays in the builders. The npm command in `Hero.astro` comes from
`example.commands.install`, not from a new constant.

## Changes by file

Line numbers are those at commit `c3def5bf6`. "(ID)" means: apply that finding. Where a page merges into another
page, its changes move with the text. Every install, quickstart, join, upgrade, remove, hooks, CI, and troubleshooting
text below uses the two install paths (a package manager, or mise): no global install, no one-off
`mise exec npm:@gspothq/cli@... -- gspot init`, no `mise trust` or `mise install` line, no runner setting, no init
question but "Continue?", and `gspot set ci.enabled true` for CI. Every `gspot.toml` key is the final one.

### `docs/src/content/docs/404.md`

- Line 20: `/brand/identity/mark/light.svg` becomes `/logo.svg` (DOC-035).
- Above `head:`, add the YAML comment `# Astro writes this page as 404.html; the canonical link and og:url name that file so the site link check finds it.` Keep the `head` lines: without them both point at `/404/`, which does not
  exist.

### `guides/overview.md` (What gspot does)

Replace the body with:

```markdown
gspot is a command-line tool that lints AI-generated code and writes rules for AI coding agents. Git hooks run its
checks before each commit and push, and a finding stops the commit or push. CI runs the checks again.

`gspot init` looks at your files and dependencies and shows what it will set up: the configurations, the tools they
need, and the files it will write. It writes nothing until you accept. Your choices live in `gspot.toml`.
`gspot install` then installs the tools and turns on the Git hooks.

## Levels

- `recommended` (the default) finds bugs, security and accessibility problems, type errors, formatting problems,
  and misuse of the frameworks and libraries your project declares.
- `all` also checks naming, word choice, code structure, doc comments, the order of declarations, API style, and
  complexity.

Neither level turns on experimental or preview lint rules. To check more, run `gspot set level all`.

## Words the guides use

- A **configuration** is a built-in set of checks, tool files, and rules for one language, framework, library,
  platform, or tool, such as `typescript` or `docker`. See the [configuration reference](/reference/configurations/).
- A **check** runs a tool, or gspot's own code, and reports **findings**. See the [check reference](/reference/checks/).
- A **lint rule** is one thing a linter looks for, such as `no-console`.
- **Rules** are Markdown files that tell coding agents how to write code. See [Coding agents](/guides/agents/).
- **Settings** are the values in `gspot.toml`. See [gspot.toml](/guides/gspot-toml/).
- A **tool file** is a settings file gspot writes for one tool, under `.gspot/config/`. A **pointer** is a small
  file, such as `eslint.config.mjs`, that sends your editor to the tool file. See [Generated files](/guides/generated-files/).
- A **stage** says when a check runs: `commit`, `push`, `message` (the commit message), or `manual`.
  See [Git hooks](/guides/hooks/).
- A **scope** is a folder with its own configurations and settings, such as one app in a monorepo.
  See [Monorepos](/guides/monorepos/).
- A **runner** is the program that starts gspot in Git hooks: your package manager when `package.json` lists gspot,
  else mise. See [How hooks start gspot](/guides/install/#how-hooks-start-gspot).
- A **managed block** is the part of a file between two gspot marker comments. gspot writes it; the rest of the file is yours.
- A **template** is a copy of your `gspot.toml` that another repository can start from. See [Reuse templates](/guides/templates/).
```

This holds NMU-011, NMU-012, NMU-064, NMU-065, and DCX-002. The "Continue" line links the Install page and the three
quickstarts. The level text must match `LEVEL_SUMMARY` and `ALL_LEVEL_SUMMARY` in
`packages/cli/src/config/policy/settings.ts:79-83`; change them there in the same words, because the CLI help, the
gspot.toml schema, and every generated `AGENTS.md` print them.

### `guides/requirements.md` (merges into Install as "What you need", DCP-009)

- Description: "What gspot needs on your machine: Git, Node.js, and the tools your checks run."
- `:6`: "Every repository needs Git. gspot needs Node.js 24.2 or newer. Bun can install and start gspot, but the checks
  still run on Node.js." (INS-012)
- `:10`: DOC-060, with `gspot init --dry-run` (a dry run never asks, so it needs no `--yes`).
- The table header "Applicable tools" becomes "Tools".
- `:14`: "Node.js and your project's package manager (npm, pnpm, Yarn, or Bun). Without one, gspot uses npm."
  (INX-003 makes the code match.)
- `:16`: "Program tools, such as ShellCheck, Gitleaks, or typos | mise: `gspot install` installs them with mise. Or
  install the same versions yourself. `gspot doctor` lists the missing ones and how to install them."
- `:19`: DOC-060's L19 text (no file name and no mise version).
- `:21`: the heading "Operating system limits" (NMU-007).
- `:25`: DOC-060. `:27`: delete (DOC-060).

### `guides/install.md`

The page takes the sections of "Changes per target page", item 2, in that order. "What you need" comes from
`requirements.md` and "Read the plan" from `existing-repository.md` (their entries). The rest of the page:

```markdown
Commit your work first: `gspot init` stops when there are uncommitted changes, so that Git keeps a copy of every
file it replaces.

| Repository | Install gspot as | Start later commands with |
| --- | --- | --- |
| Has `package.json` | a dev dependency, pinned to one version | `npx gspot`, `pnpm exec gspot`, `yarn exec gspot`, or `bunx gspot` |
| Any other, such as Python or Swift | an npm package that mise pins in your `mise.toml` | `mise exec -- gspot` |

The guides write commands as `gspot ...`. Add the start from this table.

## Repository with package.json

    npm install --save-dev --save-exact @gspothq/cli
    git add package.json package-lock.json
    git commit -m "build: Add gspot"
    npx gspot init
    npx gspot install
    npx gspot check

| Package manager | Add gspot | Then run |
| --- | --- | --- |
| pnpm | `pnpm add --save-dev --save-exact @gspothq/cli` | `pnpm exec gspot init`, `pnpm exec gspot install`, `pnpm exec gspot check` |
| Yarn | `yarn add --dev --exact @gspothq/cli` | `yarn exec gspot init`, `yarn exec gspot install`, `yarn exec gspot check` |
| Bun | `bun add --dev --exact @gspothq/cli` | `bunx gspot init`, `bunx gspot install`, `bunx gspot check` |

Commit `package.json` and the lockfile before `init`.

## Repository without package.json

    mise use node@24 'npm:@gspothq/cli@<version>'
    git add mise.toml
    git commit -m "build: Add gspot"
    mise exec -- gspot init
    mise exec -- gspot install
    mise exec -- gspot check

Replace `<version>` with the version you install, such as `0.1.0`. `mise use` pins Node.js and gspot in your
`mise.toml`, the same way a dev dependency pins gspot in `package.json`.

## Install the tools and check

`init` shows a plan: the files it replaces, the configurations, the tools, the Git hooks, and CI. It asks
"Continue?" and writes the files when you accept; `--yes` accepts without asking. It installs nothing and runs no
check, and it ends with "run gspot install". `gspot install` installs the tools and turns on the Git hooks.
`gspot check` runs the checks.

Fix the findings, review the generated files, and commit. If `gspot install` fails, see [Troubleshooting](/guides/troubleshooting/).

## How hooks start gspot

When the root `package.json` lists `@gspothq/cli`, the Git hooks start gspot through your package manager:
`npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, or `bun run --no-install gspot`. Otherwise they run
`mise exec -- gspot`.

## Private registries

gspot's npm, pnpm, Yarn, and Bun installs use the registry settings of your repository and your environment. uv
reads Python package indexes from `uv.toml` or `[tool.uv]` in `pyproject.toml`.

Keep credentials in environment variables or your user settings, never in `gspot.toml` or a lockfile. Each
teammate gives their own credentials when they run `gspot install`.

Cloned a repository that already uses gspot? See [Join a repository](/guides/join/).
```

This holds INX-009, DOC-049, DOC-061, INX-002, INX-003, INX-005, INX-009, DCX-001, and DCX-002. Join a repository is
its own page (DCP-005), so this page has no "After you clone" section.

### `guides/quickstart/typescript.md` (becomes the JavaScript-and-TypeScript page)

DCX-013, DOC-014, DOC-053, DOC-062, and DCX-002. Also `:111`: "Add gspot and commit, because `gspot init` stops on
uncommitted changes:" (DOC-049). `:121-126`: the setup block of DCX-013 (`npx gspot init --yes`,
`npx gspot set level all`, `npx gspot install`, `npx gspot check`; no `doctor` line). `:132`: DOC-014, then DOC-053's
line.

### `guides/quickstart/python.md`

- Description: "Set up gspot in a Python project and fix a finding." (NMU-014)
- `:6`: "Read [Install](/guides/install/) first."
- `:8`: "Replace `<version>` with the version you install, such as `0.1.0`." (`mise use` saves the version as typed,
  so `@latest` would not pin it; INX-002.)
- `:23`: "Pin Node.js and gspot with mise, commit the pin, and set up gspot. `--yes` accepts the plan:" (INX-002,
  INX-003: no runner choice)
- `:26`: the block

    ```sh
    mise use node@24 'npm:@gspothq/cli@<version>'
    git add mise.toml
    git commit -m "build: Add gspot"
    mise exec -- gspot init --yes --configurations python
    ```

    The e2e test runs the same commands with the exact version.

- `:29`: DCX-002's sentence. The block at `:31-37` becomes `mise exec -- gspot install` and `mise exec -- gspot check`,
  with no `doctor` line (the quickstarts run init, install, and check, and `gspot install` already names missing
  programs) and no `mise trust` or `mise install` line (INX-001, INX-006; `QUICKSTART_COMMANDS`).
- `:39`: "The new project has formatting findings. Fix them and check again:"
- `:46`: DOC-053's line.
- `:68`: "The check exits with `1` and reports:"
- `:74`: DOC-062.
- `:76`: the heading "Fix the source" (NMU-014).
- `:85`: "To check more, run `mise exec -- gspot set level all` and `mise exec -- gspot install`, then fix the new
  findings."

### `guides/quickstart/swift.md`

The same changes as the Python page, at `:6`, `:8`, `:44`, `:47`, `:50`, `:52-58`, `:90`, `:96`, `:98`, and `:107`,
with `--configurations swift`. `:60`: delete the license sentences (DCX-014). `:6`: "This example runs on macOS" stays
until the quickstart test passes on Linux (TTO-018).

### `guides/existing-repository.md` (merges into Install as "Read the plan", DCP-009)

- `:14`: `gspot init --dry-run` (a dry run never asks, so it needs no `--yes`).
- `:18`: "The dry run writes nothing and asks nothing. When the plan looks right, run `gspot init`; it shows the plan
  again and asks "Continue?"." (CLX-001: init asks no other question.)
- `:27-30`: delete (DOC-063).
- `:32-33`: "Commit first. To get a replaced file back, check it out from the commit before `gspot init`." (DOC-049)
- `:35-36`: delete (DCX-012).
- `:43-44`: DOC-063, with "gspot hook lines" (DOC-051).
- `:48-55`: delete; the Install page says once what to run after init (DCX-002).

### `guides/join.md` (its own page, DCP-005)

- `:6`: DOC-064.
- The table header "Prepare checks" becomes "Install tools". The Yarn rows use `yarn exec gspot install` and
  `yarn exec gspot check` (the form the hooks run).
- `:20`: "`gspot install` installs the program tools with mise. Without mise, install them yourself; `gspot doctor`
  lists the missing ones and how to install them."
- `:22-30` ("With mise"): the block becomes `mise exec -- gspot install` and `mise exec -- gspot check`, with no
  `mise trust` and no `mise install` line (INX-001).
- `:32-43` ("With a global npm install"): delete (INX-005).
- `:45`: DOC-064, with "gspot hook lines".

### `guides/findings.md`

- `:26`: DOC-065.
- `:46`: "Paths are relative to the current folder." (DCX-001)
- `:50-57`: the lead "To check only the files changed on your branch:", then the block `gspot check --base origin/main`
  (delete the `--skip` line), then DOC-016's sentence.
- `:65`: "`gspot check --dry-run` prints the changes the fixers would make and writes nothing." (`--dry-run` turns on
  `--fix`, CLX-007, so the sentence "`--dry-run` requires `--fix`" goes.)
- `:67-70`: "such as formatters and import sorters" (delete "codemods"). "If a fixer is missing or fails, the run is
  incomplete and gspot exits 2; the message names the fixer." (DOC-006)
- `:72`: the anchor `#add-a-fix-command`.
- `:76`: the link `/guides/exclude/#ignore-a-finding`.
- `:78`: the link `/guides/gspot-toml/#change-a-limit`.
- `:80-85`: DOC-015.

### `guides/hooks.md`

- `:6`: DOC-066's L6 sentence.
- `:14`, `:16`, `:42`, `:55`: DOC-066.
- `:18-20`: the heading "After you clone", then one sentence: "`gspot install` points Git at the hooks in your copy; see
  [Join a repository](/guides/join/)." (DCP-012)
- `:22`, `:33`: DOC-051's text, with "gspot hook lines". The lines use the repository's start command (see [How hooks
  start gspot](/guides/install/#how-hooks-start-gspot)); for an npm repository:

    ```sh
    # pre-commit
    npm exec --no -- gspot check --hook pre-commit
    # pre-push: keep Git's remote arguments and standard input
    npm exec --no -- gspot check --hook pre-push -- "$@"
    # commit-msg: keep Git's message-file argument
    npm exec --no -- gspot check --message-file "$1"
    ```

    The commit-msg line has no `--hook commit-msg` (CLX-006).

- `:38-39`: `gspot check --hook pre-commit` and `gspot check --message-file .git/COMMIT_EDITMSG` (CLX-006).
- `:44-46`: `gspot check --base origin/main` (DOC-016).
- `:48-53`: DOC-009's text. The `hooks.push_files` line and the coverage sentence go (TML-002).
- `:57`: "Checks at the `manual` stage never run in hooks. Run them with `gspot check --only <check>`." The CodeQL
  example stays only on the Security page.

### `guides/ci.md`

Replace the body with:

```markdown
`gspot init` proposes a CI workflow in its plan when the repository is on GitHub or GitLab and has no lint job of
its own. To turn CI on later, run `gspot set ci.enabled true`. For GitLab, also run `gspot set ci.provider gitlab`.
`gspot set` writes the workflow file.

For GitHub, gspot writes `.github/workflows/gspot.yml`. For GitLab, it writes `.gitlab/ci/gspot.yml`. Include that
file in your pipeline:

    include:
      - local: .gitlab/ci/gspot.yml

The job checks the files changed since the pull or merge request base, or since the previous push. The first push of
a branch checks every file.

On GitHub, the job runs on Linux. To add other operating systems, run
`gspot set ci.operating_systems linux macos windows`. Pick only systems where your checks can run; for example,
Xcode checks need macOS. On pushes to the default branch, the job also runs the manual checks your configurations
select.

## Tools

The job installs mise, runs gspot at the version in `.gspot/version`, and gspot installs its tools. The GitLab job
expects mise on the runner image. To prepare the project before gspot installs its tools, set one command, for
example `gspot set ci.setup_command npm ci`. The job runs it before `gspot install` and stops if it fails. gspot
quotes each argument, so spaces, quotes, and `$` reach the command as plain text.

If gspot finds an existing lint job, or Bitbucket Pipelines, Jenkins, CircleCI, Azure Pipelines, or Buildkite,
`init` writes no workflow. Add the steps of "Your own pipeline" to that pipeline.

## Your own pipeline

Install mise and your project's runtime. Then install your dependencies and run gspot with the start command your
repository uses (see [Install gspot](/guides/install/)). With npm:

    npm ci
    npx gspot install
    npx gspot check

With mise, run `mise exec -- gspot install`, then `mise exec -- gspot check`.

Run manual checks by name, for example `npx gspot check --only security/codeql`. Keep gspot's exit code: `1` means
findings, and `2` means the run could not finish; a missing program gives exit 2, and the report names it. `gspot
check --json` prints the report as JSON. Do not cache or upload `.gspot/state/`, installed tools, or credentials.

## Turn CI off

Run `gspot set ci.enabled false`.
```

This holds DOC-010, DOC-067, DCX-001, DCX-021, INX-005, INS-003, INS-035, NMU-007, NMU-065, TML-002, TML-014, and
TML-015.

### `guides/agents.md` (Coding agents)

Replace the body with:

```markdown
gspot writes rules: Markdown files that tell coding agents how to write code that passes its checks. The checks
still decide whether code passes.

## Rules and AGENTS.md

When `rules.enabled = true` (the default), gspot writes the rules that fit your languages, frameworks, and level
under `.gspot/rules/`, and a managed block in `AGENTS.md` that lists them. Your own text outside the block stays as
it is.

[Codex reads `AGENTS.md`](https://developers.openai.com/codex/guides/agents-md).
[Claude Code reads `CLAUDE.md`](https://code.claude.com/docs/en/memory), not `AGENTS.md`. To give Claude Code the
rules, put this line in your `CLAUDE.md`:

    @AGENTS.md

gspot never changes `CLAUDE.md`.

To write the block into another instruction file too, run
`gspot set rules.instruction_files .github/copilot-instructions.md`. Paths are relative to the repository root.

## What the block tells agents

The block lists the rules, gives the command to run before committing, and says how to change settings. Do not edit
files under `.gspot/`. To keep a finding, add an ignore with a reason (`gspot ignore`).

## Turn rules off

Run `gspot set rules.enabled false`. This deletes the rules and the managed blocks gspot wrote. gspot also deletes
an instruction file it created, unless you edited it. Your own text stays.
```

This holds DOC-011, DOC-068, DCX-003, and DCX-018.

### `guides/policy.md` (renamed `guides/gspot-toml.md`, NMU-012)

- Description: "Choose configurations and a level, and change settings in gspot.toml." (DOC-069)
- `:6-7`: "the exceptions" becomes "the ignores".
- `:19`: the link "the [gspot.toml reference](/reference/gspot-toml/)" (POL-035).
- `:24`: "A `gspot.toml` starts with the configurations it selects:"
- `:31-34`: DOC-069.
- `:36-41`: DOC-055.
- After `:41`, add the text moved from `remove.md` (DCP-004).
- `:49-52`: DOC-069; delete the license sentence (DOC-053).
- `:54-74` ("Ignore one finding"): moves to `guides/exclude.md` (DCP-007), with these changes: `:64` "for an ignore
  that ends on a date" replaces "for a temporary acceptance"; `:66` "To ignore a dependency advisory, use
  `gspot ignore dependencies/osv --rule <advisory ID> --reason "..."`."; `:68-72`
  `gspot unignore javascript/eslint --rule no-console --paths "scripts/**"` (DCX-001).
- `:85`: DOC-069. `:89`: DOC-005.
- `:95-99`: "- `--scope api` writes the setting in the scope `api`. - `gspot unset <setting>` removes your value, so the
  default applies again. - On a list, `gspot set` adds items and `gspot unset <setting> <item...>` removes them. To
  replace a whole list, run `gspot unset <setting>`, then `gspot set <setting> <items...>`. - A scope's list adds to
  the lists it inherits. A command (a list of arguments) always replaces the inherited one as a whole." (DCX-001,
  DOC-069)
- `:101-104`: DOC-069's reason-form text; no `[reasons]` and no `[[reasons]]`.
- `:106-107`: delete (`docs.require_license` is deleted; a missing LICENSE file is accepted with
  `gspot ignore docs/required-files --rule missing-license --reason "..."`).
- `:109-112`: DOC-069, with `dependencies.allowed_registries`.
- `:113-125` ("Edit the file by hand"): DOC-069, and "gspot.toml is TOML 1.0. Keep each inline table on one line."
  (CFR-007); the first line is the `#:schema` line with the version (CFR-001).
- `:127-131`: delete (DOC-055).
- `:135-140`: delete (DCP-011).

### `guides/exclude.md` (keeps its file name; title "Exclude files and ignore findings", DCP-007)

- Description: "Hide files, mark generated and copied files, ignore a finding, and allow a name."
- `:6`: "gspot reads the files Git tracks, plus untracked files that `.gitignore` does not hide. To make gspot stop
  reporting something, hide the files with `.gitignore`, mark generated and copied files in `.gitattributes`, ignore a
  finding, or allow a name." (TMF-003)
- `:8-14` ("Exclude build output"): delete. There is no root `exclude` key (TMF-003); `.gitignore` hides build output.
- `:16-18`: the heading "Mark generated and copied files", then: "Mark files a tool writes as `linguist-generated` and
  files copied from another project as `linguist-vendored` in `.gitattributes`, for example
  `src/generated/** linguist-generated`. gspot does not check them as your own code." There are no `[[generated]]` or
  `[[vendored]]` records and no `generator` field (CFR-005).
- `:20-26` ("Test files"): moves to `testing.md` (DCP-008).
- `:28-34`: the section "Ignore a finding" holds the text moved from `policy.md:54-74` (see the `policy.md` entry).
  `:34`: "Add `--rule <id>` to ignore one rule instead of the whole check."
- `:36-44`: the heading "Allow a name", and the example:

    ```toml
    [[naming.override]]
    paths = ["migrations/**"]
    categories = ["files"]
    allow_digits = true
    reason = "Migration file names start with their version number."
    ```

    Every `[[naming.override]]` needs a `reason` (TMF-005); names to accept go in `allowed_names` (POL-021).

- `:46-48`: delete (TML-004 deletes `ignore_file`; no page documents it).

### `guides/monorepos.md`

- `:12`: "This `gspot.toml` has two scopes and no configurations at the root:"
- `:14-31`: the example becomes:

    ```toml
    [[scope]]
    path = "api"
    configurations = ["typescript", "express", "vitest"]
    limits.function_lines = { value = 80, reason = "The API parser is one state machine." }

    [[scope]]
    path = "ios"
    configurations = ["swift", "xcode"]
    ```

    The raised limit takes its reason next to the value (CFR-002). The root `configurations = []` line is left out: it
    is the default, and gspot's writer drops defaults. `:30-31` become: "Each `[[scope]]` names its folder in `path`. Its
    settings apply to that folder only." (POL-006)

- `:33`: "After you change the scopes, run `gspot apply` and `gspot install`, then check one scope:"
- `:51-52`: "When a tool needs a different tool file per scope, gspot writes it under `.gspot/config/<path>/`."
  (NMU-030)
- `:60-61`, `:69`, `:87`: DOC-071.
- `:71-85`: the heading "A TypeScript app and a Python API", then: "Given an npm project under `apps/web` and a Python
  project under `services/api`, `gspot init` proposes one scope for each. Check their configurations in the plan. To
  add a configuration that init did not detect:" followed by the existing `gspot add pytest --scope services/api`
  block (DCX-001).
- `:89-99`: the heading "A gspot.toml below the Git root", then DCX-001's text: "gspot uses the nearest `gspot.toml` in
  the current folder or a folder above it. To use the one in `api/`, run gspot from there: `cd api && gspot check`."
  (CLX-009)

### `guides/runners.md` (deleted; two parts move to Install, DCP-009)

- `:6-32`: delete. There is no `runner` setting (INX-003): no `gspot set runner` and no `gspot unset runner` line, no
  runner suggestion, no global install, and no mise file that pins gspot or Node.js (INX-001, INX-002, INX-005). The
  one fact that stays becomes the Install section "How hooks start gspot".
- `:34`: the hooks sentence moves to Git hooks ("To turn them off, run `gspot set hooks.enabled false`, then
  `gspot install`") and the CI sentence to CI ("Run `gspot set ci.enabled false`") (DCX-001).
- `:36-40` ("Private registries"): moves whole to Install, in plain words (see the `install.md` block).

### `guides/generated-files.md`

- `:6`, `:37`, `:53-56`: DOC-073. `:6` also becomes "...from `gspot.toml`. Your app's own settings stay yours."
- `:21`: DCX-021: "`.gspot/mise.toml` | The program tools gspot installs with mise." This is the only page that names
  the file.
- Table: add `.gspot/.yarnrc.yml`, and name `.gspot/vale/` in the git-ignored list (DOC-083).
- `:39-41`: DOC-050's one instruction.
- `:45-46`: "the root files" becomes "the pointers".
- After the pointer list (`:26-30`), add the generated files outside `.gspot/` that an agent must not edit: the
  pointers, and `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml` (GEN-029).
- Add INX-012's sentence: "gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip
  that folder, for Renovate: `"ignorePaths": [".gspot/**"]`."

### `guides/command-checks.md`

- `:28-29`: "Add the check to `gspot.toml` as a `[[command_check]]` record:"
- `:31-44`: the example becomes (`output` is an inline table on one line):

    ```toml
    [[command_check]]
    name = "notes"
    command = ["node", "scripts/check-notes.mjs", "{files}"]
    paths = ["notes/**"]
    stage = "commit"
    summary = "Finds unfinished FIXME notes."
    help = "Replace each FIXME note with the finished instruction."
    output = { format = "regex", pattern = '^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$' }
    ```

    `:56`: `gspot check --only notes`.

- `:62`: the title "Fixed note" (NMU-014).
- `:76`: "`output` decides how the output becomes findings:"
- `:82-93`: the JSON example becomes `output = { format = "json", fields = { message = "message" } }`.
- `:95-100`: DOC-074 (one line for the five tool formats), with `trufflehog` (NMU-039).
- `:95`, `:103`: "[gspot.toml reference](/reference/gspot-toml/#command_check)".
- `:105-109` ("Count failures in the output"): delete (TML-004 deletes `finding_count_pattern`).
- `:111-118`: DOC-074 (the heading "Add a fix command").
- `:120-123`: delete the `crash_pattern` paragraph (TML-004).
- `:125-127` ("Native exclusions"): delete (TML-004 deletes `ignore_file`, so no page documents it).

### `guides/templates.md`

- `:3`, `:6`, `:14`: DOC-075.
- Every `team.template.toml` becomes `gspot.template.toml` (NMU-038).
- `:16`: "A template carries the hooks, CI, and rules settings, but no hook scripts, lockfiles, or installed tools."
  (INX-004: nothing about how gspot starts)
- `:18-29` ("Export writes these template fields", and the `template` and `selection` text): delete (TML-011).
- `:34`: keep only DOC-075's "Export can write anywhere, but not over `gspot.toml` or a file gspot generates." Delete
  the `--dry-run` sentence (CLX-004: export has no `--dry-run`).
- `:41-45`: `gspot init --from ../gspot.template.toml --dry-run` (a dry run needs no `--yes`), then
  `gspot init --from ../gspot.template.toml --yes`, `gspot install`, and `gspot check` (DCX-002).
- `:47`: "`init` checks the template, writes it into the new repository's `gspot.toml`, and records the template file
  name and its SHA-256 in one comment line:"
- `:53`: "Later edits to the template do not change repositories that used it." (NMU-065)
- `:59`: "In repository A, add an ignore and export `gspot.toml`:" `:69`: add `gspot install`. `:72`: "The new
  `gspot.toml` keeps the ignore and the configurations."

### `guides/upgrade.md`

Replace the body with (DCX-015, DOC-076, INX-002, INX-009):

```markdown
Commit first, so you can go back. Read the [release notes](https://github.com/stefanionescu/gspot/releases) of the
version you pick, and use that version, such as `1.2.0`, in place of `<version>` below.

## With a package manager

    npm install --save-dev --save-exact '@gspothq/cli@<version>'
    npx gspot apply
    npx gspot install
    npx gspot check

With pnpm, Yarn, or Bun, use that package manager's exact install command and start command
([Install gspot](/guides/install/)).

## With mise

    mise use npm:@gspothq/cli@<version>
    mise exec -- gspot apply
    mise exec -- gspot install
    mise exec -- gspot check

`gspot apply` writes the new version to `.gspot/version` and to the `#:schema` line of `gspot.toml`, and updates the
generated files. Review the diff, fix any findings, and commit `package.json` and its lockfile (or `mise.toml`),
`gspot.toml`, and the files in `.gspot/` together. Teammates then run `gspot install` (see
[Join a repository](/guides/join/)).
```

### `guides/remove.md` (Remove gspot)

Replace the body with (DCP-004, INX-009):

```markdown
To stop checking one language or framework instead, see [gspot.toml](/guides/gspot-toml/#choose-configurations).

gspot has no uninstall command. Commit first, then:

1. Restore the tool files you want from the commit before `gspot init`.
2. Delete the gspot managed blocks from `AGENTS.md`, your other instruction files, `.gitignore`, and
   `.gitattributes`. Keep your own text outside the blocks.
3. Delete the pointers and the gspot CI file (`.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`).
4. If Git uses `.gspot/hooks`, run `git config --unset core.hooksPath`. If another hook manager runs your hooks,
   delete the gspot hook lines from them.
5. Remove gspot: `npm uninstall @gspothq/cli` (or your package manager's remove command), or
   `mise unuse npm:@gspothq/cli`. Then delete `gspot.toml` and `.gspot/`.

Run your other checks and review the diff before you commit. To undo, restore the last commit and run
`gspot install`.
```

### `guides/testing.md`

- `:3`, `:6-9`: "floor" becomes "the least coverage".
- `:9`, `:74`: a Swift target's coverage is a `[[coverage.target]]` record, written by hand in `gspot.toml`, because
  `gspot set` writes no record lists (TMF-004, DT1-002). `:72-76` becomes:

    ```toml
    [[coverage.target]]
    name = "Orders"
    lines = 80
    ```

    "Replace `Orders` with the target named in the coverage report. Add `reason` when `lines` is below
    `coverage.lines`. Then run `gspot apply` and `gspot check --only swift-tests/coverage`."

- `:20`: "in a scratch copy of your sources".
- `:33-34`, `:46`, `:66-69`: DOC-079. `:68-69`: the link text `swift-snapshot-testing` and `swift-tests` (NMU-066).
- `:78`: "Xcode coverage needs macOS, the `xcode` configuration, and `xcode.project` and `xcode.scheme` in
  `gspot.toml`; `gspot init` writes the ones it finds." (TML-014)
- Add the "Test files" section from `exclude.md` (DCP-008).

### `guides/dependency-licenses.md`

- Description: "Check the licenses of your installed packages, and allow one package version."
- `:10`: DOC-079, with "an allowed package" in place of "an exception".
- `:21`: "To allow one package version with a license you reviewed, add a `[[licenses.allowed_package]]` record. Name
  the license in the reason:"
- `:23-27`:

    ```toml
    [[licenses.allowed_package]]
    name = "colorama"
    version = "0.4.6"
    reason = "BSD. Installed metadata reports the reviewed BSD license in its short form."
    ```

    One record per package, no `license` field (TML-009).

- `:29`: "An allowed package holds only for that exact installed version; a record that matches no installed package
  is reported." Keep the sentence on how Python package names match.
- `:33-34`: "...move the packages you still allow into `[[licenses.allowed_package]]` records, with exact versions."

### `guides/security.md`

- `:6`, `:24`, `:42`, `:47`: DOC-008.
- `:17`, `:42-43`: DOC-079.
- `:31`: `tools.semgrep.registry` becomes `tools.semgrep.registry_packs`.
- `:38`: the link `/guides/exclude/#ignore-a-finding` (DCP-007).

### `guides/troubleshooting.md`

- Description: "Fix the common problems: gspot.toml has an error, a tool is missing, gspot install fails, the version
  differs, and checks are slow."
- `:17`: "## gspot.toml has an error" (POL-064).
- `:22-26` and `:77-79`: one section, "A tool is missing" (DCX-011, DOC-079). No `mise install` line (INX-006) and no
  runner link (INX-003).
- `:30-35`: the heading "`gspot install` fails", with DCX-011's text.
- `:37-40` and `:73-75`: one section (DCX-011, INS-009).
- `:44-45`: DOC-050's pointer (the current advice does not work).
- `:52-57`: keep the example, and add the Windows form: "On Windows, run `$env:GSPOT_JOBS = "2"` first." This page is
  the one home of the example (DCP-006); the exit-codes page keeps only the `GSPOT_JOBS` row. "small CI runner"
  becomes "small CI machine". The variable stays (EXG-056).
- `:65`: "## The working tree has uncommitted changes" (POL-064). `:67`: "Commit or stash your work before
  `gspot init`."
- `:69-71`: the heading "There is no terminal to ask in", then "Pass `--yes` to accept the plan without the
  "Continue?" question. A dry run never asks: `gspot init --dry-run`." (CLX-001)
- `:81-83` ("npm exec cannot find gspot"): "`gspot init` does not add `@gspothq/cli` to your dependencies; add it with
  your package manager (see [Install gspot](/guides/install/)). In a fresh clone, run your package manager's install,
  then `gspot install`." (INX-005) The runner sentence goes (INX-003).

### `reference/runtime.md` (renamed `reference/exit-codes.md`, DCP-006)

- The description, `:9`, `:12`, and the rows: DOC-006 and DOC-078 (after CLX-012).
- `:19-25`: delete the `GSPOT_JOBS` example; Troubleshooting is its one home (DCP-006).
- Add the `--json` error codes once NMU-032 renames them.

### `README.md` (root)

Replace the file with (DOC-034, DOC-043, INX-009, DOC-056, NMU-064, DCX-002):

```markdown
# gspot

gspot is a command-line tool that lints AI-generated code and writes rules for AI coding agents. Git hooks run its
checks before each commit and push, and CI runs them again.

## Install

gspot is not on npm yet. These steps work after the first release.

In a repository with `package.json`, commit your work, then run:

    npm install --save-dev --save-exact @gspothq/cli
    git add package.json package-lock.json
    git commit -m "build: Add gspot"
    npx gspot init
    npx gspot install
    npx gspot check

[Install gspot](https://generativespotting.com/guides/install/) covers pnpm, Yarn, Bun, and mise.

## Documentation

- [What gspot does](https://generativespotting.com/guides/overview/)
- Quickstarts: [JavaScript and TypeScript](https://generativespotting.com/guides/quickstart/javascript-typescript/),
  [Python](https://generativespotting.com/guides/quickstart/python/),
  [Swift](https://generativespotting.com/guides/quickstart/swift/). The JavaScript and TypeScript quickstart shows
  gspot refusing a commit with a file that only passes a call on.
- [gspot.toml](https://generativespotting.com/guides/gspot-toml/)
- [Coding agents](https://generativespotting.com/guides/agents/)

## License

[Apache-2.0](LICENSE.md)
```

Delete the "not on npm yet" line on release day. Do not put that line on the site: the release workflow deploys the
site only with a published stable tag, so there it would always be false. This text passes `docs/readme-shape`: it
has an opening paragraph and an Install section.

### `packages/cli/README.md`

Delete the generator (`packages/cli/scripts/build.ts:53-63` and its `readFile` and `writeFile` imports; INX-009), and
write the file by hand:

```markdown
# gspot

gspot is a command-line tool that lints AI-generated code and writes rules for AI coding agents.

## Install

Commit your work, then run:

    npm install --save-dev --save-exact @gspothq/cli
    git add package.json package-lock.json
    git commit -m "build: Add gspot"
    npx gspot init
    npx gspot install
    npx gspot check

The [install guide](https://generativespotting.com/guides/install/) covers other package managers and mise. The
[documentation](https://generativespotting.com/) covers everything else.
```

The block is the npm path of the Install page, the same as the root README (`init` refuses uncommitted changes, so
the dependency is committed first).

### `packages/eslint-plugin/README.md`

- `:3-6`: "ESLint rules that catch non-public environment variables read in browser code, files and functions that
  only pass calls on, and messy imports. The gspot CLI sets the plugin up for you. You can also use it alone with
  Node.js 22.12 or newer and ESLint 9.38 or newer." ("non-public": the rule reports any environment variable without
  a public prefix such as `NEXT_PUBLIC_`, secret or not. Node.js 22.12 and no "and CommonJS": PLG-013.)
- `:8-15`: delete the hand-written table of contents; GitHub and npm build one, and with six H2 headings
  `docs/readme-shape` needs no contents list.
- `:35-36`: "`gspot.configs.all` turns on every rule. Some rules need options; gspot sets them for you." `:35` lists the
  `all` rules (PLG-033).
- The `settings.gspot.root` text moves under "Configure" as one sentence without the code block (the example sets the
  default, `process.cwd()`).
- `:70`: the one rule reference link, to `/reference/eslint-plugin/` (DCP-015); delete the repeated link at `:105`
  (PLG-033).
- `:71`: "lists each rule's level, options, defaults, and examples" (level, not preset); delete `:71-72` "It
  identifies rules that need project options..." (PLG-017).

### `docs/README.md`

DOC-046, with DOC-031's path. Keep "Asset licenses".

### `AGENTS.md`

- The managed block (written by `packages/cli/src/agent-rules/contracts.ts` and `config/agent-rules.ts`):
    - the heading `# Rules` (IGN-002);
    - one level line, `Level: \`all\`.` (GEN-011);
    - the label "General:" in place of "Repository:", and the two first-read files not listed again (GEN-011);
    - "Infrastructure:" for the `infrastructure` group (NMU-009);
    - the repository's start command with `check --staged` and the four setting commands (DCX-018);
    - the generated files outside `.gspot/` (GEN-029).
- The hand-written part, lines 82-103, becomes the text under "AGENTS.md replacement text" (DCX-017).
- `:109`: "Verify a forced major version with the packages that use it before changing it." (in place of "native
  consumers")

### `docs/astro.config.ts`

- Delete the `unused-css` integration and its imports (DOC-002).
- Delete `starlightLlmsTxt` (DCX-009), the `twitter:card` and `twitter:image` entries (DCX-008), and the `Header` and
  `Search` component lines (DCX-005, DCX-006).
- The favicon is `/logo.svg`; `og:image` is `${SITE_URL}/social.png` (DOC-035).
- Rewrite the `vite` comment (DOC-033). Take the URLs and the font list from `src/config/site.ts` (DCP-016).
- The `font-licenses` integration stays: the fonts' license must ship with them (`docs/README.md:18-19`).

### `docs/package.json`

Delete `purgecss` (DOC-002) and `starlight-llms-txt` (DCX-009). `satteri`: DOC-033.

### `docs/wrangler.jsonc`, `docs/src/content.config.ts`, `docs/.markdownlint-cli2.mjs`, `docs/.stylelintrc.json`

No change, except the import path in `content.config.ts` after DOC-031. The two pointer files are generated (their
header follows GEN-017).

### `docs/tsconfig.json`

DOC-032.

### `docs/src/env.d.ts`, `docs/src/content/revision.ts`

Delete (DOC-023, DOC-018).

### `docs/src/components/home/Hero.astro`

- DOC-037: one npm block built from `example.commands` (`install`, `init`, `install_tools`, `check`) and a link to
  `/guides/install/`; the mise and global tabs go; the right column drops "1. Set up".
- DOC-038 (the summary without timings) and DOC-022 (the "3. Fix" tab keeps its two hand-written items).
- Keep the `find` guard (DOC-025).

### `docs/src/components/home/Features.astro`

DCX-010: delete the image block and the `.illustration` CSS. The type comes from `types/home.ts`.

### `docs/src/components/starlight/Header.astro`, `Search.astro`

Delete (DCX-005, DCX-006).

### `docs/src/components/starlight/SiteTitle.astro`

`:15`: `url(/logo.svg)`; delete `default.png` (DOC-035). Keep the "Docs" link: it is the way back to the guides from
the homepage header.

### `docs/src/config/example.json`

DOC-022 (delete `version` and `fix.correction`), POL-036 (record `policy` again from a real `gspot init`; this also
brings in NMU-031's header line). The new `policy` has the target shape: the versioned `#:schema` line, no `runner`,
`[ci] enabled = true`, and the final keys. `commands` keeps `install` (the npm line), `init`, and `level`, and gains
`install_tools = "npx gspot install"` and `check = "npx gspot check"` (DCX-013). The JavaScript-and-TypeScript page
and the Hero are built from this file.

### `docs/src/config/home.ts`

DCP-014 (no type import), DCX-010 (no `image`), DOC-040 (delete the comment). The third card becomes "Write rules for
coding agents" / "gspot writes rules that tell coding agents how to write code, and lists them in AGENTS.md."

### `docs/src/config/navigation.ts`

DCP-014 (no type import), DOC-040 (delete the comment), DCP-017 (`REFERENCE_FOLDERS`). The labels follow "Target
pages" and POL-035: one "gspot.toml reference" entry in place of "Settings" and "gspot.toml schema".

### `docs/src/config/reference.ts`

DCX-004 (delete three constants; add `REFERENCE_COLLECTION_NAME`, `REFERENCE_IDS_KEY`, and `PAGES_FOLDER`), DCP-017
(`REFERENCE_FOLDERS`), DOC-029 (`SETTINGS_INTRO` becomes `GSPOT_TOML_INTRO`, with its text), and DOC-080 ("file tags"
becomes "files marked" in `DETECTION_LABELS`).

### `docs/src/config/site.ts` (new)

`SITE_URL`, `REPOSITORY_URL`, `LOGO`, `SOCIAL_IMAGE`, `SOCIAL_IMAGE_SIZE`, and `FONT_PACKAGES` (DCP-016).

### `docs/src/types/components.ts`

Rename to `types/home.ts`; keep `FeatureProps` without `image`; delete `Sidebar` (DCP-014).

### `docs/src/types/reference.ts`

Delete `SchemaNode` (DOC-020). `ReferencePage.data.editUrl` becomes `false` (DOC-018). The `SettingDeclaration` import
comes from the CLI's `types/settings/tables.ts`.

### `docs/src/pages/index.astro`

Import `../home.css` (DCX-007). The landing reset moves into `home.css` (DOC-039). Take the footer URLs from
`config/site.ts` (DCP-016).

### `docs/src/pages/schema/gspot.schema.json.ts`

Delete (CFR-001): unpkg serves the schema of each published version, so the docs route goes, with the
`structure/lone-files` ignore at `gspot.toml:443-446` that exists only for it, and the media type it sets.

### `docs/src/theme.css`

DOC-021, DOC-039, DCX-007 (drop `@import './home.css'`; move `:192-208` to `home.css`). Keep `:226-228` and `:255`
(ROOT-005).

### `docs/src/home.css`

Imported by `index.astro` only. It takes the landing rules from `theme.css` (DCX-007).

### `docs/src/navigation.css`

Add the one search-button rule (DCX-005). Keep the rest: it sets the 2.75rem phone touch targets that the other
controls use.

### `docs/src/content/reference/*.ts` (moving to `docs/src/reference/`, DOC-031)

- `collection.ts`: NMU-009 (import the CLI's `GROUP_LABELS`, LAY-002), DOC-024, DOC-026, DOC-080, and DCX-004's values.
- `commands.ts`: DOC-018, DOC-024, DOC-025, DOC-027, and DCX-001 (`-C`).
- `configurations.ts`: DOC-080.
- `checks.ts`: DOC-025, DOC-080.
- `plugin.ts` (becomes `eslint-plugin.ts`): DOC-025, PLG-017, DCP-015. Take the rule prefix from the plugin's
  `config/` (DCX-004).
- `policy.ts` (becomes `gspot-toml.ts`): DOC-029, DOC-080, DCP-018; POL-035 merges the two pages. The page links the
  versioned schema `https://unpkg.com/@gspothq/cli@<version>/gspot.schema.json` and imports `buildJsonSchema` from the
  CLI settings code (CFR-001).
- `page.ts`: rename to `markdown.ts`; DOC-018.
- `schema.ts`: moves into the CLI as `packages/cli/src/settings/schema/gspot-toml.ts`; its `JSON_SCHEMA_DIALECT` goes
  to `packages/cli/src/config/settings/schema.ts` (CFR-001).

### `docs/public/`

- `brand/identity/mark/light.svg` becomes `logo.svg`, and `brand/identity/social.png` becomes `social.png` (DOC-035).
- Delete `brand/identity/mark/default.png` (DOC-035) and `brand/home/*.svg` (DCX-010).
- `licenses/turborepo.txt` stays.

### `docs/assets/readme/`

Delete (DOC-034).

## AGENTS.md replacement text

`AGENTS.md` lines 82-103 become (DCX-017):

```markdown
Do not use subagents or parallel agents unless asked in the conversation.

## Folders

- Each package keeps its fixed values (constants, lists, tables of names, paths, file names, limits, URLs, and
  command arguments) in a `config/` folder, and its TypeScript types in a `types/` folder:
  `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, `scripts/`, and `tests/`.
- `config/` imports only from `config/` of the same package. `types/` imports only from `config/` and `types/` of
  the same package, and may use `import type` from a library when a type extends a library type. `tests/types/` may
  also `import type` from the CLI package; `tests/config/` imports only from `tests/config/`.
- Every exported type is written by hand in `types/<area>/<topic>.ts`, in plain TypeScript. Each zod schema is
  checked against its type with `satisfies z.ZodType<T>`. No exported type uses `z.infer`; a type used only in its
  own file may stay there. A list of allowed names is an `as const` array in `config/`; its type is
  `(typeof LIST)[number]` in `types/`, and its schema is `z.enum(LIST)`.
- Every other file takes its constants from `config/` and its types from `types/`, and declares no module-level
  constants or exported types of its own. Zod schemas and values computed at import time stay in their own files.
- Group `config/` and `types/` by topic, one file per topic, such as `config/checks/language/bash.ts` or
  `types/settings/tables.ts`. Do not mirror the source tree. Split a file over 300 lines by topic.
- These folder rules are for this repository only. gspot does not ask other repositories to follow them.
- Tests: unit tests in `tests/unit/cli/` and `tests/unit/eslint-plugin/`, integration tests in `tests/integration/`,
  end-to-end tests in `tests/e2e/`, shared test code in `tests/setup/`, test constants and sample data in
  `tests/config/`, shared test types in `tests/types/`.
- The configurations gspot ships live in `packages/cli/configurations/`. The code that reads them lives in
  `packages/cli/src/configurations/`. The schema of `gspot.toml` lives in `packages/cli/src/settings/schema/`.

## Code

- Delete a function that only calls another function; call the other one directly. Keep a callback that an API
  needs, and a calculation that several callers share.
- A check that runs a tool is named after the tool, so readers know which lint rules and suppression comments apply.
  A check that gspot runs in its own code is named after what it checks. Both start with the configuration name.

## Commits

- Commit straight to main. Do not open branches or pull requests.
- A commit message says what changed and why, in plain words. Do not list test counts, ledger counts, or byte counts.

## Owner decisions

These decisions are final. Never reverse one inside other work.

- 2026-10-11: By default, delete: a file, option, setting, flag, or test that does not earn its place goes.
- 2026-10-06: Fix the cause; never work around it. Use one setting for each concern: no special time limits,
  per-suite or per-operating-system budgets, environment switches, or options for one caller.
- 2026-10-06: gspot ships only as JavaScript on npm. Never add per-operating-system binaries, standalone archives,
  platform packages, or a release-archive pin.
- 2026-10-11: The CLI has 14 commands, one job each: init, install, apply, check, add, remove, set, unset, ignore,
  unignore, list, explain, doctor, and export.
- 2026-10-06: The shipped banned naming terms stay complete, no group is removable, and they apply at level `all`
  only.
- 2026-10-06: The rule `TALKING.md` ("When you talk, use ASD-STE100.") ships in every installation.
- 2026-10-06: The documentation site is generativespotting.com, deployed to Cloudflare Workers.
- 2026-10-03: No scheduled CI.
- 2026-10-06: No GitHub environments.
- 2026-10-07: Use one name for each concept (the Names table below). Never give one thing two names or one name two
  meanings.
- 2026-10-07: This repository has no `CONTRIBUTING.md`. Repository rules that no check enforces live in this file.

## Names

(The short name table from `findings/glossary.md`, once the renames are done.)
```

The dates come from Git history and the decision records (DEC-026): 2026-10-03 (`f513db1c4`, the scheduled workflows
run only by hand), 2026-10-06 (the decisions recorded in `3b05fd0cb` and in `findings/progress.json` at `c3def5bf6`:
binaries, one setting per concern, banned terms, `TALKING.md`, the site domain, no GitHub environments), 2026-10-07
(one name per concept; no `CONTRIBUTING.md`, `b36d7d0fc`), and 2026-10-11 (default delete and the 14-command CLI,
CMD-092).
