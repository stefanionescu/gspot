# Source: install, apply, ownership, planning, tools, rules, and the shipped configurations

684 rows. move 389, keep 170, delete 66, merge 23, rename 19, inline 11, split 6.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/agent-rules/contracts.ts`

- rulesByArea (function, 9-20): **move** to `packages/cli/src/rules.ts` `rulesByArea`. Moves to src/rules.ts, because agent-rules/ becomes one file; GEN-011: skip FIRST_READ files and label them General; LIF-045: carry kind in RuleSource and drop the cast.
- indexLines (function, 22-35): **move** to `packages/cli/src/rules.ts` `indexLines`. Moves to src/rules.ts, because agent-rules/ becomes one file; TML-003: the own_rules_folder row (Project rules) goes and the folder is always RULES_DIRECTORY.
- managedBlock (function exported, 46-59): **move** to `packages/cli/src/rules.ts` `managedBlock`. Moves to src/rules.ts; the glossary keeps the name "managed block"; GEN-011 drops the two level lines; LIF-045: one true header.

## `packages/cli/src/agent-rules/public.ts`

- configurationRules (function, 16-30): **move** to `packages/cli/src/rules.ts` `configurationRules`. Moves to src/rules.ts, because agent-rules/ becomes one file.
- selectRuleFiles (function exported, 42-66): **move** to `packages/cli/src/rules.ts` `selectRuleFiles`. Moves to src/rules.ts under the glossary word "rules"; CFG-050 deletes the shared always_selected line; CFL-025 deletes the front matter strip; TML-003, TMF-008: the target path is RULES_DIRECTORY/&lt;path&gt; with no folder setting, and because exclude entries are root-relative, the test compares the entry with RULES_DIRECTORY/&lt;path&gt;.
- textAtLevel (function exported, 74-85): **move** to `packages/cli/src/rules.ts` `textAtLevel`. Moves to src/rules.ts; LIF-042; stop exporting: only tests import it; tests go through selectRuleFiles.

## `packages/cli/src/config/lifecycle/drift.ts`

- DRIFT_DIFF_CONTEXT (const exported, 1-1): **move** to `packages/cli/src/config/apply.ts` `DIFF_CONTEXT_LINES`. Moves to config/apply.ts with the other apply constants; one user; the glossary retires "drift" in code; it stays a named number (no-magic-numbers).

## `packages/cli/src/config/lifecycle/ownership.ts`

- OWNED_KINDS (const exported, 5-5): **move** to `packages/cli/src/config/ownership.ts` `OWNED_KINDS`. Moves to config/ownership.ts beside the log schema that reads it; the log schema and types/ownership.ts (OwnedKind) import it, so there is no type cycle; the list is \['tool_file', 'block', 'keys', 'settings', 'pin', 'hook', 'lock'\] (glossary: settings, not policy; LIF-054: managed keys, not merge), and an old ownership.json is read with no migration (version 0.1.0).
- ADOPTED_KINDS (const exported, 9-9): **move** to `packages/cli/src/config/ownership.ts` `ADOPTED_KINDS`. Moves to config/ownership.ts; one user (planChange); config/ imports no types, so it is a Set of (typeof OWNED_KINDS)\[number\], not Set&lt;OwnedKind&gt;.
- MOVED_HEADING (const exported, 12-12): **delete**. Delete (A5): gspot never touches CLAUDE.md, so apply/claude-md.ts (lifecycle/ownership/claude-file.ts) goes.
- OWNERSHIP_JSON_INDENT (const exported, 14-14): **move** to `packages/cli/src/config/ownership.ts` `OWNERSHIP_JSON_INDENT`. Moves to config/ownership.ts; one user.
- RETAINED_PATHS (const exported, 17-17): **move** to `packages/cli/src/config/apply.ts` `RETAINED_PATHS`. Moves to config/apply.ts: an apply concept (the files apply keeps), read only by isStray in apply/stale.ts.
- MERGED_CONFIGURATION_FORMATS (const exported, 20-20): **move** to `packages/cli/src/config/ownership.ts` `MANAGED_KEYS_FORMATS`. Moves to config/ownership.ts as MANAGED_KEYS_FORMATS (LIF-054: managed keys); one user, the log schema.

## `packages/cli/src/config/lifecycle/selection.ts`

- NO_CONFIGURATIONS (const exported, 1-1): **move** to `packages/cli/src/config/commands/init.ts` `NO_CONFIGURATIONS`. Moves to config/commands/init.ts, the file of init constants, because both users are init code (LIF-009).

## `packages/cli/src/config/lifecycle/version-pin.ts`

- PIN_INSTALL_COMMANDS (const exported, 2-8): **merge** to `packages/cli/src/config/generation/hooks.ts` `RUNNERS`. Merges into the static RUNNERS table in config/generation/hooks.ts (INS-014: one table with command, missing and pin fields beside the hook runner commands); INS-006: exact flags (--save-exact, --exact); INX-002, INX-003, INX-005: RUNNERS is keyed by RUNNER_NAMES from config/repository/tooling.ts (no gspot or global row), and the mise pin field is 'mise use npm:@gspothq/cli@&lt;version&gt;'.

## `packages/cli/src/config/tools/install.ts`

- SETUP (const exported, 1-1): **rename** to `packages/cli/src/config/tools/diagnostics.ts` `REINSTALL_HINT`. Renamed REINSTALL_HINT, because "setup" is the glossary word for preparing a machine; moves to config/tools/diagnostics.ts beside its users, tools/diagnostics.ts and the lockfile checks.
- VERSION_TIMEOUT_MS (const exported, 3-3): **delete**. Delete: S05-007: a second fixed time limit (15 s) for --version, mise which and the npm client version; the owner allows one time limit per concern, so these runs take the one tool timeout (tool_timeout_seconds, EXG-030).
- HOST_HINTS (const exported, 5-18): **split** to `packages/cli/configurations/testing/pytest/manifest.toml; packages/cli/configurations/testing/vitest/manifest.toml; packages/cli/configurations/language/javascript/manifest.toml; packages/cli/configurations/library/drizzle/manifest.toml; packages/cli/configurations/platform/cloudflare/manifest.toml; packages/cli/configurations/language/swift/manifest.toml; packages/cli/configurations/infrastructure/xcode/manifest.toml; packages/cli/configurations/infrastructure/docker/manifest.toml; packages/cli/configurations/language/bash/manifest.toml` `install_hint`. Splits into install_hint (LIF-044): each hint goes into its \[\[tool\]\] declaration as install_hint; delete the xcstringstool entry (no declaration); glossary: system tool, not host.
- TOOL_ENV (const exported, 20-20): **move** to `packages/cli/src/config/tools/run.ts` `TOOL_ENV`. Moves to config/tools/run.ts (running a tool); users runTool and, by S05-010, readToolVersion instead of its own { NO_COLOR: '1' }.
- INSTALL_OUTPUT_LIMIT (const exported, 23-23): **keep** to `packages/cli/src/config/tools/diagnostics.ts` `INSTALL_OUTPUT_LIMIT`. Moves to config/tools/diagnostics.ts beside its users, tools/diagnostics.ts and the lockfile checks (config/install.ts already names the install area); the test checks the output length.
- SECRET_ENVIRONMENT_KEY (const exported, 25-25): **delete**. Delete: gspot keeps only the URL-password redaction and the value redaction of registryCredentials; the other redaction patterns go.
- HTTP_URL (const exported, 27-27): **keep** to `packages/cli/src/config/tools/diagnostics.ts` `HTTP_URL`. Moves to config/tools/diagnostics.ts beside the URL credential code, near its users tools/npm/lockfiles.ts and tools/python/settings.ts and the lockfile checks.
- URL_CREDENTIALS (const exported, 29-29): **keep** to `packages/cli/src/config/tools/diagnostics.ts` `URL_CREDENTIALS`. Moves to config/tools/diagnostics.ts: gspot keeps the URL-password redaction; one user.
- CREDENTIAL_ASSIGNMENT (const exported, 31-32): **delete**. Delete: gspot keeps only the URL-password redaction plus the value redaction of registryCredentials (S05-012 keeps writeNpmrc and its .gspot/.npmrc of references), so this redaction pattern has no use.
- AUTHORIZATION_HEADER (const exported, 34-34): **delete**. Delete: gspot keeps only the URL-password redaction plus the value redaction of registryCredentials, so this redaction pattern has no use.

## `packages/cli/src/config/tools/mise.ts`

- TOOL_PROJECT_FILES (const exported, 5-8): **delete**. Delete: its one user duplicateMisePins goes with the duplicate-pin detection (INX-007).

## `packages/cli/src/config/tools/npm.ts`

- INTEGRITY (const exported, 3-3): **keep** to `packages/cli/src/config/tools/npm.ts` `INTEGRITY`. Stays in config/tools/npm.ts, where it fits; one user.
- CREDENTIAL_KEY (const exported, 5-5): **keep** to `packages/cli/src/config/tools/npm.ts` `CREDENTIAL_KEY`. Stays in config/tools/npm.ts: S05-012 keeps registryCredentials, and A6 rules out a copy of the repository .npmrc.
- ENCODED_CREDENTIAL_KEY (const exported, 7-7): **keep** to `packages/cli/src/config/tools/npm.ts` `ENCODED_CREDENTIAL_KEY`. Stays in config/tools/npm.ts: S05-012 keeps registryCredentials, its user.
- CONNECTION_URL_KEY (const exported, 9-9): **keep** to `packages/cli/src/config/tools/npm.ts` `CONNECTION_URL_KEY`. Stays in config/tools/npm.ts: S05-012 keeps registryCredentials, its user.
- NPM_SETTING_PREFIX (const exported, 11-11): **keep** to `packages/cli/src/config/tools/npm.ts` `NPM_SETTING_PREFIX`. Stays in config/tools/npm.ts: S05-008: not dead; registryEnvironment writes npm_config\_&lt;key&gt;, and registryFor (twice), stripRegistryUrls and yarnSettings read npm_config_registry by hand; all use this one prefix.
- PACKAGE_SETTING_VARIABLE_PREFIX (const exported, 13-13): **keep** to `packages/cli/src/config/tools/npm.ts` `PACKAGE_SETTING_VARIABLE_PREFIX`. Stays in config/tools/npm.ts: S05-012 keeps writeNpmrc and its environment references.
- YARN_SETTING_VARIABLE_PREFIX (const exported, 15-15): **keep** to `packages/cli/src/config/tools/npm.ts` `YARN_SETTING_VARIABLE_PREFIX`. Stays in config/tools/npm.ts: S05-012 keeps yarnSettings.
- GITHUB_DOWNLOAD_URL (const exported, 18-19): **delete**. Delete (LIF-025): the GitHub refusal guess goes.
- GITHUB_REFUSAL (const exported, 21-21): **delete**. Delete (LIF-025): the GitHub refusal guess goes, because the full output is shown anyway.
- CONNECTION_KEYS (const exported, 23-34): **keep** to `packages/cli/src/config/tools/npm.ts` `CONNECTION_KEYS`. Stays in config/tools/npm.ts; one user, registryEnvironment, which serves only runNpmClient because the mise step passes no registry settings to mise (INX-006).
- YARN_CONNECTION_KEYS (const exported, 36-51): **keep** to `packages/cli/src/config/tools/npm.ts` `YARN_CONNECTION_KEYS`. Stays in config/tools/npm.ts: S05-012 keeps yarnSettings.
- YARN_ENVIRONMENT_SETTINGS (const exported, 53-61): **keep** to `packages/cli/src/config/tools/npm.ts` `YARN_ENVIRONMENT_SETTINGS`. Stays in config/tools/npm.ts: S05-012 keeps yarnSettings.
- LOCKFILE_ARGUMENTS (const exported, 64-68): **keep** to `packages/cli/src/config/tools/npm.ts` `LOCKFILE_ARGUMENTS`. Stays in config/tools/npm.ts; one user (npmClientCommands); keeps --network-concurrency=1; written as const without the Record&lt;...PackageInstaller...&gt; annotation, because config/ imports no types and the caller checks the key.
- INSTALL_ARGUMENTS (const exported, 71-75): **keep** to `packages/cli/src/config/tools/npm.ts` `INSTALL_ARGUMENTS`. Stays in config/tools/npm.ts; one user; written as const with no type import.
- YARN_ARGUMENTS (const exported, 78-81): **keep** to `packages/cli/src/config/tools/npm.ts` `YARN_ARGUMENTS`. Stays in config/tools/npm.ts; one user.

## `packages/cli/src/config/tools/python.ts`

- UV_LOCKFILE_ARGUMENTS (const exported, 2-2): **keep** to `packages/cli/src/config/tools/python.ts` `UV_LOCKFILE_ARGUMENTS`. Stays in config/tools/python.ts, where it fits; users are the Python project code and one integration test.
- UV_VENV_ARGUMENTS (const exported, 3-3): **keep** to `packages/cli/src/config/tools/python.ts` `UV_VENV_ARGUMENTS`. Stays in config/tools/python.ts; one user; S05-009: drop --relocatable, because A6 builds .venv in place and nothing moves it.
- UV_INSTALL_ARGUMENTS (const exported, 4-4): **keep** to `packages/cli/src/config/tools/python.ts` `UV_INSTALL_ARGUMENTS`. Stays in config/tools/python.ts; one user.
- INDEX_SETTINGS (const exported, 5-16): **keep** to `packages/cli/src/config/tools/python.ts` `INDEX_SETTINGS`. Stays in config/tools/python.ts; one user.
- URL_SCHEME (const exported, 17-17): **keep** to `packages/cli/src/config/tools/python.ts` `URL_SCHEME`. Stays in config/tools/python.ts; one user.

## `packages/cli/src/config/tools/vale.ts`

- VALE_PACKAGES (const exported, 2-2): **keep** to `packages/cli/src/config/tools/vale.ts` `VALE_PACKAGES`. Stays in config/tools/vale.ts, where it fits; every module may import config/ (S05-011), and the config/tools/!(vale).ts glob goes.
- PACKAGE_FOLDERS (const exported, 5-5): **inline** to `packages/cli/src/config/tools/vale.ts` `VALE_PACKAGE_FOLDERS`. Inline: no outside user; its one value joins VALE_PACKAGE_FOLDERS in config/tools/vale.ts (S05-011).
- VALE_PACKAGE_FOLDERS (const exported, 8-8): **keep** to `packages/cli/src/config/tools/vale.ts` `VALE_PACKAGE_FOLDERS`. Stays in config/tools/vale.ts (S05-011).

## `packages/cli/src/configurations/contracts.ts`

- miseOs (function, 24-28): **delete**. Delete: INX-006: the generated .gspot/mise.toml has no os lists; gspot names only the tools that have a build for this OS and CPU in its mise install call, and missingBuild compares the platform and platform-arch names without an architecture suffix.
- recordPinVersions (function, 31-46): **move** to `scripts/manifests.ts` `assertPinsAgree`. Moves to scripts/manifests.ts as assertPinsAgree (LIF-057): a check of shipped manifests runs at build time in assertManifests (ROOT-017: root scripts/), not in every collectPins call; its map of pin owners keeps the type PinRequirement from types/configurations.ts.
- allChecks (function exported, 53-62): **move** to `packages/cli/src/configurations/manifests.ts` `allChecks`. Moves to configurations/manifests.ts; ARC-002 file names; reads the checks of every manifest.
- toolFileName (function exported, 69-73): **move** to `packages/cli/src/configurations/manifests.ts` `toolFileName`. Moves to configurations/manifests.ts; ARC-002; names a manifest tool file target; users in checks, execution, planning.
- pinOf (function exported, 80-85): **move** to `packages/cli/src/configurations/tool-pins.ts` `pinOf`. Moves to tool-pins.ts (LIF-008); both users (misePins, uvPin) are there, so stop exporting; INX-006: it returns name, version and options only, with no os field.
- toolProjectPins (function exported, 92-109): **move** to `packages/cli/src/configurations/tool-pins.ts` `toolProjectPins`. Moves to configurations/tool-pins.ts (LIF-008): contracts.ts becomes tool-pins.ts.
- collectPins (function exported, 116-128): **move** to `packages/cli/src/configurations/tool-pins.ts` `collectPins`. Moves to configurations/tool-pins.ts; LIF-008; LIF-057 drops the pin conflict check from it.
- toolPin (function exported, 138-147): **move** to `packages/cli/src/configurations/tool-pins.ts` `toolDeclaration`. Moves to configurations/tool-pins.ts as toolDeclaration; NMS table B (it returns the whole tool declaration; "pin" is an exact version); LIF-056 delete the preferred parameter.
- checkToolPin (function exported, 155-159): **move** to `packages/cli/src/configurations/tool-pins.ts` `toolWithCheckFloor`. Moves to configurations/tool-pins.ts as toolWithCheckFloor; LIF-008; it adds a check's version floor to a tool declaration (glossary: pin is an exact version).
- toolName (function exported, 166-168): **move** to `packages/cli/src/configurations/tool-pins.ts` `toolName`. Moves to configurations/tool-pins.ts (LIF-008).
- toolProjectPackage (function exported, 175-187): **move** to `packages/cli/src/configurations/tool-pins.ts` `toolProjectPackage`. Moves to tool-pins.ts (LIF-008); it writes the tool name 'node' instead of NPM_REQUIRES, and that name is a config value that prepareNpmLockfile uses too. Values to config: NODE_TOOL = 'node' -&gt; packages/cli/src/config/tools/npm.ts
- npmToolNames (function exported, 194-203): **move** to `packages/cli/src/configurations/tool-pins.ts` `npmToolNames`. Moves to configurations/tool-pins.ts (LIF-008).
- misePin (function exported, 210-216): **move** to `packages/cli/src/configurations/tool-pins.ts` `misePin`. Moves to configurations/tool-pins.ts (LIF-008).
- isBelowFloor (function exported, 225-229): **move** to `packages/cli/src/tools/versions.ts` `isBelowFloor`. Moves to tools/versions.ts; runtime user is tools/ (toolVersionState); the build check in scripts/manifests.ts imports it from there; LIF-049 one comment.

## `packages/cli/src/configurations/errors/contracts.ts`

- assertRequirementsExist (function, 22-26): **move** to `scripts/manifests.ts` `assertRequirementsExist`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertDefaultsDeclared (function, 29-37): **move** to `scripts/manifests.ts` `assertDefaultsDeclared`. Moves to scripts/manifests.ts (A9): the declared names come from settings/schema/tables.ts and no manifest declares a setting, so only the undeclared-name refusal stays; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertSettingsAgree (function, 40-55): **delete**. Delete (A9): each setting is declared once in settings/schema/tables.ts, so two declarations cannot disagree.
- assertNoReplacementCycle (function, 58-71): **move** to `scripts/manifests.ts` `assertNoReplacementCycle`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertReplacement (function, 74-81): **move** to `scripts/manifests.ts` `assertReplacement`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertToolPin (function, 83-92): **move** to `scripts/manifests.ts` `assertToolPin`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- settingsRead (function, 95-104): **move** to `scripts/manifests.ts` `settingsRead`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertSettingWait (function, 107-132): **move** to `scripts/manifests.ts` `assertSettingWait`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertToolFileConsumers (function, 135-174): **move** to `scripts/manifests.ts` `assertToolFileConsumers`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- assertRuleFiles (function, 177-187): **move** to `scripts/manifests.ts` `assertRuleFiles`. Moves to scripts/manifests.ts; LIF-007 (ROOT-017: into the root scripts/ folder): build-only manifest checks leave the shipped source; the build calls them once.
- manifestError (function exported, 195-197): **move** to `packages/cli/src/configurations/manifests.ts` `manifestError`. Moves to src/configurations/manifests.ts (LIF-007 keeps it in src/configurations); the manifest reader throws it.
- declaredTools (function exported, 204-214): **move** to `packages/cli/src/configurations/manifests.ts` `declaredTools`. Moves to configurations/manifests.ts; LIF-007 keeps it in src/configurations; linkManifestTools uses it.
- assertManifests (function exported, 221-241): **move** to `scripts/manifests.ts` `assertManifests`. Moves to scripts/manifests.ts (LIF-007, ROOT-017); A9: the declared settings come from settings/schema/tables.ts, not manifest.settings; SCR-005: called once from scripts/build.ts; drop the call in the setting-schema script; tests import it from scripts/.

## `packages/cli/src/configurations/errors/public.ts`

- CHECK_RULES (const, 23-64): **move** to `scripts/manifests.ts` `CHECK_CONTRADICTIONS`. Moves into assertManifests in scripts/manifests.ts as CHECK_CONTRADICTIONS (LIF-010: CheckRule is no lint rule); LIF-006 deletes the sixth entry (manual with nothing slow); it is a table of check functions, not static values, so it stays out of config/.
- toolFileReaders (function, 66-76): **delete**. Delete (LIF-006): the "no check reads it and no pointer" check goes.
- manifestTableErrors (function, 79-92): **delete**. Delete (LIF-006): it checks the fixed table order on every start.
- manifestErrors (function exported, 100-123): **merge** to `scripts/manifests.ts` `assertManifests`. Merges into assertManifests in scripts/manifests.ts (LIF-006): only the CHECK_CONTRADICTIONS loop stays, at build time; parseManifest does one schema parse.
- unknownConfigurationDiagnostic (function exported, 131-134): **move** to `packages/cli/src/configurations/unknown-names.ts` `unknownConfigurationMessage`. Moves to configurations/unknown-names.ts as unknownConfigurationMessage; glossary retires "diagnostic".
- unknownConfigurations (function exported, 142-153): **move** to `packages/cli/src/configurations/unknown-names.ts` `unknownConfigurations`. Moves to configurations/unknown-names.ts.
- unknownCheckDiagnostic (function exported, 161-164): **move** to `packages/cli/src/configurations/unknown-names.ts` `unknownCheckMessage`. Moves to configurations/unknown-names.ts as unknownCheckMessage; glossary retires "diagnostic".

## `packages/cli/src/configurations/public.ts`

- issueLines (function, 26-36): **move** to `packages/cli/src/configurations/manifests.ts` `issueLines`. Moves to manifests.ts, the file named for manifests.
- locatedConfiguration (function, 39-46): **inline** to `packages/cli/src/configurations/manifests.ts` `parseManifest`. Inline into parseManifest in configurations/manifests.ts (LIF-006): delete the name/kind refusal; name and kind come from the folder in one expression.
- state (const, 48-48): **delete**. Delete (CMD-086): a module-level let replaces the wrapper object and ManifestCache.
- shipped (const, 50-50): **move** to `packages/cli/src/configurations/manifests.ts` `namingDefaultsCache`. Moves to manifests.ts as namingDefaultsCache, the cache of namingDefaults (CFG-035); it is a module-level let cache, not a static value, so it stays out of config/.
- registerManifest (function, 53-59): **inline** to `packages/cli/src/configurations/manifests.ts` `configurationManifests`. Inline into configurationManifests (INS-009: "configuration manifest", not "embedded"); S05-001: its only check (two configurations with one folder name) checks shipped data, so it joins assertManifests in scripts/manifests.ts (LIF-006, LIF-007), and the two lines left have one caller. Values to config: MANIFEST_FILE = 'manifest.toml' -&gt; packages/cli/src/config/configurations.ts
- visit (function, 63-84): **move** to `packages/cli/src/configurations/select.ts` `visit`. Moves to select.ts (requirement closure); S05-002: drop the visiting stack and the circle message: requirements come only from shipped manifests, so assertManifests refuses a requirement cycle at build time beside assertNoReplacementCycle, and visit adds the name to seen before it walks the requirements, so no input can loop.
- parseManifest (function exported, 92-146): **move** to `packages/cli/src/configurations/manifests.ts` `parseManifest`. Moves to manifests.ts, the entry point for parsing a manifest; tests build manifests through it (LIF-042); A9: no settings field; CFL-006 deletes the fragment merge; CFL-052 keeps the semgrep/ folder rule (plain .yml after CFL-001). Values to config: SEMGREP_FOLDER = 'semgrep/' -&gt; packages/cli/src/config/configurations.ts; SEMGREP_TOOL_FILE = { tool: 'semgrep', rule_keys: \['rules'\], per_scope: true, when: { configuration: 'security' } } -&gt; packages/cli/src/config/configurations.ts
- linkManifestTools (function exported, 153-170): **move** to `packages/cli/src/configurations/manifests.ts` `linkManifestTools`. Moves to configurations/manifests.ts; LIF-042; stop exporting: only configurationManifests calls it; tests use parseManifest and configurationManifests.
- configurationManifests (function exported, 176-188): **move** to `packages/cli/src/configurations/manifests.ts` `configurationManifests`. Moves to manifests.ts; a module-level let holds the manifests; INS-009 comment; the caller adds the slash to CONFIGURATIONS_FOLDER. Values to config: CONFIGURATIONS_FOLDER = 'configurations' -&gt; packages/cli/src/config/configurations.ts
- knownChecks (function exported, 195-199): **move** to `packages/cli/src/configurations/manifests.ts` `knownChecks`. Moves to manifests.ts with the other manifest readers.
- namingTerms (function exported, 205-208): **move** to `packages/cli/src/configurations/manifests.ts` `namingDefaults`. Moves to configurations/manifests.ts as namingDefaults (CFG-035): naming/policy.json becomes naming/defaults.json; glossary "naming defaults".
- configurationFiles (function exported, 215-222): **move** to `packages/cli/src/configurations/manifests.ts` `ruleFiles`. Renamed ruleFiles (glossary: rules) and moved to manifests.ts; policy/ also calls it, so it stays below src/rules.ts.
- pythonInstallerPin (function exported, 228-235): **move** to `packages/cli/src/configurations/tool-pins.ts` `uvPin`. Renamed uvPin, because uv has one name (LIF-052); INX-006: its user is misePins (uv is a program tool in .gspot/mise.toml); installUv and the pip install hints of the uv project go, so uv is found like any program tool. Values to config: PYTHON_CONFIGURATION = 'python' -&gt; packages/cli/src/config/configurations.ts; UV_TOOL = 'uv' -&gt; packages/cli/src/config/tools/python.ts
- misePins (function exported, 242-248): **move** to `packages/cli/src/configurations/tool-pins.ts` `misePins`. Moves to tool-pins.ts; INX-001, INX-002: .gspot/mise.toml pins program tools and uv only; Node is a system tool (general/gspot/manifest.toml), so there is no Node pin, and gspot pins no copy of itself. Values to config: UV_TOOL = 'uv' -&gt; packages/cli/src/config/tools/python.ts
- requireChain (function exported, 257-270): **move** to `packages/cli/src/commands/remove.ts` `requireChain`. Moves to commands/remove.ts, its one user (LIF-058); A1: gspot remove stays and keeps removing configurations.
- selectConfigurations (function exported, 278-284): **move** to `packages/cli/src/configurations/select.ts` `selectConfigurations`. Moves to configurations/select.ts.
- isSourceKind (function exported, 291-293): **inline** to `packages/cli/src/configurations/select.ts` `sourceConfigurations`. Inline into sourceConfigurations in configurations/select.ts (LIF-058).
- sourceConfigurations (function exported, 300-302): **move** to `packages/cli/src/configurations/select.ts` `sourceConfigurations`. Moves to select.ts with the configuration selection. Values to config: SOURCE_GROUPS = \['language', 'framework'\] -&gt; packages/cli/src/config/configurations.ts
- everyManifest (function exported, 309-315): **move** to `packages/cli/src/configurations/select.ts` `everyManifest`. Moves to configurations/select.ts.
- isConfigurationSelected (function exported, 323-325): **move** to `packages/cli/src/configurations/select.ts` `isConfigurationSelected`. Moves to configurations/select.ts.

## `packages/cli/src/lifecycle/install/contracts.ts`

- stageInputs (function, 45-53): **delete**. Delete (A6): Vale's package step runs on the generated vale.ini straight into .gspot/, so nothing is copied into a work folder.
- ownHooksPath (function, 57-59): **inline** to `packages/cli/src/install/hooks.ts` `planHooks`. Inline into planHooks: hookStatus reuses planHooks (TEL-003), so this one-line path has one caller.
- foreignHooks (function, 63-80): **move** to `packages/cli/src/install/hooks.ts` `otherHooks`. Moves to install/hooks.ts and renamed otherHooks (TEL-003). Values to config: HOOKS_PATH_SETTING = 'core.hooksPath' -&gt; packages/cli/src/config/repository/hooks.ts; SAMPLE_HOOK_SUFFIX = '.sample' -&gt; packages/cli/src/config/install.ts
- foreignHookNote (function, 83-86): **move** to `packages/cli/src/install/hooks.ts` `otherHooksNote`. Moves to install/hooks.ts as otherHooksNote ("other hooks"); INX-003: the hook lines use the repository's start command (the npm client when the root package.json lists @gspothq/cli, else mise exec -- gspot), not policy.runner.
- hasValePackages (function exported, 94-102): **move** to `packages/cli/src/install/vale.ts` `hasValePackages`. Moves to install/vale.ts (LIF-008) with the Vale installation.
- listStyleFiles (function exported, 110-118): **move** to `packages/cli/src/execution/copy/revision.ts` `listStyleFiles`. Moves to execution/copy/revision.ts: A6 deletes stageInputs, its other caller, so its one user is copyValePackages there (S05-004); stop exporting.
- installValePackages (function exported, 125-152): **move** to `packages/cli/src/install/vale.ts` `installValePackages`. Moves to install/vale.ts; A6: Vale writes its packages straight into .gspot/ with no scratch copy or swap; LIF-018: level first, and throw instead of returning error text; LIF-017 deletes the link checks; Vale's command word stays inside the argument value. Values to config: VALE_TOOL = 'vale' -&gt; packages/cli/src/config/tools/vale.ts; VALE_INSTALL_ARGUMENTS = \['--config', VALE_CONFIG, 'sync'\] -&gt; packages/cli/src/config/install.ts
- getHookPlan (function exported, 161-175): **move** to `packages/cli/src/install/hooks.ts` `planHooks`. Renamed planHooks (NMS-016: "get" hides work) and moved to install/hooks.ts; the hook path setting is one value, HOOKS_PATH_SETTING in config/repository/hooks.ts. Values to config: SET_HOOKS_PATH = \['git', 'config', HOOKS_PATH_SETTING\] -&gt; packages/cli/src/config/install.ts; UNSET_HOOKS_PATH = \['git', 'config', '--unset', HOOKS_PATH_SETTING\] -&gt; packages/cli/src/config/install.ts
- installHooks (function exported, 182-190): **move** to `packages/cli/src/install/hooks.ts` `installHooks`. Moves to install/hooks.ts with the other hook code.
- hookStatus (function exported, 199-235): **move** to `packages/cli/src/install/hooks.ts` `hookStatus`. Moves to install/hooks.ts; one readFileSync, and it reuses planHooks (TEL-003); CLX-006: the commit-msg line is gspot check --message-file "$1" (no --hook), and the readiness test still finds the pre-commit and pre-push lines through HOOK_COMMAND. Values to config: HOOK_COMMAND = 'gspot check --hook' -&gt; packages/cli/src/config/install.ts

## `packages/cli/src/lifecycle/install/public.ts`

- projectPreview (function, 43-54): **delete**. Delete (LIF-029): the phase framework goes.
- installations (const, 56-201): **merge** to `packages/cli/src/install/install.ts` `installTools`. Merges into installTools (LIF-029): one plain async function runs the steps in order; INS-001: no mise --version check; GEN-030: show mise output; LIF-002: no input re-read loop; INX-001, INX-006: the mise step runs in every repository when mise is on PATH (no runner check): mise trust .gspot/mise.toml, then mise install &lt;tool names&gt; with cwd .gspot, naming only tools whose checks are active and that have a build here; without mise it prints one line naming the programs to install; no registryEnvironment. Values to config: TOOL_PROJECT_INPUTS = \[NPM_TOOL_PROJECT_FILE, PYTHON_TOOL_PROJECT_FILE, YARN_SETTINGS\] -&gt; packages/cli/src/config/install.ts; MISE_TRUST_ARGUMENTS = \['mise', 'trust', MISE_TOOL_PROJECT_FILE\] -&gt; packages/cli/src/config/install.ts; MISE_INSTALL_ARGUMENTS = \['mise', 'install'\] -&gt; packages/cli/src/config/install.ts
- runInstallationPhases (function, 203-218): **merge** to `packages/cli/src/install/install.ts` `installTools`. Merges into installTools in install/install.ts; LIF-029; LIF-028 compute neededToolManifests once.
- isInstallationFailure (function, 220-222): **move** to `packages/cli/src/install/install.ts` `isInstallationFailure`. Moves to install/install.ts with installTools.
- installationPlan (function exported, 231-250): **merge** to `packages/cli/src/install/install.ts` `installTools`. Merges into installTools: CLX-004: gspot install has no --dry-run, so the command lines are not computed ahead; installTools returns the commands it ran for the JSON steps field.
- installTools (function exported, 261-304): **move** to `packages/cli/src/install/install.ts` `installTools`. Moves to install/install.ts; INX-001, INX-006: it installs program tools with mise for every repository (cwd .gspot), then the npm and Python tool projects and the Vale packages, straight into .gspot/ with no staging folder, swap or installing mark (A6); uv comes from the mise bin-paths folders; it records the installed kinds with one assignment (LIF-063); CMD-015 drops refreshLockfiles; it returns the commands it ran (CLX-004).

## `packages/cli/src/lifecycle/merge/contracts.ts`

- openConfigurationDocument (function, 11-15): **inline** to `packages/cli/src/ownership/managed-keys.ts` `openKeysDocument`. Inline into openKeysDocument: one caller; LIF-054: managed keys; the name JSON_EXTENSIONS already holds another value, so the edit extensions are JSON_EDIT_EXTENSIONS. Values to config: TOML_EXTENSION = '.toml' -&gt; packages/cli/src/config/ownership.ts; JSON_EDIT_EXTENSIONS = \['.json', '.jsonc'\] -&gt; packages/cli/src/config/ownership.ts; EMPTY_JSON_TEXT = '{}\\n' -&gt; packages/cli/src/config/ownership.ts
- openMergedDocument (function exported, 24-35): **move** to `packages/cli/src/ownership/managed-keys.ts` `openKeysDocument`. Moves to ownership/managed-keys.ts, which replaces lifecycle/merge/ (LIF-054); LIF-059 deletes the recorded-format comparison.
- hasFields (function exported, 45-51): **move** to `packages/cli/src/ownership/managed-keys.ts` `hasManagedKeys`. Moves to ownership/managed-keys.ts as hasManagedKeys (LIF-054).

## `packages/cli/src/lifecycle/merge/public.ts`

- isEmptyContainer (function, 12-17): **move** to `packages/cli/src/ownership/managed-keys.ts` `isEmptyContainer`. Moves to ownership/managed-keys.ts; LIF-054 managed keys.
- hasUnrecordedEdits (function, 20-24): **move** to `packages/cli/src/ownership/managed-keys.ts` `hasUnrecordedEdits`. Moves to ownership/managed-keys.ts; LIF-054 managed keys.
- retireFields (function, 27-36): **move** to `packages/cli/src/ownership/managed-keys.ts` `restoreUnrequestedKeys`. Moves to ownership/managed-keys.ts as restoreUnrequestedKeys; LIF-054 managed keys; glossary retires "retire".
- planField (function, 39-57): **move** to `packages/cli/src/ownership/managed-keys.ts` `planKey`. Moves to ownership/managed-keys.ts as planKey; LIF-054 managed keys.
- recordParents (function, 60-66): **move** to `packages/cli/src/ownership/managed-keys.ts` `recordParents`. Moves to ownership/managed-keys.ts; LIF-054 managed keys.
- installFields (function, 69-88): **move** to `packages/cli/src/ownership/managed-keys.ts` `setKeys`. Moves to ownership/managed-keys.ts as setKeys; LIF-054 managed keys; glossary keeps "install" for tools.
- buildRecord (function, 91-106): **move** to `packages/cli/src/ownership/managed-keys.ts` `keysRecord`. Moves to ownership/managed-keys.ts as keysRecord; LIF-054 managed keys.
- buildMergePlan (function, 109-117): **move** to `packages/cli/src/ownership/managed-keys.ts` `keyChangePlan`. Moves to ownership/managed-keys.ts as keyChangePlan; LIF-054 managed keys.
- pruneParents (function exported, 126-141): **move** to `packages/cli/src/ownership/managed-keys.ts` `pruneParents`. Moves to ownership/managed-keys.ts; LIF-054; plans.ts uses it when it restores keys.
- planDocumentMerge (function exported, 148-172): **move** to `packages/cli/src/ownership/managed-keys.ts` `planKeyChanges`. Moves to ownership/managed-keys.ts as planKeyChanges; LIF-054; LIF-059 delete the fieldsSchema.parse of generated changes.

## `packages/cli/src/lifecycle/ownership/claude-file.ts`

- authoredText (function, 11-16): **delete**. Delete (A5): gspot never touches CLAUDE.md, so apply/claude-md.ts (lifecycle/ownership/claude-file.ts) goes.
- planClaudeMove (function exported, 24-42): **delete**. Delete (A5): gspot never touches CLAUDE.md, so apply/claude-md.ts (lifecycle/ownership/claude-file.ts) goes.

## `packages/cli/src/lifecycle/ownership/contracts.ts`

- isEdited (function, 27-31): **move** to `packages/cli/src/ownership/plans.ts` `isEdited`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- isPreservedReplacement (function, 34-46): **move** to `packages/cli/src/ownership/plans.ts` `isPreservedReplacement`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- planChange (function, 49-61): **move** to `packages/cli/src/ownership/plans.ts` `planChange`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- planUpdate (function, 64-76): **move** to `packages/cli/src/ownership/plans.ts` `planUpdate`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- planInsert (function, 79-92): **move** to `packages/cli/src/ownership/plans.ts` `planInsert`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- blockPlan (function, 95-107): **move** to `packages/cli/src/ownership/plans.ts` `blockPlan`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- restorableRecord (function, 110-115): **move** to `packages/cli/src/ownership/plans.ts` `restorableKeys`. Moves to ownership/plans.ts (LIF-008) and renamed restorableKeys, because the record is managed keys (LIF-054).
- restoreFields (function, 118-127): **move** to `packages/cli/src/ownership/plans.ts` `restoreKeys`. Moves to ownership/plans.ts (LIF-008) and renamed restoreKeys (LIF-054: managed keys).
- restoreBlock (function, 131-144): **move** to `packages/cli/src/ownership/plans.ts` `restoreBlock`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- fileRestoration (function, 148-152): **move** to `packages/cli/src/ownership/plans.ts` `fileRestoration`. Moves to ownership/plans.ts, which replaces ownership/contracts.ts (LIF-008).
- getRestoration (function, 155-164): **move** to `packages/cli/src/ownership/plans.ts` `findRestoration`. Moves to ownership/plans.ts (LIF-008) and renamed findRestoration (NMS-016: no "get").
- getOnDisk (function exported, 173-176): **move** to `packages/cli/src/ownership/plans.ts` `readOnDisk`. Moves to ownership/plans.ts as readOnDisk; NMS-016; LIF-042 stop exporting (used only in its own file).
- planReplacement (function exported, 184-194): **move** to `packages/cli/src/ownership/plans.ts` `planReplacement`. Moves to ownership/plans.ts; LIF-008; LIF-013 delete plannedFiles and the duplicate validate.
- planBlock (function exported, 204-219): **move** to `packages/cli/src/ownership/plans.ts` `planBlock`. Moves to ownership/plans.ts (LIF-008).
- planMerge (function exported, 229-251): **move** to `packages/cli/src/ownership/plans.ts` `planManagedKeys`. Moves to ownership/plans.ts as planManagedKeys; LIF-054; kind merge becomes keys.
- planRetirement (function exported, 260-269): **move** to `packages/cli/src/ownership/plans.ts` `planDeletion`. Moves to ownership/plans.ts as planDeletion; CMD names table: deleting a replaced tool file is "delete"; glossary retires "retire".
- recordedBlockStart (function exported, 278-281): **move** to `packages/cli/src/ownership/plans.ts` `recordedBlockStart`. Moves to ownership/plans.ts; LIF-042 stop exporting (used only in its own file).
- planRestoration (function exported, 290-298): **move** to `packages/cli/src/ownership/plans.ts` `planRestoration`. Moves to ownership/plans.ts (LIF-008).

## `packages/cli/src/lifecycle/ownership/public.ts`

- recoverPending (function, 24-35): **move** to `packages/cli/src/ownership/log.ts` `recoverPending`. Moves to ownership/log.ts with the ownership log code.
- parseOwnership (function, 38-41): **move** to `packages/cli/src/ownership/log.ts` `parseOwnershipState`. Moves to ownership/log.ts and renamed parseOwnershipState (LIF-053, glossary: OwnershipState). Values to config: OWNERSHIP_LOG_VERSION = 1 -&gt; packages/cli/src/config/ownership.ts
- getEntry (function, 44-51): **move** to `packages/cli/src/ownership/log.ts` `findOwnedFile`. Moves to ownership/log.ts as findOwnedFile; glossary OwnedFile; NMS-016 no "get".
- openLog (function, 58-102): **move** to `packages/cli/src/ownership/log.ts` `openLog`. Moves to ownership/log.ts; LIF-012 deletes the unreachable pending check in entryFor; no "lifecycle owner" wording. Values to config: OWNERSHIP_LOG_FILE = '${STATE_DIRECTORY}/ownership.json' -&gt; packages/cli/src/config/ownership.ts
- validatePlans (function, 105-113): **inline** to `packages/cli/src/ownership/log.ts` `applyPlans`. Inline into applyPlans in ownership/log.ts; LIF-059 deletes the duplicate-destination check; the path check that stays is one loop in applyPlans (LIF-013).
- removeEmptyFolders (function, 116-121): **move** to `packages/cli/src/ownership/log.ts` `removeEmptyFolders`. Moves to ownership/log.ts with the ownership log code.
- writeBatch (function, 124-145): **move** to `packages/cli/src/ownership/log.ts` `writeBatch`. Moves to ownership/log.ts with the ownership log code.
- identify (function exported, 152-157): **move** to `packages/cli/src/ownership/log.ts` `identify`. Moves to ownership/log.ts with the ownership log code.
- isRecorded (function exported, 165-170): **move** to `packages/cli/src/ownership/log.ts` `isRecorded`. Moves to ownership/log.ts with the ownership log code.
- openOwnership (function exported, 177-185): **move** to `packages/cli/src/ownership/log.ts` `openOwnershipLog`. Renamed openOwnershipLog (LIF-053: ownership log) and moved to ownership/log.ts; A6: it does not call recoverInstallations. Values to config: WRITER_LOCK_FILE = '${STATE_DIRECTORY}/writer.lock' -&gt; packages/cli/src/config/ownership.ts
- getOwnership (function exported, 192-195): **move** to `packages/cli/src/ownership/log.ts` `readOwnershipLog`. Renamed readOwnershipLog (LIF-053; NMS-016: no "get") and moved to ownership/log.ts. Values to config: OWNERSHIP_LOG_FILE = '${STATE_DIRECTORY}/ownership.json' -&gt; packages/cli/src/config/ownership.ts
- applyPlans (function exported, 203-220): **move** to `packages/cli/src/ownership/log.ts` `applyPlans`. Moves to ownership/log.ts; LIF-014: return void; LIF-032: one notOverwrittenError message.

## `packages/cli/src/lifecycle/ownership/state/contracts.ts`

- hashSchema (const, 10-10): **move** to `packages/cli/src/ownership/log-schema.ts` `hashSchema`. Moves to ownership/log-schema.ts, which replaces state/contracts.ts (LIF-008); a zod schema stays in its module, and its static values go to config/. Values to config: SHA256_HEX = /^\[a-f0-9\]{64}$/u -&gt; packages/cli/src/config/ownership.ts
- pathSchema (const, 12-18): **move** to `packages/cli/src/ownership/log-schema.ts` `pathSchema`. Moves to ownership/log-schema.ts, which replaces state/contracts.ts (LIF-008); a zod schema stays in its module.
- keyPathSchema (const, 20-20): **move** to `packages/cli/src/ownership/log-schema.ts` `keyPathSchema`. Moves to ownership/log-schema.ts, which replaces state/contracts.ts (LIF-008); a zod schema stays in its module.
- configurationFieldSchema (const, 22-26): **move** to `packages/cli/src/ownership/log-schema.ts` `managedKeySchema`. Moves to ownership/log-schema.ts and renamed managedKeySchema, because the field holds managed keys, not a configuration (LIF-054); a zod schema stays in its module.
- identitySchema (const, 28-31): **move** to `packages/cli/src/ownership/log-schema.ts` `identitySchema`. Moves to ownership/log-schema.ts, which replaces state/contracts.ts (LIF-008); a zod schema stays in its module.
- configurationFieldsSchema (const, 33-44): **inline** to `packages/cli/src/ownership/log-schema.ts` `ownedFileSchema`. Inline into ownedFileSchema in ownership/log-schema.ts; LIF-059 deletes the overlap superRefine; what stays is z.array(managedKeySchema).
- fileSchema (const, 46-71): **move** to `packages/cli/src/ownership/log-schema.ts` `ownedFileSchema`. Moves to ownership/log-schema.ts as ownedFileSchema (glossary: OwnedFile); LIF-054: the field configuration becomes keys; installed becomes written; a zod schema stays in its module.
- ownershipSchema (const exported, 73-122): **move** to `packages/cli/src/ownership/log-schema.ts` `ownershipStateSchema`. Moves to ownership/log-schema.ts as ownershipStateSchema (glossary: OwnershipState); A6: the installing field goes; LIF-059 deletes the superRefine invariants and keeps the zod shape; a zod schema stays in its module.
- fieldsSchema (const exported, 124-124): **delete**. Delete: LIF-059 deletes its parse in planDocumentMerge; ManagedKey is inferred from managedKeySchema.

## `packages/cli/src/lifecycle/ownership/state/public.ts`

- sideFolders (function, 28-31): **delete**. Delete (A6): install goes straight into .gspot/, so there are no .next or .previous folders.
- setKind (function, 34-39): **delete**. Delete (LIF-063): two plain assignments and two saves.
- linkTarget (function, 42-49): **delete**. Delete (LIF-001): no file-by-file copy.
- installedFile (function, 52-77): **delete**. Delete (LIF-001, LIF-017): no file-by-file copy and no link checks are left.
- recoverInstallations (function exported, 84-92): **delete**. Delete (A6): with no swap there is no crash recovery of tool folders; the next gspot install repairs a failed install.
- installTree (function exported, 100-127): **delete**. Delete (A6): the package manager, uv and Vale write straight into .gspot/, so nothing swaps a folder in; the refusal of a folder gspot did not create goes with it; installTools records the installed kind (LIF-063); LIF-004: writeAll goes.
- deleteInstallation (function exported, 134-140): **inline** to `packages/cli/src/apply/write.ts` `pruneToolFolders`. Inline into pruneToolFolders (S05-003): after A6, LIF-016 and LIF-063 the body is three lines (skip a kind gspot did not install, remove the folder, drop the kind from installed) with one caller, so no ownership/tool-folders.ts is left; tests go through writeGeneratedFiles.
- readInstalledTree (function exported, 148-177): **delete**. Delete (LIF-001): nothing is read into memory; tests copy cached folders with copyInto clone.

## `packages/cli/src/lifecycle/public.ts`

- pruneInstallations (function, 41-45): **move** to `packages/cli/src/apply/write.ts` `pruneToolFolders`. Moves to apply/write.ts as pruneToolFolders (glossary: installed tool folder) and takes in the three lines of deleteToolFolder (S05-003).
- moveClaudeFile (function, 48-52): **delete**. Delete (A5): gspot never touches CLAUDE.md; the CLAUDE.md move goes.
- writeGenerated (function, 59-117): **move** to `packages/cli/src/apply/write.ts` `writeGenerated`. Moves to apply/write.ts; A5: CLAUDE.md leaves the expected paths and the CLAUDE.md move call goes; LIF-032: one notOverwrittenError and one expectedPaths helper; LIF-015: no root; S05-006: drop the agentRulesEnabled field, which fed only the CLAUDE.md move.
- conflictedOutputs (function, 120-128): **move** to `packages/cli/src/apply/write.ts` `conflictedOutputs`. Moves to apply/write.ts with the file writing.
- patch (function, 130-134): **move** to `packages/cli/src/apply/stale.ts` `patch`. Moves to apply/stale.ts, the file of stale-file detection (glossary: stale).
- fileDrift (function, 136-161): **move** to `packages/cli/src/apply/stale.ts` `staleWholeFiles`. Moves to apply/stale.ts as staleWholeFiles; glossary retires "drift" in code (stale).
- blockDrift (function, 163-179): **move** to `packages/cli/src/apply/stale.ts` `staleBlocks`. Moves to apply/stale.ts as staleBlocks; glossary stale.
- keyDrift (function, 182-187): **move** to `packages/cli/src/apply/stale.ts` `staleKeys`. Moves to apply/stale.ts as staleKeys; glossary stale; LIF-054 managed keys.
- isStray (function exported, 195-197): **move** to `packages/cli/src/apply/stale.ts` `isStray`. Moves to apply/stale.ts; both write.ts and stale.ts import it, so it is not test-only (LIF-042); LIF-032: add expectedPaths beside it.
- writeGeneratedFiles (function exported, 207-259): **move** to `packages/cli/src/apply/write.ts` `writeGeneratedFiles`. Moves to apply/write.ts; LIF-047: no "lifecycle owner"; S05-006: no agentRulesEnabled and no root in the request; INX-001: the generated-file kind 'runner' goes: .gspot/mise.toml has the kind of the other tool project files, and the dependency-change test lists it beside .gspot/package.json and .gspot/pyproject.toml.
- readVersionPin (function exported, 266-272): **move** to `packages/cli/src/apply/version-pin.ts` `readVersionPin`. Moves to apply/version-pin.ts with the version pin code.
- writeVersionPin (function exported, 278-288): **move** to `packages/cli/src/apply/version-pin.ts` `writeVersionPin`. Moves to apply/version-pin.ts; writeGeneratedFiles calls it, so it is not test-only after the split.
- assertVersionPin (function exported, 295-317): **move** to `packages/cli/src/apply/version-pin.ts` `assertVersionPin`. Moves to apply/version-pin.ts; INX-002, INX-003, INX-005: no runner parameter and no raw-value parsing: it reads the start command from the repository and prints that RUNNERS row's pin, such as npm install --save-dev --save-exact @gspothq/cli@&lt;version&gt; or mise use npm:@gspothq/cli@&lt;version&gt;; the npm install --global fallback goes; no "binary" wording; INS-045: the package name comes from package.json.
- computeDrift (function exported, 325-339): **move** to `packages/cli/src/apply/stale.ts` `findStaleFiles`. Moves to apply/stale.ts as findStaleFiles (glossary: stale; gspot/drift becomes gspot/generated-files); A5: CLAUDE.md leaves the known paths.
- compareRules (function exported, 347-368): **move** to `packages/cli/src/apply/stale.ts` `compareLintRules`. Moves to apply/stale.ts as compareLintRules; LIF-042 stop exporting (test-only export); glossary "lint rule".

## `packages/cli/src/lifecycle/selection/contracts.ts`

- mergeConfigurationChoices (function, 14-16): **move** to `packages/cli/src/commands/reconcile.ts` `mergeConfigurationChoices`. Moves to commands/reconcile.ts (LIF-009, LIF-009): only commands use reconcile.
- reconcileChoices (function, 18-62): **move** to `packages/cli/src/commands/reconcile.ts` `reconcileChoices`. Moves to commands/reconcile.ts (LIF-009).
- configurationMutation (function, 64-76): **move** to `packages/cli/src/commands/reconcile.ts` `configurationMutation`. Moves to commands/reconcile.ts (LIF-009).
- reconcileConfigurations (function exported, 83-103): **move** to `packages/cli/src/commands/reconcile.ts` `reconcileConfigurations`. Moves to commands/reconcile.ts (LIF-009): only commands use it; the glossary limits "reconcile" to user text.

## `packages/cli/src/lifecycle/selection/public.ts`

- initScopes (function, 21-35): **inline** to `packages/cli/src/commands/init/selection.ts` `selectForInit`. Inline into selectForInit (S05-005): CMD-092 deletes --scope-configurations, the only source of options.scopes, so what is left is one line (the root scope plus the workspace scopes) with one caller; the "Scope directory does not exist" refusal goes with the flag.
- getCandidate (function, 37-42): **move** to `packages/cli/src/commands/init/selection.ts` `findCandidate`. Moves to commands/init/selection.ts as findCandidate; LIF-009; NMS-016 no "get".
- rootSelection (function, 44-61): **move** to `packages/cli/src/commands/init/selection.ts` `rootSelection`. Moves to commands/init/selection.ts (LIF-009): only init uses it.
- scopeSelection (function, 63-80): **move** to `packages/cli/src/commands/init/selection.ts` `scopeSelection`. Moves to commands/init/selection.ts (LIF-009): only init uses it; S05-005: drop the flagged parameter, which is always undefined without --scope-configurations.
- hasSourceOutsideScopes (function, 82-89): **move** to `packages/cli/src/commands/init/selection.ts` `hasSourceOutsideScopes`. Moves to commands/init/selection.ts (LIF-009): only init uses it.
- assertKnown (function, 91-100): **move** to `packages/cli/src/commands/init/selection.ts` `assertKnown`. Moves to commands/init/selection.ts (LIF-009): only init uses it; S05-005: it checks only the --configurations names, with no scope flags.
- listedConfigurations (function, 102-117): **move** to `packages/cli/src/commands/init/selection.ts` `listedConfigurations`. Moves to commands/init/selection.ts (LIF-009): only init uses it.
- reasonFor (function, 119-123): **move** to `packages/cli/src/commands/init/selection.ts` `reasonFor`. Moves to commands/init/selection.ts (LIF-009): only init uses it.
- selectForInit (function exported, 130-179): **move** to `packages/cli/src/commands/init/selection.ts` `selectForInit`. Moves to commands/init/selection.ts (LIF-009); S05-005: no scopeFlags; named comes from options.configurations only.

## `packages/cli/src/planning/contracts.ts`

- conditionSkip (function, 24-43): **move** to `packages/cli/src/planning/skips.ts` `conditionSkip`. Moves to planning/skips.ts (LIF-038).
- ignoreSkip (function, 46-56): **move** to `packages/cli/src/planning/skips.ts` `ignoreSkip`. Moves to planning/skips.ts (LIF-038).
- waitingSetting (function, 58-65): **move** to `packages/cli/src/planning/skips.ts` `waitingSetting`. Moves to planning/skips.ts (LIF-038).
- platformSkip (function, 68-75): **move** to `packages/cli/src/planning/skips.ts` `systemSkip`. Moves to planning/skips.ts as systemSkip; LIF-038; glossary: the OS is "system" in code.
- nativeIgnore (function, 78-83): **move** to `packages/cli/src/planning/skips.ts` `toolIgnore`. Moves to planning/skips.ts as toolIgnore; NMS table B; NMS-006 no "native".
- selectionStatus (function exported, 92-113): **move** to `packages/cli/src/planning/skips.ts` `settingsSkip`. Moves to planning/skips.ts as settingsSkip (LIF-036, "settings" for "policy"); call it once in planOne; LIF-035: the Semgrep rule-file case moves into the Semgrep check.
- skipFor (function exported, 125-140): **move** to `packages/cli/src/planning/skips.ts` `skipFor`. Moves to planning/skips.ts; LIF-038; LIF-039 take PlanInputs; CMD-092 --skip goes.
- restrictIgnoredPaths (function exported, 148-156): **move** to `packages/cli/src/planning/skips.ts` `restrictIgnoredPaths`. Moves to planning/skips.ts (LIF-038).
- missingBuild (function exported, 165-172): **move** to `packages/cli/src/configurations/tool-pins.ts` `missingBuild`. Moves to configurations/tool-pins.ts; INX-006: miseOs is deleted; missingBuild decides which program tools the mise install call names (only tools with a build for this OS and CPU), and INX-006's stage filter is one more condition on that name list.
- coverageArguments (function exported, 180-192): **move** to `packages/cli/src/planning/checks.ts` `coverageArguments`. Moves to planning/checks.ts (LIF-038): it stays in planning. Values to config: FLAG_VALUE = /=.\*/su -&gt; packages/cli/src/config/planning.ts

## `packages/cli/src/planning/files.ts`

- projectFiles (function, 14-19): **rename** to `packages/cli/src/planning/files.ts` `scopeFiles`. Renamed scopeFiles; glossary retires "project" for a scope.
- projectOwned (function, 22-35): **rename** to `packages/cli/src/planning/files.ts` `scopeCoveredFiles`. Renamed scopeCoveredFiles; glossary "covers" (not owns) and scope (not project).
- ownedFor (function, 38-58): **rename** to `packages/cli/src/planning/files.ts` `coveredFiles`. Renamed coveredFiles; glossary covers; LIF-035 postgres/squawk declares its files by a setting pattern.
- withoutIgnored (function, 61-75): **keep** to `packages/cli/src/planning/files.ts` `withoutIgnored`. Stays in planning/files.ts.
- narrowed (function, 78-88): **keep** to `packages/cli/src/planning/files.ts` `narrowed`. Stays in planning/files.ts; TML-002: it returns every file when isTouched (gspot.toml or .gspot/ changed) before the inNarrowed test, which replaces the push_files and ci.files mode switches.
- missingTriggers (function, 91-120): **keep** to `packages/cli/src/planning/files.ts` `missingTriggers`. Stays in planning/files.ts.
- childScopes (function exported, 128-133): **keep** to `packages/cli/src/planning/files.ts` `childScopes`. Stays in planning/files.ts; used by planning and checks/language/python.
- runsAtRoot (function exported, 141-152): **keep** to `packages/cli/src/planning/files.ts` `runsAtRoot`. Stays in planning/files.ts; used by planning/checks.ts.
- filesFor (function exported, 161-178): **keep** to `packages/cli/src/planning/files.ts` `filesFor`. Stays in planning/files.ts; used by planning/checks.ts.

## `packages/cli/src/planning/public.ts`

- isStageWanted (function, 26-30): **move** to `packages/cli/src/planning/checks.ts` `isStageWanted`. Moves to planning/checks.ts (LIF-038).
- entriesFor (function, 32-42): **move** to `packages/cli/src/planning/checks.ts` `entriesFor`. Moves to planning/checks.ts (LIF-038).
- isWanted (function, 44-49): **move** to `packages/cli/src/planning/checks.ts` `isWanted`. Moves to planning/checks.ts (LIF-038).
- planOne (function, 51-77): **move** to `packages/cli/src/planning/checks.ts` `planOne`. Moves to planning/checks.ts (LIF-038).
- narrowSet (function, 79-83): **move** to `packages/cli/src/planning/checks.ts` `narrowSet`. Moves to planning/checks.ts (LIF-038).
- skipReplacedChecks (function, 86-99): **move** to `packages/cli/src/planning/checks.ts` `skipReplacedChecks`. Moves to planning/checks.ts (LIF-038).
- planScope (function, 101-114): **move** to `packages/cli/src/planning/checks.ts` `planScope`. Moves to planning/checks.ts (LIF-038).
- planScopes (function, 116-132): **move** to `packages/cli/src/planning/checks.ts` `planScopes`. Moves to planning/checks.ts (LIF-038).
- isActive (function exported, 139-146): **move** to `packages/cli/src/planning/checks.ts` `isActive`. Moves to planning/checks.ts (LIF-038).
- configuredChecks (function exported, 154-158): **move** to `packages/cli/src/planning/checks.ts` `configuredChecks`. Moves to planning/checks.ts; LIF-038; LIF-039 replace the boolean parameter.
- ownedInputs (function exported, 166-173): **move** to `packages/cli/src/planning/checks.ts` `coveredInputs`. Moves to planning/checks.ts as coveredInputs; LIF-038; glossary covers, not owns.
- planRun (function exported, 181-191): **move** to `packages/cli/src/planning/checks.ts` `planRun`. Moves to planning/checks.ts (LIF-038); its incomplete-history error keeps the code 'selection'.
- checkCompanions (function exported, 200-217): **move** to `packages/cli/src/planning/needed-tools.ts` `checkCompanions`. Moves to planning/needed-tools.ts (LIF-038). Values to config: FLAG_VALUE = /=.\*/su -&gt; packages/cli/src/config/planning.ts
- licenseProjects (function exported, 227-260): **move** to `packages/cli/src/planning/needed-tools.ts` `licenseProjects`. Moves to planning/needed-tools.ts (LIF-038). Values to config: LICENSES_CONFIGURATION = 'licenses' -&gt; packages/cli/src/config/planning.ts
- requiredToolNames (function exported, 268-287): **move** to `packages/cli/src/planning/needed-tools.ts` `requiredToolNames`. Moves to planning/needed-tools.ts (LIF-038).
- applicableManifests (function exported, 295-348): **move** to `packages/cli/src/planning/needed-tools.ts` `neededToolManifests`. Moves to planning/needed-tools.ts as neededToolManifests; LIF-028 rename and compute once per session; LIF-035 ESLint libraries as required_tools.

## `packages/cli/src/tools/contracts.ts`

- searchDirectories (function, 45-58): **move** to `packages/cli/src/tools/find.ts` `searchDirectories`. Moves to tools/find.ts; INX-006: for program tools the folders of one mise bin-paths &lt;names&gt; run (cwd .gspot, once per session) come first. Values to config: NPM_BIN_FOLDER = 'node_modules/.bin' -&gt; packages/cli/src/config/tools/find.ts; PYTHON_ENVIRONMENT_FOLDER = '.venv' -&gt; packages/cli/src/config/tools/python.ts; MISE_BIN_PATHS_ARGUMENTS = \['mise', 'bin-paths'\] -&gt; packages/cli/src/config/tools/find.ts
- candidateExists (function, 61-71): **move** to `packages/cli/src/tools/find.ts` `candidateExists`. Moves to tools/find.ts.
- repositoryCandidates (function, 74-78): **inline** to `packages/cli/src/tools/find.ts` `locateRepositoryCandidates`. Inline into locateRepositoryCandidates in tools/find.ts; one caller, four lines.
- hostCandidates (function, 81-95): **move** to `packages/cli/src/tools/find.ts` `systemCandidates`. Moves to tools/find.ts as systemCandidates (glossary: system tool, not host); INX-006: the shim lookup stays only for system tools, because program tools are found in the mise bin-paths folders; S05-007: the mise which run takes the tool timeout. Values to config: MISE_PROGRAM = 'mise' -&gt; packages/cli/src/config/tools/find.ts; MISE_SHIMS_FOLDER = 'shims' -&gt; packages/cli/src/config/tools/find.ts; MISE_WHICH = 'which' -&gt; packages/cli/src/config/tools/find.ts
- versionAbove (function, 98-106): **move** to `packages/cli/src/tools/versions.ts` `versionAbove`. Moves to tools/versions.ts with the version code. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- installHint (function exported, 114-129): **move** to `packages/cli/src/tools/find.ts` `installHint`. Moves to tools/find.ts; all users are in find.ts, so stop exporting; LIF-044: hints come from the manifest install_hint; INX-006: no runner parameter: a tool gspot installs (tool project or program tool) gets Run: gspot install, and without mise on PATH the hint says Install mise, or install &lt;name&gt; &lt;version&gt; yourself; the mise install &lt;pin&gt; hint goes. Values to config: MISE_INSTALL_URL = '<https://mise.jdx.dev/getting-started.html>' -&gt; packages/cli/src/config/tools/find.ts
- unavailableNote (function exported, 138-144): **move** to `packages/cli/src/tools/find.ts` `unavailableNote`. Moves to tools/find.ts; stop exporting (one user, toolAvailability); LIF-049 one comment.
- toolVersionState (function exported, 153-164): **move** to `packages/cli/src/tools/versions.ts` `toolVersionState`. Moves to tools/versions.ts; IGN-002: state values in backticks.
- locateRepositoryCandidates (function exported, 173-176): **move** to `packages/cli/src/tools/find.ts` `locateRepositoryCandidates`. Moves to tools/find.ts; stop exporting: all users in find.ts.
- locateCandidates (function exported, 185-189): **move** to `packages/cli/src/tools/find.ts` `locateCandidates`. Moves to tools/find.ts.
- packageVersion (function exported, 198-206): **move** to `packages/cli/src/tools/versions.ts` `packageVersion`. Moves to tools/versions.ts; used only in its own file, so stop exporting. Values to config: NPM_BIN_FOLDER = 'node_modules/.bin' -&gt; packages/cli/src/config/tools/find.ts
- toolInstallationPlan (function exported, 218-236): **delete**. Delete: CLX-004: it listed the commands for the install dry run, which is deleted; installNpmTools and installPythonTools run their commands directly (LIF-029, LIF-030: no generic ToolProject); CMD-015: no refreshLockfiles.
- prepareToolProject (function exported, 248-266): **split** to `packages/cli/src/tools/npm/project.ts; packages/cli/src/tools/python/project.ts` `prepareNpmLockfile;preparePythonLockfile`. Splits into prepareNpmLockfile and preparePythonLockfile (A6): no tools/staging.ts or withStagingFolder; LIF-030: two plain modules.
- installToolProject (function exported, 275-315): **split** to `packages/cli/src/tools/npm/project.ts; packages/cli/src/tools/python/project.ts` `installNpmTools;installPythonTools`. Splits into installNpmTools and installPythonTools (A6): the client installs straight into .gspot/ (no scratch copy, no tools/staging.ts or withStagingFolder, no swap); LIF-030; LIF-002 and LIF-021 delete both guards.
- runTool (function exported, 323-346): **move** to `packages/cli/src/tools/run.ts` `runTool`. Moves to tools/run.ts; EXG-030 timeout, not deadline.
- assertCredentialFreeLockfile (function exported, 354-358): **move** to `packages/cli/src/tools/diagnostics.ts` `assertCredentialFreeLockfile`. Moves to tools/diagnostics.ts (credential handling); the uv lockfile needs it, and S05-012 keeps it for the npm lockfile too, because registryCredentials stays.
- addEnvironmentReference (function exported, 367-373): **move** to `packages/cli/src/tools/npm/project.ts` `addEnvironmentReference`. Moves to tools/npm/project.ts; S05-012 keeps writeNpmrc and yarnSettings, because A6 rules out a copy of the repository settings files into .gspot/; yarn.ts imports it.
- registryPasswords (function exported, 380-384): **move** to `packages/cli/src/tools/diagnostics.ts` `registryPasswords`. Moves to tools/diagnostics.ts; the Python index settings still use it.
- installationDiagnostics (function exported, 392-410): **move** to `packages/cli/src/tools/diagnostics.ts` `installationDiagnostics`. Moves to tools/diagnostics.ts; it keeps the URL-password redaction only; GEN-030: also for mise failures. Values to config: REDACTED = '\[redacted\]' -&gt; packages/cli/src/config/tools/diagnostics.ts
- readToolVersion (function exported, 420-429): **move** to `packages/cli/src/tools/versions.ts` `readToolVersion`. Moves to tools/versions.ts beside parseVersionOutput (PAR-011); LIF-047: no "native"; S05-007 and S05-010: it takes the tool timeout and TOOL_ENV instead of { NO_COLOR: '1' }. Values to config: VERSION_FLAG = '--version' -&gt; packages/cli/src/config/tools/run.ts

## `packages/cli/src/tools/npm/contracts.ts`

- credentialsOf (function, 43-58): **move** to `packages/cli/src/tools/npm/project.ts` `registryCredentials`. Moves to tools/npm/project.ts as registryCredentials ("Of" is a filler suffix); S05-012 keeps it for the lockfile check and the redaction.
- writeNpmrc (function, 61-69): **move** to `packages/cli/src/tools/npm/project.ts` `writeNpmrc`. Moves to tools/npm/project.ts; S05-012 keeps it: it writes .gspot/.npmrc with ${GSPOT_PACKAGE_SETTING_n} references (no secret values) for one package manager run, removes it in a finally, and the gitignore block lists .gspot/.npmrc. Values to config: NPMRC_FILE = '.npmrc' -&gt; packages/cli/src/config/tools/npm.ts
- assertPackageInstallerVersion (function, 72-79): **move** to `packages/cli/src/tools/npm/project.ts` `assertNpmClientVersion`. Moves to tools/npm/project.ts as assertNpmClientVersion; NMS-009 NpmClient ("manager" is banned); GEN-021 compare with the installed client, not a recorded N.x.
- needsVersionCheck (function, 82-86): **move** to `packages/cli/src/tools/npm/project.ts` `needsVersionCheck`. Moves to tools/npm/project.ts; LIF-069 keeps the version check.
- assertNativeVersion (function, 88-102): **move** to `packages/cli/src/tools/npm/project.ts` `assertWrapperVersion`. Moves to tools/npm/project.ts as assertWrapperVersion (LIF-069; NMS-006: no "native"). Values to config: VERSION_FLAG = '--version' -&gt; packages/cli/src/config/tools/run.ts
- readRegistrySettings (function, 105-138): **move** to `packages/cli/src/tools/npm/project.ts` `readRegistrySettings`. Moves to tools/npm/project.ts; it keeps the import, and registryEnvironment keeps its one caller, runNpmClient. Values to config: NPM_PROGRAM = 'npm' -&gt; packages/cli/src/config/tools/npm.ts
- assertPackageVersions (function exported, 146-160): **move** to `packages/cli/src/tools/npm/project.ts` `runNpmWrappersOnce`. Moves to tools/npm/project.ts as runNpmWrappersOnce (LIF-069: say the editorconfig-checker download in the name and one comment); one user, installNpmTools, so stop exporting. Values to config: NPM_BIN_FOLDER = 'node_modules/.bin' -&gt; packages/cli/src/config/tools/find.ts
- packageInstallerCommands (function exported, 167-174): **move** to `packages/cli/src/tools/npm/project.ts` `npmClientCommands`. Moves to tools/npm/project.ts as npmClientCommands; NMS-009 table B; stop exporting (users in npm/project.ts).
- githubRefusalNote (function exported, 181-185): **delete**. Delete (LIF-025): the full output is shown anyway.
- registryEnvironment (function exported, 192-217): **move** to `packages/cli/src/tools/npm/project.ts` `registryEnvironment`. Moves to tools/npm/project.ts; INX-006: the mise step does not call it, so its one caller is runNpmClient; S05-008: it writes npm_config\_&lt;key&gt; through NPM_SETTING_PREFIX; the scope registry key needs a name without the banned word 'scoped'. Values to config: NPM_SCOPE_REGISTRY_KEY = /^@\[^\\s:=\]+:registry$/u -&gt; packages/cli/src/config/tools/npm.ts; REGISTRY\_AUTH\_KEY = /^\\/\\/\[^\\s\]+:(?:\_authToken|\_auth|username|\_password|certfile|keyfile)$/u -&gt; packages/cli/src/config/tools/npm.ts; CERTIFICATE_KEYS = \[':certfile', ':keyfile'\] -&gt; packages/cli/src/config/tools/npm.ts; REGISTRY_ALIASES = \['BUN_CONFIG_REGISTRY', 'YARN_REGISTRY'\] -&gt; packages/cli/src/config/tools/npm.ts
- runPackageInstaller (function exported, 228-263): **move** to `packages/cli/src/tools/npm/project.ts` `runNpmClient`. Moves to tools/npm/project.ts as runNpmClient (NMS-009); LIF-025: no GitHub note; stop exporting; S05-012: it keeps the reference-only settings file of writeNpmrc and its npm_config_userconfig; S05-008: it uses NPM_SETTING_PREFIX. Values to config: VERSION_FLAG = '--version' -&gt; packages/cli/src/config/tools/run.ts

## `packages/cli/src/tools/npm/lockfiles.ts`

- yarnMatches (function, 15-24): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `yarnMatches`. Stays in tools/npm/lockfiles.ts. Values to config: YARN_DESCRIPTOR_SEPARATOR = /,\\s\*/u -&gt; packages/cli/src/config/tools/npm.ts; YARN_LOCKFILE = 'yarn.lock' (read from the existing lockfile table) -&gt; packages/cli/src/config/parsers/lockfiles.ts
- registryFor (function, 27-31): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `registryFor`. Stays in tools/npm/lockfiles.ts; S05-008: it reads npm_config_registry and npm_config\_&lt;scope&gt;:registry through NPM_SETTING_PREFIX.
- isStandardTarball (function, 34-45): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `isStandardTarball`. Stays in tools/npm/lockfiles.ts.
- relativeReference (function, 48-53): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `relativeReference`. Stays in tools/npm/lockfiles.ts.
- lockfileMatches (function exported, 63-71): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `lockfileMatches`. Stays in tools/npm/lockfiles.ts; LIF-034 delete the conflict-marker check (parse failure means no match, SLF-030).
- stripYarnRegistryUrls (function exported, 80-96): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `stripYarnRegistryUrls`. Stays in tools/npm/lockfiles.ts; LIF-024 keeps it with its comparison; stripRegistryUrls moves here, so stop exporting; it throws GspotError(installation). Values to config: YARN_LOCKFILE = 'yarn.lock' (read from the existing lockfile table) -&gt; packages/cli/src/config/parsers/lockfiles.ts
- stripBunRegistryUrls (function exported, 105-121): **keep** to `packages/cli/src/tools/npm/lockfiles.ts` `stripBunRegistryUrls`. Stays in tools/npm/lockfiles.ts; LIF-024 drops the before/after comparison; stop exporting. Values to config: BUN_LOCKFILE = 'bun.lock' (read from the existing lockfile table) -&gt; packages/cli/src/config/parsers/lockfiles.ts

## `packages/cli/src/tools/npm/public.ts`

- detectedInstaller (function, 32-46): **move** to `packages/cli/src/tools/npm/project.ts` `detectedNpmClient`. Moves to tools/npm/project.ts as detectedNpmClient (NMS-009); INX-003, INX-003: no runner parameter (the setting is gone), and it falls back to npm. Values to config: NPM_CLIENT_DETECTION = { ignoreArgv: true, ignorePackageJSON: true, includeParentDirs: false } -&gt; packages/cli/src/config/tools/npm.ts; NPM_PROGRAM = 'npm' -&gt; packages/cli/src/config/tools/npm.ts
- recordedInstaller (function, 49-59): **delete**. Delete (GEN-021): the generated package.json drops packageManager, so nothing reads it back.
- stripRegistryUrls (function, 62-69): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `stripRegistryUrls`. Moves to tools/npm/lockfiles.ts (LIF-024): one exported entry for both lockfile edits, beside them; S05-008: it reads npm_config_registry through NPM_SETTING_PREFIX.
- packageToolProject (const exported, 72-134): **split** to `packages/cli/src/tools/npm/project.ts` `prepareNpmLockfile;installNpmTools`. Splits into prepareNpmLockfile and installNpmTools (LIF-030: the ToolProject object becomes plain functions); LIF-002, LIF-021: the guards go; it writes the tool name 'node'; CLX-004: the dry-run list npmInstallSteps goes with install --dry-run. Values to config: NODE_TOOL = 'node' -&gt; packages/cli/src/config/tools/npm.ts
- selectPackageInstaller (function exported, 143-170): **move** to `packages/cli/src/tools/npm/project.ts` `selectNpmClient`. Moves to tools/npm/project.ts as selectNpmClient (NMS-009); INX-003, GEN-021; INX-003: no runner parameter; the hooks generator's start command uses the client it selects when the root package.json lists @gspothq/cli, and the separate runner detection goes. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- inspectPackageInstaller (function exported, 178-184): **move** to `packages/cli/src/tools/npm/project.ts` `readNpmClientVersion`. Moves to tools/npm/project.ts as readNpmClientVersion (NMS-009); S05-007: it takes the tool timeout. Values to config: VERSION_FLAG = '--version' -&gt; packages/cli/src/config/tools/run.ts

## `packages/cli/src/tools/npm/yarn.ts`

- yarnSettings (function exported, 22-72): **keep** to `packages/cli/src/tools/npm/yarn.ts` `yarnSettings`. Stays in tools/npm/yarn.ts; S05-012 keeps it for Yarn Berry private registries: A6 rules out a copy of the repository .yarnrc.yml into .gspot/, where it would overwrite the .gspot/.yarnrc.yml gspot generates; it writes the merged settings with ${GSPOT_YARN_SETTING_n} references to .gspot/.yarnrc-install.yml for one run (YARN_RC_FILENAME), removes it in a finally, and the gitignore block lists it. Values to config: YARN_INSTALL_SETTINGS_FILE = '.yarnrc-install.yml' -&gt; packages/cli/src/config/tools/npm.ts; YARN_CONFIG_LIST = \['yarn', 'config', '--json', '--no-defaults'\] -&gt; packages/cli/src/config/tools/npm.ts; YARN_CONFIG_GET = \['yarn', 'config', 'get'\] -&gt; packages/cli/src/config/tools/npm.ts; YARN_SECRET_KEYS = \['npmAuthToken', 'npmAuthIdent'\] -&gt; packages/cli/src/config/tools/npm.ts

## `packages/cli/src/tools/public.ts`

- libraryInspection (function, 41-55): **move** to `packages/cli/src/tools/find.ts` `libraryInspection`. Moves to tools/find.ts; LIF-064 compute root, hint, want once in inspectTool.
- inspectLibraryCommand (function, 58-77): **move** to `packages/cli/src/tools/find.ts` `inspectLibraryCommand`. Moves to tools/find.ts; LIF-064: compute root, hint and want once in inspectTool; ST4-003: no error branch for an empty version_command: commandSchema needs at least one item, so it reads const \[program, ...args\] = command as \[string, ...string\[\]\].
- inspectHostLibrary (function, 80-89): **merge** to `packages/cli/src/tools/find.ts` `inspectLibrary`. Merges into inspectLibrary in tools/find.ts (LIF-064).
- inspectLibrary (function, 92-102): **move** to `packages/cli/src/tools/find.ts` `inspectLibrary`. Moves to tools/find.ts (LIF-064). Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- missingInspection (function, 106-109): **move** to `packages/cli/src/tools/find.ts` `missingInspection`. Moves to tools/find.ts; LIF-064 compute root, hint, want once in inspectTool.
- executableInspection (function, 112-124): **move** to `packages/cli/src/tools/find.ts` `executableInspection`. Moves to tools/find.ts; LIF-064 compute root, hint, want once in inspectTool.
- inspectProjectExecutable (function, 127-159): **move** to `packages/cli/src/tools/find.ts` `inspectProjectExecutable`. Moves to tools/find.ts; A6: install goes straight into .gspot/, with no staging folder, swap or installing state, so the isInstallationPending branch goes; LIF-064: compute root, hint and want once in inspectTool.
- inspectExecutable (function, 161-178): **move** to `packages/cli/src/tools/find.ts` `inspectExecutable`. Moves to tools/find.ts; LIF-064 compute root, hint, want once in inspectTool.
- isInstallationPending (function, 181-188): **delete**. Delete (A6): there is no installing state, so no pending install blocks a tool.
- pendingInspection (function, 191-198): **delete**. Delete (A6): no installing state, so no pending install blocks a tool.
- lockfileDrift (function, 200-213): **merge** to `packages/cli/src/tools/lockfiles.ts` `staleLockfiles`. Merges into staleLockfiles in tools/lockfiles.ts; LIF-030 (no generic description); glossary stale.
- recordLockfile (function, 216-220): **move** to `packages/cli/src/tools/lockfiles.ts` `recordLockfile`. Moves to tools/lockfiles.ts; new tools/lockfiles.ts holds the code for both tool projects.
- inspectTool (function exported, 228-241): **move** to `packages/cli/src/tools/find.ts` `inspectTool`. Moves to tools/find.ts; A6: the pending-install check and its cache key part go.
- isToolAvailable (function exported, 248-250): **move** to `packages/cli/src/tools/find.ts` `isToolAvailable`. Moves to tools/find.ts with the other tool lookups. Values to config: AVAILABLE_TOOL_STATES = \['ok', 'system', 'newer'\] -&gt; packages/cli/src/config/tools/find.ts
- toolAvailability (function exported, 258-263): **move** to `packages/cli/src/tools/find.ts` `toolAvailability`. Moves to tools/find.ts.
- duplicateMisePins (function exported, 272-310): **delete**. Delete (INX-007): the duplicate-pin detection goes: npm and Python tools run only from .gspot/, and .gspot/mise.toml ranks above the user's mise.toml, so no clash is left to report.
- toolProjectDrift (function exported, 318-323): **move** to `packages/cli/src/tools/lockfiles.ts` `staleLockfiles`. Moves to tools/lockfiles.ts as staleLockfiles; glossary stale; return only stale lockfiles.
- prepareToolProjects (function exported, 332-350): **move** to `packages/cli/src/tools/lockfiles.ts` `prepareLockfiles`. Moves to tools/lockfiles.ts as prepareLockfiles; LIF-030; CMD-015 no refreshLockfiles; LIF-055 reader is Root read.

## `packages/cli/src/tools/python/contracts.ts`

- indexLocation (function, 25-29): **move** to `packages/cli/src/tools/python/settings.ts` `indexLocation`. Moves to tools/python/settings.ts; uv index settings.
- requirementTexts (function, 32-36): **move** to `packages/cli/src/tools/python/project.ts` `requirementTexts`. Moves to tools/python/project.ts; lockfile matching sits with the uv project code.
- constraintsMatch (function, 39-45): **move** to `packages/cli/src/tools/python/project.ts` `constraintsMatch`. Moves to tools/python/project.ts with the lockfile matching. Values to config: CONSTRAINT_OPERATOR = /\[&lt;&gt;!~=\]/u -&gt; packages/cli/src/config/tools/python.ts
- parsePythonSettings (function exported, 53-75): **move** to `packages/cli/src/tools/python/settings.ts` `parsePythonSettings`. Moves to tools/python/settings.ts; stop exporting: its one source caller writePythonSettings moves beside it; tests go through writePythonSettings.
- pythonLockfileMatches (function exported, 83-101): **move** to `packages/cli/src/tools/python/project.ts` `pythonLockfileMatches`. Moves to tools/python/project.ts; it takes the parsed project and parses once; staleLockfiles uses it; the value is the package name before == in a pinned line, and REQUIREMENT_NAME names another value in config/parsers/dependency-files.ts. Values to config: PINNED_PACKAGE_NAME = /^\[^=\]+/u -&gt; packages/cli/src/config/tools/python.ts

## `packages/cli/src/tools/python/public.ts`

- writePythonSettings (function, 28-36): **move** to `packages/cli/src/tools/python/settings.ts` `writePythonSettings`. Moves to tools/python/settings.ts; S05-012: it writes the full index URLs, which can hold a password, so the file goes to a scratch folder outside the repository, never into .gspot/, and uv gets --config-file. Values to config: UV_SETTINGS_FILE = 'uv.toml' -&gt; packages/cli/src/config/tools/python.ts; PYPROJECT_TOML = 'pyproject.toml' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- readPythonLockfile (function, 39-56): **move** to `packages/cli/src/tools/python/project.ts` `readPythonLockfile`. Moves to tools/python/project.ts; LIF-020: validate once, at the end of the lockfile step. Values to config: PYPROJECT_TOML = 'pyproject.toml' -&gt; packages/cli/src/config/parsers/dependency-files.ts; UV_LOCKFILE_NAME = 'uv.lock' (read from the existing lockfile table) -&gt; packages/cli/src/config/parsers/lockfiles.ts
- runUv (function, 59-77): **move** to `packages/cli/src/tools/python/project.ts` `runUv`. Moves to tools/python/project.ts; LIF-020: no lockfile read per run; the missing and failed errors move in here; S05-009: drop UV_VENV_RELOCATABLE and UV_LINK_MODE=copy, because A6 builds .venv in place. Values to config: UV_NO_DOWNLOADS = \['--no-python-downloads'\] -&gt; packages/cli/src/config/tools/python.ts
- relocateInterpreter (function, 80-100): **delete**. Delete (A6): uv builds .venv straight in .gspot/, so its interpreter link stays (LIF-003).
- pythonToolProject (const exported, 103-165): **split** to `packages/cli/src/tools/python/project.ts` `preparePythonLockfile;installPythonTools`. Splits into preparePythonLockfile and installPythonTools (LIF-030: plain functions, no ToolProject object); LIF-020; LIF-021: the guards go; INX-006, CLX-004: the installer row of commands (mise install uv) and the dry-run list pythonInstallSteps go; uv comes from the mise bin-paths folders. Values to config: UV_TOOL = 'uv' -&gt; packages/cli/src/config/tools/python.ts
- installUv (function exported, 174-200): **delete**. Delete (INX-006): uv is a program tool in .gspot/mise.toml, installed with the others and found through mise bin-paths, so the second uv install path goes.
- pythonProjectCommand (function exported, 209-228): **move** to `packages/cli/src/tools/python/project.ts` `pythonProjectCommand`. Moves to tools/python/project.ts with the uv project code. Values to config: UV_RUN_ARGUMENTS = \['run', '--no-sync'\] -&gt; packages/cli/src/config/tools/python.ts

## `packages/cli/src/types/lifecycle/apply.ts`

- WriteRequest (type exported, 5-13): **move** to `packages/cli/src/types/apply.ts` `WriteRequest`. Moves to types/apply.ts; LIF-015 deletes root, and S05-006 drops agentRulesEnabled.
- ApplyReport (type exported, 15-22): **move** to `packages/cli/src/types/apply.ts` `ApplyReport`. Moves to types/apply.ts, beside the apply types; writeGeneratedFiles returns it.
- MergeRecord (type exported, 24-24): **move** to `packages/cli/src/types/ownership.ts` `ManagedKeys`. Moves to types/ownership.ts as ManagedKeys (LIF-054): every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Planned (type exported, 27-33): **move** to `packages/cli/src/types/ownership.ts` `WritePlan`. Moves to types/ownership.ts as WritePlan: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;; so plans.ts and log.ts form no type cycle.
- Drift (type exported, 35-40): **move** to `packages/cli/src/types/apply.ts` `StaleFile`. Moves to types/apply.ts as StaleFile (glossary: stale).

## `packages/cli/src/types/lifecycle/install.ts`

- InstallationContext (type exported, 12-21): **delete**. Delete: LIF-029 one plain function with local values; LIF-001 no trees; LIF-002 no original; CMD-015 no refreshLockfiles.
- InstallationStep (type exported, 24-37): **delete**. Delete (LIF-029): the phase framework goes, and one plain function runs the steps.
- InstallationResult (type exported, 40-40): **move** to `packages/cli/src/types/install.ts` `InstallationResult`. Moves to types/install.ts, beside the other install types.
- InstallationPlan (type exported, 43-49): **delete**. Delete (CLX-004): the install dry run is deleted, so no type lists the planned commands.
- HookContext (type exported, 51-51): **move** to `packages/cli/src/types/install.ts` `HookContext`. Moves to types/install.ts: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- HookStatus (type exported, 53-53): **move** to `packages/cli/src/types/install.ts` `HookStatus`. Moves to types/install.ts with the other install types.
- HookPlan (type exported, 55-55): **move** to `packages/cli/src/types/install.ts` `HookPlan`. Moves to types/install.ts with the other install types.

## `packages/cli/src/types/lifecycle/merge.ts`

- MergeRequest (type exported, 9-16): **move** to `packages/cli/src/types/ownership.ts` `KeyChangeRequest`. Moves to types/ownership.ts as KeyChangeRequest (LIF-054): every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Field (type exported, 18-18): **move** to `packages/cli/src/types/ownership.ts` `ManagedKey`. Moves to types/ownership.ts as ManagedKey (LIF-054): every exported type is written by hand in types/, and managedKeySchema is checked with satisfies z.ZodType&lt;T&gt;.
- MergePlan (type exported, 20-24): **move** to `packages/cli/src/types/ownership.ts` `KeyChangePlan`. Moves to types/ownership.ts as KeyChangePlan (LIF-054): every exported type is written by hand in types/.
- MergePlanContents (type exported, 27-33): **move** to `packages/cli/src/types/ownership.ts` `KeyChangeContents`. Moves to types/ownership.ts as KeyChangeContents (LIF-054): every exported type is written by hand in types/.

## `packages/cli/src/types/lifecycle/ownership.ts`

- Restoration (type exported, 6-6): **move** to `packages/cli/src/types/ownership.ts` `Restoration`. Moves to types/ownership.ts with the other ownership types.
- Outcome (type exported, 8-8): **move** to `packages/cli/src/types/ownership.ts` `Outcome`. Moves to types/ownership.ts beside WritePlan; LIF-014: applyPlans returns nothing.
- OwnedBlock (type exported, 10-10): **move** to `packages/cli/src/types/ownership.ts` `OwnedBlock`. Moves to types/ownership.ts: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- PlannedBlock (type exported, 12-12): **move** to `packages/cli/src/types/ownership.ts` `PlannedBlock`. Moves to types/ownership.ts: every exported type is written by hand in types/.
- ReplacementRequest (type exported, 14-21): **move** to `packages/cli/src/types/ownership.ts` `ReplacementRequest`. Moves to types/ownership.ts; LIF-013 deletes plannedFiles.
- OwnedKind (type exported, 24-24): **move** to `packages/cli/src/types/ownership.ts` `OwnedKind`. Moves to types/ownership.ts, built from the config list OWNED_KINDS (types/ may import config/).
- PendingOwnership (type exported, 26-26): **move** to `packages/cli/src/types/ownership.ts` `PendingWrite`. Moves to types/ownership.ts as PendingWrite: it records one interrupted write; every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Ownership (type exported, 28-28): **move** to `packages/cli/src/types/ownership.ts` `OwnershipState`. Moves to types/ownership.ts as OwnershipState (glossary; LIF-053): every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- OwnershipEntry (type exported, 30-30): **move** to `packages/cli/src/types/ownership.ts` `OwnedFile`. Moves to types/ownership.ts as OwnedFile (glossary); LIF-053 deletes the alias; every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Identity (type exported, 32-32): **move** to `packages/cli/src/types/ownership.ts` `Identity`. Moves to types/ownership.ts: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Log (type exported, 35-42): **move** to `packages/cli/src/types/ownership.ts` `OwnershipLog`. Moves to types/ownership.ts as OwnershipLog (glossary; LIF-053): every exported type is written by hand in types/.
- InstallationFolders (type exported, 45-45): **delete**. Delete (A6): sideFolders goes, so there are no staging or previous folder paths.

## `packages/cli/src/types/lifecycle/selection.ts`

- CiChoice (type exported, 8-8): **move** to `packages/cli/src/types/commands/init.ts` `CiChoice`. Moves to types/commands/init.ts as a plain type: an init type, and commands/init/questions.ts is not created (CLX-001).
- RunnerChoice (type exported, 11-11): **delete**. Delete: INX-003 deletes the runner setting, so the runner choice has no user.
- InitOptions (type exported, 13-26): **move** to `packages/cli/src/types/commands/init.ts` `InitOptions`. Moves to types/commands/init.ts: every exported type is written by hand in types/; CMD-092 deletes the scopes, hooks, ci, agentRules, runner and install fields with their flags.
- ConfigurationReason (type exported, 28-28): **move** to `packages/cli/src/types/commands/init.ts` `ConfigurationReason`. Moves to types/commands/init.ts, the file of init types, which already uses it (InitPlan).
- InitDetection (type exported, 31-39): **move** to `packages/cli/src/types/commands/init.ts` `InitDetection`. Moves to types/commands/init.ts: every exported type is written by hand in types/.
- InitSelection (type exported, 42-49): **move** to `packages/cli/src/types/commands/init.ts` `InitSelection`. Moves to types/commands/init.ts: every exported type is written by hand in types/.
- InitInputs (type exported, 52-59): **move** to `packages/cli/src/types/commands/init.ts` `InitInputs`. Moves to types/commands/init.ts: every exported type is written by hand in types/; the field workspace becomes scopes.
- ConfigurationReconciliation (type exported, 62-62): **move** to `packages/cli/src/types/repository/selection.ts` `ConfigurationReconciliation`. Moves to types/repository/selection.ts, because these are configuration selection types; commands/reconcile.ts keeps its name.
- ConfigurationMerge (type exported, 65-69): **move** to `packages/cli/src/types/repository/selection.ts` `ConfigurationLists`. Moves to types/repository/selection.ts as ConfigurationLists, because these are configuration selection types; LIF-054: "merge" already means Git merges and managed keys.
- ConfigurationChoices (type exported, 72-72): **move** to `packages/cli/src/types/commands/init.ts` `ConfigurationChoices`. Moves to types/commands/init.ts with the init types.

## `packages/cli/src/types/tools/install.ts`

- ToolState (type exported, 6-6): **move** to `packages/cli/src/types/tools/find.ts` `ToolState`. Moves to types/tools/find.ts (finding tools); the state host becomes system; the name types/tools/install.ts does not fit once the Vale and install items leave.
- Inspected (type exported, 8-8): **move** to `packages/cli/src/types/tools/find.ts` `Inspected`. Moves to types/tools/find.ts: every exported type is written by hand in types/.
- ToolInspection (type exported, 10-19): **move** to `packages/cli/src/types/tools/find.ts` `ToolInspection`. Moves to types/tools/find.ts, beside the inspectTool types.
- ToolSearch (type exported, 21-30): **move** to `packages/cli/src/types/tools/find.ts` `ToolSearch`. Moves to types/tools/find.ts: every exported type is written by hand in types/; A6: the getPendingInstallations field goes (no installing state).
- InstalledFile (type exported, 33-33): **delete**. Delete (LIF-001): no file-by-file copy, so no installed-file record is left.
- ToolOwner (type exported, 36-39): **delete**. Delete (LIF-055): the reader is Root read; installTree goes with LIF-001.
- AvailableToolInspection (type exported, 42-42): **move** to `packages/cli/src/types/tools/find.ts` `AvailableToolInspection`. Moves to types/tools/find.ts with the tool lookup types.
- ToolAvailability (type exported, 45-45): **move** to `packages/cli/src/types/tools/run.ts` `ToolAvailability`. Moves to types/tools/run.ts: a runnable path or the failure that stops the run.
- LockfileDrift (type exported, 48-48): **move** to `packages/cli/src/types/tools/project.ts` `StaleLockfile`. Moves to types/tools/project.ts as StaleLockfile (glossary: stale); the file name fits the tool projects once ToolProject is deleted.
- LockfilePreparation (type exported, 50-50): **delete**. Delete (CMD-015, LIF-029): the refreshLockfiles plumbing goes.
- DuplicateMisePin (type exported, 52-52): **delete**. Delete (INX-007): its producer duplicateMisePins is deleted.
- LocateOptions (type exported, 54-58): **move** to `packages/cli/src/types/tools/find.ts` `LocateOptions`. Moves to types/tools/find.ts; it names InstalledToolFolder, built from the config list INSTALLED_TOOL_FOLDERS, so it may sit in types/.
- ValeInstallation (type exported, 61-68): **move** to `packages/cli/src/types/install.ts` `ValeInstallation`. Moves to types/install.ts: every exported type is written by hand in types/; LIF-055: the owner becomes a Root read.
- ExecutionFailure (type exported, 71-71): **move** to `packages/cli/src/types/tools/run.ts` `ExecutionFailure`. Moves to types/tools/run.ts: tools/ is the lowest owner (ToolAvailability uses it), and execution/ imports it.

## `packages/cli/src/types/tools/npm.ts`

- PackagePreparation (type exported, 4-4): **delete**. Delete (LIF-030): plain function parameters.
- PackageInstallation (type exported, 6-6): **delete**. Delete (LIF-030): plain function parameters replace it.
- PackageRun (type exported, 9-9): **move** to `packages/cli/src/types/tools/project.ts` `NpmClientRun`. Moves to types/tools/project.ts as NpmClientRun (NMS-009): one topic file for both tool projects instead of a two-item npm.ts.
- PackageCommands (type exported, 12-12): **move** to `packages/cli/src/types/tools/project.ts` `NpmClientCommands`. Moves to types/tools/project.ts as NpmClientCommands (NMS-009).

## `packages/cli/src/types/tools/project.ts`

- ToolProjectPlan (type exported, 5-5): **delete**. Delete (LIF-029, LIF-030): each tool project is plain functions, and gspot install has no dry run (CLX-004), so no plan type is left.
- ToolProjectGuards (type exported, 8-8): **delete**. Delete (LIF-002, LIF-021): both tool project guards go.
- ToolProject (type exported, 11-35): **delete**. Delete (LIF-030): two plain modules replace the generic interface.

## `packages/cli/src/types/tools/python.ts`

- PythonPreparation (type exported, 5-10): **move** to `packages/cli/src/types/tools/project.ts` `PythonPreparation`. Moves to types/tools/project.ts; the field pythonInstaller becomes uvPath, the uv found in the mise bin-paths folders (INX-006).
- PythonExecution (type exported, 12-12): **delete**. Delete (LIF-030): plain parameters of installPythonTools.
- PythonToolLockfile (type exported, 15-15): **move** to `packages/cli/src/types/tools/project.ts` `PythonToolLockfile`. Moves to types/tools/project.ts: every exported type is written by hand in types/, and lockfileSchema is checked with satisfies z.ZodType&lt;T&gt;.
- PythonRequirement (type exported, 18-18): **move** to `packages/cli/src/types/tools/project.ts` `PythonRequirement`. Moves to types/tools/project.ts: every exported type is written by hand in types/.
- PythonSettingsSources (type exported, 21-21): **move** to `packages/cli/src/types/tools/project.ts` `PythonSettingsSources`. Moves to types/tools/project.ts with the tool project types.
- PythonIndexSettings (type exported, 24-24): **move** to `packages/cli/src/types/tools/project.ts` `PythonIndexSettings`. Moves to types/tools/project.ts with the tool project types.

## `packages/cli/src/types/tools/run.ts`

- ToolRunOptions (type exported, 4-7): **move** to `packages/cli/src/types/tools/run.ts` `ToolRunOptions`. Stays in types/tools/run.ts, beside runTool's other types; ToolAvailability and ExecutionFailure join it.

## `packages/cli/src/types/tools/session.ts`

- ToolSession (type exported, 6-6): **merge** to `packages/cli/src/types/planning.ts` `Session`. Merges into Session in types/planning.ts: one Session type, written by hand in types/; INX-006: the runner check behind pythonInstaller goes, and the session keeps the mise bin-paths folders it reads once.

## `packages/cli/configurations/database/postgres/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/database/postgres/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); CKO-041: \[\[check\]\] migration-docs and the setting postgres.doc_sections go; its naming override record uses the shared override keys under the header naming.override (TMF).

