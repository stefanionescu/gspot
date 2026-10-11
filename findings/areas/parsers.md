# Parsers and the manifest schema

The parser code turns files and tool output into data for the checks, `init`, `apply`, and the settings code. It
lives in `packages/cli/src/parsers/`, with its constants in `config/parsers/` and its types in `types/parsers/`
(123 files, about 7,600 lines). The target keeps only real readers in `parsers/`, one file per topic with a name
that says the topic. Check logic moves into its check, the schema of gspot's own `manifest.toml` moves to
`configurations/schema/`, gspot.toml tables move to `settings/schema/`, and every exported type is written by hand
in `types/`, with each schema checked against it (ARC-008).

All paths are under `packages/cli/src/` unless they start with `tests/`, `scripts/`, `docs/`, or name a root file.

## Findings

### PAR-001: The Swift function reader is dead; only tests keep it alive

- Where: `parsers/swift/public.ts:19-72` (`readSwift`, `getSwiftFunctions`, `disposeSwift`), `config/parsers/swift.ts:2-12` (`SWIFT_BODY_NODES`), `types/parsers/swift/source.ts:4-11` (`SwiftFunction`, `SwiftSource`, `ParsedSwift`), `tests/cli/parsers/tree-sitter.test.ts:8,96-112`, `tests/cli/parsers/swift/source.test.ts`, `tests/types/cli/parsers.ts`, `tests/cli/parsers/nginx.test.ts:26`
- Kind: delete
- Problem: No check reads Swift functions this way; the trivial-functions check reads Swift through `checks/general/structure/conventions.ts`. `readSwift` and `disposeSwift` are called only by `tests/cli/parsers/tree-sitter.test.ts`, `getSwiftFunctions` only by `readSwift` and `tests/cli/parsers/swift/source.test.ts`, and `SWIFT_BODY_NODES` only by `getSwiftFunctions`.
- Fix: Delete `readSwift`, `getSwiftFunctions`, `disposeSwift`, `SWIFT_BODY_NODES`, and the types `SwiftFunction`, `SwiftSource`, `ParsedSwift`. Delete `tests/cli/parsers/swift/source.test.ts` and the Swift rows of `tests/cli/parsers/tree-sitter.test.ts`. Delete `tests/types/cli/parsers.ts`: its observation types exist only to run one test over the Python and Swift readers, and `DirectiveCase` only feeds a `satisfies DirectiveCase[]` in `tests/cli/parsers/nginx.test.ts`, which goes too.
- Size: small

### PAR-002: The Bash parser computes four results nobody reads

- Where: `parsers/bash/public.ts:235,247-262,269-271`, `types/parsers/bash.ts:8,17,41,43,46`, `checks/language/contracts.ts:37-40`, `tests/cli/parsers/bash.test.ts:28-38`
- Kind: delete
- Problem: `parseBashScript` returns `quotedArguments`, `isTrivialFile`, and a `statements` count per function. No code reads them: every Bash check (`checks/language/bash/*.ts`) reads only `name`, `start`, `end`, `body`, and `highestRead` of a function, and only `tests/cli/parsers/bash.test.ts` asserts `statements`. The `minimumStatements` option exists only to compute `isTrivialFile`.
- Fix: Delete the `quotedArguments` and `isTrivialFile` fields, the `statements` field of `ScriptFunction`, the `QuotedArgument` type, and the `BashParseOptions` type with its `minimumStatements` option. The signature becomes `parseBashScript(text, cache?)` (PAR-079). Remove the imports of `executableStatements` and `isTrivialFile` from the Bash parser (they move to the trivial-functions check, S08-002). Update the caller in `checks/language/contracts.ts:37` and the test expectations. The file becomes `parsers/bash.ts` (PAR-007).
- Size: small

### PAR-003: The "index" mode of `parseGitEntries` is dead

- Where: `parsers/contracts.ts:92-103`, `repository/revisions/public.ts:115,121`, `tests/cli/parsers/git.test.ts:25,31,40`
- Kind: simplify
- Problem: `parseGitEntries(output, kind)` has an `'index'` branch. The only production caller handles the index itself (`repository/revisions/public.ts:115`) and calls this function only for commits (line 121). Only the Git test reaches the index branch.
- Fix: Rename it to `parseTreeEntries(output: Uint8Array)` in `parsers/git.ts`, keep only the commit path, and drop the `kind` parameter. Update `getEntries` and the test.
- Size: small

### PAR-005: `finding_count_pattern` is in both check schemas, but no check needs it

- Where: `parsers/schema/configurations.ts:153` (manifest `checkFields`), `policy/schema/public.ts:62` (gspot.toml command checks), `types/configurations.ts:37` (`CheckDeclaration`), `execution/command/contracts.ts:33-37` (`countMatches`), `:65-68` (`markFailure`), `:130`, `:154`, `execution/public.ts:125` (`countedFailure`), `tests/cli/execution/count-pattern.test.ts`
- Kind: delete
- Problem: The manifest check schema accepts `finding_count_pattern`, but no shipped `manifest.toml` sets it. The gspot.toml command-check schema accepts it too, but a command the user owns sets its own exit code, and `exit_codes` already tells findings from a crash (TML-004). Both kinds of check run through one type, `CheckDeclaration`, which carries the field to the runner. There `countMatches` builds a global regular expression and collects every match into an array, only for its one caller, `markFailure`, to ask `> 0`. The two guards in `isToolBroken` and `finishResult` and `countedFailure` in the ignore step serve the same field.
- Fix: Delete `finding_count_pattern` from the manifest check fields, from the command-check schema, and from `CheckDeclaration`. Delete `countMatches`, the counting branch of `markFailure`, the two guards, and `countedFailure`, so the exit code alone marks the failure. Delete the field's only test, `count-pattern.test.ts`, with the helper `identityPolicy`. The code that reads the other manifest-only fields stays, because shipped manifests set them: `crash_pattern` (`hasToolError`), `needs` (`unrunnable`), and the planning reads of `operating_systems` (today `platforms`) and `ignore_file`. `finding_count_pattern` is not one of the shared check fields of PAR-028.
- Size: small

### PAR-006: Three Zod schemas exist only to describe a TypeScript type

- Where: `parsers/schema/contracts.ts:59-84` (`findingSchema`, `resultSchema`), `parsers/schema/public.ts:71-75` (`installerPinSchema`), `types/parsers/output.ts:29`, `types/execution/check.ts:105-107`, `types/parsers/tool.ts:4`
- Kind: simplify
- Problem: These schemas never check data at run time; code only takes `z.infer` of them. Only `policyJsonSchema` turns schemas into JSON Schema, and only for setting schemas, so the `.meta` description on `resultSchema.files` is never published.
- Fix: Write the types by hand: `Finding`, `CheckResult`, and `CheckStatus` (`(typeof CHECK_STATUSES)[number]`) in `types/execution/check.ts`, and `InstallerPin` in `types/configurations.ts`. Delete the three schemas and the `Defined<...>` wrappers that only undo `.optional()`.
- Size: small

### PAR-007: `public.ts` and `contracts.ts` say nothing about what a parser file holds

- Where: `parsers/public.ts`, `parsers/contracts.ts`, `parsers/{bash,naming,output,output/structured,packages,schema,source,sql,swift,toml,tool}/{public,contracts}.ts`
- Kind: rename
- Problem: 24 of the 62 parser code files are called `public.ts` or `contracts.ts`. The names say nothing about the content, and the pairs do not mean "public" and "internal": 11 of the 12 `contracts.ts` files are imported from outside their folder (`parsers/source/contracts.ts` by 14 files, `parsers/contracts.ts` by 10). `bash/contracts.ts` holds Next.js build flags, `naming/public.ts` the SQL extractor, `swift/contracts.ts` Swift coverage, and `parsers/contracts.ts` Git listings and lockfiles.
- Fix: Name each file by its topic (see "Target layout"). `parsers/public.ts` splits into `json.ts` and `generated-header.ts`, and its Markdown and docs helpers leave for their checks (PAR-012, PAR-046). `parsers/contracts.ts` becomes `git.ts` (which also takes `attributes.ts`) and `lockfiles.ts` (PAR-085). `bash/public.ts` becomes `bash.ts`. `source/public.ts` becomes `tree-sitter.ts` and `comments.ts`. `source/contracts.ts` becomes `python.ts` and `typescript.ts`, and statement counting leaves for its check (S08-002). `packages/public.ts` and `packages/contracts.ts` become `dependency-files.ts`, `npm-client.ts`, `tool-project.ts`, and `tsconfig.ts` (PAR-022, PAR-023, PAR-063). `sql/contracts.ts` and `sql/public.ts` become `sql/postgres.ts`. `toml/public.ts` becomes `toml/document.ts`, and `toml/contracts.ts` becomes `toml/comments.ts`. `output/public.ts` becomes `output/formats.ts` and `output/text.ts` (PAR-014). The other files leave `parsers/` (PAR-008, PAR-011, PAR-013, PAR-016, PAR-021).
- Size: large

### PAR-008: `parsers/schema/` is not "shared parser contracts"

- Where: all 28 files in `parsers/schema/`
- Kind: move
- Problem: AGENTS.md says file-format schemas belong to their parsers, and only shared parser contracts live in `parsers/schema/`. Most files here are neither. They fall into six groups:
    1. Third-party tool reports read by one check: `ast-grep.ts`, `codeql.ts`, `docker.ts`, `duplication.ts`, `svelte.ts`, `supabase.ts`, `site.ts` (report half), `xcode.ts` (test plan, strings, assets), `xctest.ts`, `swift-coverage.ts`, `licenses.ts` (report half).
    2. Third-party files read by one parser that lives elsewhere: `mise.ts` (only `parsers/mise.ts`), `git.ts` (only `parsers/contracts.ts`), `lockfiles.ts`, `repository.ts` (only `repository/paths/contracts.ts`), `yarn.ts` (only `tools/npm/yarn.ts`), `python/*.ts` (one check each).
    3. gspot's own `manifest.toml` format: `configurations.ts`, most of `public.ts` (`toolSchema`), `command.ts`, `naming.ts` (`shippedNamingSchema`), and the setting declarations and `conditionSchema` in `contracts.ts`.
    4. gspot.toml table schemas: `namingLists`, `generatedSchema`, `vendoredSchema`, `allowlistSchema`, `levelSchema`, `runnerSchema`, `operatingSystemSchema`.
    5. Messages between gspot and its own child programs: `linkinatorRequestSchema`, `purgecssRequestSchema` (`site.ts`), `formatConfigurationSchema` (`format.ts`).
    6. Data read only by the rule-list script `scripts/eslint-presets.ts` (PAR-031).
