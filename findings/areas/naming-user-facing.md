# Names users see

This area is every name a person meets without reading the code: CLI help and messages, `gspot.toml` keys, check IDs,
configuration names and groups, mise tasks, CI jobs, test folders, files, and titles, and docs page titles and
headings. Today the repository often uses several names for one thing and one name for several things ("native",
"platform", "rules", "exception", "policy"), groups the same checks three ways, and puts internal words such as
"authored", "canonical", and "reconcile" into messages. The target: one name for each concept, as `glossary.md` fixes
it, in every message, key, check ID, folder, file, and title.

## Findings

### NMU-001: An error message links to a docs page that does not exist

- Where: `packages/cli/src/policy/public.ts:45`
- Kind: fix-bug
- Problem: When `gspot.toml` has an unknown key, gspot says "The gspot.toml schema reference
  (generativespotting.com/reference/configuration/) lists every key." That page does not exist: the reference page of
  gspot.toml is `/reference/gspot-toml/`, and `/reference/configurations/` (plural) is the configuration index.
  `git grep "reference/configuration/"` finds only this message.
- Fix: "`<key>` is not a gspot.toml setting. See generativespotting.com/reference/gspot-toml/ for every key." The URL
  is `SETTINGS_REFERENCE_URL` in `config/settings/file.ts`.
- Size: small

### NMU-004: Every check has a required title that no user ever sees

- Where: `packages/cli/src/parsers/schema/configurations.ts:121` (`title: z.string().min(1)`),
  `packages/cli/src/types/configurations.ts:37-38`, all 184 `[[check]]` records in
  `packages/cli/configurations/*/*/manifest.toml`, `tests/cli/configurations/errors.test.ts:248-252`