## `packages/cli/configurations/database/postgres/rules/POSTGRES.md`

- (the file) (file): **keep** to `packages/cli/configurations/database/postgres/rules/POSTGRES.md`. Stays; CFL-025 delete the front matter; CFL-036.

## `packages/cli/configurations/database/postgres/squawk.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/squawk.ts` `squawkToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer. Values to config: SQUAWK_RECOMMENDED_OFF = \['prefer-bigint-over-int', 'prefer-bigint-over-smallint', 'prefer-identity', 'prefer-text-field', 'require-table-schema'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/framework/astro/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/astro/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/astro/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/astro.ts` `astroFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: ASTRO_RULES = { 'astro/no-set-html-directive', 'astro/no-exports-from-components', 'astro/no-prerender-export-outside-pages' } at error plus the 4 all-level rules -&gt; packages/cli/src/config/generation/eslint-fragments.ts; ASTRO_FILES = \['\*\*/\*.astro'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts; ASTRO_SCRIPT_FILES = \['\*\*/\*.astro/\*.ts', '\*\*/\*.astro/\*.js'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/astro/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/astro/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; S5C-017: the fragment reads its preset sources from eslint_presets; TML-008: its \[set\] table writes "tools.eslint.import_extension" = "extensionless".

## `packages/cli/configurations/framework/astro/rules/ASTRO.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/astro/rules/ASTRO.md`. Stays; CFL-025 delete the front matter; CFL-035.