- Fix: Delete the folder. Each schema moves to the file that reads it, and its type is written by hand in the matching `types/` topic file (ARC-008).
    1. Report schemas move into their check: `codeqlLanguagesSchema` to `checks/general/security.ts`, the Trivy and Compose schemas to `checks/infrastructure/docker.ts`, the jscpd schemas to `checks/general/duplication.ts`, the license report schemas to `checks/general/licenses.ts`, the site report schemas to `checks/framework/site/built-pages.ts` and `webManifestSchema` to `checks/framework/site/source-files.ts`, the Supabase and Deno schemas to `checks/platform/supabase.ts`, the Svelte schema to `checks/framework/svelte.ts` (PAR-073), the Xcode test plan, strings, and asset schemas to `checks/infrastructure/xcode/`, and the Swift coverage schemas to `checks/testing/swift-tests.ts` (PAR-016). The ast-grep schemas go with ast-grep (CKO-001).
    2. File schemas move beside their reader: the mise task schemas to `parsers/mise.ts`, `gitEntrySchema` to `parsers/git.ts`, the `project.pbxproj` schemas to `parsers/xcode.ts`, the npm, Bun, pnpm, and Yarn lockfile schemas to `tools/npm/lockfiles.ts`, the three Yarn settings schemas to `tools/npm/yarn.ts` (PAR-073), the uv schemas to `tools/python/` (PAR-042), and the Python tool schemas to their checks (PAR-072). The pnpm, Lerna, and Rush workspace schemas are deleted (S07-002), and `miseToolsSchema` goes with its one reader (INX-007).
    3. The `manifest.toml` schemas move to `configurations/schema/` (PAR-009), except `outputSchema`, which moves to `parsers/output/formats.ts` because the output readers need it.
    4. The gspot.toml table schemas move or go as PAR-010 says.
    5. The request schemas move into the child programs that read them: `linkinatorRequestSchema` to `checks/framework/site/linkinator-program.ts`, `purgecssRequestSchema` to `checks/framework/site/purgecss-program.ts`. The Prettier child and its schema go (DEC-009).
    6. The schemas only the rule-list script reads move to `scripts/update-rule-lists.ts` (PAR-031).

    Delete `types/parsers/{sarif,semgrep,site,docker,supabase}.ts`, which only re-export `z.infer` of one schema; their types are written by hand in `types/parsers/output.ts`, `types/checks/framework.ts`, `types/checks/infrastructure.ts`, and `types/checks/platform.ts`. Every move keeps the import order of `[[architecture.module]]`: `parsers` imports only `system`, and `generation` imports neither `checks` nor `tools`. Change the AGENTS.md sentence about `parsers/schema/` to match.

- Size: large

### PAR-009: The manifest schema lives in `parsers/`, but gspot.toml already treats it as `configurations`

- Where: `parsers/schema/configurations.ts`, `parsers/schema/naming.ts:43-59`, `parsers/schema/public.ts`, `parsers/schema/command.ts`, `gspot.toml:135,145`
- Kind: move
- Problem: `manifestSchema` describes gspot's own `manifest.toml`, and its only reader is `configurations/public.ts`. gspot.toml has to carve the file out of the `parsers` module and into the `configurations` module with globs: line 135 lists `parsers/schema/configurations.ts` under `configurations`, and line 145 excludes it from `parsers` with `parsers/schema/!(configurations).ts`. `shippedNamingSchema` is also read only by `configurations/public.ts:206`.
- Fix: Move the manifest schemas into the folder `configurations/schema/`, split by topic to stay under 300 lines:
    - `manifest.ts`: `manifestSchema`, `checkSchema`, `checkFields`, `detectionSchema`, `toolFileSchema`, `eslintAllRulesSchema`, `eslintPresetSchema`, `eslintPresetBlockSchema`.
    - `tool.ts`: `toolSchema`, `toolDeclarationSchema`, the installer schemas, `replacementSchema`.
    - `naming.ts`: `identifierCategory`, `namingGroupSchema`, `namingOverrideSchema`, `reservedCategories`, and `namingDefaultsSchema` (CFG-035).
    - `parts.ts`: `checkStageSchema`, `commandSchema`, `findingExitCodesSchema`, `conditionSchema`, `versionFloorSchema`, `pathContainerSchema`, `regexSchema` (PAR-026), `commandCheckFields` (PAR-028), and the schemas of PAR-010.

    Their types are written by hand in `types/configurations.ts` (`Manifest`, and `ToolDeclaration`, renamed from `ToolPin`) and `types/checks/general.ts` (`NamingDefaults`, renamed from `NamingTerms`), and each schema is checked against its type (ARC-008). The setting declaration schemas are deleted with the `[[setting]]` tables (S09-012). Keep `outputSchema` in `parsers/output/formats.ts`: the output readers need it, and `parsers` may not import `configurations`. `toolSchema` leaves `parsers` only after `parseVersionOutput` and `hasToolSection` leave it (PAR-011). Then delete both glob carve-outs in gspot.toml.

- Size: medium

### PAR-010: gspot.toml table schemas sit in `parsers/schema/`, against AGENTS.md

- Where: `parsers/schema/naming.ts:35-40` (`namingLists`), `parsers/schema/inventory.ts:7-16` (`generatedSchema`, `vendoredSchema`), `parsers/schema/licenses.ts:11-25` (`allowlistSchema`, `licenseExceptionSchema`), `parsers/schema/contracts.ts:168-175` (`levelSchema`, `operatingSystemSchema`, `runnerSchema`), `config/parsers/inventory.ts`
- Kind: move
- Problem: AGENTS.md says gspot.toml tables belong to `policy/schema/`. These are gspot.toml tables and values, and `policy/schema/public.ts:2-11` and `policy/schema/native/contracts.ts:4-6` import them from `parsers/schema/`.
- Fix: Move `namingLists` and `allowlistSchema` (renamed `licensesSchema`, with `licenseExceptionSchema` renamed `allowedPackageSchema` for the `[[licenses.allowed_package]]` record, TML-009) to `settings/schema/tables.ts`: their users are the settings code, checks, and generation, which may import `settings`. Move `levelSchema`, `operatingSystemSchema`, and `fileKindSchema` to `configurations/schema/parts.ts`, because the manifest schema and `repository/` also use them and neither may import `settings`; their lists are `config/` values (S07-008), with `FILE_KINDS` in `config/repository/inventory.ts`. `generatedSchema` and `vendoredSchema` are deleted with the tables they describe (CFR-005), and `runnerSchema` with the `runner` setting (INX-003). Delete `parsers/schema/inventory.ts` and `config/parsers/inventory.ts`.
- Size: medium

### PAR-011: `parsers/tool/` is a grab bag; every function has one caller

- Where: `parsers/tool/public.ts`, `parsers/tool/contracts.ts`, `parsers/tool/format.ts`, `config/parsers/{cloudflare,expo,nextjs,nginx,xcode}.ts`, `config/parsers/tool/{format,tool-file,version}.ts`, `types/parsers/{cloudflare,nextjs,nginx,xcode,tool}.ts`
- Kind: move
- Problem: "tool" means "anything". The folder holds seven unrelated readers, each with its own config and type file elsewhere and one caller: `readPbxproj` and `testTargets` (`checks/tool/xcode/project.ts`); `parseWrangler`, `parseHeaders`, `redirectFindings` (`checks/platform/cloudflare.ts`); `parseExpoDoctor` (`checks/framework/expo.ts`); `nextSettingsFindings` (`checks/framework/public.ts`); `readFormatConfiguration` (`commands/init/public.ts`); `parseDirectives` (`checks/tool/public.ts`); `parseVersionOutput` (`tools/contracts.ts`, `tools/npm/contracts.ts`); `hasToolSection` (`repository/discovery/public.ts`). Only `projectBuildSettings` has two callers (`commands/init/contracts.ts`, `parsers/swift/public.ts`).
- Fix: Delete the folder.
    - Keep the Xcode project reader in the parser layer as `parsers/xcode.ts`, because `generation/` (through `readSwiftVersion`) and `commands/init` also need `projectBuildSettings`, and `generation` may not import `checks`.
    - Move the Cloudflare readers into `checks/platform/cloudflare.ts`, Expo into `checks/framework/expo.ts`, and Next.js into a new `checks/framework/nextjs.ts` with `parseNextBuildFlags` (PAR-021). Move the nginx tokenizer to `checks/infrastructure/nginx.ts` (PAR-083).
    - Move `parseVersionOutput` to `tools/versions.ts`.
    - Move `hasToolSection`, `getIniSection` (as `hasIniSection`, PAR-018), and `parseToolFile` to `repository/tooling.ts`, the tooling survey. Rename `parseToolFile` to `parseSharedFile`: it reads the user's own file, not a tool file gspot writes. Its JSON branch uses `readJson` (PAR-040), and the three extensions of `TOOL_FILE_FORMATS` become the case labels of its one switch.
    - The Prettier reader and its child program go (DEC-009).
    - The constants go to the `config/` topic files of the code they move with (`config/checks/platform/cloudflare.ts`, `config/checks/framework/expo.ts`, `config/checks/framework/nextjs.ts`, `config/checks/infrastructure/nginx.ts`, `config/parsers/xcode.ts`; the version values as S07-005 says). The types go to `types/checks/platform.ts`, `types/checks/infrastructure.ts`, `types/parsers/xcode.ts`, and `types/tools/find.ts` (`ParsedToolVersion`).
- Size: large

### PAR-012: Check logic and finding messages live in the parser layer

- Where: `parsers/tool/public.ts:231-281,302-339`, `parsers/source/contracts.ts:164-174` (`trivialText`), `parsers/public.ts:115-151,228-235` (`proseLines`, `pathTokens`, `cleanPathToken`), `parsers/public.ts:153-173` (`ruleSections`), `parsers/css.ts`, `parsers/source/contracts.ts` (`typescriptProgram`)
- Kind: move
- Problem: These functions decide what is wrong and write the user's message. That is check work, not reading, and each has one user. `redirectFindings` writes "Use a supported Cloudflare redirect status instead of ...", `parseHeaders` writes "Write this header as Name: value.", and `nextSettingsFindings` decides which keys are secrets. `trivialText` is the trivial-function message (callers `trivial-functions.ts` and `checks/language/sql.ts`). `proseLines`, `pathTokens`, and `cleanPathToken` serve only `checks/general/docs.ts`, `ruleSections` only the rules code (`agent-rules/public.ts`), and `moduleImporters` and `definedClasses` only `checks/language/css.ts`. (`frozenMigrationPaths` in `parsers/sql/migrations.ts` is also check logic, but `generation/` uses it and may not import `checks`, so it stays.)
- Fix: Move `trivialText` into `checks/general/structure/trivial-functions.ts` and export it for `sql.ts`. Move `proseLines`, `pathTokens`, `cleanPathToken`, and their helper `withoutPunctuation` into `checks/general/docs.ts`, with their constants in `config/checks/general/docs.ts`. Move `ruleSections` into `src/rules.ts`. Delete `parsers/css.ts` and `typescriptProgram`: their only users, the `css/module-classes` check (CKO-029) and the test-placement check, are deleted. The Cloudflare and Next.js messages move with their readers (PAR-011).
- Size: medium

### PAR-013: The naming extractors belong to the naming check

- Where: `parsers/naming/*.ts`, `config/parsers/naming.ts`, `types/parsers/naming.ts:13-34`
- Kind: move
- Problem: All five extractors (`bashIdentifiers`, `pythonIdentifiers`, `swiftIdentifiers`, `typescriptIdentifiers`, `sqlIdentifiers`) have one caller, `checks/general/naming/contracts.ts`. The SQL extractor hides in a file called `public.ts`. The naming categories are split between `config/parsers/naming.ts` (`CATEGORY_LABELS`) and `config/checks/general/naming.ts` (`CATEGORY_PARENTS`).
- Fix: Move the extractors to `checks/general/naming/{bash,python,swift,typescript,sql}.ts`, and `createIdentifier` with `addIdentifier` to `checks/general/naming/declarations.ts` (its own file avoids an import loop with the naming reader). In `sql.ts`, rename `READERS` to `NAME_READERS` (the SQL lexer has a `READERS` too) and `identifiers` to `statementIdentifiers`. Put `CATEGORY_LABELS`, keyed by the `as const` list `NAME_CATEGORIES`, beside `CATEGORY_PARENTS` and `CASE_NAMES` in `config/checks/general/naming.ts`; every module may import `config/`, so the naming schemas read the list there (`identifierCategory = z.enum(NAME_CATEGORIES)`, S07-008). The category type is `(typeof NAME_CATEGORIES)[number]` in `types/checks/general.ts`, with `Identifier`, `IdentifierDeclaration`, `SqlNamed`, and `ExtractSink`. Delete the `?? declaration.category` fallback in `createIdentifier`. The node sets of the extractors join `config/checks/general/naming.ts` with language prefixes (S08-005).
- Size: medium