- Kind: delete
- Problem: Each check declares both `title` ("Check Bash syntax") and `summary` ("Checks that Bash scripts parse
  before running them."). Only `summary` is shown (docs check pages, `gspot explain`, the check index); no code in
  `packages/cli/src`, `docs/src`, or `scripts` reads a check's `title`. The 184 titles are names nobody reads, and a
  test forces every manifest to keep them.
- Fix: Delete `title` from `checkFields`, from `CheckDeclaration`, from all 184 checks, and the title half of the test
  at `errors.test.ts:248`. Text fixes for checks go to `summary` and `help`.
- Size: medium

### NMU-005: "native" names the integration test suite and four other things

- Where: `tests/tools/` (105 files), `mise.toml:45-47` (`test:tools`, "Run native compatibility tests"),
  `scripts/plugin.ts:1,22,26,69` ("native suites"), `.github/actions/setup/action.yml:10-11` (input `native-tests`),
  `.github/workflows/ci.yml:96-176` (job `tools`, step "tool tests"), at least 235 of 1,923 test titles ("native
  Jest at all ...", "native Wrangler ...")
- Kind: rename
- Problem: "native" means (1) a tool's own options and files ("Native options gspot does not declare", docs headings
  "Native exclusions", "Native ignore files"); (2) the real tool running in a test (the titles, the mise task, the
  action input); (3) generated code (`policy/schema/native/`); (4) a library's own behavior ("native help"); (5) an
  executable tool. The suite that runs the real linters is called "tools", "test", "native", and "tool tests" in five
  places.
- Fix: The suite is the integration tests: `tests/integration/`, task `test:integration`, CI job `integration`
  (glossary, SCR-003); there is no runner script and no action input for it (RTX-004). Drop "native" from the test
  titles and task descriptions of that suite (the folder says it), and everywhere else: say "the tool's own" for
  meaning 1 (NMS-006).
- Size: large

### NMU-007: "platform" means the operating system and also Cloudflare and Supabase

- Where: `packages/cli/src/platform/` (processes, files, Git), `packages/cli/configurations/platform/` (Cloudflare,
  Supabase), `packages/cli/src/checks/platform/`, `gspot.toml` keys `ci.platforms` and `[check."x"].platforms`
  (operating systems, `policy/schema/public.ts:75-78,109-111`), the shipped `[[check]]` field `platforms`, the
  `[[tool]]` key `platforms`, the docs heading "Platform limits" (`guides/requirements.md:21`, the operating system),
  the docs group label "Platforms" (Cloudflare, Supabase) and the check-page field "Platforms" (operating systems,
  `docs/src/content/reference/checks.ts:13`), `tests/harness/platforms.ts`
- Kind: rename
- Problem: One word has two unrelated meanings, sometimes in one file: `tests/tools/generation/platform-security.test.ts`
  tests the Cloudflare and Supabase Semgrep rules and imports `hasToolBuild` from `tests/harness/platforms.ts`
  (operating systems).
- Fix: Do after PLR-003, which renames `src/platform/` to `src/system/` (with `config/system/`, `types/system/`, and
  `tests/unit/cli/system/`). Keep "platform" only for the group of Cloudflare and Supabase (folders, the docs label
  "Platforms", `.gspot/rules/platform/`). Rename `ci.platforms` to `ci.operating_systems`, the shipped `[[check]]` field `platforms` to `operating_systems` in the check schema and in the manifests that set it (9 keys), and the `[[tool]]` key `platforms` to `builds` in `toolSchema` and the 8 `[[tool]]` tables (it lists OS and CPU builds); its value list is `TOOL_BUILDS` in `config/configurations.ts`, derived only from `OPERATING_SYSTEMS`. The command-check key `platforms` is deleted (TML-004). The heading "Platform limits" becomes "Operating
  system limits" on the Install page (INX-009), and the check-page field becomes "Operating systems".
- Size: large

### NMU-009: Configuration group names are abbreviated, vague, and labeled two ways

- Where: the folders `packages/cli/configurations/infra/`, `test/`, `general/`; `CONFIGURATION_LABELS`
  (`packages/cli/src/config/configurations.ts:17-26`, `general: 'Repository'`) and `CONFIGURATION_GROUPS`
  (`docs/src/config/reference.ts:26-35`, `general: 'General'`); the manifest field `kind`
  (`packages/cli/src/parsers/schema/configurations.ts:258`); `.gspot/rules/infra/...`
- Kind: rename
- Problem: `infra` is an abbreviation. `test` reads like test data (`packages/cli/configurations/test/jest`) and is
  labeled "Test runners". The group `general` is "Repository" in AGENTS.md and the init plan, and "General" on the
  docs site. Two tables hold the same labels in different orders.
- Fix: Rename `infra` to `infrastructure` and `test` to `testing`; the manifest field `kind` becomes `group`
  (glossary). One list `GROUPS` and one label table `GROUP_LABELS` in `config/configurations.ts`, with the labels
  "Databases", "Frameworks", "General", "Infrastructure", "Languages", "Libraries", "Platforms", "Testing". The docs read `GROUP_LABELS` too (DCX-004). These folder names
  reach users in `.gspot/rules/<group>/`.
- Size: large

### NMU-011: "rules" means the Markdown files for coding agents and lint rules

- Where: `docs/src/content/docs/guides/overview.md:24` ("A **rule** is an individual lint instruction or an
  instruction for a coding agent"); the folders `packages/cli/configurations/*/*/rules/` and `.gspot/rules/` beside
  `packages/eslint-plugin/src/rules/`; `docs/src/content/reference/configurations.ts:105-106` ("Rule exclusions",
  "Rules for coding agents"); `packages/cli/src/commands/doctor/public.ts:137`; `tests/cli/generation/guides.test.ts`
  and titles such as "recommended guides omit sections"
- Kind: rewrite-text
- Problem: `--rule`, `[[ignore]] rule`, `tools.eslint.rules`, and `gspot explain <rule>` mean a lint rule, while the
  docs, folders, and doctor also say "rules" for the Markdown files, so "rules" alone is ambiguous. The tests call the
  Markdown files "guides".
- Fix: "Rules" are the Markdown files for coding agents (owner decision); a linter's rule is a "lint rule" in gspot's
  own text, while the tools' own words stay (`--rule`, `[[ignore]] rule`, the ESLint `rules` key). The overview says:
  "A **lint rule** is one thing a linter looks for, such as `no-console`." and "**Rules** are Markdown files that tell
  coding agents how to write code." The reference headings become "Lint rules turned off" and "Rules". The doctor
  label stays `rules`. `guides.test.ts` merges into `tests/unit/cli/rules.test.ts`, and "guide" becomes "rule" in its
  titles.
- Size: small

### NMU-012: The gspot.toml guide has three names

- Where: `docs/src/content/docs/guides/policy.md` (slug `guides/policy`, title "gspot.toml"),
  `docs/src/config/navigation.ts:33`, `README.md` and `packages/cli/README.md` ("[Policy]"), `guides/overview.md:22`
  ("[Policy guide]"), `guides/command-checks.md:95,103` and `guides/exclude.md:18` ("[policy reference]" for the page
  titled "gspot.toml schema"), `docs/src/content/reference/collection.ts:96-102` ("Policy tables, examples, and
  accepted fields.")
- Kind: rename
- Problem: The same page is "gspot.toml", "Policy", and "Policy guide"; the reference page is "gspot.toml schema" and
  "policy reference". Users meet the file name `gspot.toml`, not the word "policy".
- Fix: Do after POL-035, which makes one "gspot.toml reference" page. Rename `guides/policy.md` to
  `guides/gspot-toml.md` and call it "gspot.toml" in every link; call the reference page "gspot.toml reference" in
  every link. Say "settings" for what the file holds; in code, `policy` becomes `settings` too (glossary).
- Size: small

### NMU-014: "Fix" is also "correction", "correct", and "codemod"

- Where: `--fix` and the key `fix` (`packages/cli/src/policy/schema/public.ts:56`: "The executable and arguments that
  correct findings"); the docs heading "Add a correction command" (`guides/command-checks.md:111`) and its anchor link
  in `guides/findings.md:72`; "Corrected note"; the quickstart headings "Correct the source"
  (`quickstart/python.md:76`, `quickstart/swift.md:98`); `reference/runtime.md` ("a correction failed"); 112 test
  titles
- Kind: rewrite-text
- Problem: The flag, the key, and the command say "fix"; the docs and tests say "correction". A reader thinks there are
  two features.
- Fix: Use "fix" (verb and noun) and "fixer" (the command) everywhere: "The program that fixes findings", "Add a fix
  command" (with its anchor), "Fix the source", "a fix failed" on the exit-codes page (`reference/exit-codes.md`),
  "Fixed note"; rewrite the test titles.
- Size: small

### NMU-015: Allow-list and size-limit settings use different key shapes and units

- Where: setting declarations in `packages/cli/configurations/*/*/manifest.toml`: `naming.allowed`,
  `licenses.allowed`, `links.allowed_urls`, `xcode.entitlements_allowed`, `dependencies.registry_hosts`,
  `tools.purgecss.safelist`, `tools.hadolint.trusted_registries`, `tools.swiftlint.keep_imports`,
  `site.sitemap_exclude`, `licenses.exceptions`; `limits.file_kb` (`general/repository/manifest.toml`),
  `site.max_kilobytes` with the item field `kb` (`framework/site/manifest.toml:210-215`); the messages "N KB is over
  the M KB limit" (`packages/cli/src/checks/general/repository.ts:34`) and "N kB compressed is over the ceiling of M
  kB" (`packages/cli/src/checks/general/site/public.ts:200`)
- Kind: rename
- Problem: The same idea, "values this check accepts", is spelled `allowed`, `allowed_<x>`, `<x>_allowed`,
  `<x>_hosts`, `safelist`, `trusted_<x>`, `keep_<x>`, `<x>_exclude`, and `exceptions`. Units are spelled `kb`,
  `kilobytes`, `KB`, and `kB`, and size limits sit both inside and outside `limits`. A user cannot guess the key and
  must look each one up.
- Fix: gspot's own allow-lists are `allowed_<thing>`: `xcode.allowed_entitlements`,
  `dependencies.allowed_registries`, `site.allowed_unlisted_pages`, `docs.allowed_urls` (NMU-017), and
  `[[licenses.allowed_package]]` records with `name`, `version`, and `reason` (TML-009). A key that copies a tool's
  own option keeps the tool's name: `tools.purgecss.safelist`, `tools.hadolint.trusted_registries` (hadolint's
  `trustedRegistries`), and `tools.swiftlint.always_keep_imports` (SwiftLint's own option name). `licenses.allowed`
  keeps its name, because the table names the items; `naming.allowed` is deleted (TML-005). One unit word in keys and
  one in messages: `limits.file_kilobytes`, `[[site.size_limit]]` records with `paths` and `kilobytes`, and "kB" in
  every message ("N kB is over the M kB limit").
- Size: medium

### NMU-017: Setting tables do not match the configuration that declares them

- Where: `limits.docs.list_item_words`, `limits.docs.paragraph_sentences`, `limits.docs.sentence_words` (declared by
  `general/prose`); `links.allowed_urls` (declared by `general/docs`; no configuration is called "links");
  `swift.xcode_project`, `swift.xcode_scheme`, `swift.xcode_destination` beside `xcode.entitlements_allowed`;
  `architecture.modules` and `architecture.roles` (declared by `general/structure`) beside `structure.reexports`
- Kind: rename
- Problem: Most settings start with their configuration name (`postgres.*`, `site.*`, `docs.*`). These do not, so
  `gspot explain` and `gspot list settings` show a table that points at the wrong configuration.
- Fix: `links.allowed_urls` becomes `docs.allowed_urls`. `architecture.*` keeps its table, and its summary says that the structure configuration declares it. The prose limits become plain limits (POL-031), and the Swift project settings move to `[xcode]` (POL-033).
- Size: medium

### NMU-020: The setting "direction" names are hard to read

- Where: the manifest key `direction` with the values `tightening`, `loosening`, `floor`, `ceiling`, `rule-options`
  (`packages/cli/src/parsers/schema/configurations.ts:200`); the docs settings column "Loosens when" and its intro
  (`docs/src/config/reference.ts:1-12`); the page description "with their types, directions, defaults, and owners"
  (`docs/src/content/reference/policy.ts:123`); `gspot list settings` prints the raw value
  (`packages/cli/src/commands/list.ts:29`); the explain texts (`packages/cli/src/config/commands/explain.ts:4-8`)
- Kind: rename
- Problem: The column answers "when does a change need a reason?", but the values are "tightening", "loosening", and
  "rule-options", which a user must decode. Some lists that grow looser are marked `tightening`
  (`tools.hadolint.trusted_registries`, `xcode.entitlements_allowed`, `site.max_kilobytes`), while the similar
  `dependencies.registry_hosts` is `loosening`.
- Fix: The setting declaration field is `reason_needed` with `raising` (a value above the default),
  `lowering` (a value below the default), or `adding` (an item, key, or value the shipped default lacks); a setting
  without the field never needs a reason, so `tightening` goes (POL-027), and rule-option tables never take a reason,
  so `rule-options` goes. The reference column is "Reason needed when", and the explain texts are
  `REASON_NEEDED_TEXTS`. An allow-list that grows looser (`tools.hadolint.trusted_registries`,
  `xcode.allowed_entitlements`) takes `adding`, and a size limit (`[[site.size_limit]]`) takes `raising`. "loosen"
  stays the plain verb for what such a value does to a check.
- Size: medium

### NMU-022: Unused things are "dead", "orphan", and "unused"

- Where: the checks `site/dead-assets`, `xcode/orphan-assets`, `xcode/orphan-sources`, beside
  `bash/unused-functions`, `javascript/knip` ("Find unused JavaScript code"), `site/purgecss` ("Find unused
  selectors"); the help text "--rule orphan-asset"
- Kind: rename
- Problem: Three words for one idea in check IDs.
- Fix: `site/dead-assets` becomes `site/unused-assets`, `xcode/orphan-assets` becomes `xcode/unused-assets` (lint
  rule `unused-asset`), and `xcode/orphan-sources` becomes `xcode/files-without-target`.
- Size: small

### NMU-023: "stale", "fresh", "freshness", and "current" name one idea

- Where: the check IDs `cloudflare/stale-types`, `supabase/stale-types`, `drizzle/stale-migrations`,
  `openapi/stale-document`, `dependencies/stale-lockfile`; titles "Keep ... current";
  `packages/cli/src/checks/general/dependencies/lockfile/fresh.ts`; the tests `lockfile-fresh.test.ts` and
  `openapi-fresh.test.ts` and titles "Supabase freshness ..."; the doctor line "The saved setup is stale"
  (`packages/cli/src/config/commands/doctor.ts:32`)
- Kind: rename
- Problem: The check ID says "stale", the title says "current", the code and tests say "fresh".
- Fix: Use "stale" (the check IDs) in code and test names: the check file is
  `checks/general/dependencies/stale-lockfile.ts`, its test `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts`,
  and the OpenAPI test joins `tests/unit/cli/checks/stale-generated-files.test.ts`; titles say "Supabase stale types
  ...". The doctor line becomes "gspot apply would change gspot.toml: {details}. Run gspot apply." (CMD-074).
- Size: small

### NMU-024: The example env file check is called a "template"

- Where: the check `secrets/env-template` (`packages/cli/configurations/general/secrets/manifest.toml:119`), its
  setting `secrets.env_examples`, the function `envTemplate` (`packages/cli/src/checks/public.ts:120`), the test titles
  "distinguish environment files from templates" and "environment reads without a template in their scope"
- Kind: rename
- Problem: "template" also means the file `gspot export` writes. The setting already says "examples".
- Fix: Rename the check to `secrets/env-examples` and the function to `envExamples`, and say "env example" in its code
  and titles.
- Size: small

### NMU-027: "authored" is jargon in messages, docs, and test titles

- Where: the messages at `packages/cli/src/commands/contracts.ts:247`, `commands/doctor/contracts.ts:164` ("an
  authored lint job"), `checks/language/public.ts:192` ("the authored TypeScript configuration"),
  `commands/explain/public.ts:94` ("When authored, this value requires an entry in [reasons]"),
  `config/commands/doctor.ts:15` (key `authored`, titled "existing lint jobs"); 24 uses in the docs
  (`guides/policy.md:31,38`, `guides/agents.md:3,16,20,38`, `guides/templates.md:8,13`, `guides/generated-files.md:6`,
  `guides/hooks.md:20`, `guides/runners.md:10`); 134 test titles
- Kind: rewrite-text
- Problem: "authored" means "written by you, not by gspot". Nobody says it that way.
- Fix: Say "your own" or "written by hand": "your own lint job", "your TypeScript configuration", "Rules and your own
  text". The explain text says to write the value with its reason: `{ value = ..., reason = "..." }`, or
  `gspot set ... --reason` (the `[reasons]` table is deleted, CFR-002).
- Size: medium

### NMU-030: "configuration" also means a tool file in messages

- Where: `packages/cli/src/execution/command/public.ts:130` ("Required configuration X is missing. Run gspot apply
  before checking." X is a tool file), `checks/general/site/public.ts:101,149` ("has no declared HTML
  configuration"), `execution/copy/contracts.ts:115` ("the revision configuration"), `policy/document/public.ts:79`
  ("The shipped format configuration is missing."), `lifecycle/merge/contracts.ts:14,33`,
  `parsers/tool/contracts.ts:104,216`, `checks/language/bash/guards.ts:30,57` ("configuration owners"); docs
  `guides/install.md:71` ("before writing the configuration"), `guides/quickstart/typescript.md:128`
- Kind: rewrite-text
- Problem: A user reads "Required configuration python is missing" as a gspot configuration. The glossary keeps
  "configuration" for the selectable unit.
- Fix: "The tool file X is missing. Run gspot apply."; "has no HTML tool file"; "environment readers" for the Bash
  guards; docs "before writing the generated files" (also in
  `guides/quickstart/javascript-typescript.mdx`). The messages of `structure/config-logic` go with the check
  (CKG-010).
- Size: small

### NMU-031: Messages say "the policy" where users know "gspot.toml"

- Where: `packages/cli/src/checks/general/contracts.ts:196` ("The policy file differs from its canonical layout."),
  `commands/contracts.ts:144` ("The policy change was not written"), `:247` ("Write the policy to a template"),
  `commands/init/plan.ts:164` ("your policy, N lines"), `commands/set.ts:164` ("No policy scope matches X"),
  `commands/add.ts:68`, `commands/remove.ts:80`, `commands/ignore.ts:131` ("apply the policy"),
  `config/commands/init.ts:51` (the header comment "The policy of this repository under gspot."),
  `config/agent-rules.ts:5` (the AGENTS.md block line "Change policy with gspot set")
- Kind: rewrite-text
- Problem: "policy" is the code name for what gspot.toml holds, while users see the file name, so the two look like
  two things.
- Fix: "gspot.toml is not in standard order. Run gspot check --fix --only gspot/settings-format."; "gspot.toml was not
  changed"; "Write gspot.toml to a template"; "gspot.toml, N lines"; "gspot.toml has no scope X"; "then apply the
  change"; the header "# gspot settings for this repository."; the AGENTS.md block line "Change settings with gspot set
  or gspot ignore" (in `config/rules.ts`).
- Size: small

### NMU-032: JSON error codes do not say what failed

- Where: `packages/cli/src/types/platform/runtime.ts:12-23` (`ErrorCode`), 54 `GspotError('selection', ...)` calls;
  `commands/init/public.ts:69` (`error: 'unreadable-config'`); `commands/contracts.ts:145,168` (`'preparation'`,
  `'apply'`)
- Kind: rename
- Problem: `--json` users get `"error": "selection"` for Git failures, dependency copies, and flag conflicts ("Choose
  --staged or --changed, not both"), while "selection" means the configurations a scope uses elsewhere. Codes mix
  nouns and a verb (`apply`).
- Fix: Do after CMD-006, which deletes the `unreadable-config` result and turns `preparation` into a thrown error.
  Split `selection` into `arguments` (flag conflicts), `git` (Git failures), and `files` (copying files for a run);
  the write failure of saving gspot.toml is `writing`; the code `policy` becomes `settings`. List the codes on the
  exit-codes page (`reference/exit-codes.md`).
- Size: medium

### NMU-037: "barrel" jargon in settings and plugin text

- Where: the `structure.reexports` summary "for libraries with barrels"
  (`packages/cli/configurations/general/structure/manifest.toml`), the plugin rule `no-index-imports` ("behind the
  barrel"), test titles "nonduplicate barrel" and "native barrel threshold"
- Kind: rewrite-text
- Problem: "barrel" is front-end slang for an index file that re-exports.
- Fix: Say "index file that re-exports other files".
- Size: small

### NMU-038: Docs and help export `team.template.toml`, but a GitHub source reads `gspot.template.toml`

- Where: `packages/cli/src/config/commands/help.ts:28`, `docs/src/content/docs/guides/templates.md:11,34,41,42,63,66,69`;
  `packages/cli/src/config/policy/templates.ts:5` (`TEMPLATE_FILE = 'gspot.template.toml'`)
- Kind: rewrite-text
- Problem: A user who follows the guide, pushes `team.template.toml`, and runs `init --from github:owner/repo` gets
  "There is no template", because a GitHub source without a path reads `gspot.template.toml`.
- Fix: Use `gspot.template.toml` in the help example and in every export example of the guide.
- Size: small

### NMU-039: The output format `trufflehog-json` breaks the naming pattern

- Where: `packages/cli/src/parsers/schema/contracts.ts:24`, `docs/src/content/docs/guides/command-checks.md`
- Kind: rename
- Problem: The other tool formats are named after the tool (`semgrep`, `knip`, `typos`, `markdownlint`), though they
  also read JSON.
- Fix: Rename it to `trufflehog`.
- Size: small

### NMU-041: The scratch copy is "copy", "snapshot", "workspace", and "isolated directory"

- Where: the explain text "Runs with selected files and declared configuration in an isolated directory"
  (`packages/cli/src/commands/explain/contracts.ts:113`); test titles "index snapshots preserve", "leaves no
  snapshot", "staged snapshots copy", "isolated corrections publish selected bytes and remove their workspace"
  (`tests/cli/execution/fixers/isolation.test.ts`), "a source snapshot retains"
- Kind: rewrite-text
- Problem: "snapshot" is a banned word, and "workspace" means npm workspaces elsewhere. Bare "copy" is not enough: in
  code it already names `FileCopy`.
- Fix: Do after INS-047, which deletes the empty `src/execution/snapshot/` and `tests/cli/repository/snapshot/`
  folders. Say "scratch copy" everywhere: "index scratch copies", "leaves no scratch copy", "remove their scratch
  copy"; explain prints "Runs on a scratch copy of the selected files in a temporary folder." The `check` help follows
  the CLI target help.
- Size: small

### NMU-042: "publish" and "publication" mean "write to disk"

- Where: 14 test titles ("before publication", "template publication is idempotent", "a failed pin publication"), the
  test file `tests/cli/lifecycle/apply/publication.test.ts`, the callback `writePolicyFile({ publish })`
  (`packages/cli/src/commands/public.ts:287`, `commands/contracts.ts:152`)
- Kind: rename
- Problem: "publish" means npm publishing in `release.yml`; here it means writing a file.
- Fix: Say "write" in the titles. `publication.test.ts` splits into `tests/unit/cli/apply/write.test.ts` and
  `tests/unit/cli/apply/version-pin.test.ts`. The `publish` callback goes with `writePolicyFile`: one
  `writeSettings(log, text, original)` in `settings/file.ts` does the write (CMD-005).
- Size: small

### NMU-043: "preview" means a dry run in test names

- Where: `tests/cli/commands/policy-preview.test.ts`, `tests/cli/lifecycle/apply/rule-preview.test.ts`,
  `tests/config/cli/lifecycle/rule-preview.ts`, 20 test titles ("apply previews missing outputs"), the doc comment
  "Preview or install locked tools" (`packages/cli/src/commands/contracts.ts:82`)
- Kind: rename
- Problem: The flag is `--dry-run`, and the docs say "dry run".
- Fix: Say "dry run" in titles. The two "preview" files go with ST2-008 (`policy-preview.test.ts`) and TEL-010 (`rule-preview.test.ts`, whose data joins `tests/config/rule-capture.ts`). The doc comment becomes "Install the pinned tools".
- Size: small

### NMU-044: mise task names do not say what they run

- Where: `mise.toml:16-79`
- Kind: rename
- Problem: `pin:eslint-presets` copies rule lists and pins nothing; `install:checks` runs `gspot install` from source
  ("Install locked repository checks with the current workspace plugin"); `test:tools` names the suite after
  "tools"; `test:package` tests `tests/packages`; `test:database` runs one Supabase test; `build:plugin` builds the
  ESLint plugin; `generate:docs` runs `astro sync`.
- Fix: The target has eight tasks (SCR-005): `pin:eslint-presets` becomes `update:rule-lists` (PLG-007); one `build` task builds the CLI and the ESLint plugin; the test tasks are `test`,
  `test:integration`, and `test:e2e`; `test:database` goes with the Docker test, `install:checks` goes
  once this repository runs the published gspot, and `astro sync` moves into `setup`. No description says
  "native".
- Size: small

### NMU-048: "plugin" alone names the ESLint plugin

- Where: `tests/plugin/`, `tests/config/plugin/`, the architecture module `name = "plugin"` (`gspot.toml:154-157`), the
  mise task `build:plugin`, the alias `#plugin/*`, the import names `pluginManifest` and `pluginPackage`
- Kind: rename
- Problem: The package folder is `packages/eslint-plugin/`, but every other name drops "eslint", while messages and
  docs also talk about Prettier plugins and ESLint plugins in general.
- Fix: Use `eslint-plugin` everywhere outside the package: `tests/unit/eslint-plugin/`, `tests/config/eslint-plugin.ts`,
  the module name `eslint-plugin`, the alias `#eslint-plugin/*`, `#eslint-plugin-package` imported as
  `eslintPluginPackage`. The build is the one `build` task with `scripts/build.ts` (SCR-005), and the CodeQL ignore
  path moves to `scripts/build.ts`.
- Size: small

### NMU-064: Rules are also "rules for AI coding agents", "agent instructions", and "installed copies"

- Where: the CLI description "install rules for AI coding agents" (`packages/cli/src/public.ts:58`,
  `packages/cli/package.json:7`, both READMEs), `packages/cli/src/policy/schema/agent-rules.ts:7,10,16` ("agent
  instructions", "folder the rules install into", "installed selection"), `packages/cli/src/config/agent-rules.ts:8`
  ("These files are installed copies"), the docs reference heading "Rules for coding agents"
- Kind: rewrite-text
- Problem: Rules are written, not installed (`gspot install` installs tools), and the same files get four names.
- Fix: "Lint AI-generated code and write rules for AI coding agents." (the CLI description, `package.json`, and the
  READMEs); in `settings/schema/rules.ts`, "Write the rules and the managed block in AGENTS.md" (the folder setting
  goes, TML-003); in `config/rules.ts`, "These files are copies that gspot writes."; the reference heading "Rules".
- Size: small

### NMU-065: Docs headings and labels use jargon

- Where: `guides/policy.md:127` "Reconcile project changes" (body: "deactivates ... configurations whose evidence
  disappeared ... authored scope policy for returning projects"), `:135` "Settings for one integration";
  `guides/hooks.md:22,33`, `guides/join.md:45`, `guides/existing-repository.md:43`, `guides/remove.md:24` "integration
  lines" and `guides/ci.md:38` "integration steps"; `guides/exclude.md:6` "Inventory declarations";
  `guides/templates.md:3` "Export portable policy", `:34` "Export can write outside the repository atomically", `:53`
  "existing consumers"; `reference/runtime.md:3` "Interpret command results and configure execution from the
  environment" and "exit contract"; `guides/overview.md:12,22-27` "declared project contracts", "A **scope**
  identifies a project", "A **pointer** is an editor-facing tool file"; `guides/ci.md:13` calls the GitLab CI file a
  "tool file" (paths under `docs/src/content/docs/`)
- Kind: rewrite-text
- Problem: Readers scan the site by its headings, and these headings use internal words.
- Fix: The sections "Reconcile project changes" (DOC-055) and "Settings for one integration" (DCP-011) are deleted
  from `guides/gspot-toml.md`, and the "Native exclusions" and "Native ignore files" sections go with `ignore_file`
  (TML-004). On the pages that stay: "gspot hook lines", with a link to Git hooks (DOC-051); "the gspot steps" in
  `guides/ci.md`; "Mark generated and copied files" on `guides/exclude.md` (DCP-007); "Export your gspot.toml as a
  template", "Export can write outside the repository", and "repositories that used it"; the exit-codes page
  (`reference/exit-codes.md`) is "Exit codes and environment variables", with no "exit contract"; in the overview, "A
  **scope** is a folder with its own configurations and settings" and "A **pointer** is a small file, such as
  `eslint.config.mjs`, that sends your editor to the tool file", and the jargon sentence goes (DCX-002); "the
  generated GitLab CI file".
- Size: small

### NMU-066: Docs and help call the swift-snapshot-testing and swift-tests configurations by other names

- Where: `docs/src/content/docs/guides/testing.md` ("[SnapshotTesting configuration]", "Swift tests"), the
  configuration title "Swift Tests" and the rule file `packages/cli/configurations/test/swift-tests/rules/XCTEST.md`,
  the empty leftover folder `packages/cli/configurations/tool/xctest/`
- Kind: rewrite-text
- Problem: One configuration has several names.
- Fix: Use the configuration ID in link text (`swift-snapshot-testing`, `swift-tests`); the rule file becomes
  `packages/cli/configurations/testing/swift-tests/rules/SWIFT-TESTS.md`; delete the empty folder.
- Size: small

### NMU-071: Manifest keys for ESLint and tools use four word orders

- Where: `packages/cli/src/parsers/schema/configurations.ts:244-316` and the manifests: `eslint_presets`,
  `eslint_all_rules`, `required_eslint_rules`, `eslint_rules_off`; `compiler_options` (TypeScript) beside
  `basedpyright_options` and `ruff_rules`; `products`; `ignored`, `ignored_folders`, `untracked_files`,
  `dockerignore`; the data files `language/css/rule-names.json` and `language/javascript/eslint-rule-names.json`
- Kind: rename
- Problem: A contributor who writes a configuration cannot guess the key names.
- Fix: Group the ESLint keys under one `[eslint]` table: `presets`, `all_level_rules`, `rules_off`, `selectors`
  (`required_eslint_rules` goes). `compiler_options` becomes `typescript_options`; `products` becomes `allowed_words`,
  the same name as the gspot.toml key (glossary); `ignored` is deleted (GEN-008), and `ignored_folders` is the one field for folders a language creates (CFL-009).
- Size: medium

### NMU-072: "owner" and "owns" mean five different things in messages

- Where: `packages/cli/src/commands/explain/public.ts:226` ("no enabled check owns this file"), `:251` ("owned by:"),
  `checks/language/python/deptry.ts:71,80` ("Dependency ownership requires uv.lock", "a second owner of the
  dependencies"), `checks/general/structure/env-owner.ts:150-151` ("the environment owner"),
  `checks/language/bash/guards.ts:30,57` ("configuration owners"), `lifecycle/ownership/public.ts:91` ("Reopen the
  lifecycle owner"), `policy/normalize.ts:136` ("the repository owns this check"),
  `checks/general/structure/trivial-functions.ts:65` and `checks/language/sql.ts:122` ("Move them to their owner")
- Kind: rewrite-text
- Problem: "owns" stands for "reads", "selects", "declares", "is allowed to read", and "uses".
- Fix: "no selected check reads this file"; "checked by:"; "deptry needs uv.lock, poetry.lock, or pdm.lock";
  "outside the environment readers" (the check `structure/env-reads`, and the Bash guards); "Move them to the code
  that uses them"; in the other messages, the real verb (reads, selects, declares, uses). The ownership-log message is
  rewritten with the other "lifecycle" messages (TCM-030).
- Size: small

### NMU-075: Generic test file names hide the subject

- Where: `ci.test.ts` (5 folders), `hooks.test.ts` (5), `lockfiles.test.ts` (5), `scopes.test.ts` (5),
  `command.test.ts` (5), `files.test.ts` (5), `checks.test.ts` (5), `settings.test.ts` (4), `takeover.test.ts` (4),
  `security.test.ts` (4), `semgrep.test.ts` (4), and 18 more names used three times
- Kind: rename
- Problem: Bun prints the file name of a failing test, so "`ci.test.ts` failed" tells a reader little. Some names are
  fine because the folder mirrors the source; others carry no subject.
- Fix: A unit test file is named after the source file it tests (`tests/unit/cli/planning/checks.test.ts` tests
  `planning/checks.ts`). Any other file whose name is only a generic noun takes its subject:
  `tests/cli/commands/explain/command.test.ts` becomes `tests/unit/cli/commands/explain/check.test.ts`, and
  `tests/tools/configurations/language/python/checks.test.ts` splits into
  `tests/integration/language/python/basedpyright-pydoclint.test.ts` and `imports.test.ts`. The test topic files apply this rule file by file (for example TCG-047, TCO-032, TGN-061, TPP-030, TPP-031, TTC-026, TTO-038).
- Size: medium

## Target names

The folders and files that change name, with their final names.

Test suites and test code:

| Today                   | Final                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `tests/cli/`            | `tests/unit/cli/` (mirrors `packages/cli/src/`, TEL-009)        |
| `tests/plugin/`         | `tests/unit/eslint-plugin/` (NMU-048)                           |
| `tests/tools/`          | `tests/integration/` (NMU-005)                                  |
| `tests/packages/`       | `tests/e2e/`                                                    |
| `tests/harness/`        | `tests/setup/`                                                  |
| `tests/config/`         | `tests/config/`, one file per topic (`architecture.md`, Layout) |
| `tests/config/samples/` | the topic files of `tests/config/`                              |
| `tests/types/`          | `tests/types/`                                                  |
| `tests/cli/scripts/`    | deleted with the scripts they test (SCR-007)                    |

Configuration groups and the check code that follows them (the same groups in `src/config/checks/`,
`src/types/checks/`, `tests/unit/cli/checks/`, and `tests/integration/`):

| `packages/cli/configurations/`           | `packages/cli/src/checks/`                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `database/postgres`                      | `database/postgres/`                                                                              |
| `framework/{astro,...,site,...}`         | `framework/{expo,nextjs,svelte,version-pairs}.ts`, `framework/site/` (from `general/site/`)       |
| `general/{commits,...,structure}`        | `general/...`                                                                                     |
| `infra/` becomes `infrastructure/`       | `infrastructure/{ansible,docker,github-actions,nginx}.ts`, `infrastructure/xcode/` (from `tool/`) |
| `language/{bash,...}`                    | `language/...`                                                                                    |
| `library/{drizzle,...}`                  | `library/...`                                                                                     |
| `platform/{cloudflare,supabase}` (stays) | `platform/{cloudflare,supabase}.ts`                                                               |
| `test/` becomes `testing/`               | `testing/{coverage,swift-tests}.ts` (from `tool/`)                                                |
| `tool/` (empty leftovers)                | deleted                                                                                           |

Other folders and files:

| Today                                             | Final                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/cli/src/platform/`                      | `packages/cli/src/system/` (NMU-007, PLR-003)                                               |
| `packages/cli/src/policy/`                        | `packages/cli/src/settings/` (NMU-012)                                                      |
| `packages/cli/src/policy/schema/native/`          | deleted with the setting-schema generator (POL-001)                                         |
| `packages/cli/src/policy/document/`               | `settings/{edit,file,templates}.ts` (EXG-015)                                               |
| `packages/cli/src/generation/documents/`          | `generation/{ci,formatting,headers,pointers,ignore-patterns,rule-capture}.ts` (EXG-015)     |
| `packages/cli/src/commands/{public,contracts}.ts` | `commands/{apply,install,export,session,save-settings}.ts` (CMD-003)                        |
| `packages/eslint-plugin/src/{config,types}/no/**` | `config/syntax.ts`, `config/imports.ts`, `types/rules.ts`, `types/syntax.ts`                |
| `scripts/plugin.ts`                               | deleted: `bun test` with the preload `tests/setup/integration.ts` runs each suite (SCR-003) |
| `scripts/eslint-presets.ts`                       | `scripts/update-rule-lists.ts` (NMU-044)                                                    |
| `scripts/setting-values.ts`                       | deleted with the setting-schema generator (POL-001)                                         |
| `scripts/workspace.ts`                            | deleted (ROOT-018)                                                                          |

## Final check IDs

This table owns every check ID that changes. The records, the manifests, the check table, tests, docs, and
`gspot.toml` use the final ID. Every check ID not listed here keeps its name (for example `bash/bash-syntax`).

| Today                         | Final                           | Why                                                                                          |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `bash/contract`               | `bash/script-layout`            | It checks the shebang, strict mode, and that `main` runs last (CKO-018).                     |
| `bash/embeds`                 | `bash/inline-scripts`           | It checks scripts written inside other files (CKO-018).                                      |
| `bash/guards`                 | `bash/include-guards`           | It checks include guards (CKO-018).                                                          |
| `docs/stale-paths`            | `docs/missing-paths`            | It reports paths and `run` commands that name nothing.                                       |
| `gspot/drift`                 | `gspot/generated-files`         | "drift" is retired; it checks the files gspot writes.                                        |
| `gspot/policy`                | `gspot/settings`                | "policy" is retired for gspot.toml.                                                          |
| `gspot/policy-layout`         | `gspot/settings-format`         | It checks the order and format of gspot.toml.                                                |
| `gspot/unmatched-paths`       | `gspot/unused-entries`          | One word, "unused", for an entry that matches nothing; its rule is `unused-entry` (POL-059). |
| `naming/policy`               | `naming/settings`               | It checks the naming settings (CKG-005).                                                     |
| `postgres/migrations-frozen`  | `postgres/edited-migrations`    | It reports edited migrations (CKO-018).                                                      |
| `postgres/rls`                | `postgres/row-level-security`   | No abbreviation (CKO-018).                                                                   |
| `python/lazy-exports`         | `python/module-getattr`         | It checks a module `__getattr__` (CKO-018).                                                  |
| `secrets/env-template`        | `secrets/env-examples`          | "template" names the export file; the setting is `secrets.env_examples` (NMU-024).           |
| `site/dead-assets`            | `site/unused-assets`            | One word, "unused" (NMU-022).                                                                |
| `sql/trivial-functions`       | `sql/functions`                 | It also checks parameter counts (CKO-021).                                                   |
| `structure/env-owner`         | `structure/env-reads`           | The setting is `architecture.roles.environment_readers`.                                     |
| `structure/prefix-collisions` | `structure/shared-prefixes`     | It reports sibling files that share a name prefix.                                           |
| `structure/stem-collisions`   | `structure/file-folder-clashes` | It reports a file and a folder with the same name.                                           |
| `translations/locales`        | `translations/messages`         | It checks the message files (CKO-018).                                                       |
| `xcode/ats`                   | `xcode/app-transport-security`  | No abbreviation (CKO-018).                                                                   |
| `xcode/orphan-assets`         | `xcode/unused-assets`           | One word, "unused"; its lint rule is `unused-asset` (NMU-022).                               |
| `xcode/orphan-sources`        | `xcode/files-without-target`    | It reports source files that no target builds (NMU-022).                                     |

Deleted checks (no final ID): `docs/headings` (CFG-003), `structure/folder-names` (CKG-003),
`structure/config-logic` (CKG-010), `structure/test-placement` (CKG-011), `structure/private-before-public` and
`structure/import-comments` (CKG-055).