## `packages/cli/configurations/framework/expo/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/expo.ts` `expoFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: EXPO_RULES = { 'expo/no-env-var-destructuring', 'expo/no-dynamic-env-var', 'expo/use-dom-exports', 'expo/prefer-box-shadow' } -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/expo/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/expo/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; TML-008: its \[set\] table writes "tools.eslint.import_extension" = "extensionless".

## `packages/cli/configurations/framework/express/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/express.ts` `expressFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: EXPRESS_RULES = { 'security/detect-no-csrf-before-method-override': 'error' } -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/express/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/express/manifest.toml`. The configuration manifest stays; S5C-006: drop security from suggests, because it is always selected.

## `packages/cli/configurations/framework/express/rules/EXPRESS.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/express/rules/EXPRESS.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/framework/express/semgrep/express.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/framework/express/semgrep/express.yml`. Renamed express.yml; CFL-001 step 1: plain YAML; CFL-043; CFL-052.

## `packages/cli/configurations/framework/fastapi/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/fastapi/manifest.toml`. The configuration manifest stays; S5C-006: drop security from suggests, because it is always selected.

## `packages/cli/configurations/framework/fastapi/rules/FASTAPI.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/fastapi/rules/FASTAPI.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/framework/fastapi/semgrep/fastapi.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/framework/fastapi/semgrep/fastapi.yml`. Renamed fastapi.yml; CFL-001 step 1: plain YAML; CFL-043; CFL-052.