### PAR-014: Tool report readers are split across two folders and three schema files

- Where: `parsers/output/contracts.ts`, `parsers/output/structured/public.ts`, `parsers/output/structured/contracts.ts`, `parsers/schema/contracts.ts:86-166`, `types/parsers/{sarif,semgrep}.ts`
- Kind: merge
- Problem: The typos, markdownlint, and TruffleHog readers are in `output/contracts.ts`, with their schemas in `schema/contracts.ts`. The SARIF, Knip, and Semgrep readers are in `output/structured/public.ts`, but the SARIF and Semgrep schemas are in `output/structured/contracts.ts` and the Knip schema is in `schema/contracts.ts`. All six read JSON, so "structured" separates nothing.
- Fix: One file per format in `parsers/output/`, each with its own schema: `sarif.ts`, `knip.ts`, `semgrep.ts`, `typos.ts`, `markdownlint.ts`, `trufflehog.ts`, `json.ts`, and `text.ts` (regex, grouped, lines). `formats.ts` (renamed from `public.ts`) holds `outputSchema`, `outputFormats`, and `parseOutput`. Their types are in `types/parsers/output.ts`. Delete `output/structured/` and `types/parsers/{sarif,semgrep}.ts`.
- Size: medium

### PAR-015: The Vale reader is not an output format

- Where: `parsers/output/contracts.ts:192-207` (`parseAlerts`), `parsers/schema/contracts.ts:156-166` (`alertsSchema`), `types/parsers/output.ts:35`; tests that import it: `tests/cli/parsers/output/json.test.ts`, `tests/tools/configurations/general/prose/styles.test.ts`, `tests/tools/configurations/general/prose/vocabulary.test.ts`, `tests/tools/configurations/general/structure.test.ts`, `tests/tools/execution/acronyms.test.ts`
- Kind: move
- Problem: `parseAlerts` is not in `outputFormats`. One built-in check calls it (`checks/general/public.ts`).
- Fix: Move it with its schema into the Vale check, `checks/general/prose.ts`, as `valeAlerts` and `valeReportSchema`, and stop exporting it. `ValeAlert` goes to `types/checks/general.ts`. The tests that import `parseAlerts` read Vale findings through `gspot check` instead.
- Size: small

### PAR-016: Swift coverage is spread over five files with two schema files

- Where: `parsers/swift/contracts.ts`, `parsers/schema/swift-coverage.ts`, `parsers/schema/xctest.ts`, `types/parsers/swift/coverage.ts`, `checks/language/swift/coverage.ts`
- Kind: merge
- Problem: One 66-line check needs four helper files, each with one production importer. `parseSwiftCoverage` validates with `swift-coverage.ts` but returns a type built from `xctest.ts`.
- Fix: Merge the code and both schemas into the swift-tests check, `checks/testing/swift-tests.ts` (CKO-005). `CoverageReport` is written by hand in `types/checks/testing.ts`.
- Size: small

### PAR-017: The markdownlint reader re-reads every reported file only to doubt markdownlint

- Where: `parsers/output/contracts.ts:18-41,128-132`
- Kind: delete
- Problem: For every markdownlint finding, gspot reads the source file and throws if the column is past the end of the line. `markdownlintFinding` uses the line text only in that test. It guards against a markdownlint bug we have no sign of.
- Fix: Drop the `lines` parameter and the `sourceLines` call in `markdownlintFindings` (`parsers/output/markdownlint.ts`). Keep `sourceLines` for typos (`parsers/output/typos.ts`), which needs it to turn byte offsets into columns.
- Size: small

### PAR-018: `getIniSection` returns text that every caller throws away

- Where: `parsers/tool/contracts.ts:118-125,202-221`, callers `parsers/tool/contracts.ts:197` and `checks/language/python/imports.ts:25`, test `tests/cli/parsers/tool/tool-file.test.ts`
- Kind: simplify
- Problem: The function rebuilds the text of a section and its subsections. Both callers only test `!== undefined`.
- Fix: Replace `parseHeader` and `getIniSection` with `hasIniSection(text, section): boolean` in `repository/tooling.ts`, the lowest folder of its two users. It tests each line against `^\s*\[section(:[^\]]*)?\]`, built with `RegExp.escape(section)` so a dot or bracket in a section name matches only itself. This drops the "Duplicate configuration section" error, because the tool that reads the file reports duplicates itself: delete the test line that expects it (`tool-file.test.ts:13`) and make the test check the boolean.
- Size: small

### PAR-019: `hasKeyPath` repeats `valueAt`

- Where: `parsers/tool/contracts.ts:109-116,199`, `platform/contracts.ts:216`
- Kind: delete
- Problem: It walks a key path with `Object.hasOwn`, which `valueAt` already does. Parsed JSON, YAML, and TOML never hold `undefined`, so `valueAt(...) !== undefined` gives the same answer.
- Fix: Delete `hasKeyPath`; use `valueAt(parsed, parts) !== undefined`.
- Size: small

### PAR-020: The same comment-block code exists twice for TOML

- Where: `parsers/toml/public.ts:118-126`, `policy/comments.ts:81-97`
- Kind: merge
- Problem: Both build an ID with `JSON.stringify([kind, ...path])`, get or create `{ path, owned: [], free: [] }`, and push `{ raw, start, line }`.
- Fix: Export one `addTomlComment(comments, kind, path, comment, placement)` from `parsers/toml/comments.ts` and call it in both places.
- Size: small

### PAR-021: The Next.js build-flag reader is filed under "bash"

- Where: `parsers/bash/contracts.ts`, `tests/cli/parsers/command.test.ts`
- Kind: move
- Problem: The file reads Next.js flags from a package.json script with Yarn's script parser. It has nothing to do with the Bash parser beside it, and its one production caller is `checks/framework/public.ts`.
- Fix: Move it with `nextSettingsFindings` into `checks/framework/nextjs.ts`, keeping the name `parseNextBuildFlags` (`parse...` for pure functions). Its test joins the Next.js check test.
- Size: small

### PAR-022: TypeScript project reading hides inside "packages"

- Where: `parsers/packages/public.ts:174,231-335`, `parsers/packages/contracts.ts:203-310`, `config/parsers/tsconfig.ts`, `types/parsers/packages.ts:54-65`
- Kind: move
- Problem: `getTsconfig`, `tsconfigProjects`, `getTsconfigProject`, `projectSources`, `parseTsconfig`, `compilerHost`, and `configurationText` read TypeScript projects. They share nothing with package.json or pyproject.toml.
- Fix: Create `parsers/tsconfig.ts` with these functions, `TSCONFIG_MEMO`, and `typeScriptConfigSchema`. Rename the functions that read files to `read...` (NMS-016): `getTsconfig` to `readTsconfig`, `getTsconfigProject` to `readTsconfigProject`, and `configurationText` to `readCompilerFile` (it reads any compiler input). Stop exporting `parseTsconfig` and `compilerHost`. `TSCONFIG_FILE`, `JSCONFIG_FILE`, and the two diagnostic codes stay in `config/parsers/tsconfig.ts`; `'node_modules'` is `NODE_MODULES` from `config/repository/tracked.ts`. `TypeScriptConfiguration` and `TypeScriptProject` go to `types/parsers/tsconfig.ts`.
- Size: medium

### PAR-023: npm client code and the `.gspot` tool project hide in "packages/contracts.ts"

- Where: `parsers/packages/contracts.ts:58-201`, `config/parsers/packages.ts:7-24`, `parsers/schema/public.ts` (`pythonToolProjectSchema`)
- Kind: rename
- Problem: `isYarnBerry`, `getPackageInstallerMajor`, `parsePackageInstaller`, `declaredPackageInstaller`, `parseToolProject`, `packageLockfile`, `toolProjectSchema`, `NPM_TOOL_PROJECT`, `YARN_BERRY_MAJOR`, and `NEXT_ESLINT_PLUGIN` share one file with the dependency-file schemas and the TypeScript compiler host. Nothing in the file name says so. Their callers are `tools/npm/*.ts` and `generation/public.ts`, and `generation` may not import `tools`, so they stay in a lower layer.
- Fix: Split them out of `parsers/packages/contracts.ts` into two files:
    - `parsers/npm-client.ts`: the name, version, and Yarn Berry test of npm, Bun, pnpm, and Yarn: `parseNpmClient`, `declaredNpmClient`, `npmClientMajor`, `npmClientVersion`, `parseNpmClientField`, `isYarnBerry`, and the npm client schemas.
    - `parsers/tool-project.ts`: the `.gspot` package.json and its lockfile: `parseToolProject`, `toolProjectSchema` (not exported; tests call `parseToolProject`), `toolDependencyVersion`, and `toolProjectLockfile` (renamed from `packageLockfile`, PAR-050).

    The constants go to `config/parsers/dependency-files.ts`. The check of the tool project name goes (INX-010). Delete `pythonToolProjectSchema`: gspot reads the pyproject.toml it wrote itself, and its shape is a plain type in `types/tools/project.ts`.

- Size: medium

### PAR-024: Two schemas describe the same "rule names" file shape

- Where: `parsers/schema/public.ts:256-262` (`eslintRuleNamesSchema`), `parsers/schema/stylelint.ts:5-11` (`stylelintRuleNamesSchema`), `config/parsers/stylelint.ts`
- Kind: merge
- Problem: Both are `{ package, version, source, rules: string[] }` with two literal values.
- Fix: One `ruleNamesFileSchema = z.strictObject({ package: z.string(), version: z.string().min(1), source: z.string(), rules: z.array(z.string().min(1)) })` in `generation/eslint/presets.ts`, read for the ESLint and the Stylelint file; its type `RuleNamesFile` is in `types/generation/eslint.ts`. Callers compare `package` and `source` when they need to. The Stylelint package name `STYLELINT_RULE_NAMES_MODULE` is then used only by the rule-list script and moves to `scripts/config/rule-lists.ts`.
- Size: small

### PAR-025: Knip's 17 issue categories are listed twice

- Where: `parsers/schema/contracts.ts:130-154`, `config/parsers/output.ts:20-39`
- Kind: merge
- Problem: The schema lists each category by hand, and `KNIP_ISSUE_MESSAGES` lists the same 17 keys again.
- Fix: The 17 category keys are one `as const` list in `config/parsers/output.ts`; `KNIP_ISSUE_MESSAGES` is keyed by it, and `KnipReport` (written by hand in `types/parsers/output.ts`) takes its keys from it (type rule). The schema in `parsers/output/knip.ts` is a written object shape, `z.object({ ... } satisfies SchemaShape<KnipReport>)` (arrays of `knipSymbolSchema`, nested arrays for `cycles` and `duplicates`), so a missing or extra category fails to compile; it is not built from the message keys at run time.
- Size: small

### PAR-026: "Is this a valid regular expression" is written twice, with two messages

- Where: `parsers/schema/public.ts:50-60` (`suppressionPattern`), `parsers/schema/contracts.ts:183-192` (`settingValidationSchema.pattern`), `parsers/schema/configurations.ts:154,228`
- Kind: merge
- Problem: Two copies of the same check, with the messages "Expected a valid Unicode regular expression." and "Use a valid Unicode regular expression.". `detectionSchema` borrows one through `settingValidationSchema.shape.pattern.unwrap()`. `checkFields.crash_pattern` has no check at all, while `toolSchema.crash_pattern` does.
- Fix: One exported `regexSchema` (from `suppressionPattern`) with one message, in `configurations/schema/parts.ts`. Use it for `suppression`, `crash_pattern` on `[[tool]]` and `[[check]]`, `diagnostic_header_pattern`, and `detect.content`. `settingValidationSchema` goes with the `[[setting]]` tables (S09-012).
- Size: small

