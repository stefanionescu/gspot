# Source: the general checks

320 rows. move 108, keep 87, delete 53, rename 52, inline 13, merge 7.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/checks/finding.ts`

- findingAt (function exported, 14-21): **keep** to `packages/cli/src/checks/finding.ts` `findingAt`. CKG-056: return Finding, add an optional help/fixable argument and use it in the three hand-built findings; parameter diagnostic becomes message (NMS table B).

## `packages/cli/src/checks/general/commits.ts`

- commitlintPushed (function exported, 19-61): **keep** to `packages/cli/src/checks/general/commits.ts` `commitlintPushed`. CKG-045: read the command from the commits/commitlint manifest entry and share the run-merge loop with gitleaks-pushed; scratchFolder takes one fixed prefix, so the scratch prefix needs no value (S01-013). Values to config: COMMIT_MESSAGE_ARGUMENTS = \['show', '--no-patch', '--no-show-signature', '--format=%B'\] -&gt; packages/cli/src/config/checks/general/commits.ts; MESSAGE_FILE = 'message.txt' -&gt; packages/cli/src/config/checks/general/commits.ts.

## `packages/cli/src/checks/general/contracts.ts`

- unmatchedPatterns (function, 29-72): **inline** to `packages/cli/src/checks/general/gspot/unused-entries.ts` `unusedEntries`. CKG-005 and CKG-006 leave it the whole body of check gspot/unused-entries; CKG-007 one final return removes the suppression; paths are root-relative, so repositoryPattern is the pattern itself and prefixScopePath goes (CFR-003); the architecture.roles module-name exemption goes (TML-001); \[\[generated\]\], \[\[vendored\]\], and exclude leave the walked schema (CFR-005, TMF-003); it reads input.repositoryFiles with no second Git listing (CKG-047). Values to config: NEGATED_PATTERN = /^!/u -&gt; packages/cli/src/config/checks/general/gspot.ts.
- unusedNames (function, 75-105): **merge** to `packages/cli/src/checks/general/naming/checks.ts` `namingSettings`. CKG-005: the unused-name report joins naming/settings and declaredNames runs once; it reads allowed_names from the root \[\[naming.override\]\] list in one pass (CFR-004); paths are root-relative, so no prefixScopePath (CFR-003); an override without paths covers the whole repository; POL-059: rule unused-entry.
- unusedIgnores (function, 108-149): **delete**. CKG-006: delete the second run of the structure checks; the run already counts ignore matches.
- gspotDrift (function exported, 157-177): **move** to `packages/cli/src/checks/general/gspot/generated-files.ts` `generatedFiles`. CKG-028: moves to the gspot/ folder as check gspot/generated-files (glossary); CKG-016 deletes the runs-once guard and its test.
- gspotPolicyLayout (function exported, 185-207): **move** to `packages/cli/src/checks/general/gspot/settings-format.ts` `settingsFormat`. CKG-028: moves to the gspot/ folder as check gspot/settings-format (glossary); CKG-025 message without "canonical"; CKG-056 use findingAt.
- fixPolicyLayout (function exported, 215-237): **move** to `packages/cli/src/checks/general/gspot/settings-format.ts` `fixSettingsFormat`. CKG-028: moves beside settingsFormat; CKG-015 reads gspot.toml once; CMD-005 calls the one shared gspot.toml write.
- unmatchedPaths (function exported, 246-259): **move** to `packages/cli/src/checks/general/gspot/unused-entries.ts` `unusedEntries`. CKG-028: check gspot/unused-entries (glossary, POL-059); CKG-006 makes it a plain one-argument entry of CHECK_FUNCTIONS; it reads allowed_names from the root \[\[naming.override\]\] list only (CFR-004).

## `packages/cli/src/checks/general/dependencies/bun-release-age.ts`

- installTable (function, 14-18): **keep** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `installTable`. Real helper; a missing bunfig.toml is a user state.
- ageFindings (function, 20-33): **keep** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `ageFindings`. Real helper with one caller.
- scannerFindings (function, 35-48): **keep** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `scannerFindings`. Real helper with one caller; dependencies.scanner is absent when no scanner is wanted, so the guard tests undefined (TML-010).
- bunReleaseAge (function exported, 55-73): **keep** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `bunReleaseAge`. Check dependencies/bun-release-age; CKG-053 use isToolProjectPath.

## `packages/cli/src/checks/general/dependencies/lockfile/fresh.ts`

- frozenCommand (function, 13-19): **move** to `packages/cli/src/checks/general/dependencies/stale-lockfile.ts` `frozenCommand`. CKG-031: lockfile/fresh.ts becomes dependencies/stale-lockfile.ts and lockfile/ goes. Values to config: YARN_LOCKFILE = 'yarn.lock' -&gt; packages/cli/src/config/parsers/lockfiles.ts; YARN_BERRY_LOCKFILE = /^\_\_metadata:/mu -&gt; packages/cli/src/config/parsers/lockfiles.ts; YARN_BERRY_FROZEN = \['yarn', 'install', '--immutable'\] -&gt; packages/cli/src/config/parsers/lockfiles.ts.
- lockfileRefusal (function, 22-33): **move** to `packages/cli/src/checks/general/dependencies/stale-lockfile.ts` `lockfileRefusal`. CKG-031; CKG-014 reads the stale pattern from LOCKFILES and drops the "no stale diagnostic is known" guard.
- lockfileFresh (function exported, 40-60): **move** to `packages/cli/src/checks/general/dependencies/stale-lockfile.ts` `staleLockfile`. CKG-031; CKO-019 and NMU-023: function named for check dependencies/stale-lockfile; NMS-007 local workspace becomes scratch. Values to config: YARN_SCRIPTS_OFF = { YARN_ENABLE_SCRIPTS: 'false' } -&gt; packages/cli/src/config/checks/general/dependencies.ts.

## `packages/cli/src/checks/general/dependencies/lockfile/hosts.ts`

- urlMessage (function, 9-12): **move** to `packages/cli/src/checks/general/dependencies/lockfile-hosts.ts` `urlMessage`. CKG-031: lockfile/hosts.ts becomes dependencies/lockfile-hosts.ts.
- fileFindings (function, 14-30): **move** to `packages/cli/src/checks/general/dependencies/lockfile-hosts.ts` `fileFindings`. CKG-031: lockfile/hosts.ts becomes dependencies/lockfile-hosts.ts.
- lockfileHosts (function exported, 37-47): **move** to `packages/cli/src/checks/general/dependencies/lockfile-hosts.ts` `lockfileHosts`. CKG-031: moves to dependencies/lockfile-hosts.ts; CKG-014 filters LOCKFILES by configuration javascript instead of JAVASCRIPT_CLIENTS; reads dependencies.allowed_registries (TML-014). Values to config: BINARY_BUN_LOCKFILE = 'bun.lockb' -&gt; packages/cli/src/config/checks/general/dependencies.ts.

## `packages/cli/src/checks/general/dependencies/manifests.ts`

- rootFindings (function, 10-32): **rename** to `packages/cli/src/checks/general/dependencies/package-json.ts` `rootFindings`. CKG-031: manifests.ts is renamed in place to package-json.ts; messages use the literal name package.json.
- packageClientFindings (function, 34-50): **rename** to `packages/cli/src/checks/general/dependencies/package-json.ts` `packageClientFindings`. CKG-031: manifests.ts is renamed in place to package-json.ts.
- lockfileFindings (function, 52-72): **rename** to `packages/cli/src/checks/general/dependencies/package-json.ts` `lockfileFindings`. CKG-031: manifests.ts is renamed in place to package-json.ts; CKG-014 filters LOCKFILES instead of JAVASCRIPT_CLIENTS.
- manifests (function exported, 79-93): **rename** to `packages/cli/src/checks/general/dependencies/package-json.ts` `packageJson`. CKG-031, CKO-019: named for check dependencies/package-json; CKG-017 read with parsePackageManifest and drop the missing-file guard; CKG-033 shared package.json file filter with version-pairs.

## `packages/cli/src/checks/general/dependencies/public.ts`

- versionPairs (function exported, 14-35): **move** to `packages/cli/src/checks/framework/version-pairs.ts` `versionPairs`. CKG-033: framework check of nextjs and react; the two registry lines stay; share the package.json file filter with package-json.ts. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.

## `packages/cli/src/checks/general/docs.ts`

- knownPaths (function, 25-46): **keep** to `packages/cli/src/checks/general/docs.ts` `knownPaths`. CKG-016: repositoryFiles becomes required in CheckInput, so the runs-once guard goes; it reads the name of each policy.command_check record (\[\[command_check\]\]). Values to config: GITIGNORE_FILE = '.gitignore' -&gt; packages/cli/src/config/repository/tracked.ts.
- miseTasks (function, 48-55): **keep** to `packages/cli/src/checks/general/docs.ts` `miseTasks`. Real helper with one caller.
- packageScripts (function, 57-65): **keep** to `packages/cli/src/checks/general/docs.ts` `packageScripts`. Real helper with one caller.
- isMissing (function, 67-74): **keep** to `packages/cli/src/checks/general/docs.ts` `isMissing`. Real helper with one caller.
- lineFindings (function, 76-96): **keep** to `packages/cli/src/checks/general/docs.ts` `lineFindings`. Real helper with one caller; the run-token pattern reads RUNNER_NAMES (mise, npm, bun, pnpm, yarn) from packages/cli/src/config/repository/tooling.ts, and runnerSchema goes with the runner setting (INX-003, INX-003). Values to config: MISE_RUN = 'mise run ' -&gt; packages/cli/src/config/checks/general/docs.ts.
- openingFindings (function, 98-115): **keep** to `packages/cli/src/checks/general/docs.ts` `openingFindings`. Real helper with one caller.
- sectionFindings (function, 117-130): **keep** to `packages/cli/src/checks/general/docs.ts` `sectionFindings`. Real helper with one caller; glossary: limit, not threshold.
- taskSources (function, 132-153): **keep** to `packages/cli/src/checks/general/docs.ts` `taskSources`. Real helper with one caller. Values to config: TOOL_VERSIONS_FILE = '.tool-versions' -&gt; packages/cli/src/config/repository/inventory.ts; MISE_CONF_FILES = '.mise/conf.d/\*.toml' -&gt; packages/cli/src/config/checks/general/docs.ts; PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.
- stalePaths (function exported, 160-172): **rename** to `packages/cli/src/checks/general/docs.ts` `missingPaths`. Check docs/stale-paths becomes docs/missing-paths; PAR-012 moves proseLines, pathTokens and cleanPathToken into this file. Values to config: MARKDOWN_EXTENSION = '.md' -&gt; packages/cli/src/config/repository/inventory.ts.
- requiredFiles (function exported, 179-199): **keep** to `packages/cli/src/checks/general/docs.ts` `requiredFiles`. Check docs/required-files. Values to config: README_FILE = 'README.md' -&gt; packages/cli/src/config/checks/general/docs.ts; LICENSE_PATH = 'LICENSE' -&gt; packages/cli/src/config/checks/general/docs.ts.
- readmeShape (function exported, 206-235): **keep** to `packages/cli/src/checks/general/docs.ts` `readmeShape`. Check docs/readme-shape; reads limits.headings_before_contents (POL-031). Values to config: README_FILE = 'README.md' -&gt; packages/cli/src/config/checks/general/docs.ts.
- headings (function exported, 242-263): **delete**. The TypeScript check docs/headings goes; the Vale style banned-headings keeps the rule.

## `packages/cli/src/checks/general/generated-code.ts`

- missingOutputs (function, 17-39): **move** to `packages/cli/src/checks/stale-generated-files.ts` `missingOutputs`. CKG-032: moves to checks/stale-generated-files.ts; CKG-058 gives one "does not exist; run &lt;command&gt;" message for both kinds, so the entries use the manifest type GeneratedPath with no original field (S01-006).
- copiedFiles (function, 42-52): **move** to `packages/cli/src/checks/stale-generated-files.ts` `copiedFiles`. CKG-032: moves to checks/stale-generated-files.ts; CKG-024 drops the "native" comment.
- generatedInputs (function, 54-86): **move** to `packages/cli/src/checks/stale-generated-files.ts` `generatedInputs`. CKG-032: moves to checks/stale-generated-files.ts.
- generatedCode (function exported, 93-142): **move** to `packages/cli/src/checks/stale-generated-files.ts` `staleGeneratedFiles`. CKG-032: serves drizzle, cloudflare, openapi and supabase stale-\* checks, so it sits in checks/ as staleGeneratedFiles (CKO-019); CKG-017 drops the cancel check runCheckTool repeats; the fallback text "The tool printed no diagnostic." becomes the default of toolOutputDetail (S01-012).

## `packages/cli/src/checks/general/licenses.ts`

- isAllowed (function, 28-35): **keep** to `packages/cli/src/checks/general/licenses.ts` `isAllowed`. Real helper with one caller.
- licenseMessage (function, 37-41): **inline** to `packages/cli/src/checks/general/licenses.ts` `allowedLicenses`. TML-009: \[\[licenses.allowed_package\]\] has name, version, and reason and the license cross-check goes, so the one "not an allowed license" message is a line in allowedLicenses.
- assertInstalled (function, 43-48): **keep** to `packages/cli/src/checks/general/licenses.ts` `assertInstalled`. Real user state (dependencies not installed).
- licenseReport (function, 50-57): **keep** to `packages/cli/src/checks/general/licenses.ts` `licenseReport`. Real helper with two callers; the fallback text becomes the default of toolOutputDetail (S01-012).
- javascriptLicenses (function, 59-70): **keep** to `packages/cli/src/checks/general/licenses.ts` `javascriptLicenses`. Tool names live in config/, so LICENSE_CHECKER stays in packages/cli/src/config/checks/general/licenses.ts (S01-007). Values to config: LICENSE_CHECKER_ARGUMENTS = \['--json', '--excludePrivatePackages', '--start'\] -&gt; packages/cli/src/config/repository/tracked.ts; NODE_MODULES = 'node_modules' -&gt; packages/cli/src/config/repository/tracked.ts; UNKNOWN_LICENSE = 'UNKNOWN' -&gt; packages/cli/src/config/repository/tracked.ts; LICENSE_CHOICE = ' OR ' -&gt; packages/cli/src/config/repository/tracked.ts.
- pythonLicenses (function, 73-93): **keep** to `packages/cli/src/checks/general/licenses.ts` `pythonLicenses`. NMS-007: isolatedFolder becomes scratch; scratchFolder takes one fixed prefix, so the scratch prefix needs no value (S01-013). Values to config: PIP_LICENSES_COMMAND = \['pip-licenses', '--format=json', '--with-system', '--from=mixed', '--python'\] -&gt; packages/cli/src/config/tools/python.ts; PYTHON_ENVIRONMENT_FOLDER = '.venv' -&gt; packages/cli/src/config/tools/python.ts.
- scanLicenses (function, 96-122): **keep** to `packages/cli/src/checks/general/licenses.ts` `scanLicenses`. CKG-050: skip a package.json that declares no dependencies before assertInstalled; the scanner object needs no LicenseScanner annotation, so write (name: string) =&gt; name (S01-003). Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.
- licensesPackages (function exported, 129-168): **rename** to `packages/cli/src/checks/general/licenses.ts` `allowedLicenses`. CKO-019: named for check licenses/allowed; \[\[licenses.allowed_package\]\] records (name, exact version, reason) replace licenses.exceptions, and each one exempts one installed name at that version (TML-009); the unused-record pass reads the root list once (CFR-004, POL-059: rule unused-entry).

## `packages/cli/src/checks/general/naming/contracts.ts`

- segmentName (function, 25-30): **move** to `packages/cli/src/checks/general/naming/identifiers.ts` `segmentName`. CKG-030: contracts.ts splits; reading names out of paths and sources goes to naming/identifiers.ts. Values to config: REST_SEGMENT = /^\\.\\.\\./u -&gt; packages/cli/src/config/checks/general/naming.ts.
- toSet (function, 32-34): **move** to `packages/cli/src/checks/general/naming/settings.ts` `toSet`. CKG-030: building the naming settings goes to naming/settings.ts (NamingSettings).
- compileRule (function, 36-49): **move** to `packages/cli/src/checks/general/naming/settings.ts` `compileOverride`. CKG-030: moves to naming/settings.ts; PathRule becomes CompiledOverride (NMS table B); an override has allowed_names and cases, no names field, and optional root-relative paths, where no paths means the whole repository (TML-005, CFR-003).
- reservedTerms (function, 51-56): **inline** to `packages/cli/src/checks/general/naming/settings.ts` `readNamingSettings`. CKG-030: naming.reserved is deleted, so only the shipped reserved terms stay and lower-casing them is one expression in readNamingSettings (TML-005).
- buildLimitsFor (function, 58-82): **move** to `packages/cli/src/checks/general/naming/settings.ts` `buildLimitsFor`. CKG-030: moves to naming/settings.ts; it reads max_characters and cases per language and per kind of name; the sql and swift values are per-language defaults of the one declaration (TML-007); glossary: limit, not ceiling.
- fileIdentifier (function exported, 91-99): **move** to `packages/cli/src/checks/general/naming/identifiers.ts` `fileIdentifier`. CKG-030; used by naming/checks.ts. Values to config: SQL_EXTENSION = '.sql' -&gt; packages/cli/src/config/repository/inventory.ts.
- directoryIdentifiers (function exported, 108-118): **move** to `packages/cli/src/checks/general/naming/identifiers.ts` `directoryIdentifiers`. CKG-030; used by naming/checks.ts.
- identifiersOf (function exported, 128-161): **move** to `packages/cli/src/checks/general/naming/identifiers.ts` `identifiersOf`. CKG-030: reading names out of paths and sources moves to naming/identifiers.ts.
- compileTerms (function exported, 169-173): **move** to `packages/cli/src/checks/general/naming/settings.ts` `compileTerms`. CKG-030; CKG-054 stop exporting: tests check banned terms through nameFindings.
- effectivePolicy (function exported, 183-230): **move** to `packages/cli/src/checks/general/naming/settings.ts` `readNamingSettings`. CKG-030: becomes readNamingSettings in naming/settings.ts, because namingSettings is the naming/settings check (S01-001); it takes the check input (selection, policyFiles, scope), so both naming checks call it in one line (S01-001); CKG-049 builds a four-field object; CKG-003 keeps the folders group, limited to directory names; it reads banned_words and the root \[\[naming.override\]\] allowed_names, with no naming.reserved (TML-005, CFR-004).
- declaredNames (function exported, 237-271): **move** to `packages/cli/src/checks/general/naming/checks.ts` `declaredNames`. CKG-005 leaves naming/settings as its one user; CKG-048 reuse sourceFiles and pathIdentifiers; stop exporting.

## `packages/cli/src/checks/general/naming/identifiers.ts`

- sourceFiles (function, 21-30): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `sourceFiles`. CKG-030: identifiers.ts is renamed in place to checks.ts; CKG-048 reuses sourceFiles.
- findingsFor (function, 32-41): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `findingsFor`. CKG-030: identifiers.ts is renamed in place to checks.ts.
- identifierFindings (function, 43-51): **inline** to `packages/cli/src/checks/general/naming/checks.ts` `namingIdentifiers`. CKG-030: its one user is namingIdentifiers, a plain function whose body is this loop (S01-001).
- pathIdentifiers (function, 53-70): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `pathIdentifiers`. CKG-030; CKG-051 drop the test-folder exemption.
- policyFindings (function, 73-102): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `namingSettings`. S01-001: becomes the exported check naming/settings itself, with no namingCheck wrapper; CKG-005 drops the dead block and POL-021 the cases block; the unused block reads the root \[\[naming.override\]\] allowed_names once, paths are root-relative, and the messages name \[\[naming.override\]\] (CFR-004, CFR-003).
- namingCheck (function, 105-117): **delete**. S01-001: a wrapper that only passes four input fields to readNamingSettings; each check calls readNamingSettings(input) in one line, so it goes.
- namingIdentifiers (const exported, 119-119): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `namingIdentifiers`. CKG-030: check naming/identifiers, a plain async function: readNamingSettings(input), then the identifierFindings loop (S01-001).
- namingPaths (const exported, 121-123): **rename** to `packages/cli/src/checks/general/naming/checks.ts` `namingPaths`. CKG-030: check naming/paths, a plain function: findingsFor(input, readNamingSettings(input), pathIdentifiers(input)) (S01-001); CKG-003 reports the banned folder words too.
- namingPolicy (const exported, 125-125): **merge** to `packages/cli/src/checks/general/naming/checks.ts` `namingSettings`. S01-001: the alias goes; the registry names namingSettings.

## `packages/cli/src/checks/general/naming/public.ts`

- isSnakeMigration (function, 29-35): **rename** to `packages/cli/src/checks/general/naming/names.ts` `isSnakeMigration`. CKG-030/NMS table A: public.ts renamed in place to names.ts (findings for one name). Values to config: SQL_EXTENSION = '.sql' -&gt; packages/cli/src/config/repository/inventory.ts.
- CASE_TESTS (const, 37-45): **rename** to `packages/cli/src/checks/general/naming/names.ts` `CASE_TESTS`. CKG-030: stays in names.ts because a table of functions is code: an object that satisfies Record&lt;CaseName, (name: string) =&gt; boolean&gt;, keyed by CASE_NAMES from config (S01-010, POL-021).
- isConsecutive (function, 47-52): **rename** to `packages/cli/src/checks/general/naming/names.ts` `isConsecutive`. CKG-030: public.ts is renamed in place to names.ts.
- stripped (function, 54-59): **rename** to `packages/cli/src/checks/general/naming/names.ts` `stripped`. CKG-030: public.ts is renamed in place to names.ts.
- caseFinding (function, 61-75): **rename** to `packages/cli/src/checks/general/naming/names.ts` `caseFinding`. CKG-030; absorbs hasCase (CKG-054). Values to config: DIGIT_RUNS = /\\d+/gu -&gt; packages/cli/src/config/checks/general/naming.ts; LAST_EXTENSION = /\\.\[^.\]\*$/u -&gt; packages/cli/src/config/checks/general/naming.ts.
- digitFinding (function, 77-86): **rename** to `packages/cli/src/checks/general/naming/names.ts` `digitFinding`. CKG-030: public.ts is renamed in place to names.ts.
- lengthFinding (function, 88-96): **rename** to `packages/cli/src/checks/general/naming/names.ts` `lengthFinding`. CKG-030; glossary: "over the limit", not ceiling.
- wordsFinding (function, 98-106): **rename** to `packages/cli/src/checks/general/naming/names.ts` `wordsFinding`. CKG-030; glossary: "over the limit", not ceiling.
- repeatFinding (function, 108-115): **rename** to `packages/cli/src/checks/general/naming/names.ts` `repeatFinding`. CKG-030: public.ts is renamed in place to names.ts.
- termFindings (function, 117-143): **rename** to `packages/cli/src/checks/general/naming/names.ts` `termFindings`. CKG-030; absorbs bannedTerm (CKG-054); CKG-003 skips a term whose categories exclude the identifier. Values to config: TEST_TERM_GROUP = 'tests' -&gt; packages/cli/src/config/checks/general/naming.ts.
- callbackFinding (function, 145-164): **rename** to `packages/cli/src/checks/general/naming/names.ts` `callbackFinding`. CKG-030: public.ts is renamed in place to names.ts; CKG-025 message without "callback position"; the override names field is deleted, so the names test goes (TML-005).
- CASE_NAMES (const exported, 167-167): **move** to `packages/cli/src/config/checks/general/naming.ts` `CASE_NAMES`. A static list of names belongs in config/: the literal list of the seven case names (as const), beside CATEGORY_LABELS; CASE_TESTS is keyed by it, the type CaseName in types/checks/general.ts derives from it, and the naming schemas validate case names with z.enum of it (S01-010, POL-021).
- hasCase (function exported, 175-177): **inline** to `packages/cli/src/checks/general/naming/names.ts` `caseFinding`. CKG-054: one-line map lookup, exported only for tests; tests go through nameFindings.
- splitParts (function exported, 184-194): **move** to `packages/cli/src/checks/general/naming/settings.ts` `splitParts`. Used by compileTerms (settings.ts) and nameFindings (names.ts); the import runs one way, names.ts to settings.ts, so there is no file cycle. Values to config: DIGIT_BOUNDARY = /(?&lt;=\\D)(?=\\d)|(?&lt;=\\d)(?=\\D)/u -&gt; packages/cli/src/config/checks/general/naming.ts.
- repeatedPart (function exported, 201-208): **rename** to `packages/cli/src/checks/general/naming/names.ts` `repeatedPart`. CKG-054: stop exporting; tests go through nameFindings.
- bannedTerm (function exported, 216-218): **inline** to `packages/cli/src/checks/general/naming/names.ts` `termFindings`. CKG-054: one-line find with one caller.
- nameFindings (function exported, 226-251): **rename** to `packages/cli/src/checks/general/naming/names.ts` `nameFindings`. CKG-030; the entry point naming/checks.ts and the tests use (CKG-054).
- rulesFor (function exported, 259-268): **rename** to `packages/cli/src/checks/general/naming/names.ts` `overridesFor`. CKG-054: stop exporting, tests go through nameFindings; returns CompiledOverride\[\] (NMS table B); the override names field is deleted, so the names test goes (TML-005).
- ruleLimits (function exported, 277-287): **rename** to `packages/cli/src/checks/general/naming/names.ts` `ruleLimits`. CKG-019: add the Ruff/SwiftLint comment above the if; CKG-038 stop exporting. Values to config: SWIFTLINT_PARENTS = \['types', 'variables'\] -&gt; packages/cli/src/config/checks/general/naming.ts; RUFF_CATEGORIES = \['classes', 'exceptions'\] -&gt; packages/cli/src/config/checks/general/naming.ts.

## `packages/cli/src/checks/general/public.ts`

- assertValeRan (function, 30-35): **move** to `packages/cli/src/checks/general/prose.ts` `assertValeRan`. CKG-027: general/public.ts splits into prose.ts and duplication.ts. Values to config: VALE_ERROR_LINE = /(?:^E\\d+)|(?:not found)|(?:error)/iu -&gt; packages/cli/src/config/checks/general/prose.ts.
- valeCommand (function, 37-47): **move** to `packages/cli/src/checks/general/prose.ts` `valeCommand`. CKG-027; CFG-003 deletes the per-scope Vale config, so the scoped lookup and its guard go (CKG-016). Values to config: VALE_TOOL = 'vale' -&gt; packages/cli/src/config/tools/vale.ts; VALE_ARGUMENTS = \['--output', 'JSON', '--no-exit'\] -&gt; packages/cli/src/config/tools/vale.ts.
- pathAlerts (function, 49-65): **move** to `packages/cli/src/checks/general/prose.ts` `pathAlerts`. CKG-027; PAR-015 valeAlerts replaces parseAlerts.
- stdinAlerts (function, 67-82): **move** to `packages/cli/src/checks/general/prose.ts` `stdinAlerts`. CKG-027: general/public.ts splits into prose.ts and duplication.ts.
- vale (function exported, 89-109): **move** to `packages/cli/src/checks/general/prose.ts` `vale`. CKG-027: check prose/vale.
- routeFor (function exported, 116-121): **move** to `packages/cli/src/checks/general/prose.ts` `routeFor`. CKG-027; CKG-054 stop exporting: tests go through vale.
- routeGroups (function exported, 128-141): **move** to `packages/cli/src/checks/general/prose.ts` `routeGroups`. CKG-027; CKG-054 stop exporting: tests go through vale.
- cloneFindings (function exported, 153-175): **inline** to `packages/cli/src/checks/general/duplication.ts` `jscpd`. CKG-054: one caller, exported only for tests; inlining drops CloneScope and CloneReport; tests go through jscpd with a faked tool run.
- jscpd (function exported, 182-217): **move** to `packages/cli/src/checks/general/duplication.ts` `jscpd`. CKG-027: check duplication/jscpd; JSCPD stays in config/checks/general/duplication.ts (S01-007); CKG-017 keeps the tested no-report message; the fallback text becomes the default of toolOutputDetail (S01-012); no scratch prefix value (S01-013); reads limits.duplicate_percent (POL-031). Values to config: JSCPD_CONFIG_FILE = 'jscpd.json' -&gt; packages/cli/src/config/checks/general/duplication.ts; JSCPD_REPORT_FILE = 'jscpd-report.json' -&gt; packages/cli/src/config/checks/general/duplication.ts; JSCPD_ARGUMENTS = \['--reporters', 'json', '--silent'\] -&gt; packages/cli/src/config/checks/general/duplication.ts.

## `packages/cli/src/checks/general/repository.ts`

- largeFiles (function exported, 14-37): **keep** to `packages/cli/src/checks/general/repository.ts` `largeFiles`. Check repository/large-files; CKG-016 and CKG-042 drop the runs-once and limit guards; reads limits.file_kilobytes; \[\[generated\]\] and \[\[vendored\]\] go, so a file whose kind is generated or vendored (from the configurations or the .gitattributes linguist markers) is skipped, and the message says to mark it in .gitattributes, move it to LFS, or ignore it with a reason (CFR-005). Values to config: LFS_FILTER = 'lfs' -&gt; packages/cli/src/config/repository/inventory.ts.
- trackedFiles (function exported, 44-65): **keep** to `packages/cli/src/checks/general/repository.ts` `trackedFiles`. Check repository/tracked-files.

## `packages/cli/src/checks/general/secrets.ts`

- changeFields (function, 33-41): **merge** to `packages/cli/src/checks/general/secrets.ts` `changedObjects`. CKG-057: merges into changedObjects; CKG-025 plain Git error messages.
- changedObjects (function, 44-53): **keep** to `packages/cli/src/checks/general/secrets.ts` `changedObjects`. CKG-057: absorbs changeFields.
- appendBlobs (function, 56-67): **keep** to `packages/cli/src/checks/general/secrets.ts` `appendBlobs`. CKG-057: plain session and file arguments instead of SecretScan.
- appendMetadata (function, 70-80): **keep** to `packages/cli/src/checks/general/secrets.ts` `appendMetadata`. CKG-057: plain arguments.
- scanCommits (function, 83-104): **keep** to `packages/cli/src/checks/general/secrets.ts` `scanCommits`. Real helper with one caller; scratchFolder takes one fixed prefix, so the scratch prefix needs no value (S01-013). Values to config: ENUMERATOR_FILE = 'commits.jsonl' -&gt; packages/cli/src/config/checks/general/secrets.ts; TRUFFLEHOG_ENUMERATOR = \['trufflehog', 'json-enumerator'\] -&gt; packages/cli/src/config/checks/general/secrets.ts; TRUFFLEHOG_FLAGS = \['--results=verified', '--json', '--fail', '--fail-on-scan-errors', '--no-update'\] -&gt; packages/cli/src/config/checks/general/secrets.ts.
- gitleaksPushed (function exported, 112-147): **keep** to `packages/cli/src/checks/general/secrets.ts` `gitleaksPushed`. CKG-045: use pushedCommits, fileBatches, the manifest command and the shared run-merge loop; the gitleaks command comes from the manifest, so it gets no config value. Values to config: GITLEAKS_LOG_FLAG = '--log-opts' -&gt; packages/cli/src/config/checks/general/secrets.ts.
- trufflehog (function exported, 155-165): **keep** to `packages/cli/src/checks/general/secrets.ts` `trufflehog`. Check secrets/trufflehog.
- envTemplate (function exported, 172-228): **rename** to `packages/cli/src/checks/general/secrets.ts` `envExamples`. NMU-024: check secrets/env-template becomes secrets/env-examples. Values to config: ENV_READ_LANGUAGES = \['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'\] -&gt; packages/cli/src/config/checks/general/secrets.ts.

## `packages/cli/src/checks/general/security.ts`

- runCodeql (function, 18-25): **keep** to `packages/cli/src/checks/general/security.ts` `runCodeql`. CKG-046: take the language for its message; CODEQL stays in config/checks/general/security.ts (S01-007); the fallback text becomes the default of toolOutputDetail (S01-012).
- analyzeLanguage (function, 27-51): **keep** to `packages/cli/src/checks/general/security.ts` `analyzeLanguage`. CKG-057 plain arguments; CKG-046 the try/catch around it goes. Values to config: CODEQL_ANALYZE_FLAGS = \['--download', '--format=sarif-latest'\] -&gt; packages/cli/src/config/checks/general/security.ts.
- codeql (function exported, 58-96): **keep** to `packages/cli/src/checks/general/security.ts` `codeql`. Check security/codeql; PAR-008 brings codeqlLanguagesSchema here; tools.codeql is read through the CODEQL constant (S01-007); tools.codeql.suite is deleted and the level picks the suite, security-extended at recommended and security-and-quality at all (TML-006); no scratch prefix value (S01-013). Values to config: CODEQL_LANGUAGES_COMMAND = \['resolve', 'languages', '--format=betterjson', '--filter-to-languages-with-queries'\] -&gt; packages/cli/src/config/checks/general/security.ts; CODEQL_SUITES = { recommended: "security-extended", all: "security-and-quality" } -&gt; packages/cli/src/config/checks/general/security.ts.
- semgrep (function exported, 104-113): **keep** to `packages/cli/src/checks/general/security.ts` `semgrep`. Check security/semgrep; CKG-016: the command is required, so the guard goes.

## `packages/cli/src/checks/general/site/contracts.ts`

- BUILD_MEMO (const, 23-23): **move** to `packages/cli/src/checks/framework/site/build.ts` `BUILD_MEMO`. CKG-029: site checks move to checks/framework/site/; it stays in build.ts because it holds a factory function (code), not a static value.
- runBuild (function, 25-43): **move** to `packages/cli/src/checks/framework/site/build.ts` `runBuild`. CKG-029: moves to checks/framework/site/build.ts; CKG-025 message without "lifecycle".
- buildDigests (function, 45-47): **move** to `packages/cli/src/checks/framework/site/build.ts` `buildDigests`. CKG-029: site checks move to checks/framework/site/.
- svgFinding (function, 50-71): **move** to `packages/cli/src/checks/framework/site/source-files.ts` `svgFinding`. CKG-029: source-file checks. Values to config: SVGO_COMMAND = \['svgo', '--input', '-', '--output', '-'\] -&gt; packages/cli/src/config/checks/framework/site.ts.
- filesUnder (function exported, 78-92): **move** to `packages/cli/src/checks/framework/site/build.ts` `filesUnder`. CKG-029; exported for built-pages.ts; CKG-025 messages.
- repositoryPath (function exported, 101-109): **move** to `packages/cli/src/checks/framework/site/build.ts` `repositoryPath`. CKG-029; exported for built-pages.ts.
- cachedBuild (function exported, 116-131): **move** to `packages/cli/src/checks/framework/site/build.ts` `cachedBuild`. CKG-029; CKG-054 stop exporting, tests go through siteBuild and requireBuild; CKG-017 drop the resources guard.
- requireBuild (function exported, 138-142): **move** to `packages/cli/src/checks/framework/site/build.ts` `requireBuild`. CKG-029; exported for built-pages.ts.
- siteBuild (function exported, 149-160): **move** to `packages/cli/src/checks/framework/site/build.ts` `siteBuild`. CKG-029: check site/build.
- buildReproducible (function exported, 167-193): **move** to `packages/cli/src/checks/framework/site/build.ts` `buildReproducible`. CKG-029: check site/build-reproducible.
- deadAssets (function exported, 200-234): **move** to `packages/cli/src/checks/framework/site/source-files.ts` `unusedAssets`. CKG-029; NMU-022: check site/dead-assets becomes site/unused-assets (rule unused-asset). Values to config: GIT_FILE_MODES = \['100644', '100755'\] -&gt; packages/cli/src/config/checks/framework/site.ts.
- svgo (function exported, 241-248): **move** to `packages/cli/src/checks/framework/site/source-files.ts` `svgo`. CKG-029: check site/svgo. Values to config: SVG_EXTENSION = '.svg' -&gt; packages/cli/src/config/checks/framework/site.ts.
- webManifest (function exported, 255-304): **move** to `packages/cli/src/checks/framework/site/source-files.ts` `webManifest`. CKG-029: check site/webmanifest; webManifest and pageOf share one placeholder origin (S01-011). Values to config: WEB_MANIFEST_EXTENSION = '.webmanifest' -&gt; packages/cli/src/config/checks/framework/site.ts; HTML_FILE = /\\.html?$/u -&gt; packages/cli/src/config/checks/framework/site.ts; MANIFEST_REL = 'manifest' -&gt; packages/cli/src/config/checks/framework/site.ts; PLACEHOLDER_ORIGIN = '<https://site.invalid/>' -&gt; packages/cli/src/config/checks/framework/site.ts.

## `packages/cli/src/checks/general/site/linkinator.ts`

- apiSchema (const, 10-13): **delete**. CKG-008 drops getConfig; CKG-017 drops the zod check that the pinned package exports functions.
- executable (const, 14-14): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `executable`. CKG-029: linkinator.ts becomes linkinator-program.ts; CKG-017 drops the missing-path guard; a runtime value of the program script, so it stays there, not in config/.
- entry (const, 16-16): **inline** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `api`. One-use value; purgecss-program.ts already resolves the package inline.
- api (const, 17-17): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `api`. CKG-029: moves to linkinator-program.ts; typed with the small LinkinatorConstructor type in types/checks/framework.ts, not a new devDependency (S01-009). Values to config: LINKINATOR = 'linkinator' -&gt; packages/cli/src/config/checks/framework/site.ts.
- request (const, 18-18): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `request`. CKG-029: the request schema moves into this file (PAR-008 group 5); a runtime value of the program script, so it stays there, not in config/.
- flags (const, 19-19): **delete**. CKG-008: the config file it reads is never there.
- headers (const, 20-30): **delete**. CKG-008: the linkinator config file it reads is never there, so the value goes.
- fragments (const, 31-31): **delete**. CKG-008: the linkinator config file it reads is never there, so the value goes.
- configuredRewrites (const, 34-38): **delete**. CKG-008: only the origin rewrites stay.
- statuses (const, 46-46): **delete**. CKG-008: the linkinator config file it reads is never there, so the value goes.
- skipped (const, 58-58): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `skipped`. CKG-029: moves to linkinator-program.ts; a runtime value of the program script, so it stays there, not in config/.
- rewrites (const, 59-62): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `rewrites`. CKG-029: moves to linkinator-program.ts; a runtime value of the program script, so it stays there, not in config/.
- checker (const, 63-63): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `checker`. CKG-029: moves to linkinator-program.ts; a runtime value of the program script, so it stays there, not in config/.
- result (const, 67-99): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `result`. CKG-029: moves to linkinator-program.ts, a runtime value of the program script; CKG-008: check() keeps path, serverRoot, recurse, checkFragments, urlRewriteExpressions, linksToSkip. Values to config: LOCAL_HOSTS = \['localhost', '127.0.0.1'\] -&gt; packages/cli/src/config/checks/framework/site.ts.

## `packages/cli/src/checks/general/site/public.ts`

- pageOf (function, 25-29): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `pageOf`. CKG-029: built-page checks. Values to config: PLACEHOLDER_ORIGIN = '<https://site.invalid/>' -&gt; packages/cli/src/config/checks/framework/site.ts; INDEX_PAGE = 'index.html' -&gt; packages/cli/src/config/checks/framework/site.ts; HTML_EXTENSION = '.html' -&gt; packages/cli/src/config/checks/framework/site.ts.
- linkinator (function exported, 38-84): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `linkinator`. CKG-029: checks site/linkinator and site/linkinator-external; CKG-001 shared sitemapUrls helper; reads docs.allowed_urls (NMU-017). Values to config: BROKEN_LINK = 'BROKEN' -&gt; packages/cli/src/config/checks/framework/site.ts; HTML_EXTENSION = '.html' -&gt; packages/cli/src/config/checks/framework/site.ts; LINKINATOR = 'linkinator' -&gt; packages/cli/src/config/checks/framework/site.ts.
- htmlValidate (function exported, 91-134): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `htmlValidate`. CKG-029: moves to built-pages.ts; CKG-022: the shared tool-file lookup replaces the five-line search and its guard; no scratch prefix value (S01-013). Values to config: HTML_VALIDATE = 'html-validate' -&gt; packages/cli/src/config/checks/framework/site.ts; HTML_EXTENSION = '.html' -&gt; packages/cli/src/config/checks/framework/site.ts.
- purgecss (function exported, 141-176): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `purgecss`. CKG-029: moves to built-pages.ts; CKG-022: the shared tool-file lookup; CKG-017 drops the report-length guard. Values to config: PURGECSS = 'purgecss' -&gt; packages/cli/src/config/checks/framework/site.ts; CSS_EXTENSION = '.css' -&gt; packages/cli/src/config/checks/framework/site.ts.
- siteSize (function exported, 183-204): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `siteSize`. CKG-029: check site/size; site.max_kilobytes becomes the root record list \[\[site.size_limit\]\] with paths and kilobytes; paths are written from the repository root (docs/dist/\_astro/\*.js), so each built file is matched as &lt;build folder&gt;/&lt;file&gt; against the root list (TMF-008, CFR-004, TML-014); glossary: "over the limit".
- sitemap (function exported, 211-244): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `sitemap`. CKG-029: moves to built-pages.ts; CKG-001: read sitemap-index and every sitemap\*.xml through sitemapUrls; reads site.allowed_unlisted_pages as globs written from the repository root, and the shipped 404.html applies inside each build folder (TMF-008, NMU-015). Values to config: SITEMAP_FILE = /^sitemap.\*\\.xml$/u -&gt; packages/cli/src/config/checks/framework/site.ts.

## `packages/cli/src/checks/general/site/purgecss.ts`

- executable (const, 9-9): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `executable`. CKG-029: purgecss.ts becomes purgecss-program.ts; CKG-017 drops the missing-path guard; a runtime value of the program script, so it stays there, not in config/.
- api (const, 11-13): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `api`. CKG-029: moves to purgecss-program.ts; CKG-017 drops the zod check; typed with the small PurgecssConstructor type in types/checks/framework.ts (S01-009). Values to config: PURGECSS = 'purgecss' -&gt; packages/cli/src/config/checks/framework/site.ts.
- request (const, 14-14): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `request`. CKG-029: the request schema moves into this file (PAR-008 group 5); a runtime value of the program script, so it stays there, not in config/.
- configuration (const, 15-15): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `configuration`. CKG-029: moves to purgecss-program.ts; a runtime value of the program script, so it stays there, not in config/.
- report (const, 16-21): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `report`. CKG-029: moves to purgecss-program.ts; a runtime value of the program script, so it stays there, not in config/. Values to config: PURGECSS_CONTENT = \['\*\*/\*.html', '\*\*/\*.js'\] -&gt; packages/cli/src/config/checks/framework/site.ts.

## `packages/cli/src/checks/general/structure/config-logic.ts`

- isOutsideImport (function, 12-18): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.
- isAllowedCall (function, 20-24): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.
- isLogic (function, 26-29): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.
- logicIn (function, 31-37): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.
- configurationFindings (function, 39-77): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.
- configurationLogic (function exported, 84-101): **delete**. CKG-010: check structure/config-logic polices only this repository's config/ folders, so it goes.

## `packages/cli/src/checks/general/structure/conventions.ts`

- sourceLanguage (function, 11-15): **keep** to `packages/cli/src/checks/general/structure/conventions.ts` `sourceLanguage`. CKG-053: one shell tag; CKG-024 drop the "native" comment. Values to config: LANGUAGE_BY_EXTENSION = { '.py': 'python', '.swift': 'swift' } -&gt; packages/cli/src/config/checks/general/structure.ts.
- captureSource (function, 18-29): **keep** to `packages/cli/src/checks/general/structure/conventions.ts` `captureSource`. Real helper with one caller.
- readHouseSources (function exported, 36-56): **rename** to `packages/cli/src/checks/general/structure/conventions.ts` `readConventionSources`. Glossary convention source (NMS-018, NMS-018); stop exporting behind the NMS-018 helper that calls visitParsed once for both remaining checks.
- disposeHouseSources (function exported, 62-64): **rename** to `packages/cli/src/checks/general/structure/conventions.ts` `disposeConventionSources`. Glossary (NMS-018, NMS-018); stop exporting behind the NMS-018 helper.

## `packages/cli/src/checks/general/structure/env-owner.ts`

- bindingScope (function, 21-26): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `bindingScope`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment. Values to config: PYTHON_SCOPE_NODES = \['function_definition', 'class_definition', 'lambda'\] -&gt; packages/cli/src/config/checks/general/structure.ts.
- importName (function, 29-32): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `importName`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- bindingNames (function, 35-50): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `bindingNames`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- importNames (function, 53-63): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `importNames`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment. Values to config: OS_MODULE = 'os' -&gt; packages/cli/src/config/checks/general/structure.ts.
- pythonNames (function, 66-79): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `pythonNames`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- environmentKind (function, 82-92): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `environmentKind`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- readReceiver (function, 95-99): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `readReceiver`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- pythonEnvironment (function, 102-109): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `pythonEnvironment`. env-owner.ts is renamed in place to env-reads.ts; CKG-024 drops the "native" comment.
- envOwner (function exported, 116-155): **rename** to `packages/cli/src/checks/general/structure/env-reads.ts` `envReads`. Check structure/env-owner becomes structure/env-reads (glossary env files); CKG-025 message says "env file"; reads architecture.roles.environment_readers. Values to config: ENV_NAME = /^\[A-Z\_\]\[A-Z0-9\_\]\*$/u -&gt; packages/cli/src/config/checks/general/structure.ts.

## `packages/cli/src/checks/general/structure/file-lines.ts`

- fileLines (function exported, 14-47): **keep** to `packages/cli/src/checks/general/structure/file-lines.ts` `fileLines`. Check structure/file-lines; CKG-043 pick the comment marker from the file tag and pass the grammar, not a fake .sh path; CKG-042 limit guard goes.

## `packages/cli/src/checks/general/structure/folder-names.ts`

- folderNames (function exported, 13-37): **merge** to `packages/cli/src/checks/general/naming/checks.ts` `namingPaths`. CKG-003: naming/paths reports the folders group on directory names; folder-names.ts goes.

## `packages/cli/src/checks/general/structure/import-comments.ts`

- importRuns (function, 13-37): **delete**. CKG-055: structure/import-comments is a house-style check, so it goes.
- importComments (function exported, 44-68): **delete**. CKG-055: structure/import-comments is a house-style check, so it goes.

## `packages/cli/src/checks/general/structure/lone-files.ts`

- loneFiles (function exported, 15-38): **keep** to `packages/cli/src/checks/general/structure/lone-files.ts` `loneFiles`. Check structure/lone-files, a product check.

## `packages/cli/src/checks/general/structure/prefix-collisions.ts`

- isNestjsName (function, 13-22): **rename** to `packages/cli/src/checks/general/structure/shared-prefixes.ts` `hasDeclaredKindSuffix`. CKG-052: renamed to hasDeclaredKindSuffix; the file becomes shared-prefixes.ts with check structure/shared-prefixes. Values to config: SPEC_SUFFIX = /\\.spec$/u -&gt; packages/cli/src/config/checks/general/structure.ts.
- isSkipped (function, 24-27): **inline** to `packages/cli/src/checks/general/structure/shared-prefixes.ts` `sharedPrefixes`. S01-005: a two-line helper with one caller and a name that says nothing; its two conditions join the skip conditions in sharedPrefixes.
- prefixCollisions (function exported, 34-80): **rename** to `packages/cli/src/checks/general/structure/shared-prefixes.ts` `sharedPrefixes`. Check structure/prefix-collisions becomes structure/shared-prefixes; the file is renamed in place.

## `packages/cli/src/checks/general/structure/private-before-public.ts`

- visibilityOf (function, 11-19): **delete**. CKG-055: structure/private-before-public is a house-style check, so it goes.
- sourceDeclarations (function, 22-38): **delete**. CKG-055: structure/private-before-public is a house-style check, so it goes.
- orderMessage (function, 41-49): **delete**. CKG-055: structure/private-before-public is a house-style check, so it goes.
- privateBeforePublic (function exported, 56-85): **delete**. CKG-055: structure/private-before-public is a house-style check, so it goes.

## `packages/cli/src/checks/general/structure/public.ts`

- reasonAbove (function, 17-27): **move** to `packages/cli/src/checks/general/gspot/suppressions.ts` `reasonAbove`. CKG-028: gspot/suppressions leaves the structure folder. Values to config: REASON_ABOVE = /^(?:\\/\\/|\\/\\\*|#|--|&lt;!--)\\s\*reason:\\s\*(?&lt;reason&gt;\\S.\*)$/u -&gt; packages/cli/src/config/checks/general/gspot.ts.
- suppressionForms (function, 30-63): **move** to `packages/cli/src/checks/general/gspot/suppressions.ts` `suppressionSyntaxes`. CKG-028; glossary suppression syntax (SuppressionSyntax).
- suppressionComments (function exported, 73-111): **inline** to `packages/cli/src/checks/general/gspot/suppressions.ts` `suppressions`. CKG-054: exported only for tests; inlining drops SuppressionComment and reasonForm (CKG-023); tests read suppressions findings, the Vale comparison reads rule and line.
- suppressions (function exported, 118-146): **move** to `packages/cli/src/checks/general/gspot/suppressions.ts` `suppressions`. CKG-028; CKG-004 keeps it the one owner of suppression reasons; CKG-023 message without the regex; CKG-017 drop the selection guard.

## `packages/cli/src/checks/general/structure/source-files.ts`

- structureSources (function exported, 12-20): **keep** to `packages/cli/src/checks/general/structure/source-files.ts` `structureSources`. Three users in structure/; CKG-044 comment without a count.
- isDependencyFolder (function exported, 27-29): **keep** to `packages/cli/src/checks/general/structure/source-files.ts` `isDependencyFolder`. Two users in structure/ (lone-files, shared-prefixes).

## `packages/cli/src/checks/general/structure/stem-collisions.ts`

- stemCollisions (function exported, 11-27): **rename** to `packages/cli/src/checks/general/structure/file-folder-clashes.ts` `fileFolderClashes`. Check structure/stem-collisions becomes structure/file-folder-clashes; the file is renamed in place.

## `packages/cli/src/checks/general/structure/test-placement.ts`

- hasAssertions (function, 12-38): **delete**. CKG-011: check structure/test-placement polices only this repository's test layout, so it goes.
- testPlacement (function exported, 45-88): **delete**. CKG-011: check structure/test-placement polices only this repository's test layout, so it goes.

## `packages/cli/src/checks/general/structure/trivial-functions.ts`

- functionBody (function, 12-21): **keep** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `functionBody`. Real helper; CKG-024 drop the "native" comment.
- trivialFunctions (function exported, 28-72): **keep** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `trivialFunctions`. Check structure/trivial-functions; PAR-012 brings trivialText here; CKG-042 limit guard goes; CKG-025 message.

## `packages/cli/src/checks/public.ts`

- BUILT_IN_CALCULATIONS (const exported, 98-220): **rename** to `packages/cli/src/checks/built-in.ts` `CHECK_FUNCTIONS`. ARC-003: public.ts becomes checks/built-in.ts; glossary CHECK_FUNCTIONS (CKO-019); the docs/headings entry goes; CKG-006 unusedEntries joins it; TTC-029 tests reach it through one setup helper; it stays in code because a table of check functions imports check code, which config/ may not.
- BUILT_IN_CHECKS (const exported, 223-253): **rename** to `packages/cli/src/checks/built-in.ts` `BUILT_IN_CHECKS`. ARC-003: the file is renamed in place; CKG-006 the unmatched-paths wrapper goes; commands/check/tree.ts uses it; a table of check functions stays in code.

## `packages/cli/src/config/checks/general/dependencies.ts`

- JAVASCRIPT_CLIENTS (const exported, 2-2): **delete**. CKG-014: dead once LOCKFILES is filtered by configuration javascript.
- BUNFIG (const exported, 4-4): **merge** to `packages/cli/src/config/generation/file-edits.ts` `BUNFIG_FILE`. One value, one place: 'bunfig.toml' is BUNFIG_FILE in config/generation/file-edits.ts, beside the key edits of that file.
- LOCKFILE_URL (const exported, 6-6): **keep** to `packages/cli/src/config/checks/general/dependencies.ts` `LOCKFILE_URL`. A static value with one user; it stays in this config file.
- NPM_DOWNLOAD (const exported, 8-8): **keep** to `packages/cli/src/config/checks/general/dependencies.ts` `NPM_DOWNLOAD`. A static value with one user; it stays in this config file.
- STALE_LOCKFILE_DIAGNOSTICS (const exported, 10-16): **merge** to `packages/cli/src/config/parsers/lockfiles.ts` `LOCKFILES`. CKG-014: becomes a stale pattern field on each LOCKFILES entry that has frozen; LOCKFILES is a static table in config/parsers/lockfiles.ts (PAR-085).
- NPM_MANIFEST (const exported, 18-18): **move** to `packages/cli/src/config/parsers/dependency-files.ts` `PACKAGE_JSON`. File names live in config/: one PACKAGE_JSON in config/parsers/dependency-files.ts serves every literal package.json use (S01-007; glossary: dependency file).
- LOCKFILE_DIAGNOSTIC_LINES (const exported, 21-21): **keep** to `packages/cli/src/config/checks/general/dependencies.ts` `LOCKFILE_DIAGNOSTIC_LINES`. A named number for no-magic-numbers with one user; it stays in this config file.
- NEXT_VERSION_PAIRS (const exported, 23-26): **move** to `packages/cli/src/config/checks/framework/version-pairs.ts` `NEXT_VERSION_PAIRS`. CKG-033: framework data for its user checks/framework/version-pairs.ts, so it moves to the framework group of config/; the registry keeps its line.
- REACT_VERSION_PAIRS (const exported, 28-28): **move** to `packages/cli/src/config/checks/framework/version-pairs.ts` `REACT_VERSION_PAIRS`. CKG-033: framework data for its user checks/framework/version-pairs.ts, so it moves to the framework group of config/.

## `packages/cli/src/config/checks/general/docs.ts`

- FILE_EXTENSION (const exported, 1-1): **keep** to `packages/cli/src/config/checks/general/docs.ts` `FILE_EXTENSION`. A static value with one user; it stays in this config file.
- START_WORDS (const exported, 3-3): **keep** to `packages/cli/src/config/checks/general/docs.ts` `START_WORDS`. A static value with one user; it stays in this config file.
- CONTENTS_TITLE (const exported, 5-5): **keep** to `packages/cli/src/config/checks/general/docs.ts` `CONTENTS_TITLE`. A static value with one user; it stays in this config file.
- SECTION_DEPTH (const exported, 8-8): **keep** to `packages/cli/src/config/checks/general/docs.ts` `SECTION_DEPTH`. A named number for no-magic-numbers with one user; it stays in this config file.

## `packages/cli/src/config/checks/general/duplication.ts`

- JSCPD (const exported, 1-1): **keep** to `packages/cli/src/config/checks/general/duplication.ts` `JSCPD`. Tool names live in config/ (S01-007); the file also takes the jscpd file names and arguments.

## `packages/cli/src/config/checks/general/gspot.ts`

- CONFLICT_HELP (const exported, 3-3): **inline** to `packages/cli/src/config/checks/general/gspot.ts` `GENERATED_FILE_HELP`. CKG-038: one use, so the text is written in its GENERATED_FILE_HELP row in this config file.
- APPLY_HELP (const exported, 5-6): **keep** to `packages/cli/src/config/checks/general/gspot.ts` `APPLY_HELP`. CKG-038: used twice by GENERATED_FILE_HELP in the same file; stop exporting.
- STRAY_HELP (const exported, 8-8): **inline** to `packages/cli/src/config/checks/general/gspot.ts` `GENERATED_FILE_HELP`. CKG-038: one use, so the text is written in its GENERATED_FILE_HELP row in this config file.
- DRIFT_MESSAGES (const exported, 10-15): **rename** to `packages/cli/src/config/checks/general/gspot.ts` `GENERATED_FILE_MESSAGES`. Glossary retires "drift" (check gspot/generated-files); a lookup table that stays in config/, written as const without the Drift type, and types/ derives the kind from its keys, so config imports no type.
- DRIFT_HELP (const exported, 17-22): **rename** to `packages/cli/src/config/checks/general/gspot.ts` `GENERATED_FILE_HELP`. Glossary retires "drift"; a lookup table that stays in config/ with no Drift type import.

## `packages/cli/src/config/checks/general/licenses.ts`

- LICENSE_CHECKER (const exported, 1-1): **keep** to `packages/cli/src/config/checks/general/licenses.ts` `LICENSE_CHECKER`. Tool names live in config/, so LICENSE_CHECKER stays in this config file (S01-007).

## `packages/cli/src/config/checks/general/naming.ts`

- DIGIT (const exported, 1-1): **keep** to `packages/cli/src/config/checks/general/naming.ts` `DIGIT`. A static value with one user; it stays in this config file.
- VERB_CATEGORIES (const exported, 3-3): **keep** to `packages/cli/src/config/checks/general/naming.ts` `VERB_CATEGORIES`. A static value with one user; it stays in this config file.
- CATEGORY_PARENTS (const exported, 6-16): **keep** to `packages/cli/src/config/checks/general/naming.ts` `CATEGORY_PARENTS`. A static table used by buildLimitsFor (settings.ts) and ruleLimits (names.ts); both import it from this config file.
- SEPARATORS (const exported, 18-18): **keep** to `packages/cli/src/config/checks/general/naming.ts` `SEPARATORS`. A static value used by splitParts; it stays in this config file.
- LOWER_WORD (const exported, 20-20): **keep** to `packages/cli/src/config/checks/general/naming.ts` `LOWER_WORD`. A static value with one user; it stays in this config file.
- CAMEL_WORD (const exported, 22-22): **keep** to `packages/cli/src/config/checks/general/naming.ts` `CAMEL_WORD`. A static value with one user; it stays in this config file.
- PASCAL_WORD (const exported, 24-24): **keep** to `packages/cli/src/config/checks/general/naming.ts` `PASCAL_WORD`. A static value with one user; it stays in this config file.
- UPPER_WORD (const exported, 26-26): **keep** to `packages/cli/src/config/checks/general/naming.ts` `UPPER_WORD`. A static value with one user; it stays in this config file.
- TIMESTAMP (const exported, 28-28): **rename** to `packages/cli/src/config/checks/general/naming.ts` `DIGITS_ONLY`. CKG-037: one name, DIGITS_ONLY, for /^\\d+$/u; it stays in this config file.
- MIGRATION_DIGITS (const exported, 31-31): **keep** to `packages/cli/src/config/checks/general/naming.ts` `MIGRATION_DIGITS`. A named number for no-magic-numbers with one user; it stays in this config file.
- NUMERIC_WORDS (const exported, 34-63): **keep** to `packages/cli/src/config/checks/general/naming.ts` `NUMERIC_WORDS`. A static table used by splitParts (settings.ts) and digitFinding (names.ts); it stays in this config file.
- NUMBER_PART (const exported, 65-65): **merge** to `packages/cli/src/config/checks/general/naming.ts` `DIGITS_ONLY`. CKG-037: the same pattern as DIGITS_ONLY, so the two merge in this config file.

## `packages/cli/src/config/checks/general/prose.ts`

- SCRIPT_GRAMMAR (const exported, 2-2): **move** to `packages/cli/src/config/generation/prose.ts` `SCRIPT_GRAMMAR`. CKG-039: the missing row of the static table PROSE_GRAMMARS, which stays in config/generation/prose.ts.

## `packages/cli/src/config/checks/general/secrets.ts`

- CHANGE_LINE (const exported, 3-3): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `CHANGE_LINE`. A static value with one user; it stays in this config file.
- DIFF_TREE (const exported, 5-15): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `DIFF_TREE`. A static value with one user; it stays in this config file.
- COMMIT_METADATA (const exported, 17-17): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `COMMIT_METADATA`. A static value with one user; it stays in this config file.
- GITLEAKS_LOG_OPTIONS (const exported, 20-20): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `GITLEAKS_LOG_OPTIONS`. A static value with one user; it stays in this config file.
- RAW_CHANGE_FIELDS (const exported, 23-23): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `RAW_CHANGE_FIELDS`. A named number for no-magic-numbers with one user; it stays in this config file.
- ENV_READ_PATTERNS (const exported, 26-37): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `ENV_READ_PATTERNS`. A static value with one user; it stays in this config file.
- ENV_KEY_LINE (const exported, 40-40): **keep** to `packages/cli/src/config/checks/general/secrets.ts` `ENV_KEY_LINE`. A static value with one user; it stays in this config file.

## `packages/cli/src/config/checks/general/security.ts`

- CODEQL (const exported, 1-1): **keep** to `packages/cli/src/config/checks/general/security.ts` `CODEQL`. Tool names live in config/ (S01-007); the file also takes the CodeQL arguments, and options() reads tools.codeql through this constant.

## `packages/cli/src/config/checks/general/site.ts`

- HTML_REPORT_FILE (const exported, 1-1): **move** to `packages/cli/src/config/checks/framework/site.ts` `HTML_REPORT_FILE`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, htmlValidate.
- SITEMAP_LOCATION (const exported, 3-3): **move** to `packages/cli/src/config/checks/framework/site.ts` `SITEMAP_LOCATION`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; used by the CKG-001 sitemapUrls helper.
- SITEMAP_FILES (const exported, 5-5): **delete**. CKG-001: the shared sitemapUrls helper reads every built sitemap\*.xml instead of two fixed names.
- LINKINATOR_STATUS_ACTIONS (const exported, 7-7): **delete**. CKG-008: linkinator reads no status table, so the value goes.
- HTTP_OK_STATUS (const exported, 9-9): **move** to `packages/cli/src/config/checks/framework/site.ts` `HTTP_OK_STATUS`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; a named number for no-magic-numbers with one user, linkinator.
- LINKINATOR_PROGRAM (const exported, 11-11): **move** to `packages/cli/src/config/checks/framework/site.ts` `LINKINATOR_PROGRAM`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, linkinator.
- PURGECSS_PROGRAM (const exported, 13-13): **move** to `packages/cli/src/config/checks/framework/site.ts` `PURGECSS_PROGRAM`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, purgecss.
- TEXT_SUFFIXES (const exported, 15-36): **move** to `packages/cli/src/config/checks/framework/site.ts` `TEXT_SUFFIXES`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, unusedAssets.
- ASSET_FOLDER (const exported, 38-38): **move** to `packages/cli/src/config/checks/framework/site.ts` `ASSET_FOLDER`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, unusedAssets.
- OUTPUT_TAIL_LINES (const exported, 41-41): **move** to `packages/cli/src/config/checks/framework/site.ts` `OUTPUT_TAIL_LINES`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, runBuild.
- SHOWN_DIFFERENCES (const exported, 44-44): **move** to `packages/cli/src/config/checks/framework/site.ts` `SHOWN_DIFFERENCES`. The site checks are framework checks (CKG-029), so their config file moves to the framework group; one user, buildReproducible.

## `packages/cli/src/config/checks/general/structure.ts`

- HOUSE_QUERIES (const exported, 5-28): **rename** to `packages/cli/src/config/checks/general/structure.ts` `CONVENTION_QUERIES`. Glossary convention (NMS-018): a static query table that stays in this config file, written without the Record&lt;CountedLanguage, string&gt; annotation so config imports no type; CKG-055 drops the entrypoint, declaration and comment captures.
- OS_ENVIRONMENT_MEMBERS (const exported, 31-31): **keep** to `packages/cli/src/config/checks/general/structure.ts` `OS_ENVIRONMENT_MEMBERS`. A static value with one user; it stays in this config file, written as const without the EnvironmentKind annotation, so config imports no type.
- CONFIG_STATEMENTS (const exported, 33-40): **delete**. CKG-010: check structure/config-logic goes, so its value goes.
- CONFIG_LOGIC_NODES (const exported, 42-57): **delete**. CKG-010: check structure/config-logic goes, so its value goes.
- CONFIG_CALL_ALLOWED (const exported, 59-59): **delete**. CKG-010: check structure/config-logic goes, so its value goes.
- INDEX_STEMS (const exported, 61-61): **keep** to `packages/cli/src/config/checks/general/structure.ts` `INDEX_STEMS`. A static value with one user; it stays in this config file.
- COMMENT_STYLE_BY_EXTENSION (const exported, 64-75): **rename** to `packages/cli/src/config/checks/general/structure.ts` `COMMENT_MARKERS`. CKG-043: three rows keyed by language tag (bash, python, sql) with no "" key; a static map that stays in this config file and needs no CommentStyle type.
- TEST_PATTERN (const exported, 78-78): **delete**. CKG-011: check structure/test-placement goes, so its value goes.
- ASSERTION_MODULES (const exported, 81-81): **delete**. CKG-011: check structure/test-placement goes, so its value goes.
- TEST_DIRECTORIES (const exported, 84-84): **delete**. CKG-011: check structure/test-placement goes, so its value goes.

## `packages/cli/src/config/checks/postgres.ts`

- CONSTRAINT_SUFFIXES (const exported, 3-7): **move** to `packages/cli/src/config/checks/database.ts` `CONSTRAINT_SUFFIXES`. CKO-007: a static value used by the schema builder; it moves to config/checks/database.ts, the one file of the database group.
- PUBLIC_SCHEMA (const exported, 9-9): **move** to `packages/cli/src/config/checks/database.ts` `PUBLIC_SCHEMA`. S01-008: named static values live in config/, and two functions use it; it moves to config/checks/database.ts, the one file of the database group.
- MIGRATION_STATEMENTS (const exported, 11-18): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- DOC_LABELS (const exported, 20-23): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- PURPOSE (const exported, 25-25): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- SECTION (const exported, 27-27): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- BLOCK_REACH (const exported, 29-29): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- DOC_SEPARATOR (const exported, 31-31): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- MIGRATION_DOWN (const exported, 34-34): **move** to `packages/cli/src/config/checks/database.ts` `MIGRATION_DOWN`. CKO-007: migrations.ts and history.ts import it from config/checks/database.ts, the one file of the database group.
- HEADER_LINES (const exported, 37-37): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- LINE_ABOVE (const exported, 40-40): **delete**. CKO-041: check postgres/migration-docs is deleted, and its layout constants go with it.
- SCHEMA_PART_INDEX (const exported, 43-43): **move** to `packages/cli/src/config/checks/database.ts` `SCHEMA_PART_INDEX`. CKO-007: a named number, because no-magic-numbers allows only -1, 0, 1; it moves to config/checks/database.ts, the one file of the database group.

## `packages/cli/src/config/checks/swift-snapshot-testing.ts`

- RECORDING_MODES (const exported, 1-1): **move** to `packages/cli/src/config/checks/library.ts` `RECORDING_MODES`. CKO-007, CKG-035: one user; the library group holds six small values, so they share one file, config/checks/library.ts.
- RECORDING_NAMES (const exported, 3-3): **move** to `packages/cli/src/config/checks/library.ts` `RECORDING_NAMES`. CKO-007, CKG-035: one user; the library group holds six small values, so they share one file, config/checks/library.ts.

## `packages/cli/src/types/checks/cloudflare.ts`

- SchemaCompiler (type exported, 2-6): **delete**. DEC-021: the hand-loaded Ajv goes and v8r checks wrangler.toml, so the type has no user.

## `packages/cli/src/types/checks/docker.ts`

- ComposeFiles (type exported, 5-5): **move** to `packages/cli/src/types/checks/infrastructure.ts` `ComposeFiles`. CKO-007, CKG-035: one user; the types of the checks are few, so the infrastructure group (CKO-005, NMU-009) has one file, types/checks/infrastructure.ts.
- ComposeDeclaration (type exported, 8-8): **move** to `packages/cli/src/types/checks/infrastructure.ts` `ComposeDeclaration`. CKG-038: used only by ComposeDocuments; it moves to types/checks/infrastructure.ts, one file per configuration group, and types/ files export their types.
- ComposeDocuments (type exported, 11-11): **move** to `packages/cli/src/types/checks/infrastructure.ts` `ComposeDocuments`. CKO-007, CKG-035: one user; the types of the checks are few, so the infrastructure group has one file, types/checks/infrastructure.ts.

## `packages/cli/src/types/checks/general/docs.ts`

- TaskSources (type exported, 2-2): **keep** to `packages/cli/src/types/checks/general.ts` `TaskSources`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- PathIndex (type exported, 5-8): **keep** to `packages/cli/src/types/checks/general.ts` `PathIndex`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.

## `packages/cli/src/types/checks/general/duplication.ts`

- CloneReport (type exported, 5-5): **delete**. cloneFindings is inlined into jscpd, which uses the parsed result of cloneReportSchema (moving into duplication.ts, PAR-008); tests go through jscpd.
- CloneScope (type exported, 8-8): **delete**. One-use bundle of four arguments (CKG-057 pattern); cloneFindings is inlined.

## `packages/cli/src/types/checks/general/generated-code.ts`

- GeneratedPath (type exported, 4-4): **move** to `packages/cli/src/types/configurations.ts` `GeneratedPath`. CKG-032: the original field goes (CKG-058), so the type is one generated_paths entry of the manifest schema; every exported type is hand-written in types/configurations.ts, and its schema is checked with satisfies z.ZodType&lt;T&gt; (S01-006).

## `packages/cli/src/types/checks/general/licenses.ts`

- LicensedPackage (type exported, 5-5): **keep** to `packages/cli/src/types/checks/general.ts` `LicensedPackage`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- LicenseException (type exported, 7-7): **move** to `packages/cli/src/types/checks/general.ts` `AllowedPackage`. TML-009: one \[\[licenses.allowed_package\]\] record, { name, version, reason }, with no license field; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- LicenseAllowlist (type exported, 10-10): **delete**. CKG-038: its one user ProjectLicenses types its configuration field with the hand-written \[licenses\] table interface, so this z.infer type has no user (S01-004).
- ProjectLicenses (type exported, 13-18): **keep** to `packages/cli/src/types/checks/general.ts` `ProjectLicenses`. A type with one user in types/checks/general.ts, one file per configuration group; its configuration field takes the hand-written \[licenses\] table interface in the same file (LAY-004), so types/checks/general.ts and types/settings/tables.ts do not import each other; field manifest becomes dependencyFile (glossary, PAR-063).
- LicenseScanner (type exported, 21-24): **delete**. S01-003: padding that only annotates one inline object in scanLicenses; TypeScript infers the union once the identity lambda says (name: string) =&gt; name.

## `packages/cli/src/types/checks/general/naming.ts`

- Term (type exported, 9-9): **keep** to `packages/cli/src/types/checks/general.ts` `Term`. Used by settings.ts and names.ts; it lives in types/checks/general.ts, one file per configuration group.
- NamingInputs (type exported, 12-15): **keep** to `packages/cli/src/types/checks/general.ts` `NamingInputs`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- NamingContext (type exported, 18-18): **keep** to `packages/cli/src/types/checks/general.ts` `NamingContext`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- PathRule (type exported, 21-32): **rename** to `packages/cli/src/types/checks/general.ts` `CompiledOverride`. NMS table B name; it moves into types/checks/general.ts, one file per configuration group; the names field goes and allowed holds the allowed_names of the override (TML-005).
- CategoryLimits (type exported, 35-35): **keep** to `packages/cli/src/types/checks/general.ts` `CategoryLimits`. Part of NamingSettings and used by names.ts; it lives in types/checks/general.ts, one file per configuration group.
- EffectivePolicy (type exported, 38-46): **rename** to `packages/cli/src/types/checks/general.ts` `NamingSettings`. Glossary name NamingSettings (NMS table B); it moves into types/checks/general.ts, one file per configuration group; reserved holds only the shipped terms (TML-005), and allowed holds only the shipped list because naming.allowed merges into \[\[naming.override\]\] allowed_names.
- PathContainer (type exported, 49-49): **move** to `packages/cli/src/types/checks/general.ts` `PathContainer`. Every exported type is hand-written in types/, and its schema pathContainerSchema is checked with satisfies z.ZodType&lt;T&gt;; it moves into types/checks/general.ts.
- NamingSource (type exported, 52-52): **keep** to `packages/cli/src/types/checks/general.ts` `NamingSource`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- FileNames (type exported, 54-54): **keep** to `packages/cli/src/types/checks/general.ts` `FileNames`. Used by declaredNames and the unused-name report, which both land in naming/checks.ts; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.

## `packages/cli/src/types/checks/general/prose.ts`

- ProseRoute (type exported, 1-1): **keep** to `packages/cli/src/types/checks/general.ts` `ProseRoute`. Its one user is the prose check; ProseRoute stays written by hand as { path: string; mode: 'path' | 'stdin'; extension: string }, because ProseGrammar is deleted (S04-007); the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- ProseRouteGroup (type exported, 4-4): **keep** to `packages/cli/src/types/checks/general.ts` `ProseRouteGroup`. Belongs with ProseRoute; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.

## `packages/cli/src/types/checks/general/secrets.ts`

- SecretScan (type exported, 3-3): **delete**. CKG-057: one-use bundle of two values.

## `packages/cli/src/types/checks/general/security.ts`

- CodeqlLanguage (type exported, 2-2): **delete**. CKG-057: one-use argument bundle.
- CodeqlAnalysis (type exported, 5-5): **delete**. CKG-057: one-use argument bundle.

## `packages/cli/src/types/checks/general/site.ts`

- SiteBuild (type exported, 5-11): **move** to `packages/cli/src/types/checks/framework.ts` `SiteBuild`. Only build.ts names it; the site checks are framework checks (CKG-029), so it moves to types/checks/framework.ts, one file per configuration group, and types/ files export their types.
- LinkinatorFlags (type exported, 14-36): **delete**. CKG-008: linkinator reads no flags file, so the type goes.
- LinkinatorConstructor (type exported, 39-54): **move** to `packages/cli/src/types/checks/framework.ts` `LinkinatorConstructor`. S01-009: no devDependency for the package types; a trimmed type stays: on(pagestart) and check() with the six kept options, returning Promise&lt;{ passed: boolean }&gt; (no schema import); it lives in types/checks/framework.ts, one file per configuration group.
- LinkinatorOptionsReader (type exported, 57-57): **delete**. CKG-008: linkinator reads no options file, so the type goes.
- PurgecssConstructor (type exported, 60-62): **move** to `packages/cli/src/types/checks/framework.ts` `PurgecssConstructor`. S01-009: no devDependency for the package types, so the small type stays in types/; it lives in types/checks/framework.ts, one file per configuration group.

## `packages/cli/src/types/checks/general/structure.ts`

- HouseSource (type exported, 8-8): **rename** to `packages/cli/src/types/checks/general.ts` `ConventionSource`. Glossary convention source (NMS table B, NMS-018); env-reads.ts and trivial-functions.ts read it; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- HouseSourceInput (type exported, 11-14): **inline** to `packages/cli/src/checks/general/structure/conventions.ts` `readConventionSources`. One-use parameter type; it becomes an inline type expression in the parameter of readConventionSources.
- EnvironmentKind (type exported, 17-17): **keep** to `packages/cli/src/types/checks/general.ts` `EnvironmentKind`. Used by env-reads.ts and OS_ENVIRONMENT_MEMBERS; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- EnvironmentScope (type exported, 18-18): **keep** to `packages/cli/src/types/checks/general.ts` `EnvironmentScope`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- EnvironmentNames (type exported, 19-19): **keep** to `packages/cli/src/types/checks/general.ts` `EnvironmentNames`. A type with one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- HouseDeclaration (type exported, 22-22): **delete**. CKG-055: only check structure/private-before-public used it, and that check goes.
- SuppressionForm (type exported, 24-30): **move** to `packages/cli/src/types/checks/general.ts` `SuppressionSyntax`. Glossary suppression syntax (NMS table B); field form becomes tool; its one user is the gspot check gspot/suppressions (CKG-028); the types of the checks are few, so it lives in one file per configuration group, types/checks/general.ts.
- CommentStyle (type exported, 33-33): **delete**. CKG-043: COMMENT_MARKERS maps a language tag to a marker; the tuple type and its wrong comment go.

## `packages/cli/src/types/checks/nginx.ts`

- Mount (type exported, 2-2): **move** to `packages/cli/src/types/checks/infrastructure.ts` `Mount`. CKO-007, CKG-035: its one user is infrastructure/nginx.ts (CKO-004); the types of the checks are few, so it lives in one file per configuration group, types/checks/infrastructure.ts.
- NginxMounts (type exported, 5-5): **move** to `packages/cli/src/types/checks/infrastructure.ts` `NginxMounts`. CKO-007, CKG-035: one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/infrastructure.ts.

## `packages/cli/src/types/checks/postgres.ts`

- StatementReader (type exported, 4-8): **move** to `packages/cli/src/types/checks/database.ts` `StatementReader`. CKO-007: one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- SchemaAlterations (type exported, 11-13): **move** to `packages/cli/src/types/checks/database.ts` `SchemaAlterations`. CKO-007: one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- Declared (type exported, 16-16): **move** to `packages/cli/src/types/checks/database.ts` `Declared`. CKO-007: part of Schema and ForeignKey; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts, and types/ files export their types.
- ForeignKey (type exported, 19-19): **move** to `packages/cli/src/types/checks/database.ts` `ForeignKey`. CKO-007: part of the database types; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts, and types/ files export their types.
- Migration (type exported, 22-29): **move** to `packages/cli/src/types/checks/database.ts` `Migration`. CKO-007: a shared Postgres type for access.ts, schema.ts, history.ts and the test setup; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- Schema (type exported, 32-39): **move** to `packages/cli/src/types/checks/database.ts` `Schema`. CKO-007: the type buildSchema returns; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- SchemaState (type exported, 41-44): **move** to `packages/cli/src/types/checks/database.ts` `SchemaState`. CKO-007: one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- Location (type exported, 46-46): **move** to `packages/cli/src/types/checks/database.ts` `Location`. CKO-007: one user; the types of the checks are few, so it lives in one file per configuration group, types/checks/database.ts.
- MigrationStatement (type exported, 49-49): **delete**. CKO-041: only MIGRATION_STATEMENTS of check postgres/migration-docs used it, and that check goes.