## `packages/cli/configurations/framework/nestjs/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nestjs/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/nestjs/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/nestjs.ts` `nestjsFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: NESTJS_INJECTABLE_FILTER_PATHS = \['/dist/', '/node_modules/', '\\\\.test\\\\.', '\\\\.spec\\\\.'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts; NESTJS_ALL_LEVEL_RULES = { '@typescript-eslint/no-extraneous-class': \['error', { allowWithDecorator: true }\] } -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/nestjs/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nestjs/manifest.toml`. The configuration manifest stays; S5C-006: drop security from suggests, because it is always selected.

## `packages/cli/configurations/framework/nestjs/rules/NESTJS.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nestjs/rules/NESTJS.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/framework/nextjs/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nextjs/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/nextjs/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/nextjs.ts` `nextjsFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; JSX_CODE_FILES serves react and react-dom too. Values to config: NEXT_PAGES_FOLDERS = \['pages/', 'src/pages/'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts; NEXT_SERVER_FILES = \['\*\*/server/\*\*', '\*\*/\*.server.\*'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts; NEXT_RULES = { '@next/next/no-html-link-for-pages', '@next/next/no-async-client-component', 'gspot/require-server-only' } -&gt; packages/cli/src/config/generation/eslint-fragments.ts; JSX_CODE_FILES = \['\*\*/\*.{js,jsx,ts,tsx}'\] (also react and react-dom) -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/nextjs/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nextjs/manifest.toml`. The configuration manifest stays (CFL-007, CFL-008, CFL-029, CFL-039); the check title field goes (NMU-004), and the check example field stays; TML-008, TMF: its \[set\] table writes "tools.eslint.import_extension" = "extensionless", and its two naming override records use allowed_names under the singular header naming.override.