### PAR-027: `percentageSchema` has a false comment and one user

- Where: `parsers/schema/primitives.ts`, `parsers/schema/duplication.ts:2,11`
- Kind: delete
- Problem: The comment says it is "shared by native reports and repository policy". Only the jscpd report schema uses it.
- Fix: Inline it into `cloneReportSchema` in `checks/general/duplication.ts` and delete `primitives.ts`.
- Size: small

### PAR-028: Command-check fields are declared twice with copied text

- Where: `parsers/schema/configurations.ts:120-180` (`checkFields`), `policy/schema/public.ts:43-81` (`checkSchema`)
- Kind: merge
- Problem: The manifest `[[check]]` fields and the gspot.toml command-check fields repeat each other, and the `needs` enum `['build', 'docker', 'network']` and the `ignore_file` description are copied word for word (`configurations.ts:155-158,167-171`, `policy/schema/public.ts:50-54,70-74`).
- Fix: Declare the shared fields once, as `commandCheckFields` in `configurations/schema/parts.ts`, and spread them into the manifest `checkFields` and the gspot.toml `commandCheckSchema` (today `checkSchema`, a near twin of the manifest `checkSchema`). The shared fields are `command`, `stage`, `summary`, `help`, `fix`, `exit_codes`, and `output`. `needs`, `operating_systems` (renamed from `platforms`, NMU-007), `ignore_file`, and `crash_pattern` stay only in the manifest check schema, and gspot.toml command checks refuse them (TML-004). `finding_count_pattern` goes from both (PAR-005). The `needs` values are one `CHECK_NEEDS` list in `config/configurations.ts`.
- Size: small

### PAR-029: The `tool` field of a manifest check has a third shape for one check

- Where: `parsers/schema/configurations.ts:160-162,184-192`, readers `commands/doctor/contracts.ts:79`, `configurations/errors/contracts.ts:148,160`, `planning/public.ts:274`, `configurations/contracts.ts:167`
- Kind: simplify
- Problem: `tool` can be a string, a list, or a table. Across all manifests there are 39 strings, 9 lists, and 1 table (`general/licenses/manifest.toml`). Four places branch on `typeof check.tool === 'object'` for that one table. AGENTS.md forbids options for one caller.
- Fix: Drop the table form. Split the licenses check into one check per ecosystem (JavaScript, Python), each with a string `tool`, or let the built-in licenses check pick its tool. Delete the four `typeof ... 'object'` branches.
- Size: medium

### PAR-030: `replaces` means two things, and `[[tool]]` has two keys for one thing

- Where: `parsers/schema/configurations.ts:147` (check `replaces`), `parsers/schema/public.ts:166-191,202-203` (tool `replaces` and `replace`)
- Kind: rename
- Problem: In `[[check]]`, `replaces = "typescript/tsc"` means "run this check instead of that check" (3 uses). In `[[tool]]`, `replaces = [...]` means "replace these config files" (30 uses), and `[[tool.replace]]` rows do the same job (11 uses); a transform merges the two.
- Fix: Rename the check field to `instead_of`. In `[[tool]]`, accept only `replace`, where each entry is a file name or a row. Delete `replaces` and its transform.
- Size: medium

### PAR-031: CLI source ships code that only the rule-list script uses

- Where: `parsers/schema/public.ts:264-326` (`eslintRuleModuleSchema`, `eslintModuleSchema`, `eslintGlobalsSchema`, `captureEslintPreset`), `parsers/schema/stylelint.ts:13-24`, `config/parsers/stylelint.ts:2`, `types/parsers/stylelint.ts`
- Kind: move
- Problem: These read installed ESLint and Stylelint packages to refresh shipped data. Only `scripts/eslint-presets.ts` calls them, plus tests.
- Fix: Move `eslintRuleModuleSchema`, `eslintModuleSchema`, `eslintGlobalsSchema`, `captureEslintPreset`, `stylelintModuleSchema`, and `stylelintConfigSchema` into `scripts/update-rule-lists.ts` (the renamed `scripts/eslint-presets.ts`). `STYLELINT_RULE_NAMES_MODULE` goes to `scripts/config/rule-lists.ts` and `StylelintModule` to `scripts/types/rule-lists.ts`. `STYLELINT_RULE_NAMES_FILE` goes to `config/generation/tool-file-sources.ts`, because the CLI's Stylelint builder reads the same file; the script imports it from there. The tests that use these names go with the other tests of `scripts/`. Keep in the CLI only `eslintPresetsSchema` and `ruleNamesFileSchema` (PAR-024) in `generation/eslint/presets.ts`, and `eslintPresetSchema`, `eslintPresetBlockSchema`, and `eslintAllRulesSchema` in `configurations/schema/manifest.ts`.
- Size: small

### PAR-036: Six shapes for "a value or an error"

- Where: `types/parsers/json.ts:2` (`{data}|{error}`), `types/parsers/cloudflare.ts:4` (`{table, error}`), `types/parsers/sql.ts:20-22` (`{tree, error}`), `types/parsers/supabase.ts:11` (`{config}|{error}`), `types/parsers/sql.ts:39` (`error | undefined` field), `types/parsers/tool.ts:10` (`{version}|{state, note}`)
- Kind: merge
- Problem: The same idea has six spellings, so each caller learns a new shape.
- Fix: One `Parsed<T, E = string> = { value: T } | { error: E }` in `types/errors.ts` (the SQL error carries an offset, `{ text, offset }`, so the error type is a parameter). Use it for the JSON, Wrangler, SQL, and Supabase results (`JsonDocument`, `WranglerParse`, `SqlParse`, `SupabaseConfigurationRead` merge into it). Keep `ParsedToolVersion` as it is, in `types/tools/find.ts`: it has a third state.
- Size: small

### PAR-037: Three types for "a line and its number", with different field names

- Where: `types/parsers/source.ts:20` (`ProseLine {number, line}`), `types/parsers/bash.ts:20` (`CodeLine {number, code}`), `types/parsers/source.ts:29` (`NumberedLine {text, number}`)
- Kind: merge
- Problem: Same data, three names, three field spellings.
- Fix: Keep `NumberedLine = { number: number; text: string }` in `types/text.ts`. Change `proseLines`, `codeLines`, `contentLines`, and their callers to it.
- Size: small

### PAR-038: "Which line is this offset on" is computed five different ways

- Where: `parsers/public.ts:51,67`, `parsers/source/public.ts:136,145,173`, `parsers/sql/public.ts:49-53`
- Kind: merge
- Problem: `positionAt` in `sql/public.ts` already returns line and column. The other places repeat `text.slice(0, at).split('\n').length`.
- Fix: Move `positionAt` to `src/text.ts`; it returns `TextPosition { line, column }`, a plain type in `types/text.ts` beside `NumberedLine`. Call it in the four other places that compute one position (`parsers/public.ts:51,67`, `parsers/source/public.ts:145,173`). `parsers/source/public.ts:136` counts lines while it walks tokens and stays.
- Size: small

### PAR-039: Small helpers repeated with the same names and meanings

- Where: `parsers/source/public.ts:92` and `parsers/tool/contracts.ts:22` (`quotedEnd`); `parsers/source/public.ts:52` and `parsers/tool/contracts.ts:59` (`commentAt`, two different meanings); `parsers/bash/public.ts:55` and `parsers/source/public.ts:152` (blank out text but keep offsets)
- Kind: merge
- Problem: Two `quotedEnd` functions do the same scan and return different ends. Two `commentAt` functions return different things. The line that replaces every character except line breaks with spaces is copied.
- Fix: One `blankOut(text)` helper, used by `maskComments` and `markdownHtml`, with its pattern `NOT_LINE_BREAK` in `config/text.ts`. Rename the nginx `commentAt` to `nginxComment`. Keep one `quotedEnd`, the one in `parsers/comments.ts`, and export it for the nginx check: it returns the index past the quote, so `scanAt` drops its `+1`.
- Size: small

### PAR-040: Six JSON-reading wrappers

- Where: `parsers/public.ts:86-94` (`readSharedJson`), `:243-253` (`parseJsonDocument`), `:260-264` (`parseJsonRecord`), `:300-309` (`parseJsonc`), `parsers/tool/contracts.ts:89-95` (inside `parseToolFile`), `parsers/packages/public.ts:210-219` (`parsePackageManifest`)
- Kind: merge
- Problem: Each wraps `JSON.parse` or `jsonc-parser` with its own error text and its own rule for "must be an object".
- Fix: One `readJson(path, text, schema?)` in `parsers/json.ts`: `readSharedJson` becomes `readJson`, and `parseJsonRecord` and `parsePackageManifest` merge into it (callers give `packageJsonSchema`). It accepts comments for `.jsonc`, names the file in errors, and validates with the schema when given. `parseJsonc` and `openJsonFile` stay beside it, and `parseJsonc` reads `JSONC_OPTIONS` from `config/parsers/json.ts`. `parseJsonDocument` (used only by two Xcode checks) returns `Parsed<T>` (PAR-036). The JSON branch of `parseSharedFile` uses `readJson` (PAR-011). `path` is required, and errors are always wrapped with the file name: today `parsePackageManifest` changes its error behavior when `path` is missing, so give the path at its three callers and in the two tests.
- Size: medium

### PAR-042: The uv.lock schema is called `lockfileSchema` and lives away from its reader

- Where: `parsers/schema/public.ts:227-241`, `types/tools/python.ts`
- Kind: rename
- Problem: The name says "any lockfile", but the shape is uv.lock. Its only users are `tools/python/contracts.ts` and `types/tools/python.ts`.
- Fix: Rename it to `uvLockSchema` and move it to `tools/python/project.ts`, its only reader.
- Size: small

### PAR-044: pnpm lockfiles are parsed in two steps, and the second step throws when there are no dev dependencies

- Where: `parsers/contracts.ts:172-174`, `parsers/schema/lockfiles.ts:8-11`
- Kind: fix-bug
- Problem: `pnpmLockfileSchema` reads `devDependencies` as `unknown`, then `pnpmSpecifiersSchema.parse(pinned)` runs. When `devDependencies` is absent, `parse(undefined)` throws. npm and Bun return `{}` in the same case. Low impact today, because the tool project always has dev dependencies.
- Fix: One schema in `tools/npm/lockfiles.ts`: `pnpmLockfileSchema` with `importers: z.record(z.string(), z.object({ devDependencies: z.record(z.string(), z.object({ specifier: z.string() })).optional() }))`. Return `{}` when `devDependencies` is missing, like npm and Bun. Delete `pnpmSpecifiersSchema`.
- Size: small

### PAR-045: SQL identifier positions come from a plain text search and can point at the wrong place

- Where: `parsers/naming/public.ts:42-62`
- Kind: fix-bug
- Problem: The extractor finds each name with `parsed.source.indexOf(name, offset)` from the start of the statement. In lowercase SQL, a short name matches inside a keyword. Example: `create table c (\n  a int\n)` finds `c` and `a` inside `create`, so the column finding points at line 1 instead of line 2.
- Fix: In `statementIdentifiers` (`checks/general/naming/sql.ts`, PAR-013), use the `location` fields that libpg-query gives on `RangeVar`, `ColumnDef`, and the other nodes that have one. Fall back to the text search only for nodes with no location, and start that search after the keyword.
- Size: small

### PAR-046: Bash code blocks in Markdown start a `bash -n` process; the other languages use tree-sitter