## `packages/cli/configurations/framework/nextjs/rules/NEXTJS.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/nextjs/rules/NEXTJS.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/framework/react-dom/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react-dom/eslint-presets.json`. Stays (A4): React DOM stays its own configuration; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/react-dom/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/react-dom.ts` `reactDomFragment`. Moves to generation/eslint/fragments/react-dom.ts (A4): React DOM stays its own configuration; CFL-001 step 3 (group E): a function that returns the imports and blocks; CFL-006 selectors in one manifest list.

## `packages/cli/configurations/framework/react-dom/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react-dom/manifest.toml`. Stays (A4): React DOM stays its own configuration; the configuration manifest stays.

## `packages/cli/configurations/framework/react-native/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/react-native.ts` `reactNativeFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: REACT_NATIVE_RULES = the 5 rules at both levels and the 3 all-level rules -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/react-native/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react-native/manifest.toml`. The configuration manifest stays; TML-008: its \[set\] table writes "tools.eslint.import_extension" = "extensionless".

## `packages/cli/configurations/framework/react-native/rules/REACT-NATIVE.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react-native/rules/REACT-NATIVE.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/framework/react/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/react/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/react.ts` `reactFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: REACT_RULES = { 'react/no-danger', 'react/no-unstable-nested-components', 'react/jsx-no-constructed-context-values', 'react/no-object-type-as-default-prop' } plus the all-level pair -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/react/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react/manifest.toml`. The configuration manifest stays (A4: React DOM stays its own configuration, so React takes nothing from it); the check title field goes (NMU-004), and the check example field stays; S5C-009: add react/self-closing-comp to eslint_all_rules before CFL-002 drops the isAll wraps; TML-008, TMF: its \[set\] table writes "tools.eslint.import_extension" = "extensionless", and its three naming override records use cases and allowed_names under the singular header naming.override.

## `packages/cli/configurations/framework/react/rules/REACT.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/react/rules/REACT.md`. Stays; CFL-025 delete the front matter; CFL-034.

## `packages/cli/configurations/framework/site/html-validate-built.json.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/tool-file-sources/html-validate.ts` `htmlValidateToolFile`. Merges into one html-validate builder (CFL-018); the built-output overrides become a constant beside it. Values to config: HTML_BUILT_OVERRIDES = the 5 rules turned off and valid-id relaxed (CFL-018) -&gt; packages/cli/src/config/generation/html.ts

## `packages/cli/configurations/framework/site/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/site/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); TMF-008, TML-014, NMU-017: when = { setting = "site.size_limit" }, and the help and summary texts name \[\[site.size_limit\]\], site.allowed_unlisted_pages and docs.allowed_urls.

## `packages/cli/configurations/framework/site/purgecss.config.mjs.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/purgecss.ts` `purgecssToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; GEN-023: no empty spread; TMF-007: it reads tools.purgecss.safelist as a plain list of class names, not the keys of a map. Values to config: PURGECSS_EXTRACTOR = the defaultExtractor text /\[\\w-/:\]+(?&lt;!:)/g -&gt; packages/cli/src/config/generation/tool-file-sources.ts; PURGECSS_PSEUDO_CLASS_PATTERN = /^:(?!:)\[\\w-\]+$/u -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/framework/site/rules/SITE.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/site/rules/SITE.md`. Stays (CFL-025: delete the front matter; CFL-040: title Static Site); S5C-012: delete the Runtime isolation and Edge middleware sections, because a static site has no middleware and CLOUDFLARE.md holds the isolate rules.

## `packages/cli/configurations/framework/svelte/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/svelte/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/svelte/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/svelte.ts` `svelteFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: SVELTE_FILES = \['\*\*/\*.svelte', '\*\*/\*.svelte.js', '\*\*/\*.svelte.ts'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts; SVELTE_RULES = { 'svelte/no-target-blank', 'svelte/button-has-type' } plus the all-level pair -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/svelte/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/svelte/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; S5C-009: add svelte/no-useless-mustaches and svelte/prefer-const to eslint_all_rules (the preset turns the first on at recommended today); TML-008: its \[set\] table writes "tools.eslint.import_extension" = "extensionless".

## `packages/cli/configurations/framework/svelte/rules/SVELTE.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/svelte/rules/SVELTE.md`. Stays; CFL-025 delete the front matter; CFL-030, CFL-035.

## `packages/cli/configurations/framework/svelte/stylelint.fragment.json.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `stylelintToolFile`. Merges into the one Stylelint builder as a constant (CFL-001), so no fragment file remains for stylelint.json. Values to config: SVELTE_STYLELINT_OVERRIDE = { files: \['\*\*/\*.svelte'\], customSyntax: 'postcss-html', ignorePseudoClasses: \['global'\] } -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/framework/vue/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/framework/vue/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/framework/vue/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/vue.ts` `vueFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: VUE_RULES = the 4 rules at both levels and the all-level table -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/framework/vue/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/framework/vue/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; S5C-009: add vue/no-useless-v-bind and vue/prefer-true-attribute-shorthand to eslint_all_rules; S5C-017: preset sources from eslint_presets; TML-008: its \[set\] table writes "tools.eslint.import_extension" = "extensionless".

## `packages/cli/configurations/framework/vue/rules/VUE.md`

- (the file) (file): **keep** to `packages/cli/configurations/framework/vue/rules/VUE.md`. Stays; CFL-025 delete the front matter; CFL-030, CFL-035.

## `packages/cli/configurations/framework/vue/stylelint.fragment.json.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `stylelintToolFile`. Merges into the one Stylelint builder (CFL-001 step 3), with the Tailwind branch. Values to config: VUE_STYLELINT_OVERRIDE = files, customSyntax, pseudo classes \['deep', 'global', 'slotted'\], functions \['v-bind'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/commits/commitlint.config.cjs.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/commitlint.ts` `commitlintToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-043: reject unknown rule names; keep the parse check for the JavaScript text. Values to config: COMMITLINT_RULES = the 11 rule entries with their options -&gt; packages/cli/src/config/generation/tool-file-sources.ts; COMMIT_LINE_LENGTH = 72 -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/commits/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/commits/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/commits/rules/GIT.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/commits/rules/GIT.md`. Stays; CFL-025 delete the front matter; CFG-050 install only where commits applies.

## `packages/cli/configurations/general/coverage/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/coverage/manifest.toml`. The configuration manifest stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); TMF-004: coverage.overrides becomes the root record list \[\[coverage.target\]\] with name, lines and reason.

## `packages/cli/configurations/general/dependencies/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/dependencies/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); TML-014: the example and help name dependencies.allowed_registries.

## `packages/cli/configurations/general/dependencies/osv-scanner.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/osv-scanner.ts` `osvScannerToolFile`. Moves to generation/tool-file-sources/osv-scanner.ts; CFL-001 step 3: a typed TypeScript function replaces the template (only where not longer).

## `packages/cli/configurations/general/dependencies/rules/DEPENDENCIES.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/dependencies/rules/DEPENDENCIES.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/general/dependencies/syncpack.json.eta`

- (the file) (file): **rename** to `packages/cli/configurations/general/dependencies/syncpack.json`. Becomes a plain file (CFL-001 step 1): it has no template code.

## `packages/cli/configurations/general/docs/lychee.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/lychee.ts` `lycheeToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; GEN-023: no empty exclude; NMU-017: it reads docs.allowed_urls.

## `packages/cli/configurations/general/docs/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/docs/manifest.toml`. The configuration manifest stays and gains rules/DOCS.md (CFG-017, CFG-045); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); A3: the \[\[check\]\] headings block goes, and docs.banned_headings becomes root only; NMU-017: the help names docs.allowed_urls.

## `packages/cli/configurations/general/duplication/jscpd.json.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/jscpd.ts` `jscpdToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-031: drop reporters; POL-031: it reads limits.min_duplicate_lines and limits.min_duplicate_tokens. Values to config: JSCPD_IGNORED = \['\*\*/.gspot/\*\*', '\*\*/\*.md', '\*\*/\*.mdx'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/duplication/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/duplication/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/engineering/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/manifest.toml`. Stays; CFG-022 drop SARIF and Homebrew; CFG-049.

## `packages/cli/configurations/general/engineering/rules/agent/PLANNING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/agent/PLANNING.md`. Stays; CFL-025 delete the front matter; CFG-016 delete the repeated lines.

## `packages/cli/configurations/general/engineering/rules/agent/SUPPRESSIONS.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/agent/SUPPRESSIONS.md`. Stays; CFL-025 delete the front matter; CFG-048 one paragraph.

## `packages/cli/configurations/general/engineering/rules/agent/TALKING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/agent/TALKING.md`. Stays; CFL-025 delete the front matter; owner decision: ships in every installation.

## `packages/cli/configurations/general/engineering/rules/agent/TASKS.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/agent/TASKS.md`. Stays; CFL-025 delete the front matter; CFG-051.

## `packages/cli/configurations/general/engineering/rules/agent/WORKING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/agent/WORKING.md`. Stays; CFL-025 delete the front matter; CFG-015 reword lines 39-40; CFG-016; CFG-022 delete the config/types clause; IGN-002.

## `packages/cli/configurations/general/engineering/rules/code/ACCESSIBILITY.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/ACCESSIBILITY.md`. Stays; CFL-025 delete the front matter; CFG-049 install only with UI files.

## `packages/cli/configurations/general/engineering/rules/code/CLI.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/CLI.md`. Stays; CFL-025 delete the front matter; CFG-018, CFG-021.

## `packages/cli/configurations/general/engineering/rules/code/COMMENTS.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/COMMENTS.md`. Stays; CFL-025 delete the front matter; CFG-015 keep.

## `packages/cli/configurations/general/engineering/rules/code/CONFIGURATION.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/CONFIGURATION.md`. Stays; CFL-025 delete the front matter; CFG-018 its secrets section moves to SECRETS.md; CFG-021.

## `packages/cli/configurations/general/engineering/rules/code/ERRORS.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/ERRORS.md`. Stays; CFL-025 delete the front matter; CFG-021, CFG-053.

## `packages/cli/configurations/general/engineering/rules/code/HTTP.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/HTTP.md`. Stays; CFL-025 delete the front matter; CFG-021.

## `packages/cli/configurations/general/engineering/rules/code/LOGGING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/LOGGING.md`. Stays; CFL-025 delete the front matter; CFG-021, CFG-051.

## `packages/cli/configurations/general/engineering/rules/code/TESTING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/engineering/rules/code/TESTING.md`. Stays; CFL-025 delete the front matter; CFG-020 about 60 lines.

## `packages/cli/configurations/general/files/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/files/manifest.toml`. The configuration manifest stays (CFG-028, CFG-029); CFL-012: it takes .storyboard and .xib; the folder keeps the name files; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/files/rules/YAML.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/files/rules/YAML.md`. Stays; CFL-025 delete the front matter; CFG-018, CFG-053.

## `packages/cli/configurations/general/files/taplo.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/taplo.ts` `taploToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-029; POL-034, CFR-002: it reads tools.taplo.extra.value. Values to config: TAPLO_FORMATTING = { align_entries: false, reorder_keys: false, array_auto_expand: false, array_auto_collapse: false } -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/files/v8r.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/v8r.ts` `v8rToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-028: set ignoreErrors once with its reason; TMF-002, TMF: it always lists the mise schema (its fileMatch patterns match nothing without a mise file), and the schemas come from the root record list \[\[tools.v8r.schema\]\] with paths and url. Values to config: MISE_SCHEMA = { name: 'mise', fileMatch: \[5 mise paths\], location: '<https://mise.jdx.dev/schema/mise.json>' } -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/files/yamllint.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/yamllint.ts` `yamllintToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-043. Values to config: YAMLLINT_RULES = the 15 rule names -&gt; packages/cli/src/config/generation/tool-file-sources.ts; YAMLLINT_RULE_OPTIONS = comments, truthy, braces, brackets, indentation options -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/format/editorconfig.eta`

- (the file) (file): **move** to `packages/cli/src/generation/formatting.ts` `editorconfigToolFile`. Moves to generation/formatting.ts (CFL-001 step 3), beside editorconfigOverrides, which it already calls; POL-034, CFR-002: it reads tools.editorconfig-checker.extra.value. Values to config: EDITORCONFIG_FIXED_SECTIONS = \[\*\] charset and trim_trailing_whitespace, \[\*.md\] trim_trailing_whitespace = false, \[Makefile\] indent_style = tab -&gt; packages/cli/src/config/generation/formatting.ts

## `packages/cli/configurations/general/format/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/format/manifest.toml`. The configuration manifest stays; CFG-046: no generated key; CFG-047: always_selected; CFL-041: pointer source; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/format/pointer.mjs.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/formatting.ts` `prettierConfiguration`. Merges into prettierConfiguration, which writes prettier.config.mjs from TypeScript (CFL-001) without the Astro and Svelte crash (CFG-001); the pointer template key goes (CFL-041); the Prettier overrides come from the root record list \[\[format.override\]\] (CFR-004).

## `packages/cli/configurations/general/format/prettier.json.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/formatting.ts` `prettierConfiguration`. Merges into generation/formatting.ts; CFL-001 step 2.

## `packages/cli/configurations/general/format/prettierignore.eta`

- (the file) (file): **move** to `packages/cli/src/generation/formatting.ts` `prettierignoreToolFile`. Moves to generation/formatting.ts (CFL-001 step 3); GEN-023: no blank lines; GEN-009; TMF-003, TMF-001: the exclude line goes with the exclude setting, and the generated and vendored lines come from the .gitattributes linguist patterns plus the configuration declarations. Values to config: PRETTIERIGNORE_HEADER = the one header comment line -&gt; packages/cli/src/config/generation/formatting.ts

## `packages/cli/configurations/general/gspot/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/gspot/manifest.toml`. The configuration manifest stays (CFG-045); the check title field goes (NMU-004), and the check example field stays; INX-002: Node becomes a system tool: system = true, min_version = "24.2.0", brew and winget kept for the doctor hint; version and mise are deleted, so .gspot/mise.toml pins no Node.

## `packages/cli/configurations/general/gspot/rules/GENERATED.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/gspot/rules/GENERATED.md`. Stays (CFL-025: delete the front matter; CFG-051); CFR-005: line 10 says: if the format has no comments, mark the file linguist-generated in .gitattributes (no \[\[generated\]\] table).

## `packages/cli/configurations/general/licenses/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/licenses/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/naming/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/naming/manifest.toml`. The configuration manifest stays (CFG-044: examples; CFL-038: shared path_containers); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/naming/policy.json`

- (the file) (file): **rename** to `packages/cli/configurations/general/naming/defaults.json`. Renamed defaults.json (CFG-035: "policy" means gspot.toml); CFG-011 deletes version and matching; TMF-005, TMF: its overrides use allowed_names and its language categories use cases, the keys of the shared override and naming schemas.

## `packages/cli/configurations/general/naming/rules/NAMING-FILES.md`

- (the file) (file): **merge** to `packages/cli/configurations/general/naming/rules/NAMING.md`. Merges into cli/configurations/general/naming/rules/NAMING.md (CFG-019): files section and boundary paragraph join NAMING.md.

## `packages/cli/configurations/general/naming/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/naming/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFG-019 takes NAMING-FILES.md; CFG-023 plain words.

## `packages/cli/configurations/general/prose/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/prose/manifest.toml`. The configuration manifest stays; CFG-025: the 62 style blocks become one prose/vale/ folder rule; CFG-003: one vale.ini; GEN-008: no ignored list; TML-014; CFL-010: words; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); IGN-002: the blocks of auto-prefixes, question-marks and gerund-headings go with the styles.

## `packages/cli/configurations/general/prose/rules/DOCS-CONTENT.md`

- (the file) (file): **merge** to `packages/cli/configurations/general/docs/rules/DOCS.md`. Merges into cli/configurations/general/docs/rules/DOCS.md (CFG-017): five DOCS files repeat each other; each rule said once.

## `packages/cli/configurations/general/prose/rules/DOCS-FORMAT.md`

- (the file) (file): **merge** to `packages/cli/configurations/general/docs/rules/DOCS.md`. Merges into cli/configurations/general/docs/rules/DOCS.md (CFG-017).

## `packages/cli/configurations/general/prose/rules/DOCS-MEDIA.md`

- (the file) (file): **merge** to `packages/cli/configurations/general/docs/rules/DOCS.md`. Merges into cli/configurations/general/docs/rules/DOCS.md (CFG-017).

## `packages/cli/configurations/general/prose/rules/DOCS-SURFACES.md`

- (the file) (file): **merge** to `packages/cli/configurations/general/docs/rules/DOCS.md`. Merges into cli/configurations/general/docs/rules/DOCS.md (CFG-017): "surfaces" is jargon for reference pages.

## `packages/cli/configurations/general/prose/rules/DOCS.md`

- (the file) (file): **move** to `packages/cli/configurations/general/docs/rules/DOCS.md`. Moves to cli/configurations/general/docs/rules/DOCS.md (CFG-017): the docs rules join the docs configuration as one file.

## `packages/cli/configurations/general/prose/rules/WRITING.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/prose/rules/WRITING.md`. Stays; CFL-025 delete the front matter; CFG-017 stays in prose; CFG-051.

## `packages/cli/configurations/general/prose/styles/LICENSES.md`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/LICENSES.md`. Moves to cli/configurations/general/prose/vale/styles/LICENSES.md; CFG-002 (fix-bug): write the MIT notices beside the copied styles; CFG-025 folder rule carries it.

## `packages/cli/configurations/general/prose/styles/gspot/acronyms.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `acronymsStyle`. Moves to the Vale style builder in generation/prose.ts (CFG-038): its exceptions come from the shared words list, so the builder writes it like heading-case and title-case, and it cannot stay a plain file.