- Where: `parsers/public.ts:175-185,194-226`, `config/parsers/markdown.ts:40-41`, `types/parsers/markdown.ts:13-16`, `checks/language/markdown.ts:18-23`
- Kind: simplify
- Problem: gspot already parses Bash with tree-sitter, and TypeScript, TSX, JavaScript, and Python fences use the tree-sitter syntax check. To keep processes out of the parser, the Bash path adds `parseBashSyntaxResult`, `BASH_ERROR_LINE`, the `FenceSyntaxReader` type, and a `checkBash` parameter that the check must give.
- Fix: Use `treeSyntaxError('bash', body, context)` for Bash too, in the Markdown check (`checks/language/markdown.ts`, PAR-066). Delete `parseBashSyntaxResult`, `BASH_ERROR_LINE`, `FenceSyntaxReader`, the `checkBash` parameter, and its callback. Check first that tree-sitter flags the Bash errors the existing tests expect; if it misses important ones, keep `bash -n` but run it inside the check.
- Size: small

### PAR-047: `codeFences` and the `meta` field exist for a docs-content test

- Where: `parsers/public.ts:101-113`, `types/parsers/markdown.ts:5`, `tests/cli/docs.test.ts`
- Kind: delete
- Problem: Production reads only `line`, `language`, and `body` of a fence. `meta` and the export of `codeFences` serve only a test that keeps the quickstart page equal to `docs/src/config/example.json`. That test polices the docs, not the code, but deleting it alone lets the page drift from the recorded example that `tests/tools/commands/example.test.ts` replays through the real CLI.
- Fix: Remove the hand copy first: the JavaScript-and-TypeScript quickstart page builds its code blocks from `docs/src/config/example.json` (DCX-013), as `docs/src/components/home/Hero.astro` already reads it. Then delete `tests/cli/docs.test.ts`, move `codeFences` into the Markdown check (`checks/language/markdown.ts`) without exporting it, and drop `meta`. Do after DCX-013.
- Size: small

### PAR-048: Exports that nobody outside the file uses

- Where: `parsers/source/contracts.ts:244` (`getPythonFunctions`), `parsers/toml/public.ts:96` (`patchToml`), `parsers/toml/contracts.ts:103` (`tomlCommentOwner`), `parsers/schema/contracts.ts:120` (`knipSymbolSchema`), `parsers/schema/public.ts:268` (`eslintPresetBlockSchema`), `parsers/schema/licenses.ts:17` (`licenseExceptionSchema`), `types/parsers/{bash,toml,xcode,supabase}.ts` (`FunctionCall`, `TomlComment`, `TomlCommentBlock`, `ProjectRoot`, `SupabaseConfiguration`)
- Kind: simplify
- Problem: They are exported but used only in their own file. That makes the public surface look bigger than it is.
- Fix: Remove the `export` keyword from `pythonFunctions` (renamed from `getPythonFunctions`, NMS-016), `patchToml`, `tomlCommentAnchor` (renamed from `tomlCommentOwner`: "owner" is filler outside the ownership log), `knipSymbolSchema`, `eslintPresetBlockSchema`, and `allowedPackageSchema` (renamed from `licenseExceptionSchema`, PAR-010). The five types are used only by other types in their own `types/` file; stop exporting them too. The other unused exports go with their code: `getKind` (PAR-050), `settingFieldSchema` and `settingFieldsSchema` (S09-012), and `packageIdentitySchema` (TML-009).
- Size: small

### PAR-050: Guards for states the libraries never produce

- Where: `parsers/source/public.ts:46-50` (`parseTree` null), `parsers/source/public.ts:158`, `parsers/public.ts:163` (missing Markdown positions), `parsers/toml/contracts.ts:43,167-171,223-226` (non-value array item, unknown node kind, missing range), `config/parsers/toml.ts:8-29` (`NODE_KINDS`, `NODE_KIND_SET`, `VALUE_KINDS`), `types/parsers/toml.ts:12,15`, `parsers/packages/contracts.ts:198-201`
- Kind: simplify
- Problem: Each throws for a case the library or a static table rules out. `getKind` checks every TOML node against a hand-copied list of 16 node kinds before it compares a string. `packageLockfile` throws if a static table lacks an entry that its type already guarantees: `LOCKFILES` has a `toolProject` row for all four of npm, Bun, pnpm, and Yarn.
- Fix: Compare `String(node.type) === 'KeyValue'` (and so on) directly; delete `getKind`, `NODE_KINDS`, `NODE_KIND_SET`, `Kinded`, and `NodeKind`. `isValue` tests `node.type` against `VALUE_KINDS`, which stays in `config/parsers/toml.ts`. Make `packageLockfile` a typed lookup with no throw, renamed `toolProjectLockfile` (PAR-023). Keep the one-line guards where the library's own type marks the value optional (tree-sitter `parse()` returns `Tree | null`; Markdown positions and TOML ranges are optional in their types): removing them needs a non-null assertion, and `@typescript-eslint/no-non-null-assertion` is an error in `.gspot/config/eslint.config.mjs`.
- Size: small

### PAR-051: TOML comments are read by a regex here and by a real TOML parser there

- Where: `parsers/source/public.ts:166-176` (`tomlComments`), `config/parsers/comments.ts:6-7` (`TOML_TOKENS`), `config/parsers/toml.ts:1-3` (`TOML_STRINGS`), `parsers/toml/contracts.ts:61-95`
- Kind: simplify
- Problem: Suppression discovery reads TOML comments with a hand-written regex. The TOML editor already gets every comment with its line from `@decimalturn/toml-patch`. `TOML_STRINGS` and `TOML_TOKENS` have one user each.
- Fix: `tomlComments` (`parsers/comments.ts`) reads comments from `parseDocument(text)`, walking tables and inline arrays. Delete `TOML_TOKENS` and `TOML_STRINGS`.
- Size: small

### PAR-053: Two `no-misused-spread` suppressions can become one

- Where: `parsers/output/contracts.ts:79-80`, `parsers/sql/public.ts:30-31`
- Kind: merge
- Problem: Both spread a string to count Unicode code points, and each carries its own suppression. `Array.from(text)` is no way out: it trips `unicorn/prefer-spread`, which is also an error in `.gspot/config/eslint.config.mjs`, so the two enabled rules disagree about this code.
- Fix: Put the count in one helper, `codePointLength(text)`, in `src/text.ts` beside `positionAt` (PAR-038), with the one suppression and its reason, and use it in both places.
- Size: small

### PAR-055: Comments full of jargon

- Where: the whole part; for example `parsers/source/public.ts:233,294`, `parsers/packages/contracts.ts:286-291`, `parsers/contracts.ts:105-107,116-120`, `parsers/output/public.ts:140`, `parsers/toml/contracts.ts:149`, `parsers/schema/public.ts:264`, `parsers/schema/stylelint.ts:13`, `parsers/schema/configurations.ts:325`, `types/parsers/bash.ts:25`
- Kind: rewrite-text
- Problem: Comments lean on filler words: "native" (98 comment lines in this part), "authored" (48), "owner" (28), "observation" (14), "boundary" (13). Examples: "Lend selected observations until a standalone handle or their run owner is disposed." "Read native compiler inputs through the authored root or its installed dependency boundary." "The installed public export read only by the explicit copy producer."
- Fix: Rewrite each comment in plain words, or delete it when the name already says it. Examples: "Parse once per run and give each caller its own copy of the tree." "Read a file for the TypeScript compiler, following links into node_modules." "The shape of ESLint's module, read by scripts/update-rule-lists.ts."
- Size: medium

### PAR-057: The file header comments of `parsers/public.ts` and `parsers/contracts.ts` are wrong or mixed

- Where: `parsers/public.ts:1`, `parsers/contracts.ts:1-2`
- Kind: rewrite-text
- Problem: `parsers/public.ts` says it is about Markdown, but it also edits JSON and detects generated headers. `parsers/contracts.ts` describes two unrelated topics.
- Fix: Splitting the files (PAR-007) fixes this. Give each new file a one-line header for its one topic.
- Size: small

### PAR-059: Xcode project reading repeats itself

- Where: `parsers/tool/public.ts:106-112` (`readProject`), `:154-158` (`readPbxproj`), `:182-192` (`testTargets`)
- Kind: simplify
- Problem: `readPbxproj` parses and checks the root object itself instead of calling `readProject`. `testTargets` looks up objects inline, with its own error text, instead of calling `projectItem`.
- Fix: In `parsers/xcode.ts`, make `readPbxproj` call `readProject` and add the main-group check. Use `projectItem` in `testTargets`. Rename `readPbxproj` to `parsePbxproj`: it reads no file.
- Size: small

### PAR-060: Two output formats share a copied function

- Where: `parsers/output/public.ts:209-211,217-219`
- Kind: merge
- Problem: The `namesFiles` functions of the `regex` and `grouped` rows are identical.
- Fix: Declare `const patternNamesFiles = (output) => ...` once and use it in both rows of `outputFormats`.
- Size: small

### PAR-061: The default output format is applied in five places

- Where: `parsers/output/public.ts:236`, `execution/command/contracts.ts:107,129,150,214`, `config/parsers/output.ts:15`
- Kind: simplify
- Problem: Every reader writes `check.output ?? DEFAULT_OUTPUT_FORMAT`. `parseRegex` then applies `DEFAULT_PATTERN` again, although `DEFAULT_OUTPUT_FORMAT` already contains it.
- Fix: Fill in the default once, with `.default()` on `output` in `outputSchema`, from `DEFAULT_OUTPUT_FORMAT` (written `as const`, with no type annotation, in `config/parsers/output.ts`). Make `output` required on the check type and delete the five `??` fallbacks and the second `DEFAULT_PATTERN` in `parseRegex`.
- Size: small

### PAR-063: "Manifest" means three different files