## `packages/cli/configurations/general/prose/styles/gspot/alt-text.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `altTextStyle`. Moves to the Vale style builder in generation/prose.ts (CFL-001 step 3: one of 8 Vale styles with template code); CFG-026: one place turns it off. Values to config: ALT_TEXT_TOKENS = the img-without-alt token and the all-level 'Image of' token -&gt; packages/cli/src/config/generation/prose.ts

## `packages/cli/configurations/general/prose/styles/gspot/ampm.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/ampm.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/auto-prefixes.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): one of the six copied styles the owner deleted.

## `packages/cli/configurations/general/prose/styles/gspot/banned-headings.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `bannedHeadingsStyle`. Moves to the Vale style builder in generation/prose.ts (A3), which writes the style banned-headings from BANNED_HEADINGS and the root setting docs.banned_headings (CFL-001 step 3); the per-scope copies go with the per-scope Vale config.

## `packages/cli/configurations/general/prose/styles/gspot/bias-free.yml.eta`

- (the file) (file): **merge** to `packages/cli/configurations/general/prose/vale/styles/gspot/conscious-language.yml`. Merges into cli/configurations/general/prose/vale/styles/gspot/conscious-language.yml (CFG-005): DMZ and spirit animal move; master/slave, hangs and sanity check go.

## `packages/cli/configurations/general/prose/styles/gspot/case-sensitive-terms.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): a Red Hat product list; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/conscious-language.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/conscious-language.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-005 takes DMZ, spirit animal and mans.

## `packages/cli/configurations/general/prose/styles/gspot/contractions.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/contractions.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/currency.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/currency.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/dash-spacing.yml.eta`

- (the file) (file): **delete**. Delete (CFG-005, CFG-005): dashes already bans these dashes; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/dashes.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/dashes.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/date-ordinals.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/date-ordinals.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-040.

## `packages/cli/configurations/general/prose/styles/gspot/dates.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/dates.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-009 numeric-dates folds into it.

## `packages/cli/configurations/general/prose/styles/gspot/file-paths.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/file-paths.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/future.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/future.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/gendered-terms.yml.eta`

- (the file) (file): **merge** to `packages/cli/configurations/general/prose/vale/styles/gspot/conscious-language.yml`. Merges into cli/configurations/general/prose/vale/styles/gspot/conscious-language.yml (CFG-005): its one entry (mans) moves.

## `packages/cli/configurations/general/prose/styles/gspot/gerund-headings.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): one of the six copied styles the owner deleted with the Tengo script.

## `packages/cli/configurations/general/prose/styles/gspot/heading-case.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `headingCaseStyle`. Moves to generation/prose.ts; CFL-001 step 3 (8 Vale styles with template code); CFG-038 exceptions from prose words plus one acronym list; GEN-016 plain escapes; CFG-022.

## `packages/cli/configurations/general/prose/styles/gspot/hedging.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/hedging.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-005.

## `packages/cli/configurations/general/prose/styles/gspot/history.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/history.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/idioms.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/idioms.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/interface-verbs.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/interface-verbs.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/item-length.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `itemLengthStyle`. Moves to the Vale style builder in generation/prose.ts (CFL-001 step 3: one of 8 Vale styles with template code); it reads limits.list_item_words. Values to config: LENGTH_STYLES = extends, scope and token of the three length styles (item, paragraph, sentence) -&gt; packages/cli/src/config/generation/prose.ts

## `packages/cli/configurations/general/prose/styles/gspot/jargon.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/jargon.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-009 remove leverage.

## `packages/cli/configurations/general/prose/styles/gspot/leading-conjunctions.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/leading-conjunctions.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/link-text.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/link-text.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/locations.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/locations.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/marketing.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/marketing.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-005.

## `packages/cli/configurations/general/prose/styles/gspot/merge-conflict-markers.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/merge-conflict-markers.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/militaristic-language.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/militaristic-language.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/modals.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/modals.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/negative-numbers.yml.eta`

- (the file) (file): **delete**. Delete (CFG-005, CFG-005): contradicts dashes; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/no-gerunds-in-titles.tengo.eta`

- (the file) (file): **delete**. Delete: the Tengo script only builds a suggestion, and the owner deleted the gerund-headings style with it (IGN-002); delete its \[\[tool_file\]\] and typos ignore.

## `packages/cli/configurations/general/prose/styles/gspot/numbered-units.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/numbered-units.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-040.

## `packages/cli/configurations/general/prose/styles/gspot/numeric-dates.yml.eta`

- (the file) (file): **delete**. Delete (CFG-009, CFG-005): a subset of dates; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/obvious-fields.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/obvious-fields.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-009 keep.

## `packages/cli/configurations/general/prose/styles/gspot/ordinal-adverbs.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/ordinal-adverbs.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-040.

## `packages/cli/configurations/general/prose/styles/gspot/paragraph-length.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `paragraphLengthStyle`. Moves to the Vale style builder in generation/prose.ts (CFL-001 step 3: one of 8 Vale styles with template code); it reads limits.paragraph_sentences; it shares LENGTH_STYLES with item-length (token \[.!?\](\\s|$)).

## `packages/cli/configurations/general/prose/styles/gspot/percentage-numbers.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/percentage-numbers.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-041 \[a-zA-Z\].

## `packages/cli/configurations/general/prose/styles/gspot/placeholders.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/placeholders.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/possessives.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `possessivesStyle`. Moves to generation/prose.ts; CFL-001 step 3 (8 Vale styles with template code); GEN-016 plain escapes.

## `packages/cli/configurations/general/prose/styles/gspot/product-centric-writing.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/product-centric-writing.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-040.

## `packages/cli/configurations/general/prose/styles/gspot/punctuated-headings.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/punctuated-headings.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/question-marks.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): one of the six copied styles the owner deleted.

## `packages/cli/configurations/general/prose/styles/gspot/release-notes.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): its Now swap fires on every comment (CFG-009); default delete; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/self-reference.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/self-reference.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-009 takes the topic-references tokens.

## `packages/cli/configurations/general/prose/styles/gspot/sentence-length.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `sentenceLengthStyle`. Moves to the Vale style builder in generation/prose.ts (CFL-001 step 3: one of 8 Vale styles with template code); it reads limits.sentence_words; it shares LENGTH_STYLES with item-length (token \\b\\w+\\b).

## `packages/cli/configurations/general/prose/styles/gspot/session-identifiers.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/session-identifiers.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/since.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/since.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/slash-alternatives.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): a Hugging Face and Red Hat exception list; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/straight-quotes.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/straight-quotes.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-042 curly double quotes.

## `packages/cli/configurations/general/prose/styles/gspot/suspended-hyphens.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/suspended-hyphens.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks; CFG-040.

## `packages/cli/configurations/general/prose/styles/gspot/symbols.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/symbols.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/time-ranges.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/time-ranges.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/title-case.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `titleCaseStyle`. Moves to generation/prose.ts; CFL-001 step 3 (8 Vale styles with template code); CFG-038 one shared exception list.

## `packages/cli/configurations/general/prose/styles/gspot/topic-references.yml.eta`

- (the file) (file): **merge** to `packages/cli/configurations/general/prose/vale/styles/gspot/self-reference.yml`. Merges into cli/configurations/general/prose/vale/styles/gspot/self-reference.yml (CFG-009, CFG-005): its tokens join self-reference; drop this module and this assembly.

## `packages/cli/configurations/general/prose/styles/gspot/unneeded-adverbs.yml.eta`

- (the file) (file): **delete**. Delete (IGN-002): reports technical words; its overlaps (CFG-009) go with it; default delete; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/url-prepositions.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/url-prepositions.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/styles/gspot/us-english.yml.eta`

- (the file) (file): **delete**. Delete (CFG-008): typos already reports British spellings; delete its \[\[tool_file\]\] and test vectors.

## `packages/cli/configurations/general/prose/styles/gspot/version-range.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/general/prose/vale/styles/gspot/version-range.yml`. Becomes plain YAML in the prose/vale/ folder (CFL-001 step 1), because it has no template code; CFG-025: the folder mirrors the target and replaces 62 \[\[tool_file\]\] blocks.

## `packages/cli/configurations/general/prose/vale.ini.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `valeIniToolFile`. Moves to a typed function in generation/prose.ts (CFG-026, CFL-001 step 3) with the turned-off rules and their plain reasons in one constant; CFG-003 and CFG-008 drop the per-scope and locale parts; GEN-024: one StylesPath base; CFG-022: plain reasons; TML-014: nothing reads prose.locale here (typos alone reads spelling.locale). Values to config: VALE_OFF_RULES = the turned-off upstream rules with one plain reason each, plus Google.Semicolons, Google.WordListCase and Harper.OkToOkay (IGN-002) -&gt; packages/cli/src/config/generation/prose.ts; RECOMMENDED_STYLES = \['dates', 'link-text', 'alt-text'\] -&gt; packages/cli/src/config/generation/prose.ts; VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table' -&gt; packages/cli/src/config/generation/prose.ts; VALE_MARKUP_FILES = '\*.{md,mdx,html,htm,astro,svelte,vue}' -&gt; packages/cli/src/config/generation/prose.ts

## `packages/cli/configurations/general/prose/vocabularies/gspot/accept.txt.eta`

- (the file) (file): **move** to `packages/cli/src/generation/prose.ts` `acceptedWordsToolFile`. Moves to generation/prose.ts: CFL-001 step 3 builds it in TypeScript, so no target-shaped template path is needed; CFL-010: words.

## `packages/cli/configurations/general/repository/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/repository/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); CFR-005, TMF: the help says: mark the file linguist-generated or linguist-vendored in .gitattributes, or raise limits.file_kilobytes with a reason.

## `packages/cli/configurations/general/secrets/gitleaks.toml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/general/secrets/gitleaks.toml`. Renamed gitleaks.toml; CFL-001 step 1; GEN-023 keep (the check passes the file, so a stray .gitleaks.toml is not read).

## `packages/cli/configurations/general/secrets/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/secrets/manifest.toml`. The configuration manifest stays (CFG-052); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/general/secrets/rules/SECRETS.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/secrets/rules/SECRETS.md`. Stays; CFL-025 delete the front matter; CFG-018 every secret rule once; CFG-053.

## `packages/cli/configurations/general/security/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/security/manifest.toml`. The configuration manifest stays (CFG-013, S5C-008); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); TML-006, TMF: when = { setting = "tools.semgrep.registry_packs" } and {each:--config:tools.semgrep.registry_packs}; tools.codeql.suite is deleted, and the level picks the CodeQL suite.

## `packages/cli/configurations/general/security/rules/SECURITY.md`

- (the file) (file): **keep** to `packages/cli/configurations/general/security/rules/SECURITY.md`. Stays; CFL-025 delete the front matter; CFG-018 heading Builds.

## `packages/cli/configurations/general/security/semgrepignore.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/semgrep.ts` `semgrepignoreToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer. Values to config: SEMGREP_IGNORED = \['dist/', 'build/', 'coverage/', '.env\*'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/spelling/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/spelling/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays.

## `packages/cli/configurations/general/spelling/typos.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/typos.ts` `typosToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFG-027: a plain array, no scopeIgnorePatterns call; TML-014: spelling.locale; TMF-007, TMF-001, POL-034: allowed_words (a plain list) feeds extend-words, extend-exclude takes the .gitattributes linguist patterns, and verbatim reads become extra.value. Values to config: TYPOS_IGNORE_PATTERNS = the commit-hash and base64 patterns -&gt; packages/cli/src/config/generation/tool-file-sources.ts; TYPOS_EXCLUDED_FILES = lockfiles, \*.pbxproj, \*.xcstrings, \*.svg, \*.min.js, \*.min.css, .gspot/config/vale/ -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/general/structure/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/general/structure/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); five \[\[check\]\] blocks go: folder-names (CKG-003), config-logic (CKG-010, ARC-008), test-placement (CKG-011), private-before-public and import-comments (CKG-055); CFG-012: real why and example text only for trivial-functions and env-owner; TML-001, TMF: the env-reads summary names architecture.roles.environment_readers, and the architecture.roles text lists environment_readers and the configuration roles only.

## `packages/cli/configurations/infra/ansible/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/ansible/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; S5C-008: drop the operating system list (operating_systems) from the check, because the tool says it.

## `packages/cli/configurations/infra/docker/hadolint.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/hadolint.ts` `hadolintToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer. Values to config: HADOLINT_RECOMMENDED_OFF = \['DL3001', 'DL3003', 'DL3008', 'DL3010', 'DL3018', 'DL3020', 'DL3048', 'DL4001'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts; HADOLINT_FAILURE_THRESHOLD = 'style' -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/infra/docker/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/docker/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-018: the trivy-findings \[\[tool_file\]\] and the --format template arguments go, and trivy-config reads --format json.

## `packages/cli/configurations/infra/docker/rules/DOCKER.md`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/docker/rules/DOCKER.md`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.

## `packages/cli/configurations/infra/docker/trivy-findings.tpl.eta`

- (the file) (file): **delete**. Delete (S5C-018): a Go template that only turns Trivy findings into lines for a regex; the trivy-config check reads trivy --format json with the JSON parser (items Results, children Misconfigurations, file Target, line CauseMetadata.StartLine, rule ID, message Title), whose children inherit parent fields.

## `packages/cli/configurations/infra/docker/trivy.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/trivy.ts` `trivyToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-013: no ignorefile line. Values to config: TRIVY_SKIPPED_FOLDERS = \['node_modules', '.gspot', '.git'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/infra/docker/trivyignore.eta`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/docker/trivyignore`. Moves to infrastructure/ as a plain file (CFL-001 step 1; glossary: configuration groups are infrastructure and testing, NMU-009); CFL-013 keeps the empty file, which stops Trivy reading the repository .trivyignore.

## `packages/cli/configurations/infra/github-actions/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/github-actions/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays.

## `packages/cli/configurations/infra/github-actions/rules/GITHUB-ACTIONS.md`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/github-actions/rules/GITHUB-ACTIONS.md`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.

## `packages/cli/configurations/infra/github-actions/zizmor.yml.eta`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/github-actions/zizmor.yml`. Moves to infrastructure/ as a plain file (CFL-001 step 1; glossary: configuration groups are infrastructure and testing, NMU-009).

## `packages/cli/configurations/infra/nginx/gixy.cfg.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/gixy.ts` `gixyToolFile`. Moves to generation/tool-file-sources/gixy.ts; CFL-001 step 3: a typed TypeScript function replaces the template (only where not longer).

## `packages/cli/configurations/infra/nginx/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/nginx/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-008: drop the operating system list (operating_systems) from the gixy check.

## `packages/cli/configurations/infra/nginx/rules/NGINX.md`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/nginx/rules/NGINX.md`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.

## `packages/cli/configurations/infra/openapi/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/openapi/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/infra/openapi/rules/OPENAPI.md`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/openapi/rules/OPENAPI.md`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.

## `packages/cli/configurations/infra/openapi/spectral.yaml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/spectral.ts` `spectralToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer. Values to config: SPECTRAL_RECOMMENDED_OFF = \['info-contact', 'info-description', 'operation-description', 'operation-tags'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/infra/xcode/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/xcode/manifest.toml`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-008: drop the operating system list (operating_systems) from the plutil check; TML-014: when = { setting = "xcode.allowed_entitlements" }.

## `packages/cli/configurations/infra/xcode/rules/XCODE.md`

- (the file) (file): **move** to `packages/cli/configurations/infrastructure/xcode/rules/XCODE.md`. Moves to infrastructure/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.

## `packages/cli/configurations/language/bash/ast-grep/assignments.yml`

- (the file) (file): **delete**. Delete (CKO-001): CKO-001 counts assignments from the tree-sitter parse gspot already holds, so this file and the ast-grep tool go.

## `packages/cli/configurations/language/bash/ast-grep/branches.yml`

- (the file) (file): **delete**. Delete (CKO-001): CKO-001 counts branches from the tree-sitter parse, so the ast-grep rule file goes.

## `packages/cli/configurations/language/bash/ast-grep/nesting.yml`

- (the file) (file): **delete**. Delete (CKO-001): CKO-001 counts nesting from the tree-sitter parse, so the ast-grep rule file goes.

## `packages/cli/configurations/language/bash/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; CKO-001 (CKO-001): \[\[tool\]\] ast-grep, tool = "ast-grep" on function-size and its products entry go; S5C-006: drop naming and format from suggests; TML-001, POL-034, TMF: the help and summary texts name architecture.roles.environment_readers, the refused-option message names tools.shellcheck.extra, and its two naming override records use allowed_names under the header naming.override.

## `packages/cli/configurations/language/bash/rules/BASH.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/rules/BASH.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening paragraph that lists what the four sibling files cover, and the Values section that LANGUAGE.md repeats.

## `packages/cli/configurations/language/bash/rules/LANGUAGE.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/rules/LANGUAGE.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening pointer paragraph.

## `packages/cli/configurations/language/bash/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFL-037.

## `packages/cli/configurations/language/bash/rules/OPERATIONS.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/rules/OPERATIONS.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening pointer line.

## `packages/cli/configurations/language/bash/rules/SAFETY.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/bash/rules/SAFETY.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening pointer line.

## `packages/cli/configurations/language/bash/semgrep/bash.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/language/bash/semgrep/bash.yml`. Renamed bash.yml; CFL-001 step 1: a fixed JavaScript object becomes plain YAML; CFL-043 no trailing line breaks; CFL-052 the semgrep/ folder rule stays.

## `packages/cli/configurations/language/bash/shellcheckrc.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/shellcheck.ts` `shellcheckToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; POL-034, CFR-002: it reads tools.shellcheck.extra.value. Values to config: SHELLCHECK_OPTIONS = \[\['source-path', 'SCRIPTDIR'\], \['external-sources', 'true'\]\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts; SHELLCHECK_CHECKS = the 3 optional checks on at both levels -&gt; packages/cli/src/config/generation/tool-file-sources.ts; SHELLCHECK_ALL_LEVEL_CHECKS = the 8 optional checks added at all -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/language/css/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/css/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); CKO-029: \[\[check\]\] module-classes goes; S5C-007: drop min_version of stylelint; S5C-014: drop the stylelint-config-recommended tool.

## `packages/cli/configurations/language/css/rule-names.json`

- (the file) (file): **rename** to `packages/cli/configurations/language/css/stylelint-rule-names.json`. Renamed stylelint-rule-names.json; CFL-040 &lt;tool&gt;-rule-names.json.

## `packages/cli/configurations/language/css/rules/CSS.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/css/rules/CSS.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/css/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/css/rules/NAMING.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/css/rules/TAILWIND.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/css/rules/TAILWIND.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/css/stylelint.json.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `stylelintToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; the Vue and Svelte fragments join it. Values to config: STYLELINT_ALL_LEVEL_RULES = the 11 rule names -&gt; packages/cli/src/config/generation/tool-file-sources.ts; TAILWIND_AT_RULES = the 11 Tailwind at-rules -&gt; packages/cli/src/config/generation/tool-file-sources.ts; STYLELINT_BASE_RULES = no-descending-specificity and import-notation -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/language/html/html-validate-source.json.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/html-validate.ts` `htmlValidateToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-018: one builder for both html-validate files; HTML_VALIDATE_EXTENDS is shared with the built-site file. Values to config: HTML_VALIDATE_EXTENDS = \['html-validate:recommended'\] (shared with the built-site file) -&gt; packages/cli/src/config/generation/html.ts

## `packages/cli/configurations/language/html/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/html/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-007: drop min_version of html-validate, because it equals the pin.

## `packages/cli/configurations/language/html/rules/HTML.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/html/rules/HTML.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/html/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/html/rules/NAMING.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/javascript/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/language/javascript/eslint-rule-names.json`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/eslint-rule-names.json`. Stays; rule lists written by scripts/update-rule-lists.ts.

## `packages/cli/configurations/language/javascript/eslint.config.mjs.eta`

- (the file) (file): **split** to `packages/cli/src/config/generation/eslint-rules.ts; packages/cli/src/generation/eslint/configuration.ts` `-;eslintConfiguration`. Splits (CFL-001 group E, CFL-017): the rule tables are static values, so they go to config/generation/eslint-rules.ts beside eslint.ts and eslint-fragments.ts, and eslintConfiguration builds the imports and plugin map from the selected plugins and adds the limit values from settings; CFL-002, CFL-003, CFL-016, CFL-021; POL-031, POL-034, TML-006, TML-008: it reads limits.min_duplicate_lines and tools.eslint.extra.value, the runtime blocks come from the runtime field of \[\[tools.eslint.override\]\], and the Node version from package.json engines. Values to config: BASE_SELECTORS = the 13 all-level selectors -&gt; packages/cli/src/config/generation/eslint-rules.ts; CORE_RULES = core rules and the reasons for the ones off -&gt; packages/cli/src/config/generation/eslint-rules.ts; SORTING_RULES = the 4 perfectionist rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; SONAR_RULES = sonarjs rules off with reasons -&gt; packages/cli/src/config/generation/eslint-rules.ts; UNICORN_RULES = unicorn rules off with reasons -&gt; packages/cli/src/config/generation/eslint-rules.ts; SECURITY_RULES = security plugin rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; NODE_RULES = n plugin rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; JSDOC_RULES = jsdoc rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; REGEXP_RULES = the 19 regexp rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; IMPORT_RULES = import-x rules -&gt; packages/cli/src/config/generation/eslint-rules.ts; ALL_LEVEL_RULES = the fixed parts of levelRules (limits come from settings) -&gt; packages/cli/src/config/generation/eslint-rules.ts

## `packages/cli/configurations/language/javascript/jsconfig.json.eta`

- (the file) (file): **merge** to `packages/cli/src/generation/jsconfig.ts` `buildJsconfig`. Merges into generation/jsconfig.ts; CFL-001 step 2: the one line only calls the TypeScript builder.

## `packages/cli/configurations/language/javascript/knip.json.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/knip.ts` `knipToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-053: ignoreExportsUsedInFile only at recommended; TMF-002, TMF-007, TMF-001, POL-034: ignoreBinaries gets the program of the repository's start command (npm, pnpm, yarn, bun or mise); ignoreDependencies reads tools.knip.ignore_dependencies as a plain list of package names (a scope list goes to the knip workspace at the scope path); ignore takes the .gitattributes linguist patterns; verbatim reads become extra.value. Values to config: KNIP_SCHEMA_URL = '<https://unpkg.com/knip@6/schema.json>' -&gt; packages/cli/src/config/generation/tool-file-sources.ts; KNIP_IGNORED = \['.gspot/\*\*'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts; KNIP_IGNORED_DEPENDENCIES = \['@gspothq/cli'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/language/javascript/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/manifest.toml`. The configuration manifest stays (CFL-003, CFL-006, CFL-007, CFL-009, CFL-026, CFL-048; LIF-044: install_hint); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); CKG-004: the eslint-comments plugin \[\[tool\]\] goes; PLG-008: gspot and gspotAll leave eslint_presets; S5C-007: drop min_version of eslint, knip and the six plugin libraries; S5C-006: drop naming and format from suggests; TML-001, TML-008, TMF: the texts name architecture.roles.environment_readers and tools.eslint.import_extension, the when condition reads architecture.module, and its naming override record uses the singular header; rule_url = "<https://generativespotting.com/reference/eslint-plugin/{rule}/>", the plugin's RULE_URL, and the help text link changes with it.

## `packages/cli/configurations/language/javascript/rules/BUN.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/BUN.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/javascript/rules/COMPONENTS.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/COMPONENTS.md`. Stays; CFL-025 delete the front matter; CFL-035 takes the shared component sentences.

## `packages/cli/configurations/language/javascript/rules/DENO.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/DENO.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/javascript/rules/JAVASCRIPT.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/JAVASCRIPT.md`. Stays; CFL-025 delete the front matter; CFL-032, CFL-035.

## `packages/cli/configurations/language/javascript/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFL-033, CFL-037.

## `packages/cli/configurations/language/javascript/rules/NODE.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/NODE.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/javascript/rules/PLAYWRIGHT.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/javascript/rules/PLAYWRIGHT.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/javascript/runtime-names.json`

- (the file) (file): **rename** to `packages/cli/configurations/language/javascript/eslint-runtime-names.json`. Renamed eslint-runtime-names.json (CFL-040).

## `packages/cli/configurations/language/javascript/semgrep/javascript.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/language/javascript/semgrep/javascript.yml`. Renamed javascript.yml; CFL-001 table: plain YAML plus one jsonwebtoken filter in TypeScript; CFL-044 run the rule at both levels; CFL-043.

## `packages/cli/configurations/language/markdown/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/markdown/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/language/markdown/markdownlint-cli2.mjs.eta`

- (the file) (file): **rename** to `packages/cli/configurations/language/markdown/markdownlint-cli2.mjs`. Renamed markdownlint-cli2.mjs; CFL-001 step 1: no template code.

## `packages/cli/configurations/language/markdown/markdownlint.jsonc.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/markdownlint.ts` `markdownlintToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer. Values to config: MARKDOWNLINT_RULES = default, MD013, MD033, MD024, MD046, MD048, MD049, MD050 entries -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/language/python/basedpyrightconfig.json.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/basedpyright.ts` `basedpyrightToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-022: all basedpyright options in one place, the fixed ones here plus the manifest basedpyright_options table. Values to config: BASEDPYRIGHT_OPTIONS = the 11 fixed options here plus the manifest basedpyright_options table (CFL-022: all in one place) -&gt; packages/cli/src/config/generation/python.ts

## `packages/cli/configurations/language/python/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); CFL-022: basedpyright_options leave for config/generation/python.ts; S5C-006: drop naming from suggests; TMF: its four naming override records use allowed_names under the header naming.override.

## `packages/cli/configurations/language/python/ruff.toml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/ruff.ts` `ruffToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; TML-010: tools.ruff.docstring_convention has no empty-string sentinel: absent means no pydocstyle convention, so the test reads undefined. Values to config: RUFF_IGNORED_RULES = the 17 rule codes -&gt; packages/cli/src/config/generation/python.ts; RUFF_ISORT = { 'length-sort': true, 'length-sort-straight': true, 'force-sort-within-sections': true } -&gt; packages/cli/src/config/generation/python.ts

## `packages/cli/configurations/language/python/rules/DESIGN.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/DESIGN.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening pointer paragraph.

## `packages/cli/configurations/language/python/rules/FLOW.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/FLOW.md`. Stays; CFL-025: delete the front matter; S5C-013: delete the opening pointer line.

## `packages/cli/configurations/language/python/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFL-037.

## `packages/cli/configurations/language/python/rules/PACKAGING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/PACKAGING.md`. Stays; CFL-025 delete the front matter; CFL-030, CFL-031.

## `packages/cli/configurations/language/python/rules/PYTHON.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/PYTHON.md`. Stays (CFL-030, CFL-031); CFL-025: delete the front matter; S5C-013: delete the opening paragraph that lists what the five sibling files cover.

## `packages/cli/configurations/language/python/rules/TYPING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/python/rules/TYPING.md`. Stays (CFL-030); CFL-025: delete the front matter; S5C-013: delete the opening pointer paragraph.

## `packages/cli/configurations/language/sql/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/sql/manifest.toml`. The configuration manifest stays (CFL-023); the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-006: drop naming from suggests.

## `packages/cli/configurations/language/sql/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/sql/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFL-037.

## `packages/cli/configurations/language/sql/rules/SQL.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/sql/rules/SQL.md`. Stays; CFL-025 delete the front matter; CFL-036 keeps the cross-schema rule.

## `packages/cli/configurations/language/sql/sqlfluff.cfg.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/sqlfluff.ts` `sqlfluffToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-023: no empty rules list. Values to config: SQLFLUFF_RECOMMENDED_OFF = \['AM05', 'AM09', 'CV11', 'ST05', 'ST07', 'ST09'\] -&gt; packages/cli/src/config/generation/tool-file-sources.ts; SQLFLUFF_CAPITALISATION = the 5 capitalisation rule options -&gt; packages/cli/src/config/generation/tool-file-sources.ts; SQL_FILE_EXTENSIONS = '.sql,.pgsql,.psql' -&gt; packages/cli/src/config/generation/tool-file-sources.ts

## `packages/cli/configurations/language/swift/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/swift/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-008: drop the operating system list (operating_systems) from the periphery check; S5C-006: drop naming from suggests; TML-014: the help names tools.swiftlint.always_keep_imports.

## `packages/cli/configurations/language/swift/periphery.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/periphery.ts` `peripheryToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; POL-033, TML-010: it reads xcode.scheme and xcode.project; an absent project means the Swift package, and xcode.scheme is absent when init found no shared scheme, so there are no empty-string tests. Values to config: PERIPHERY_RETAIN = the 6 retain\_\* flags -&gt; packages/cli/src/config/generation/swift.ts

## `packages/cli/configurations/language/swift/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/swift/rules/NAMING.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/swift/rules/SWIFT.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/swift/rules/SWIFT.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/swift/rules/SWIFTUI.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/swift/rules/SWIFTUI.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/swift/rules/UIKIT.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/swift/rules/UIKIT.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/language/swift/semgrep/swift.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/language/swift/semgrep/swift.yml`. Renamed swift.yml; CFL-001 step 1: a fixed JavaScript object becomes plain YAML; CFL-043 no trailing line breaks; CFL-052 the semgrep/ folder rule stays.

## `packages/cli/configurations/language/swift/swiftformat.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/swiftformat.ts` `swiftformatToolFile`. Moves to a typed TypeScript function (CFL-001 step 3), which replaces the template where it is not longer; CFL-024: trailingClosures once. Values to config: SWIFTFORMAT_OPTIONS = the fixed options -&gt; packages/cli/src/config/generation/swift.ts; SWIFTFORMAT_OFF = trailingClosures, initCoderUnavailable, redundantInternal, redundantPublic with their reasons -&gt; packages/cli/src/config/generation/swift.ts; SWIFTFORMAT_RECOMMENDED_OFF = the 63 rules off at recommended -&gt; packages/cli/src/config/generation/swift.ts; SWIFTFORMAT_ALL_LEVEL_ON = \['blockComments', 'wrapEnumCases'\] -&gt; packages/cli/src/config/generation/swift.ts

## `packages/cli/configurations/language/swift/swiftlint.yml.eta`

- (the file) (file): **move** to `packages/cli/src/generation/tool-file-sources/swiftlint.ts` `swiftlintToolFile`. Moves to one builder that writes the whole file with its two comments (S5C-010): a plain YAML half would need merge code; the rule lists go to config/; CFL-014: delete the fragments line; TML-007, TMF, TML-014: it reads limits.closure_lines and limits.type_lines for Swift, naming.max_characters for Swift (default 40) and tools.swiftlint.always_keep_imports. Values to config: SWIFTLINT_OPT_IN = the 81 opt-in rules -&gt; packages/cli/src/config/generation/swift.ts; SWIFTLINT_ANALYZER = \['capture_variable', 'typesafe_array_init', 'unused_import'\] -&gt; packages/cli/src/config/generation/swift.ts; SWIFTLINT_RECOMMENDED_OFF = the 34 rules off at recommended -&gt; packages/cli/src/config/generation/swift.ts; SWIFTLINT_DISABLED = the 6 rules SwiftFormat owns -&gt; packages/cli/src/config/generation/swift.ts

## `packages/cli/configurations/language/typescript/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/language/typescript/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/language/typescript/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/typescript.ts` `typescriptFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-021: projects computed once. Values to config: TYPESCRIPT_RULES = the rule table with its option arrays -&gt; packages/cli/src/config/generation/eslint-fragments.ts; TYPESCRIPT_TEST_RULES_OFF = no-magic-numbers and no-non-null-assertion off in tests -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/language/typescript/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/language/typescript/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; GEN-018: the tsconfig \[\[tool_file\]\] goes; S5C-007: drop min_version of typescript-eslint; S5C-006: drop naming and format from suggests.

## `packages/cli/configurations/language/typescript/rules/NAMING.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/typescript/rules/NAMING.md`. Stays; CFL-025 delete the front matter; CFL-033, CFL-037.

## `packages/cli/configurations/language/typescript/rules/TYPESCRIPT.md`

- (the file) (file): **keep** to `packages/cli/configurations/language/typescript/rules/TYPESCRIPT.md`. Stays; CFL-025 delete the front matter; CFL-032.

## `packages/cli/configurations/language/typescript/tsconfig.json.eta`

- (the file) (file): **delete**. Delete (GEN-018): the .gspot/config/tsconfig.json tool file this template writes goes; buildTsconfig stays only for the run-time file runTsc builds, so nothing replaces the template.

## `packages/cli/configurations/library/drizzle/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/drizzle.ts` `drizzleFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: DRIZZLE_RULES = \['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/library/drizzle/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/drizzle/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/library/drizzle/rules/DRIZZLE.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/drizzle/rules/DRIZZLE.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/library/react-hook-form/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/react-hook-form/manifest.toml`. Stays; the configuration manifest stays.

## `packages/cli/configurations/library/react-hook-form/rules/REACT-HOOK-FORM.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/react-hook-form/rules/REACT-HOOK-FORM.md`. Stays; CFL-025 delete the front matter; CFL-034.

## `packages/cli/configurations/library/swift-snapshot-testing/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/swift-snapshot-testing/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays.

## `packages/cli/configurations/library/tanstack-query/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/library/tanstack-query/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/library/tanstack-query/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/tanstack-query.ts` `tanstackQueryFragment`. Moves to generation/eslint/fragments/tanstack-query.ts; CFL-001 step 3 (group E): a function that returns the imports and blocks; CFL-006 selectors in one manifest list.

## `packages/cli/configurations/library/tanstack-query/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/tanstack-query/manifest.toml`. Stays; the configuration manifest stays.

## `packages/cli/configurations/library/tanstack-query/rules/TANSTACK-QUERY.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/tanstack-query/rules/TANSTACK-QUERY.md`. Stays; CFL-025 delete the front matter; CFL-034.

## `packages/cli/configurations/library/testing-library/eslint-presets.json`

- (the file) (file): **keep** to `packages/cli/configurations/library/testing-library/eslint-presets.json`. Stays; rule lists written by scripts/update-rule-lists.ts (read without installing the plugins).

## `packages/cli/configurations/library/testing-library/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/testing-library.ts` `testingLibraryFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: TESTING_LIBRARY_DEFAULT_PRESET = 'dom' -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/library/testing-library/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/testing-library/manifest.toml`. Stays; the configuration manifest stays.

## `packages/cli/configurations/library/translations/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/translations.ts` `translationsFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate. Values to config: TRANSLATIONS_RULES = { 'i18next/no-literal-string': \['error', { mode: 'jsx-text-only' }\] } -&gt; packages/cli/src/config/generation/eslint-fragments.ts; JSX_FILES = \['\*\*/\*.{jsx,tsx}'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/library/translations/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/translations/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/library/translations/rules/I18N.md`

- (the file) (file): **rename** to `packages/cli/configurations/library/translations/rules/TRANSLATIONS.md`. Renamed TRANSLATIONS.md; CFL-040 one name for the configuration; CFL-025 no front matter.

## `packages/cli/configurations/library/translations/rules/NEXT-INTL.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/translations/rules/NEXT-INTL.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/library/trpc/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/trpc/manifest.toml`. The configuration manifest stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/library/trpc/rules/TRPC.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/trpc/rules/TRPC.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/library/zod/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/zod.ts` `zodFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: ZOD_RULES = the 9 rule names -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/library/zod/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/zod/manifest.toml`. Stays; the configuration manifest stays.

## `packages/cli/configurations/library/zod/rules/ZOD.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/zod/rules/ZOD.md`. Stays; CFL-025 delete the front matter.

## `packages/cli/configurations/library/zustand/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/zustand.ts` `zustandFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list. Values to config: ZUSTAND_STORE_CREATORS = \['create', 'createStore'\] -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/library/zustand/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/library/zustand/manifest.toml`. The configuration manifest stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9).

## `packages/cli/configurations/library/zustand/rules/ZUSTAND.md`

- (the file) (file): **keep** to `packages/cli/configurations/library/zustand/rules/ZUSTAND.md`. Stays; CFL-025 delete the front matter; CFL-034.

## `packages/cli/configurations/platform/cloudflare/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/platform/cloudflare/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-006: drop security from suggests.

## `packages/cli/configurations/platform/cloudflare/rules/WORKERS.md`

- (the file) (file): **rename** to `packages/cli/configurations/platform/cloudflare/rules/CLOUDFLARE.md`. Renamed CLOUDFLARE.md (CFL-040).

## `packages/cli/configurations/platform/cloudflare/semgrep/workers.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/platform/cloudflare/semgrep/cloudflare.yml`. Renamed cloudflare.yml; CFL-040 name after the configuration; CFL-049 plain YAML, run only at level all.

## `packages/cli/configurations/platform/supabase/manifest.toml`

- (the file) (file): **keep** to `packages/cli/configurations/platform/supabase/manifest.toml`. The configuration manifest stays; the check title field goes (NMU-004), and the check example field stays; its \[\[setting\]\] tables leave for settings/schema/tables.ts (A9); S5C-006: drop security from suggests.

## `packages/cli/configurations/platform/supabase/rules/SUPABASE.md`

- (the file) (file): **keep** to `packages/cli/configurations/platform/supabase/rules/SUPABASE.md`. Stays; CFL-025 delete the front matter; CFL-031, CFL-037.

## `packages/cli/configurations/platform/supabase/semgrep/supabase.yml.eta`

- (the file) (file): **rename** to `packages/cli/configurations/platform/supabase/semgrep/supabase.yml`. Renamed supabase.yml; CFL-001 table: plain YAML; the functions-folder path list is filled in TypeScript; CFL-043.

## `packages/cli/configurations/test/jest/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/jest.ts` `jestFragment`. Moves to a function that returns the imports and blocks (CFL-001 step 3, group E); CFL-006: selectors in one manifest list; CFL-002: no second isAll gate; CFL-019: eslintFiles.tests. Values to config: JEST_GLOBAL_PACKAGE = '@jest/globals' -&gt; packages/cli/src/config/generation/eslint-fragments.ts

## `packages/cli/configurations/test/jest/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/testing/jest/manifest.toml`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays.

## `packages/cli/configurations/test/pytest/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/testing/pytest/manifest.toml`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; TMF: its naming override record uses the singular header naming.override.

## `packages/cli/configurations/test/swift-tests/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/testing/swift-tests/manifest.toml`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays; TMF-004: the summary names the \[\[coverage.target\]\] floor.

## `packages/cli/configurations/test/swift-tests/rules/XCTEST.md`

- (the file) (file): **move** to `packages/cli/configurations/testing/swift-tests/rules/SWIFT-TESTS.md`. Moves to testing/ and is named after the configuration (CFL-040; glossary: configuration groups are infrastructure and testing, NMU-009).

## `packages/cli/configurations/test/swift-tests/swiftlint.yml.eta`

- (the file) (file): **merge** to `packages/cli/configurations/testing/swift-tests/manifest.toml`. Merges into cli/configurations/testing/swift-tests/manifest.toml (CFL-041, CFL-014): no Eta code, so the pointer becomes a plain body like the other pointers; fragment = true stays.

## `packages/cli/configurations/test/vitest/eslint-presets.json`

- (the file) (file): **move** to `packages/cli/configurations/testing/vitest/eslint-presets.json`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); scripts/update-rule-lists.ts writes its rule lists.

## `packages/cli/configurations/test/vitest/eslint.fragment.js.eta`

- (the file) (file): **move** to `packages/cli/src/generation/eslint/fragments/vitest.ts` `vitestFragment`. Moves to generation/eslint/fragments/vitest.ts; CFL-001 step 3 (group E): a function that returns the imports and blocks; CFL-006 selectors in one manifest list; CFL-002 no second isAll gate; CFL-019 eslintFiles.tests.

## `packages/cli/configurations/test/vitest/manifest.toml`

- (the file) (file): **move** to `packages/cli/configurations/testing/vitest/manifest.toml`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); the check title field goes (NMU-004), and the check example field stays.

## `packages/cli/configurations/test/vitest/rules/VITEST.md`

- (the file) (file): **move** to `packages/cli/configurations/testing/vitest/rules/VITEST.md`. Moves to testing/ (glossary: configuration groups are infrastructure and testing, NMU-009); CFL-025: delete the front matter.