- Where: `repository/contracts.ts` (`readPackageManifests`, `readPackageManifest`), `parsers/schema/configurations.ts:242` (`manifestSchema`, gspot's `manifest.toml`), `parsers/packages/contracts.ts:115,121` (`pythonManifestSchema`, `packageManifestSchema`), `types/parsers/packages.ts:31-40` (`PackageManifest`, `ManifestParser`), `parsers/packages/public.ts:226` (`manifestParser`), `checks/general/licenses.ts:98-121` (`manifest` field), `config/checks/general/dependencies.ts:18` (`NPM_MANIFEST`)
- Kind: rename
- Problem: The same word names gspot's configuration manifest, package.json, and any dependency file (package.json, pyproject.toml, Pipfile, requirements.txt, Package.swift). In `licenses.ts`, both meanings appear within a few lines.
- Fix: Keep "manifest" only for gspot's `manifest.toml`; the others are dependency files. In `parsers/dependency-files.ts`, rename `PackageManifest` to `DependencyFile`, `ManifestParser` to `DependencyFileParser`, `manifestParser` to `dependencyFileParser`, `packageManifestSchema` to `packageJsonSchema`, `pythonManifestSchema` to `pyprojectSchema` (type `Pyproject`), and `parsePackageSummary` to `parsePackageJson`. `readPackageManifests` becomes `readDependencyFiles` and `readPackageManifest` becomes `readPackageJson` (both in `repository/dependency-files.ts`); the two readers differ by one letter today. In the checks, the `manifest` field of the licenses check (a package.json or pyproject.toml path) becomes `dependencyFile`, and `NPM_MANIFEST` becomes `PACKAGE_JSON` in `config/parsers/dependency-files.ts`.
- Size: medium

### PAR-064: "Header" means four things; `parseHeader` and `parseHeaders` are unrelated

- Where: `parsers/tool/contracts.ts:118` (`parseHeader`, an INI section line), `parsers/tool/public.ts:231` (`parseHeaders`, Cloudflare `_headers` file), `parsers/contracts.ts:46` (`readHeader`, Git blob line), `parsers/public.ts:316` (`hasHeader`, generated header)
- Kind: rename
- Problem: Two functions one letter apart do unrelated jobs, and two more use the same word for other things.
- Fix: `parseHeader` goes with PAR-018. Rename `parseHeaders` to `parseHeadersFile` and `readHeader` to `readBlobLine`; `hasHeader` becomes `hasGeneratedHeader` with EXG-048.
- Size: small

### PAR-065: "Document" means a parse result in one place and an editable file in another

- Where: `types/parsers/json.ts:2` (`JsonDocument`), `types/parsers/document.ts:8` (`ConfigurationDocument`), `parsers/public.ts:243,272` (`parseJsonDocument` returns `JsonDocument`; `openJsonDocument` returns `ConfigurationDocument`)
- Kind: rename
- Problem: Two functions with almost the same name return unrelated things.
- Fix: Delete `JsonDocument` (use `Parsed<T>`, PAR-036). Rename `ConfigurationDocument` to `EditableFile` in `types/parsers/editable-file.ts` (with `KeyPath`), `openJsonDocument` to `openJsonFile`, and `openTomlDocument` to `openTomlFile`.
- Size: small

### PAR-066: "Finding" is used for parser-level results, not only for gspot findings

- Where: `types/parsers/markdown.ts:11` (`FenceSyntaxFinding`), `types/parsers/nextjs.ts:2` (`NextSettingsFinding`), `types/parsers/cloudflare.ts:10` (`HeaderBlocks.findings`), `parsers/tool/public.ts:266` (`redirectFindings`), `parsers/public.ts:43-83` (`find...SyntaxFinding`)
- Kind: rename
- Problem: `Finding` is gspot's report row. These are intermediate results with other shapes.
- Fix: Rename `FenceSyntaxFinding` to `FenceSyntaxError` (in `types/checks/language.ts`), the `find*SyntaxFinding` functions to `jsonSyntaxError`, `tomlSyntaxError`, `yamlSyntaxError`, and `treeSyntaxError`, and `findFenceSyntaxFindings` to `fenceSyntaxErrors`; they move into the Markdown check (`checks/language/markdown.ts`). Delete `NextSettingsFinding`: the Cloudflare and Next.js readers move into their checks (PAR-011) and return real `Finding` values there.
- Size: small

### PAR-067: The `stringList` name means two different schemas

- Where: `parsers/packages/contracts.ts:30` (`z.array(z.string())`), `parsers/schema/configurations.ts:25` (`z.array(z.string()).default([])`)
- Kind: rename
- Problem: The same local name in two files has a different default.
- Fix: Rename the one with a default to `optionalStringList` (in `configurations/schema/manifest.ts`). The other stays `stringList` in `parsers/dependency-files.ts`.
- Size: small

### PAR-068: `resultSchema` names two different things

- Where: `parsers/schema/contracts.ts:70` (a gspot check result), `parsers/output/structured/contracts.ts:9` (one SARIF result)
- Kind: rename
- Problem: Same name, two meanings.
- Fix: The first goes with PAR-006. Rename the SARIF one to `sarifResultSchema` in `parsers/output/sarif.ts`.
- Size: small

### PAR-069: Misplaced comment in `parseVersionOutput`

- Where: `parsers/tool/contracts.ts:141,233-234`
- Kind: rewrite-text
- Problem: "A shim with no selected version starts nothing ..." sits above the line that prefers the installed npm package version. It describes the `NO_VERSION` test on line 141.
- Fix: When `parseVersionOutput` moves to `tools/versions.ts` (PAR-011), put the comment above the `NO_VERSION` test. Above the npm line write: "An npm tool reports the version its package declares."
- Size: small

### PAR-070: `attributeRules` invents an empty attribute for a pattern with no attributes

- Where: `parsers/attributes.ts:25,40-43`
- Kind: fix-bug
- Problem: For a line with only a pattern, `''.split(/\s+/u)` gives `['']`, and `attributesFor` then sets an attribute named `''`.
- Fix: Write `.split(/\s+/u).filter(Boolean)` in `attributeRules` (`parsers/git.ts`).
- Size: small

### PAR-071: Single-use fields in the manifest schema

- Where: `parsers/schema/configurations.ts:143` (`path_prefix`, markdown only), `:152` (`limit`, structure only), `:163` (`min_versions`, bash only), `:167` (`ignore_file`, format only), `:172` (`nested_config_file`, swift only), `:248` (`compiler_options`, nestjs only), `:255` (`ignored`, prose only), `:285` (`entry`, javascript only), `:304` (`basedpyright_options`, python only)
- Kind: simplify
- Problem: Each field serves one configuration. AGENTS.md says not to add options for one caller.
- Fix: For each field, move the value into the one built-in check or tool file source that needs it, or fold it into an existing general field. Decide field by field; start with `path_prefix`, `nested_config_file`, and `limit`, which look easiest to inline.
- Size: medium

### PAR-072: `parsers/schema/python/` is a deep folder of tiny one-use files

- Where: `parsers/schema/python/{dependencies,docstrings,imports}.ts`, `types/parsers/python.ts:24`
- Kind: move
- Problem: Three files of 5 to 21 lines, each read by one check (`checks/language/python/deptry.ts`, `checks/language/public.ts`, `checks/language/python/imports.ts`). pyproject.toml is described by six schemas in four files.
- Fix: Move each schema into its check: `deptrySchema` to `checks/language/python/deptry.ts`, `docstringStyleSchema` to `checks/language/python/pydoclint.ts`, and `importLinterSchema` to `checks/language/python/import-linter.ts`. Delete the folder. `PythonDocstringStyle` goes to `types/checks/language.ts`.
- Size: small

### PAR-073: Trivial schemas in files of their own

- Where: `parsers/schema/svelte.ts:3` (`svelteFailureSchema = z.string()`), `parsers/schema/yarn.ts` (three Yarn settings schemas)
- Kind: move
- Problem: A named export and a separate file for `z.string()` adds nothing. The three Yarn settings schemas have one reader, `yarnSettings` in `tools/npm/yarn.ts`, yet sit in `parsers/schema/`.
- Fix: Write `z.string()` inline in `svelteFindings`, move `diagnosticSchema` into `checks/framework/svelte.ts`, and delete `schema/svelte.ts`. Move the three Yarn schemas into `tools/npm/yarn.ts`, beside `yarnSettings`, and delete `schema/yarn.ts`.
- Size: small

### PAR-074: Constants filed under parsers that parsers never use

- Where: `config/parsers/toml.ts:5,35-38` (`BARE_KEY`, `TOOL_EMIT_FORMAT`), `config/parsers/docker.ts:4` (`DOCKERFILE_NAME`), `config/parsers/git.ts:24-26` (`CONFLICT_MARKER_PREFIX`, `CONFLICT_MARKERS`)
- Kind: move
- Problem: Only generation, one check, the apply code, and tools use them: `generation/mise.ts` (`BARE_KEY`), `generation/compilation/public.ts` and `generation/contracts.ts` (`TOOL_EMIT_FORMAT`), `checks/tool/docker.ts` (`DOCKERFILE_NAME`), `tools/npm/lockfiles.ts` (`CONFLICT_MARKER_PREFIX`), `lifecycle/public.ts` (`CONFLICT_MARKERS`).
- Fix: Move `TOOL_EMIT_FORMAT` to `config/generation/tool-file-sources.ts`, `DOCKERFILE_NAME` to `config/repository/inventory.ts`, and `CONFLICT_MARKERS` to `config/apply.ts`, with `CONFLICT_MARKER_SOURCE` written into it. `BARE_KEY` goes, because the mise file is written with the TOML library, which quotes keys itself (EXG-062). `CONFLICT_MARKER_PREFIX` goes, because a lockfile with conflict markers already fails to parse (LIF-034).
- Size: small

### PAR-075: `typescriptImports` lives in the parser layer for one generator

- Where: `parsers/source/contracts.ts:284-305`, `types/parsers/typescript.ts`
- Kind: move
- Problem: Only `generation/fragments.ts` uses it.
- Fix: Move the function into `generation/fragments.ts` and its type `TypescriptImports` to `types/generation/fragments.ts`. Delete `types/parsers/typescript.ts`. Update the import in `tests/cli/generation/eslint/fragments.test.ts`.
- Size: small

### PAR-077: The "fixable" rule for regex output hides in a side effect of `message`

- Where: `parsers/output/public.ts:54-58` (`isFixable`), caller `:73` (`regexFinding`)
- Kind: simplify
- Problem: Without a `fixable` pattern, a finding counts as fixable when the manifest sets a fixed `message`. The comment "A fixed message describes files the tool marks for formatting." does not say that. The rule sits in `isFixable`, a two-line helper with one caller.
- Fix: Inline `isFixable` into `regexFinding` (`parsers/output/text.ts`) as `fixable: fixable?.test(line) ?? output.message !== undefined`, with this comment above it: "Formatters list only the files they would change, so a fixed message means the finding can be fixed."
- Size: small

### PAR-078: `nextArguments` keeps its own list of npm clients

- Where: `parsers/bash/contracts.ts:46-48`, `parsers/packages/contracts.ts:87`
- Kind: merge
- Problem: `['npm', 'pnpm', 'yarn', 'bun']` repeats the list in `packageInstallerIdentitySchema`.
- Fix: Both read `NPM_CLIENTS` from `config/parsers/dependency-files.ts`. `nextArguments` moves to `checks/framework/nextjs.ts` (PAR-021).
- Size: small

### PAR-079: `ParseReads` is named after one of its two fields and given as `context`

- Where: `types/parsers/source.ts:6`, `parsers/source/public.ts:240`, `parsers/public.ts:73,197`, `types/parsers/bash.ts:46`
- Kind: rename
- Problem: The type is a read cache plus a cleanup stack, but callers name the parameter `context` and the type says "reads".
- Fix: Rename the type to `ParseCache` (in `types/parsers/tree-sitter.ts`) and the parameter to `cache`.
- Size: small

### PAR-080: The `Identifier.kind` field is a display label

- Where: `types/parsers/naming.ts:20-21`, `parsers/naming/contracts.ts:16`
- Kind: rename
- Problem: `kind` holds text like "typescript function"; its comment calls it "The label a finding prints". "kind" names many other things in this code.
- Fix: Rename the field to `label`.
- Size: small

### PAR-081: The `visitParsed` cache has two modes and three nested maps

- Where: `parsers/source/public.ts:25-27,293-343`
- Kind: simplify
- Problem: It caches by reader function, then by cleanup stack, then by file list, with a separate path when no stack is given (tests and standalone use). It needs an `as Value` cast and is hard to follow.
- Fix: Key one `Map` on `JSON.stringify([readerName, root, paths])`, held inside the run's `ReadCache`, and give it the cleanup stack. Standalone callers create a `DisposableStack`, so there is one path. Delete `PARSED_MEMO` and `ParsedVisit`.
- Size: medium

### PAR-082: The Swift package dependency reader is a regex over the whole file

- Where: `parsers/packages/public.ts:159-172`, `config/parsers/packages.ts:5`
- Kind: fix-bug
- Problem: `url:\s*"..."` also matches a commented-out `// .package(url: "...")` line, which becomes a dependency.
- Fix: In `parseSwiftPackage` (`parsers/dependency-files.ts`), parse `Package.swift` with the Swift tree-sitter grammar gspot already ships, and read `url:` arguments only from call expressions. Or strip `//` comments with `parseComments` first.
- Size: small

### PAR-083: The nginx tokenizer needs three files

- Where: `parsers/tool/contracts.ts:21-85,149-181`, `config/parsers/nginx.ts`, `types/parsers/nginx.ts`
- Kind: simplify
- Problem: A 110-line hand-written tokenizer is spread over three files for one check that only needs `include` directives (`checks/tool/public.ts:61`). No nginx parser is in the dependencies, so a library swap is not free.
- Fix: Move the tokenizer into `checks/infrastructure/nginx.ts`, its five constants to `config/checks/infrastructure/nginx.ts`, and `DirectiveScan` to `types/checks/infrastructure.ts`. Keep the code.
- Size: small

### PAR-084: `openTomlDocument` re-parses its own output to check the library

- Where: `parsers/toml/public.ts:66-71`, `parsers/public.ts:281-283`
- Kind: simplify
- Problem: After every TOML edit, gspot parses the new text and compares it with the intended values. The JSON editor re-parses after every `set`. These check `@decimalturn/toml-patch` and `jsonc-parser`, not user input.
- Fix: Delete the TOML round-trip check; POL-002 shows that its result is not used anyway. Keep the JSON re-parse, which also refreshes `document`, but drop the `try` wrapper text that blames the user's field.
- Size: small

### PAR-085: Lockfile code shares a file with Git, and `parseLockfile` picks a parser every caller already knows

- Where: `parsers/contracts.ts:140-184` (`parseLockfile`, `rootLockfileDependencies`, `lockfileEntry`), `parsers/schema/lockfiles.ts`, `types/parsers/lockfiles.ts:22` (`LockfileName`), `config/parsers/lockfiles.ts` (field `parsed`), callers `tools/npm/lockfiles.ts:16,81,91,106,116` and `parsers/contracts.ts:167,168,172`
- Kind: move
- Problem: The lockfile functions share a file with the Git stream parser. `parseLockfile(filename, text)` picks a parser by file name, but every one of its eight calls gives a fixed string: `'yarn.lock'` and `'bun.lock'` three times each, `'package-lock.json'` and `'pnpm-lock.yaml'` once each. It adds a branch table, a TOML branch that nothing reaches, the type `LockfileName`, and the `LOCKFILES` field `parsed`, which exists only to build that type.
- Fix: Delete `parseLockfile`, `LockfileName`, and the field `parsed`. Each call uses its format parser directly: `parseSyml` for `yarn.lock`, `parseJsonc` for `bun.lock`, `JSON.parse` for `package-lock.json`, and `parseYaml` for `pnpm-lock.yaml`. Move `rootLockfileDependencies` (one production caller) and the npm, Bun, pnpm, and Yarn lockfile schemas to `tools/npm/lockfiles.ts`. Move `lockfileEntry`, a one-line `find` with six callers in four folders, to `parsers/lockfiles.ts`. Keep `LOCKFILES` in `config/parsers/lockfiles.ts`, where the parser layer can read it: it drives copies, stale checks, document generation, and tool projects (seven files import it), so rewrite its first comment to say so: "Every lockfile gspot knows, which package manager writes it, and how to tell whether it is stale." `client` keeps its name, the code name for npm, Bun, pnpm, and Yarn.
- Size: small

### S07-002: The pnpm, Lerna, and Rush workspace schemas check a value nobody reads

- Where: `parsers/schema/repository.ts` (`workspacePatternsSchema`, `rushProjectsSchema`); caller `repository/paths/contracts.ts:20-46` (`workspacePackages`)
- Kind: delete
- Problem: `workspacePackages` runs `schema.parse(parse(source))` and drops the result (`repository/paths/contracts.ts:45-46`). Then `@manypkg/tools` reads and parses the same file again and returns the packages: `pnpm-workspace.yaml` with the same `yaml` library, `lerna.json` with `JSON.parse` and its own `packages/*` default, and `rush.json` with `jju`. The two `.transform` steps and the `packages/*` default never reach anyone. For pnpm and Lerna, `isMonorepoRootSync` runs before gspot's parse and rethrows every error except ENOENT, so the parse errors the tests see already come from manypkg.
- Fix: Delete both schemas, the `parse` and `schema` fields of the `declarations` list, and the `readText` call. The loop becomes `if (!tool.isMonorepoRootSync(root)) continue; return tool.getPackagesSync(root).packages;`. A broken file still stops discovery. Only the Rush message changes (from jsonc-parser's text to jju's), so the Rush row of `INVALID_WORKSPACE_CASES` takes the new text.
- Size: small

### S07-003: `compiled` only forwards to `new RegExp`

- Where: `parsers/output/public.ts:30-32`; calls at `:82`, `:97`, `:98`
- Kind: simplify
- Problem: `compiled(source, standard)` is `new RegExp(source ?? standard, 'u')`. The name hides a one-line call.
- Fix: Delete it. Each call writes `new RegExp(output.pattern ?? DEFAULT_PATTERN, 'u')` (and the file and grouped defaults) directly in `parsers/output/text.ts`. Where PAR-061 fills a default in the schema, the `??` goes too.
- Size: small

### S07-005: Two version constants sit in a folder whose code leaves

- Where: `config/parsers/tool/version.ts:2` (`NO_VERSION`), `:5` (`VERSION_FLOOR`); users `parsers/tool/contracts.ts:141` (`versionFailure`), `parsers/schema/public.ts:80`
- Kind: move
- Problem: Their users leave `parsers/`: `versionFailure` goes to `tools/versions.ts` (PAR-011), and `versionFloorSchema` to `configurations/schema/parts.ts` (PAR-009). Static values stay in `config/`, so the constants need their own new place.
- Fix: Move `NO_VERSION` to `config/tools/run.ts`, beside `VERSION_FLAG`, and `VERSION_FLOOR` to `config/configurations.ts`. Then delete `config/parsers/tool/`: `format.ts` goes with the Prettier child (DEC-009), and the values of `tool-file.ts` become the case labels of one switch (PAR-011).
- Size: small

### S07-008: Enum lists that plain types need are written inside the schemas

- Where: `parsers/schema/contracts.ts:169` (`levelSchema`), `:175` (`runnerSchema`); `parsers/schema/command.ts:5` (`checkStageSchema`); `parsers/schema/configurations.ts:258` (the configuration `kind` enum); `parsers/schema/naming.ts` (`identifierCategory`); `parsers/schema/git.ts:5` (the Git modes); `parsers/schema/inventory.ts` (`fileKindSchema`)
- Kind: merge
- Problem: `types/` may not import a schema, but `types/configurations.ts:5` (the level), `types/repository/inventory.ts:7-8` (the runner and the file kind), and `types/execution/copy.ts:35` (the Git mode, through `GitEntry`) take their types from these schemas. Two of the lists are also written a second time in `config/`: the configuration group names are the keys of `CONFIGURATION_LABELS` (`config/configurations.ts:17-26`), and the Git modes are `GITLINK_MODE`, `SYMLINK_MODE`, and the mode table in `config/repository/revisions.ts:19-24`.
- Fix: One `as const` list in `config/` for each, and the schema is `z.enum(LIST)`: `LEVELS`, `STAGES`, and `GROUPS` in `config/configurations.ts` (NMU-009 names the groups and their labels); `NAME_CATEGORIES` in `config/checks/general/naming.ts` (`CATEGORY_LABELS` is keyed by it); `FILE_KINDS` in `config/repository/inventory.ts`; and `GIT_ENTRY_MODES` in `config/repository/revisions.ts`. Never `z.enum(Object.keys(...))`: under zod 4 it outputs `string`, and a literal-union type then fails its check. Each type in `types/` is `(typeof LIST)[number]`. `runnerSchema` and the runner type are deleted (INX-003). The tests' level loops use `LEVELS` (TGN-037).
- Size: small

### S08-002: Statement counting is check logic with one user, the trivial-functions check

- Where: `parsers/source/contracts.ts:19-107,122-162` (`isBashStatement`, `STATEMENT_COUNTS`, `isSubstantialFunction`, `isSubstantialAssignment`, `isNonReferenceAlias`, `SUBSTANCE`, `LANGUAGE_SUBSTANCE`, `isInert`, `isSubstantial`, `executableStatements`, `isTrivialFile`), `config/parsers/statements.ts`, `types/parsers/statements.ts`, `tests/cli/parsers/statements.test.ts`
- Kind: move
- Problem: These functions decide when a function or a file is "trivial": which nodes count as statements, and which assignments, aliases, and commands are "substantial". That is the rule of one check, not reading. Once PAR-002 removes the Bash parser's calls, the only production user is `checks/general/structure/trivial-functions.ts`; no other package imports them.
- Fix: Move statement counting into `checks/general/structure/trivial-functions.ts` and stop exporting `executableStatements` and `isTrivialFile`. With the counting code, `trivialText`, and `swiftFunctionName`, the check grows from 72 to about 230 lines, under the 300-line limit. Move `isDocstring` to `parsers/python.ts`, which also uses it. Move the six node sets to `config/checks/general/structure.ts` (renamed as S08-005 says). Move `CountedLanguage` and `IsSubstantial` to `types/checks/general.ts`, with `CountedLanguage = keyof typeof CONVENTION_QUERIES`; `CONVENTION_QUERIES` is written `as const`, so `config/checks/general/structure.ts` imports no type. `tests/cli/parsers/statements.test.ts` and its data move to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` and test through `trivialFunctions`.
- Size: small

### S08-003: `withoutDeclaration` is a one-caller line helper of the Bash script-layout check

- Where: `parsers/bash/public.ts:295-301`, `config/parsers/bash.ts:2` (`DECLARATION_WORDS`), caller `checks/language/bash/contract.ts:78`
- Kind: move
- Problem: The function removes `export`, `readonly`, `local`, `declare`, or `typeset` and their flags from one line of text. It parses nothing, has one caller (a check), and no test calls it.
- Fix: Move `withoutDeclaration` into `checks/language/bash/script-layout.ts` (not exported) and `DECLARATION_WORDS` into `config/checks/language/bash.ts`.
- Size: small

### S08-004: `getAttributes` is a pure lookup named like a costly read

- Where: `parsers/html.ts:9-20`, callers `checks/general/site/contracts.ts:262`, `checks/language/html.ts:76,104,124`
- Kind: rename
- Problem: Verbs are for work with a cost, and pure lookups take a noun (NMS-016), as `pythonFunctions` and `findTomlTable` already do. `getAttributes` only reads the child nodes of one element (`element.namedChildren`).
- Fix: Rename it to `elementAttributes` in `parsers/html.ts` and its four call sites.
- Size: small

### S08-005: Constants lose their meaning when they join a shared topic file

- Where: `config/parsers/naming.ts`, `config/parsers/statements.ts`, `config/parsers/swift.ts`, `config/parsers/cloudflare.ts`
- Kind: rename
- Problem: In a file of their own, names such as `SPLAT_NODES`, `NAME_NODES`, or `STATUS_CODES` were clear from the file name. In one naming file that holds Python, Swift, and TypeScript node sets (`config/checks/general/naming.ts` already holds 12 naming values, and 16 more join it), or in one Cloudflare file beside `REQUIRED_HEADERS`, the bare names say nothing about the language or the purpose.
- Fix: Rename on the move. To `config/checks/general/naming.ts`: `SPLAT_NODES` to `PYTHON_SPLAT_NODES`, `IMPLICIT_PARAMETERS` to `PYTHON_IMPLICIT_PARAMETERS`, `EXCEPTION_BASE` to `PYTHON_EXCEPTION_BASE`, `MEMBER_PARENTS` to `SWIFT_MEMBER_PARENTS`, `NAMED_DECLARATIONS` to `TYPESCRIPT_DECLARATIONS`, `NAME_NODES` to `TYPESCRIPT_NAME_NODES`, `PATTERN_FIELDS` to `TYPESCRIPT_PATTERN_FIELDS`, `PATTERN_LISTS` to `TYPESCRIPT_PATTERN_LISTS`. To `config/checks/general/structure.ts`: `TYPE_ALIASES` to `TYPE_ALIAS_NODES`, `TYPE_REFERENCES` to `TYPE_REFERENCE_NODES`, `NAMES` to `BARE_NAME_NODES`, `ACCESSOR_NODES` to `SWIFT_ACCESSOR_NODES`, `FUNCTION_NAMES` to `SWIFT_FUNCTION_LABELS`. To `config/checks/platform/cloudflare.ts`: `STATUS_CODES` to `REDIRECT_STATUS_CODES`.
- Size: small

### S08-006: The same literal is written in two to five places

- Where: `/^\.\//u` in `parsers/public.ts:234` and `config/parsers/output.ts:11` (`LEADING_DOT_SLASH`); `/^["']|["']$/gu` in `parsers/html.ts:18` and `parsers/source/contracts.ts:270`; `{ allowTrailingComma: true }` in `parsers/public.ts:201,302`; `['simple_expansion', 'expansion']` in `parsers/bash/public.ts:26,132`; `'--'` in `parsers/bash/public.ts:158,178`; `'node_modules'` in `parsers/packages/contracts.ts:271,298`; `'__all__'` in `parsers/source/contracts.ts:51,112`; `/\w/u` in `parsers/sql/lexer.ts:35,52`; the Swift name quote ``'`'`` in `parsers/naming/swift.ts:9,18,32,51,60`; the three inline tests in `requirementName`
- Kind: merge
- Problem: Each group says one thing more than once, so a change to one copy leaves the others behind.
- Fix: One named value each in `config/`: reuse `LEADING_DOT_SLASH`; add `SURROUNDING_QUOTES` (`config/text.ts`), `JSONC_OPTIONS` (`config/parsers/json.ts`), `EXPANSION_NODES` and `END_OF_OPTIONS` (`config/parsers/bash.ts`), `NODE_MODULES` (`config/repository/tracked.ts`), `PYTHON_EXPORT_LIST` (`config/parsers/python.ts`), `WORD_CHARACTER` (`config/parsers/sql.ts`), and `SWIFT_NAME_QUOTE` (`config/checks/general/naming.ts`). Replace the three inline tests in `requirementName` with one `REQUIREMENT_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u` in `config/parsers/dependency-files.ts`; the uv pin pattern in `config/tools/python.ts` is a different value with its own name, `PINNED_PACKAGE_NAME`.
- Size: small

## Target layout

All under `packages/cli/src/`.

```text
parsers/
  bash.ts               parseBashScript, codeLines, maskComments, the temporary-file readers
  comments.ts           parseComments, commentText, the comment reader of each file type, quotedEnd, blankOut
  dependency-files.ts   package.json, pyproject.toml, Pipfile, requirements.txt, Package.swift
  generated-header.ts   generatedHeader, hasGeneratedHeader
  git.ts                index and tree listings, the blob stream, .gitattributes rules
  html.ts               elementAttributes
  json.ts               readJson, parseJsonc, parseJsonDocument, openJsonFile
  lockfiles.ts          lockfileEntry
  mise.ts               parseMiseTasks and the mise task schemas
  npm-client.ts         npm, Bun, pnpm, and Yarn: name, version, Yarn Berry
  python.ts             readPython, pythonFunctions, exportedNames, isDocstring
  shebang.ts            parseShebang
  swift.ts              swiftSourceTags (PLR-037)
  tool-project.ts       the .gspot package.json and its lockfile
  tree-sitter.ts        parseSource, visitParsed, visitParsedSources, grammarFor
  tsconfig.ts           TypeScript project reading
  typescript.ts         typescriptNodes
  xcode.ts              project.pbxproj reading (checks, init, and generation use it)
  output/
    formats.ts          outputSchema, outputFormats, parseOutput
    text.ts             regex, grouped, lines
    json.ts  sarif.ts  knip.ts  semgrep.ts  typos.ts  markdownlint.ts  trufflehog.ts   (each with its schema)
  sql/
    lexer.ts            psql masking and SQL tokens
    migrations.ts       frozen migration paths (generation uses it)
    postgres.ts         parsePostgres, statement views, parseSqlText, parseSqlFile
  toml/
    comments.ts         keep TOML comments with their keys during edits; addTomlComment
    document.ts         openTomlFile, parseTomlFile, findTomlTable, patchToml
```

What leaves `parsers/`:

| Today                                                                  | Target                                                                                    | Finding                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| `naming/*`                                                             | `checks/general/naming/{bash,python,swift,typescript,sql,declarations}.ts`                | PAR-013                   |
| statement counting, `trivialText`, `swiftFunctionName`, `accessorName` | `checks/general/structure/trivial-functions.ts`                                           | PAR-012, S08-002          |
| Markdown fence readers, `codeFences`                                   | `checks/language/markdown.ts`                                                             | PAR-046, PAR-047, PAR-066 |
| docs prose helpers                                                     | `checks/general/docs.ts`                                                                  | PAR-012                   |
| `ruleSections`                                                         | `src/rules.ts`                                                                            | PAR-012                   |
| `css.ts`, `typescriptProgram`                                          | deleted                                                                                   | PAR-012                   |
| Cloudflare, Expo, Next.js readers; `bash/contracts.ts`                 | `checks/platform/cloudflare.ts`, `checks/framework/expo.ts`, `checks/framework/nextjs.ts` | PAR-011, PAR-021          |
| nginx tokenizer                                                        | `checks/infrastructure/nginx.ts`                                                          | PAR-083                   |
| `parseVersionOutput`                                                   | `tools/versions.ts`                                                                       | PAR-011                   |
| tool-file sections, `parseToolFile`                                    | `repository/tooling.ts` (`hasToolSection`, `hasIniSection`, `parseSharedFile`)            | PAR-011, PAR-018          |
| Prettier reader and child program                                      | deleted; `commands/init/format.ts` reads the plain files                                  | DEC-009                   |
| Swift coverage                                                         | `checks/testing/swift-tests.ts`                                                           | PAR-016                   |
| `readSwiftVersion`                                                     | `generation/tool-file-sources/swiftformat.ts`                                             | PAR-011                   |
| Vale reader                                                            | `checks/general/prose.ts`                                                                 | PAR-015                   |
| `typescriptImports`                                                    | `generation/fragments.ts`                                                                 | PAR-075                   |
| `rootLockfileDependencies`, lockfile schemas                           | `tools/npm/lockfiles.ts`                                                                  | PAR-085                   |
| `positionAt`, `codePointLength`                                        | `src/text.ts`                                                                             | PAR-038, PAR-053          |
| manifest schemas                                                       | `configurations/schema/{manifest,tool,naming,parts}.ts`                                   | PAR-009, PAR-010          |
| gspot.toml table schemas                                               | `settings/schema/tables.ts`                                                               | PAR-010                   |
| report schemas of one check                                            | that check                                                                                | PAR-008                   |
| rule-list script schemas                                               | `scripts/update-rule-lists.ts`                                                            | PAR-031                   |
| rule names and preset schemas                                          | `generation/eslint/presets.ts`                                                            | PAR-024, PAR-031          |
| uv schemas, Yarn settings schemas                                      | `tools/python/`, `tools/npm/yarn.ts`                                                      | PAR-042, PAR-073          |
| `bunInstallSchema`                                                     | `checks/general/dependencies/bun-release-age.ts`                                          | PAR-008                   |

`config/parsers/` keeps `bash`, `comments`, `dependency-files` (renamed from `packages`), `git` (which takes `attributes`), `json`, `lockfiles`, `output`, `python`, `shebang`, `sql`, `swift`, `toml`, `tree-sitter`, `tsconfig`, and `xcode`. `types/parsers/` keeps `bash`, `comments`, `dependency-files`, `editable-file`, `git`, `lockfiles`, `output`, `python`, `sql`, `toml`, `tree-sitter`, `tsconfig`, and `xcode`. The other constant and type files of the part move to the `config/` and `types/` topic files of the code they serve, as the findings above say. Every move keeps the import order of `[[architecture.module]]`: `parsers` imports only `system`; `generation` imports neither `checks` nor `tools`; `repository` and `configurations` do not import `settings`.

## Names

| Concept                                                                                    | The one name                                                                                                                                                              | Names to retire                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| npm, Bun, pnpm, Yarn in code                                                               | `NpmClient`, `parseNpmClient`, `declaredNpmClient`, `npmClientMajor`, `NPM_CLIENTS`; the `LOCKFILES` field `client`                                                       | `PackageInstaller*`, `parsePackageInstaller`, `getPackageInstallerMajor`, `PACKAGE_MANAGERS`                                  |
| Where a tool installs from (npm, PyPI, Homebrew, mise)                                     | installer (`installers`, `InstallerPin`)                                                                                                                                  | "installer" for npm, Bun, pnpm, or Yarn                                                                                       |
| gspot's `manifest.toml`                                                                    | manifest (`manifestSchema` in `configurations/schema/manifest.ts`, `Manifest`)                                                                                            | "manifest" for any other file                                                                                                 |
| package.json, pyproject.toml, Pipfile, requirements.txt, Package.swift                     | dependency file (`DependencyFile`, `DependencyFileParser`, `dependencyFileParser`, `packageJsonSchema`, `pyprojectSchema`, `parsePackageJson`)                            | `PackageManifest`, `ManifestParser`, `manifestParser`, `packageManifestSchema`, `pythonManifestSchema`, `parsePackageSummary` |
| uv.lock                                                                                    | `uvLockSchema`                                                                                                                                                            | `lockfileSchema`                                                                                                              |
| A line with its number                                                                     | `NumberedLine { number, text }`                                                                                                                                           | `ProseLine`, `CodeLine`                                                                                                       |
| A value or an error                                                                        | `Parsed<T, E>`                                                                                                                                                            | `JsonDocument`, `WranglerParse`, `SqlParse`, `SupabaseConfigurationRead`                                                      |
| A problem a reader finds before a check reports it                                         | `...SyntaxError`, `FenceSyntaxError`                                                                                                                                      | `FenceSyntaxFinding`, `find...SyntaxFinding`, `NextSettingsFinding`                                                           |
| Header                                                                                     | `hasGeneratedHeader`, `parseHeadersFile`, `readBlobLine`                                                                                                                  | `hasHeader`, `parseHeaders`, `readHeader`, `parseHeader`                                                                      |
| An editable JSON or TOML file                                                              | `EditableFile`, `openJsonFile`, `openTomlFile`                                                                                                                            | `ConfigurationDocument`, `openJsonDocument`, `openTomlDocument`                                                               |
| A check that runs in place of another / files a tool replaces / where a check or tool runs | `instead_of` on `[[check]]` / `replace` on `[[tool]]` / `operating_systems` on `[[check]]`, `builds` on `[[tool]]`                                                        | `replaces`, `[[tool.replace]]`, `platforms`                                                                                   |
| The parse cache                                                                            | `ParseCache`, parameter `cache`                                                                                                                                           | `ParseReads`, parameter `context`                                                                                             |
| Parsed source                                                                              | `SourceTree`, `PythonFiles`                                                                                                                                               | `ParsedSource`, `ParsedPython`                                                                                                |
| Identifier display text                                                                    | `Identifier.label`                                                                                                                                                        | `Identifier.kind`                                                                                                             |
| Captured lint rule values                                                                  | `capturedLintRulesSchema`, `CapturedLintRules`, log field `lintRules`                                                                                                     | `ruleSettingsSchema`, `CapturedRules`, log field `rules`                                                                      |
| The user's own shared file                                                                 | `parseSharedFile`                                                                                                                                                         | `parseToolFile`                                                                                                               |
| Pure and reading functions                                                                 | `parse...` or a noun for pure functions (`parsePbxproj`, `elementAttributes`, `pythonFunctions`); `read...` only when it reads files (`readTsconfig`, `readCompilerFile`) | `readPbxproj`, `getAttributes`, `getPythonFunctions`, `getTsconfig`, `configurationText`                                      |
