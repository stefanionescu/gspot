# Source: system (was platform) and repository

441 rows. move 317, keep 51, delete 41, rename 14, inline 13, merge 5.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/config/platform/assets.ts`

- GRAMMAR_PACKAGES (const exported, 2-10): **move** to `scripts/config/grammars.ts` `GRAMMAR_PACKAGES`. Moves to scripts/config/grammars.ts, the scripts config file: a build-only constant, read by the grammar copy, step 1 of scripts/build.ts (SCR-005, SCR-006); INS-021 deletes its only runtime user, the wasmPath name guard.
- RUNTIME_WASM (const exported, 13-16): **delete**. Delete (INS-008, INS-008): libpg-query.wasm is never read, and web-tree-sitter loads its own .wasm with Parser.init() and no arguments.
- SWIFT_GRAMMAR_FILE (const exported, 19-19): **move** to `scripts/config/grammars.ts` `SWIFT_GRAMMAR_FILE`. Moves to scripts/config/grammars.ts with GRAMMAR_PACKAGES: build-only, read by step 1 of scripts/build.ts (SCR-005, SCR-006) together with the Swift grammar pin; INS-021 deletes the runtime guard.
- DOWNLOAD_TIMEOUT_MS (const exported, 21-21): **delete**. Delete (ROOT-021): no special time limit.

## `packages/cli/src/config/platform/git.ts`

- GIT_TIMEOUT_MS (const exported, 2-2): **delete**. Delete (PLR-041): no Git caller overrides it, and one 30-second limit is wrong for clone --shared and cat-file --batch of every blob; local Git plumbing runs without a limit and stops on Ctrl-C (owner rule: one setting per concern; same as ROOT-021).
- GIT_PATH_VARIABLES (const exported, 5-14): **move** to `packages/cli/src/config/system/git.ts` `GIT_PATH_VARIABLES`. Stays in config/system/git.ts, the topic file of the static Git values (platform becomes system); one user, the Git environment code.
- GIT_COMMAND_CONFIGURATION (const exported, 17-17): **move** to `packages/cli/src/config/system/git.ts` `GIT_COMMAND_CONFIGURATION`. Stays in config/system/git.ts, the topic file of the static Git values (platform becomes system); one user.
- GIT_ENVIRONMENT_NAME (const exported, 19-19): **move** to `packages/cli/src/config/system/git.ts` `GIT_ENVIRONMENT_NAME`. Stays in config/system/git.ts, the topic file of the static Git values (platform becomes system); one user, parseLocalEnvironment.
- GIT_CREATION_COMMANDS (const exported, 22-22): **move** to `packages/cli/src/config/system/git.ts` `GIT_CLONE_COMMAND`. Becomes GIT_CLONE_COMMAND in config/system/git.ts (PLR-025): only git clone creates a repository, so 'init' goes and gitEnvironment tests argv\[1\] against this config value.
- GIT_EXECUTABLES (const exported, 25-25): **move** to `packages/cli/src/config/system/git.ts` `GIT_EXECUTABLE`. Becomes GIT_EXECUTABLE in config/system/git.ts (PLR-025, PLR-030): 'git.exe' never reaches this code, and 'git' is the program name every Git runner in system/git.ts writes, so it is one config value.
- NOT_REPOSITORY_CODE (const exported, 28-28): **move** to `packages/cli/src/config/system/git.ts` `NOT_REPOSITORY_CODE`. Stays in config/system/git.ts, the topic file of the static Git values (platform becomes system); one user, isOutsideGit.
- GIT_NONLOCAL_ENVIRONMENT_NAME (const exported, 31-31): **move** to `packages/cli/src/config/system/git.ts` `GIT_NONLOCAL_ENVIRONMENT_NAME`. Stays in config/system/git.ts, the topic file of the static Git values (platform becomes system); one user, gitEnvironment.

## `packages/cli/src/config/platform/locations.ts`

- TOOLS_PROJECT (const exported, 2-2): **delete**. Delete (INX-010): the generated .gspot/package.json has no name (a private package is never published) and the Python project is named tools, so the shared gspot-tools name and its two literal checks go.
- CONFIGURATION_DIRECTORY (const exported, 4-4): **move** to `packages/cli/src/config/system/locations.ts` `TOOL_FILE_DIRECTORY`. Becomes TOOL_FILE_DIRECTORY (glossary: tool file; NMS-003) in config/system/locations.ts, the topic file of gspot's own paths in a repository (platform becomes system); users in configurations, generation and checks.
- POLICY_FILE (const exported, 6-6): **move** to `packages/cli/src/config/system/locations.ts` `SETTINGS_FILE`. Becomes SETTINGS_FILE (glossary) in config/system/locations.ts, the topic file of gspot's own paths (platform becomes system); 22 users in 9 folders.
- TOOL_PYTHON_PROJECT (const exported, 8-8): **move** to `packages/cli/src/config/system/locations.ts` `PYTHON_TOOL_PROJECT_FILE`. Becomes PYTHON_TOOL_PROJECT_FILE (glossary: Python tool project; "package project" is retired) in config/system/locations.ts, the topic file of gspot's own paths; the name differs from the PYTHON_TOOL_PROJECT identity object; users in tools, generation, install, apply and commands.
- UV_LOCKFILE (const exported, 10-10): **move** to `packages/cli/src/config/system/locations.ts` `UV_LOCKFILE`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in tools/python and generation.
- VALE_CONFIG (const exported, 12-12): **move** to `packages/cli/src/config/system/locations.ts` `VALE_CONFIG`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in checks, execution, install and apply.
- STYLES_DIRECTORY (const exported, 15-15): **move** to `packages/cli/src/config/system/locations.ts` `STYLES_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); GEN-008 deletes its other two users (VALE_OWN_PREFIXES and the second branch of isValePackageFile), so one user is left, the Vale install inputs.
- VALE_PACKAGE_DIRECTORY (const exported, 18-18): **move** to `packages/cli/src/config/system/locations.ts` `VALE_PACKAGE_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in repository, execution and install; part of INSTALLED_TOOL_FOLDERS.
- NODE_MODULES_DIRECTORY (const exported, 20-20): **move** to `packages/cli/src/config/system/locations.ts` `NODE_MODULES_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in generation and tools; part of INSTALLED_TOOL_FOLDERS.
- PYTHON_ENVIRONMENT_DIRECTORY (const exported, 22-22): **move** to `packages/cli/src/config/system/locations.ts` `PYTHON_ENVIRONMENT_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users tools and INSTALLED_TOOL_FOLDERS (read by ownership/).
- TOOL_PACKAGE_PROJECT (const exported, 24-24): **move** to `packages/cli/src/config/system/locations.ts` `NPM_TOOL_PROJECT_FILE`. Becomes NPM_TOOL_PROJECT_FILE (glossary: npm tool project; "package project" is retired) in config/system/locations.ts, the topic file of gspot's own paths; the name differs from the NPM_TOOL_PROJECT identity object; users in tools, generation, install, apply and commands.
- YARN_SETTINGS (const exported, 26-26): **move** to `packages/cli/src/config/system/locations.ts` `YARN_SETTINGS`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in tools, generation and install.
- DOT_GSPOT (const exported, 29-29): **move** to `packages/cli/src/config/system/locations.ts` `DOT_GSPOT`. Stays in config/system/locations.ts (platform becomes system): 23 users from parsers/ up, and every layer may import config/.
- VERSION_FILE (const exported, 31-31): **move** to `packages/cli/src/config/system/locations.ts` `VERSION_PIN_FILE`. Becomes VERSION_PIN_FILE (glossary: version pin, .gspot/version) in config/system/locations.ts, the topic file of gspot's own paths; users in ownership, generation, apply and commands.
- STATE_DIRECTORY (const exported, 34-34): **move** to `packages/cli/src/config/system/locations.ts` `STATE_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in system (STATE_FOLDER_PATTERN), generation and ownership.
- HOOKS_DIRECTORY (const exported, 37-37): **move** to `packages/cli/src/config/system/locations.ts` `HOOKS_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); users in repository, generation, install, apply and commands.
- RULES_DIRECTORY (const exported, 39-39): **move** to `packages/cli/src/config/system/locations.ts` `RULES_DIRECTORY`. Stays with the other .gspot paths in config/system/locations.ts (platform becomes system); TML-003: rules.folder is deleted, so the rules always go here; users: the rule writer, the managed-block index and the rules exclude check.
- MISE_CONFIG_PATH (const exported, 41-41): **move** to `packages/cli/src/config/system/locations.ts` `MISE_TOOL_PROJECT_FILE`. Becomes MISE_TOOL_PROJECT_FILE in config/system/locations.ts, named like its siblings NPM_TOOL_PROJECT_FILE and PYTHON_TOOL_PROJECT_FILE (a bare MISE_FILE would be a near twin of MISE_FILES); INX-001: the value is '.gspot/mise.toml'; users: the mise file writer, gspot install and the generated CI cache key.
- INSTALLATION_DIRECTORIES (const exported, 44-48): **move** to `packages/cli/src/config/system/locations.ts` `INSTALLED_TOOL_FOLDERS`. Becomes INSTALLED_TOOL_FOLDERS (glossary: installed tool folder) in config/system/locations.ts; users in ownership, tools and generation.

## `packages/cli/src/config/platform/managed-blocks.ts`

- HASH_BLOCK_END (const exported, 3-3): **inline** to `packages/cli/src/config/system/managed-blocks.ts` `MARKERS`. Inline into MARKERS in config/system/managed-blocks.ts (PLR-031): used only inside MARKERS.
- HASH_BLOCK_START (const exported, 5-5): **inline** to `packages/cli/src/config/system/managed-blocks.ts` `MARKERS`. Inline into MARKERS in config/system/managed-blocks.ts (PLR-031): used only inside MARKERS.
- MANAGED_BLOCK_END (const exported, 7-7): **inline** to `packages/cli/src/config/system/managed-blocks.ts` `MARKERS`. Inline into MARKERS in config/system/managed-blocks.ts (PLR-031): used only inside MARKERS.
- MANAGED_BLOCK_START (const exported, 9-9): **merge** to `packages/cli/src/config/system/managed-blocks.ts` `MARKERS`. Merges into MARKERS in config/system/managed-blocks.ts (PLR-031): sourceKind reads MARKERS.markdown.start, so one table holds all four markers.
- MARKERS (const exported, 11-14): **move** to `packages/cli/src/config/system/managed-blocks.ts` `MARKERS`. Stays in config/system/managed-blocks.ts (TPR-055; platform becomes system); written as const with no type annotation, because config/ may not import types/, so BlockMarkers goes.
- BLOCK_STYLES (const exported, 17-17): **move** to `packages/cli/src/config/system/managed-blocks.ts` `BLOCK_STYLES`. Stays in config/system/managed-blocks.ts (platform becomes system); the ownership log schema also reads it, and BlockStyle in types/ derives from it.

## `packages/cli/src/config/platform/modes.ts`

- PRIVATE_FILE (const exported, 4-4): **move** to `packages/cli/src/config/system/modes.ts` `PRIVATE_FILE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); 11 users in checks, ownership, install, tools and system.
- MODE_BITS (const exported, 7-7): **move** to `packages/cli/src/config/system/modes.ts` `MODE_BITS`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users in checks, execution and system.
- READ_ONLY_FILE (const exported, 10-10): **move** to `packages/cli/src/config/system/modes.ts` `READ_ONLY_FILE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); LIF-001 deletes readInstalledTree, its other user, so one user is left, fileMode.
- WRITABLE_FILE (const exported, 13-13): **move** to `packages/cli/src/config/system/modes.ts` `WRITABLE_FILE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); one user, fileMode.
- OWNER_WRITE_BIT (const exported, 16-16): **move** to `packages/cli/src/config/system/modes.ts` `OWNER_WRITE_BIT`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users fileMode and mustUnlinkFirst, both in safe-folder/.
- OWNER_WRITABLE_FILE (const exported, 19-19): **move** to `packages/cli/src/config/system/modes.ts` `OWNER_WRITABLE_FILE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users in ownership, apply, settings, commands and repository.
- EXECUTABLE_FILE (const exported, 22-22): **move** to `packages/cli/src/config/system/modes.ts` `EXECUTABLE_FILE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users in repository, ownership, apply and scripts/build.ts.
- PERMISSION_BITS (const exported, 25-25): **move** to `packages/cli/src/config/system/modes.ts` `PERMISSION_BITS`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users: ENTRY_MODES (repository), the scratch copy, and fileMode's one mode for every link (PLR-029).
- PRIVATE_DIRECTORY (const exported, 28-28): **move** to `packages/cli/src/config/system/modes.ts` `PRIVATE_DIRECTORY`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); users: the Swift build cache and the writer lock's lease folder (PLR-047 replaces the 0o700 literal).
- DIRECTORY_MODE (const exported, 30-30): **move** to `packages/cli/src/config/system/modes.ts` `DIRECTORY_MODE`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); one user, populateRevision, because the installTree use goes with LIF-001.
- EXECUTABLE_BITS (const exported, 32-32): **move** to `packages/cli/src/config/system/modes.ts` `EXECUTABLE_BITS`. Stays in config/system/modes.ts, the topic file of every file mode (platform becomes system); one user, readFileEntry.

## `packages/cli/src/config/platform/operating-systems.ts`

- OPERATING_SYSTEMS (const exported, 2-14): **move** to `packages/cli/src/config/system/operating-systems.ts` `OPERATING_SYSTEMS`. Stays in config/system/operating-systems.ts (platform becomes system); users from system/ (currentOperatingSystem) up; the field node becomes nodeName (PLR-056).

## `packages/cli/src/config/platform/paths.ts`

- EXECUTABLE_LAYOUTS (const exported, 2-13): **move** to `packages/cli/src/config/system/paths.ts` `EXECUTABLE_LAYOUTS`. Stays in config/system/paths.ts: a static table goes to config/, so it is not inlined into systemExecutables, which stays the entry picked when the module starts (PLR-030).

## `packages/cli/src/config/platform/root.ts`

- PORTABLE_LINK_TARGET (const exported, 3-3): **delete**. Delete (PLR-027): the segment rules already refuse these characters.
- CLAIM_INITIALIZATION_MS (const exported, 6-6): **delete**. Delete (TPR-021): atomic lock creation leaves no empty lock to wait for.
- CLAIM_POLL_MS (const exported, 9-9): **delete**. Delete (TPR-021): atomic lock creation leaves no empty lock to wait for.
- CLAIM_WAIT_BYTES (const exported, 11-11): **delete**. Delete (TPR-021): atomic lock creation leaves no empty lock to wait for.
- FILE_WRITE_BATCH (const exported, 14-14): **delete**. Delete (LIF-004, LIF-001): no batched file writes are left.
- LIFECYCLE_PRIVATE_PATH (const exported, 17-17): **move** to `packages/cli/src/config/system/locations.ts` `STATE_FOLDER_PATTERN`. Becomes STATE_FOLDER_PATTERN in config/system/locations.ts beside STATE_DIRECTORY, the only value it is built from; users in system (state path refusal) and repository (file lists); "lifecycle" is retired (glossary).
- DEVICE_NAME (const exported, 19-19): **move** to `packages/cli/src/config/system/safe-folder.ts` `DEVICE_NAME`. Moves to config/system/safe-folder.ts, which replaces config/platform/root.ts (PLR-008: root becomes safe folder); one user, isUnsafeSegment.
- UNSAFE_CHARACTERS (const exported, 21-21): **move** to `packages/cli/src/config/system/safe-folder.ts` `UNSAFE_CHARACTERS`. Moves to config/system/safe-folder.ts, which replaces config/platform/root.ts (PLR-008: root becomes safe folder); one user, isUnsafeSegment.
- UNSAFE_PATH_END (const exported, 23-23): **move** to `packages/cli/src/config/system/safe-folder.ts` `UNSAFE_PATH_END`. Moves to config/system/safe-folder.ts, which replaces config/platform/root.ts (PLR-008: root becomes safe folder); one user, isUnsafeSegment.

## `packages/cli/src/config/platform/runtime.ts`

- { version: RUNNING_VERSION } (const exported, 4-4): **move** to `packages/cli/src/apply/version-pin.ts` `GSPOT_VERSION`. Moves to apply/version-pin.ts as GSPOT_VERSION (glossary: "the running gspot"): it reads the CLI's package.json through an import, and config/ imports only config/, so it stays out of config/; users the version pin (apply), the session and --version (commands), apply the lowest.
- PROGRAM_ARGUMENT_OFFSET (const exported, 7-7): **delete**. Delete (ROOT-020): main.ts takes const \[\_runtime, \_entry, ...argv\] = process.argv, and the three child programs read process.argv\[2\] (ignoreArrayIndexes).
- MAX_EXIT_CODE (const exported, 9-9): **move** to `packages/cli/src/config/configurations.ts` `MAX_EXIT_CODE`. Moves to config/configurations.ts: its users are the configuration schemas (findingExitCodesSchema and toolDeclarationSchema), so it joins the existing file, not a new one-item file.
- MS_PER_SECOND (const exported, 12-12): **move** to `packages/cli/src/config/units.ts` `MS_PER_SECOND`. Moves to config/units.ts, the one file for unit constants (the lint rule needs the constant); users in system, terminal and tools; src/units.ts is not made.
- SECONDS_PER_DAY (const exported, 15-15): **move** to `packages/cli/src/config/units.ts` `SECONDS_PER_DAY`. Moves to config/units.ts with the other unit constants: users in two areas, generation/bunfig.ts and the bun-release-age check, both about Bun's minimum release age.
- BYTES_PER_KB (const exported, 18-18): **move** to `packages/cli/src/config/units.ts` `BYTES_PER_KB`. Moves to config/units.ts with the other unit constants; users the large-file check and the site weight check.
- EXIT_ERROR (const exported, 21-21): **move** to `packages/cli/src/config/terminal.ts` `EXIT_ERROR`. Moves to config/terminal.ts with gspot's exit codes; the lowest user is terminal/ (check report), and printResult sets the exit code.
- MISSING_CODE (const exported, 23-23): **move** to `packages/cli/src/config/system/processes.ts` `MISSING_CODE`. Moves to config/system/processes.ts, the file of process exit codes and wait times; one user.
- FAILED_CODE (const exported, 25-25): **move** to `packages/cli/src/config/system/processes.ts` `FAILED_CODE`. Moves to config/system/processes.ts, the file of process exit codes and wait times; one user.
- TASKKILL_GONE_CODE (const exported, 28-28): **move** to `packages/cli/src/config/system/processes.ts` `TASKKILL_GONE_CODE`. Moves to config/system/processes.ts, the file of process exit codes and wait times; PLR-030: the Windows branch is needed; one user.
- DRAIN_MS (const exported, 31-31): **move** to `packages/cli/src/config/system/processes.ts` `DRAIN_MS`. Moves to config/system/processes.ts, the file of process exit codes and wait times; one user.
- REAP_MS (const exported, 34-34): **move** to `packages/cli/src/config/system/processes.ts` `REAP_MS`. Moves to config/system/processes.ts, the file of process exit codes and wait times; PLR-030: the group kill stays; one user.
- ROOT_SEARCH_DEPTH (const exported, 36-36): **move** to `packages/cli/src/config/system/assets.ts` `PACKAGE_SEARCH_DEPTH`. Becomes PACKAGE_SEARCH_DEPTH (PLR-008) in config/system/assets.ts, beside the other package-file values; one user, packageFolder.
- DECLARATION_EXTENSIONS (const exported, 38-38): **move** to `packages/cli/src/config/system/paths.ts` `DECLARATION_EXTENSIONS`. Moves to config/system/paths.ts, the path rules of the machine; one user, extensionOf.
- EXIT_FINDINGS (const exported, 41-41): **move** to `packages/cli/src/config/terminal.ts` `EXIT_FINDINGS`. Moves to config/terminal.ts with gspot's exit codes; users doctor and execution/report; NMS-003 keeps the name.
- FULL_PERCENTAGE (const exported, 44-44): **move** to `packages/cli/src/config/units.ts` `FULL_PERCENTAGE`. Moves to config/units.ts with the other unit constants; users the site and Swift test checks and the written-out setting schemas (POL-001); PAR-027 deletes percentageSchema.

## `packages/cli/src/config/platform/text.ts`

- SUGGESTION_LIMIT (const exported, 1-1): **move** to `packages/cli/src/config/text.ts` `SUGGESTION_LIMIT`. Moves to config/text.ts with the values of the generic text module; one user, similar.
- TYPO_MIN (const exported, 3-3): **move** to `packages/cli/src/config/text.ts` `TYPO_MIN`. Moves to config/text.ts with the values of the generic text module; one user, similar.
- TYPO_FRACTION (const exported, 5-5): **move** to `packages/cli/src/config/text.ts` `TYPO_FRACTION`. Moves to config/text.ts with the values of the generic text module; one user, similar.
- LIST_LIMIT (const exported, 8-8): **move** to `packages/cli/src/config/text.ts` `LIST_LIMIT`. Moves to config/text.ts with the values of the generic text module; one user, codeList.

## `packages/cli/src/config/repository/aliases.ts`

- TRAILING_STAR (const exported, 1-1): **keep** to `packages/cli/src/config/repository/aliases.ts` `TRAILING_STAR`. Stays in config/repository/aliases.ts (PLR-038), which also takes the file names of the aliases code, so it holds more than one tiny item.

## `packages/cli/src/config/repository/hooks.ts`

- LEFTHOOK_NAMES (const exported, 3-3): **keep** to `packages/cli/src/config/repository/hooks.ts` `LEFTHOOK_NAMES`. Stays in config/repository/hooks.ts, the file of hook manager names and folders (PLR-013); one user, readHooks.
- LEFTHOOK_CONFIG_PREFIX (const exported, 4-4): **inline** to `packages/cli/src/config/repository/hooks.ts` `LEFTHOOK_PREFIXES`. Inline into LEFTHOOK_PREFIXES in config/repository/hooks.ts (PLR-013): '.config/' is written there.
- LEFTHOOK_PREFIXES (const exported, 5-5): **keep** to `packages/cli/src/config/repository/hooks.ts` `LEFTHOOK_PREFIXES`. Stays in config/repository/hooks.ts, the file of hook manager names and folders; PLR-013: one plain cross product of names, extensions and prefixes.
- LEFTHOOK_EXTENSIONS (const exported, 6-6): **keep** to `packages/cli/src/config/repository/hooks.ts` `LEFTHOOK_EXTENSIONS`. Stays in config/repository/hooks.ts, the file of hook manager names and folders (PLR-013).
- LEFTHOOK_YAML_EXTENSION_COUNT (const exported, 7-7): **delete**. Delete (PLR-013): the slicing goes.
- HOOK_PACKAGES (const exported, 10-10): **keep** to `packages/cli/src/config/repository/hooks.ts` `HOOK_PACKAGES`. Stays in config/repository/hooks.ts, the file of hook manager names and folders; one user, isToolsOnlyPackage.
- MISE_HOOK_DIRECTORY (const exported, 12-12): **keep** to `packages/cli/src/config/repository/hooks.ts` `MISE_HOOK_DIRECTORY`. Stays in config/repository/hooks.ts, the file of hook manager names and folders; one user, readHooks.
- HOOK_DIRECTORIES (const exported, 15-15): **keep** to `packages/cli/src/config/repository/hooks.ts` `HOOK_DIRECTORIES`. Stays in config/repository/hooks.ts, the file of hook manager names and folders; users readHooks and the prefix-collisions check.

## `packages/cli/src/config/repository/inventory.ts`

- DEPENDENCY_FOLDERS (const exported, 4-12): **move** to `packages/cli/src/config/repository/tracked.ts` `INSTALLED_DEPENDENCY_FOLDERS`. Becomes INSTALLED_DEPENDENCY_FOLDERS (PLR-021: named for its job) in config/repository/tracked.ts: it serves the file listing and isToolingPath, which uses it instead of an inline 'node_modules'; users the file list, isToolingPath and two structure checks.
- FILE_PREFIX_BYTES (const exported, 14-14): **keep** to `packages/cli/src/config/repository/inventory.ts` `FILE_PREFIX_BYTES`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; PLR-006: it is not kept on TrackedFile; PLR-036: classifyFile takes the prefix; users readRepository and the gspot.toml entry in commands.
- ROOT_SCOPE (const exported, 17-17): **move** to `packages/cli/src/config/repository/scopes.ts` `ROOT_SCOPE`. Moves to config/repository/scopes.ts, beside the workspace file names; users scopes, read and commands/init/selection.ts; PLR-046: comment "The scope for the whole repository."
- GENERATED_BANNERS (const exported, 19-28): **keep** to `packages/cli/src/config/repository/inventory.ts` `GENERATED_BANNERS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, fileOrigin.
- GENERATED_BUILD_WRAPPERS (const exported, 31-31): **keep** to `packages/cli/src/config/repository/inventory.ts` `GENERATED_BUILD_WRAPPERS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, fileOrigin.
- VENDORED_DIRECTORIES (const exported, 33-41): **rename** to `packages/cli/src/config/repository/inventory.ts` `VENDORED_FOLDERS`. Renamed VENDORED_FOLDERS (PLR-021: named for its job); stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, kindOf.
- LICENSE_FILE (const exported, 44-44): **keep** to `packages/cli/src/config/repository/inventory.ts` `LICENSE_FILE`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; users kind.ts and the docs check.
- NOTICE_FILE (const exported, 47-47): **keep** to `packages/cli/src/config/repository/inventory.ts` `NOTICE_FILE`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, isLicenseFile.
- LICENSE_TAGS (const exported, 50-50): **keep** to `packages/cli/src/config/repository/inventory.ts` `LICENSE_TAGS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, isLicenseFile.
- VALE_OWN_PREFIXES (const exported, 53-53): **delete**. Delete (GEN-008): it names the Vale styles folder that goes.
- BANNER_BYTES (const exported, 55-55): **keep** to `packages/cli/src/config/repository/inventory.ts` `BANNER_BYTES`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, fileOrigin.
- EXTENSION_TAGS (const exported, 57-105): **keep** to `packages/cli/src/config/repository/inventory.ts` `EXTENSION_TAGS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; users tags.ts and kind.ts (license file test).
- SHEBANG_INTERPRETERS (const exported, 107-120): **keep** to `packages/cli/src/config/repository/inventory.ts` `SHEBANG_INTERPRETERS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, shebangTags.
- INTERPRETER_DIALECTS (const exported, 123-123): **keep** to `packages/cli/src/config/repository/inventory.ts` `INTERPRETER_DIALECTS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user file.
- BINARY_EXTENSIONS (const exported, 125-181): **keep** to `packages/cli/src/config/repository/inventory.ts` `BINARY_EXTENSIONS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, tagEntry.
- FILENAME_TAGS (const exported, 183-197): **keep** to `packages/cli/src/config/repository/inventory.ts` `FILENAME_TAGS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, tagEntry.
- SHEBANG_TAGS (const exported, 199-203): **keep** to `packages/cli/src/config/repository/inventory.ts` `SHEBANG_TAGS`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, shebangTags.
- LINT_DIRECTORIES (const exported, 205-205): **move** to `packages/cli/src/config/repository/tooling.ts` `LINT_DIRECTORIES`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user, readTooling.
- AGENT_FILES (const exported, 207-207): **move** to `packages/cli/src/config/repository/tooling.ts` `AGENT_FILES`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user, readTooling.
- RULES_DIRECTORIES (const exported, 209-209): **move** to `packages/cli/src/config/repository/tooling.ts` `RULES_DIRECTORIES`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user, readTooling.
- LINT_WORDS (const exported, 212-212): **move** to `packages/cli/src/config/repository/tooling.ts` `LINT_WORDS`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user, isLintJob.
- LINT_PAIRS (const exported, 215-215): **move** to `packages/cli/src/config/repository/tooling.ts` `LINT_PAIRS`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user, isLintCommand; PLR-046: drop the stale half of its comment.
- FOREIGN_CI_FILES (const exported, 217-223): **move** to `packages/cli/src/config/repository/tooling.ts` `FOREIGN_CI_FILES`. Moves to config/repository/tooling.ts with the lists readTooling searches, out of the file-kind tables; one user file.
- MISE_FILES (const exported, 225-235): **move** to `packages/cli/src/config/repository/tooling.ts` `MISE_FILES`. Moves to config/repository/tooling.ts with the lists readTooling searches; INX-003, INX-007: detectRunner and the duplicate-pin detection go, so its user is the docs check (mise task files).
- TASK_AFTER_RUN (const exported, 238-238): **move** to `packages/cli/src/config/repository/tooling.ts` `TASK_AFTER_RUN`. Moves to config/repository/tooling.ts with the lists readTooling searches; it stays a constant, because the lint rule forbids a bare 2; one user.
- SOURCE_KIND (const exported, 241-241): **keep** to `packages/cli/src/config/repository/inventory.ts` `SOURCE_KIND`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; one user, sourceKind; written as const with no Verdict annotation, because config/ may not import types/.
- SHEBANG_TAG (const exported, 242-242): **keep** to `packages/cli/src/config/repository/inventory.ts` `SHEBANG_TAG`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; users tags.ts and detect.ts.
- RUNTIME_TAG (const exported, 244-244): **keep** to `packages/cli/src/config/repository/inventory.ts` `RUNTIME_TAG`. Stays in config/repository/inventory.ts, the file-kind and tag tables of the repository read; users tags.ts and detect.ts.

## `packages/cli/src/config/repository/revisions.ts`

- ABSENT_HASH (const exported, 3-3): **keep** to `packages/cli/src/config/repository/revisions.ts` `ABSENT_HASH`. Stays in config/repository/revisions.ts; one user file.
- COMMIT_DIFF_ARGV (const exported, 5-5): **keep** to `packages/cli/src/config/repository/revisions.ts` `COMMIT_DIFF_ARGV`. Stays in config/repository/revisions.ts: command arguments are config values; --no-ext-diff goes (PLR-040).
- LOG_ARGV (const exported, 7-15): **keep** to `packages/cli/src/config/repository/revisions.ts` `LOG_ARGV`. Stays in config/repository/revisions.ts: command arguments are config values.
- WORKTREE_DIFF_ARGV (const exported, 17-17): **keep** to `packages/cli/src/config/repository/revisions.ts` `WORKTREE_DIFF_ARGV`. Stays in config/repository/revisions.ts; used three times.
- GITLINK_MODE (const exported, 19-19): **keep** to `packages/cli/src/config/repository/revisions.ts` `GITLINK_MODE`. Stays in config/repository/revisions.ts with the Git entry modes; users the file list (submodules), the revision copy and Postgres history.
- SYMLINK_MODE (const exported, 20-20): **keep** to `packages/cli/src/config/repository/revisions.ts` `SYMLINK_MODE`. Stays in config/repository/revisions.ts with the Git entry modes; users ENTRY_MODES, the revision copy, Postgres history and the Xcode project check.
- ENTRY_MODES (const exported, 22-26): **keep** to `packages/cli/src/config/repository/revisions.ts` `ENTRY_MODES`. Stays in config/repository/revisions.ts with the Git entry modes; users listRepositoryFiles (Windows executable bit) and the scratch copy.

## `packages/cli/src/platform/contracts.ts`

- hostLayout (const, 11-11): **move** to `packages/cli/src/system/executables.ts` `systemExecutables`. Moves to system/executables.ts as systemExecutables (PLR-002; the glossary retires "host" for the operating system): a module value picked from process.platform when the module starts, reading EXECUTABLE_LAYOUTS from config/system/paths.ts; not exported.
- executableNames (function exported, 18-20): **move** to `packages/cli/src/system/executables.ts` `executableNames`. Moves to system/executables.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- environmentBin (function exported, 27-29): **move** to `packages/cli/src/system/executables.ts` `virtualEnvironmentBin`. Moves to system/executables.ts as virtualEnvironmentBin: it means a Python virtual environment, and "environment" also names the process environment in system/environment.ts.
- environmentExecutable (function exported, 37-39): **move** to `packages/cli/src/system/executables.ts` `virtualEnvironmentExecutable`. Moves to system/executables.ts as virtualEnvironmentExecutable: it means a Python virtual environment, as virtualEnvironmentBin does.
- toPosix (function exported, 46-48): **move** to `packages/cli/src/system/paths.ts` `toPosix`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- toolPath (function exported, 56-58): **move** to `packages/cli/src/system/paths.ts` `toolOutputPath`. Moves to system/paths.ts as toolOutputPath (NMS-003); it stays separate from toPosix.
- toPlatform (function exported, 65-67): **move** to `packages/cli/src/system/paths.ts` `toSystemPath`. Moves to system/paths.ts as toSystemPath; PLR-003; glossary (system in code; toPlatform retired; NMU-007 asks for a name without "native").
- isInside (function exported, 74-76): **move** to `packages/cli/src/system/paths.ts` `isInside`. Moves to system/paths.ts (PLR-002).
- extensionOf (function exported, 83-89): **move** to `packages/cli/src/system/paths.ts` `extensionOf`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- trimTrailingSlashes (function exported, 96-100): **move** to `packages/cli/src/system/paths.ts` `trimTrailingSlashes`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- pathKey (function exported, 107-109): **move** to `packages/cli/src/system/paths.ts` `pathKey`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- directoryOf (function exported, 116-119): **move** to `packages/cli/src/system/paths.ts` `directoryOf`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- stemOf (function exported, 126-130): **move** to `packages/cli/src/system/paths.ts` `stemOf`. Moves to system/paths.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- prefixOf (function exported, 137-140): **move** to `packages/cli/src/checks/general/structure/shared-prefixes.ts` `prefixOf`. Moves to checks/general/structure/shared-prefixes.ts; moved out to its one user, the prefix-collisions check, which the checks part renames shared-prefixes.ts; not exported.
- directoryTree (function exported, 147-167): **move** to `packages/cli/src/checks/general/structure/source-files.ts` `directoryTree`. Moves to checks/general/structure/source-files.ts; (moved out of system/): users prefix-collisions and stem-collisions; source-files.ts holds the helpers the structure checks share.
- expandPaths (function exported, 174-181): **move** to `packages/cli/src/system/paths.ts` `includeParentFolders`. Moves to system/paths.ts as includeParentFolders; PLR-014 (look-alike of expandedPaths); PLR's withParentFolders carries "with", a shipped banned term (conjunctions group).
- compact (function exported, 188-190): **move** to `packages/cli/src/objects.ts` `compact`. Moves to src/objects.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- isRecord (function exported, 197-199): **move** to `packages/cli/src/objects.ts` `isRecord`. Moves to src/objects.ts (PLR-002): platform/contracts.ts splits into paths, objects, text and executables.
- isRecordArray (function exported, 206-208): **move** to `packages/cli/src/objects.ts` `isRecordArray`. Moves to src/objects.ts.
- valueAt (function exported, 216-223): **move** to `packages/cli/src/objects.ts` `valueAt`. Moves to src/objects.ts with the object helpers; PAR-019: hasKeyPath uses it.
- normalizeTables (function exported, 230-238): **move** to `packages/cli/src/objects.ts` `normalizeTables`. Moves to src/objects.ts with the object helpers.
- createTable (function exported, 246-258): **move** to `packages/cli/src/objects.ts` `createTable`. Moves to src/objects.ts.
- similar (function exported, 266-278): **move** to `packages/cli/src/text.ts` `similar`. Moves to src/text.ts with the text helpers.
- codeList (function exported, 285-290): **move** to `packages/cli/src/text.ts` `codeList`. Moves to src/text.ts with the text helpers.
- contentDigest (function exported, 297-299): **move** to `packages/cli/src/text.ts` `contentDigest`. Moves to src/text.ts with the text helpers. Values to config: DIGEST_ALGORITHM = 'sha256' -&gt; packages/cli/src/config/text.ts
- decodeUtf8 (function exported, 306-308): **move** to `packages/cli/src/text.ts` `decodeUtf8`. Moves to src/text.ts with the text helpers.
- quoteArgument (function exported, 315-318): **move** to `packages/cli/src/text.ts` `quoteArgument`. Moves to src/text.ts with the text helpers. Values to config: PLAIN_ARGUMENT = /^\[a-zA-Z0-9\_./-\]+$/u -&gt; packages/cli/src/config/text.ts

## `packages/cli/src/platform/git/contracts.ts`

- hasGitEntry (function, 25-34): **delete**. Delete (PLR-053): rely on Git's exit code and message; no walk of every parent folder for a .git entry.
- parseLocalEnvironment (function, 37-42): **move** to `packages/cli/src/system/git.ts` `parseLocalEnvironment`. Moves to system/git.ts, where platform/git/public.ts and contracts.ts merge; not exported. Values to config: TRAILING_NEWLINE = /\\n$/u -&gt; packages/cli/src/config/text.ts; GIT_DIR_VARIABLE = 'GIT_DIR' -&gt; packages/cli/src/config/system/git.ts
- sourceGitEnvironment (function, 45-77): **move** to `packages/cli/src/system/git.ts` `sourceGitEnvironment`. Moves to system/git.ts (PLR-012): plain blocking Git queries, worked out once per process; not exported. Values to config: GIT_SOURCE_ARGV = \['rev-parse', '--is-bare-repository', '--absolute-git-dir'\] -&gt; packages/cli/src/config/system/git.ts; GIT_TOP_LEVEL_ARGV = \['rev-parse', '--show-toplevel'\] -&gt; packages/cli/src/config/system/git.ts; GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE' -&gt; packages/cli/src/config/system/git.ts
- targetGitEnvironment (function, 80-95): **move** to `packages/cli/src/system/git.ts` `targetGitEnvironment`. Moves to system/git.ts (PLR-012): a plain function, no generator; not exported. Values to config: GIT_DIRECTORY_ARGV = \['rev-parse', '--absolute-git-dir'\] -&gt; packages/cli/src/config/system/git.ts; GIT_LOCALE = { LC_ALL: 'C' } -&gt; packages/cli/src/config/system/git.ts
- gitEnvironment (function, 98-119): **move** to `packages/cli/src/system/git.ts` `gitEnvironment`. Moves to system/git.ts (PLR-012): one plain function serves runGit, runGitBlocking and runTool; exported for tools/run.ts. Values to config: GIT_VARIABLE_PREFIX = 'GIT\_' -&gt; packages/cli/src/config/system/git.ts; GIT_LOCAL_VARIABLES_ARGV = \['rev-parse', '--local-env-vars'\] -&gt; packages/cli/src/config/system/git.ts
- isOutsideGit (function exported, 127-133): **move** to `packages/cli/src/system/git.ts` `isOutsideGit`. Moves to system/git.ts; PLR-053: it matches Git's code and message only. Values to config: NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ' -&gt; packages/cli/src/config/system/git.ts
- getGitEnvironment (function exported, 142-155): **merge** to `packages/cli/src/system/git.ts` `gitEnvironment`. Merges into gitEnvironment in system/git.ts (PLR-012): the async driver loop goes; tools/run.ts calls gitEnvironment.
- runGitBlocking (function exported, 164-177): **move** to `packages/cli/src/system/git.ts` `runGitBlocking`. Moves to system/git.ts (PLR-012): its second driver loop goes.

## `packages/cli/src/platform/git/public.ts`

- runGit (function exported, 14-18): **move** to `packages/cli/src/system/git.ts` `runGit`. Moves to system/git.ts; it takes run's optional output argument (text or a consumer), so streamGit merges into it.
- runGitBinary (function exported, 27-31): **move** to `packages/cli/src/system/git.ts` `runGitForBytes`. Moves to system/git.ts as runGitForBytes (NMS-003: "binary" is retired; it returns bytes); it calls runGit with a consumer that collects the chunks and joins them with Buffer.concat, and runForBytes is inlined here.
- streamGit (function exported, 41-50): **merge** to `packages/cli/src/system/git.ts` `runGit`. Merges into runGit: the same code except the output argument, so runGit takes run's optional output; one caller, visitGitBlobs.
- readGitSetting (function exported, 58-65): **move** to `packages/cli/src/system/git.ts` `readGitSetting`. Moves to system/git.ts with the Git runners. Values to config: GIT_SETTING_ARGV = \['config', '--null', '--get'\] -&gt; packages/cli/src/config/system/git.ts
- hooksDirectory (function exported, 72-76): **move** to `packages/cli/src/system/git.ts` `hooksDirectory`. Moves to system/git.ts; EXG-032 adds hookPrefix and gitTopLevel beside it. Values to config: GIT_HOOKS_ARGV = \['rev-parse', '--git-path', 'hooks'\] -&gt; packages/cli/src/config/system/git.ts
- gitText (function exported, 85-92): **move** to `packages/cli/src/system/git.ts` `gitText`. Moves to system/git.ts with the Git runners.
- gitLines (function exported, 101-104): **move** to `packages/cli/src/system/git.ts` `gitLines`. Moves to system/git.ts with the Git runners.
- gitPaths (function exported, 113-116): **move** to `packages/cli/src/system/git.ts` `gitPaths`. Moves to system/git.ts with the Git runners.
- isShallow (function exported, 124-127): **move** to `packages/cli/src/system/git.ts` `isShallow`. Moves to system/git.ts with the Git runners. Values to config: GIT_SHALLOW_ARGV = \['rev-parse', '--is-shallow-repository'\] -&gt; packages/cli/src/config/system/git.ts

## `packages/cli/src/platform/memo.ts`

- memo (function exported, 10-17): **move** to `packages/cli/src/system/file-reads.ts` `memo`. Moves to system/file-reads.ts; file-reads.ts holds the run cache: ReadCache, MemoKey, memo, createReadCache; CKO-026 adds the keyed form.

## `packages/cli/src/platform/public.ts`

- commandOptions (function, 34-52): **move** to `packages/cli/src/system/processes.ts` `commandOptions`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- missingExecutable (function, 55-64): **move** to `packages/cli/src/system/processes.ts` `missingExecutable`. Moves to system/processes.ts; PLR-030: the PATHEXT branch is needed. Values to config: PATHEXT_DEFAULT = '.COM;.EXE;.BAT;.CMD' -&gt; packages/cli/src/config/system/processes.ts; PATH_SEPARATORS = /\[\\\\/\]/u -&gt; packages/cli/src/config/system/processes.ts
- notFound (function, 68-78): **move** to `packages/cli/src/system/processes.ts` `notFound`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- isUnfinished (function, 81-85): **move** to `packages/cli/src/system/processes.ts` `isUnfinished`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- completed (function, 87-105): **move** to `packages/cli/src/system/processes.ts` `completed`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- isGroupGone (function, 109-114): **move** to `packages/cli/src/system/processes.ts` `isGroupGone`. Moves to system/processes.ts; PLR-030: the macOS EPERM branch is needed.
- terminate (function, 116-139): **move** to `packages/cli/src/system/processes.ts` `terminate`. Moves to system/processes.ts; PLR-030: the group kill stays. Values to config: TASKKILL_PROGRAM = 'taskkill' -&gt; packages/cli/src/config/system/processes.ts; TASKKILL_OPTIONS = \['/T', '/F'\] -&gt; packages/cli/src/config/system/processes.ts
- supervise (function, 141-200): **move** to `packages/cli/src/system/processes.ts` `supervise`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- runStream (function exported, 209-244): **move** to `packages/cli/src/system/processes.ts` `run`. Moves to system/processes.ts as run: run only forwarded to it with 'utf8', so output becomes an optional argument with the default 'utf8' and the run callers do not change; PLR-043: output is text or a consumer, with no base64 mode.
- run (function exported, 252-254): **merge** to `packages/cli/src/system/processes.ts` `run`. Merges into run: it only called runStream(command, options, 'utf8').
- runBlocking (function exported, 262-270): **move** to `packages/cli/src/system/processes.ts` `runBlocking`. Moves to system/processes.ts: platform/public.ts splits into processes, errors and environment.
- runBinary (function exported, 278-282): **inline** to `packages/cli/src/system/git.ts` `runGitForBytes`. Inline into runGitForBytes (NMS-003): with PLR-043 it is run with a chunk collector joined by Buffer.concat, and its one production caller is runGitForBytes (the other callers are tests).
- GspotError (class exported, 287-305): **move** to `packages/cli/src/errors.ts` `GspotError`. Moves to src/errors.ts; PLR-016: the header comment about other code goes.
- isInteractive (function exported, 311-313): **move** to `packages/cli/src/system/environment.ts` `isInteractive`. Moves to system/environment.ts, the environment role file.
- miseHome (function exported, 319-324): **move** to `packages/cli/src/system/environment.ts` `miseHome`. Moves to system/environment.ts, the environment role file. Values to config: MISE_DATA_VARIABLE = 'MISE_DATA_DIR' -&gt; packages/cli/src/config/system/environment.ts; XDG_DATA_VARIABLE = 'XDG_DATA_HOME' -&gt; packages/cli/src/config/system/environment.ts; MISE_DATA_FOLDER = '.local/share/mise' -&gt; packages/cli/src/config/system/environment.ts; MISE_FOLDER = 'mise' -&gt; packages/cli/src/config/system/environment.ts
- environmentVariables (function exported, 330-337): **move** to `packages/cli/src/system/environment.ts` `environmentVariables`. Moves to system/environment.ts, the environment role file.
- cacheDirectory (function exported, 343-348): **move** to `packages/cli/src/system/environment.ts` `cacheDirectory`. Moves to system/environment.ts, the environment role file. Values to config: CACHE_FOLDER_NAME = 'gspot' -&gt; packages/cli/src/config/system/environment.ts
- hostPlatform (function exported, 354-356): **move** to `packages/cli/src/system/environment.ts` `currentOperatingSystem`. Moves to system/environment.ts as currentOperatingSystem; PLR-003; PLR-056; glossary retires "platform" and "host" for the operating system.

## `packages/cli/src/platform/root/contracts.ts`

- assertInsideFolder (function, 16-21): **move** to `packages/cli/src/system/files.ts` `assertInsideFolder`. Moves to system/files.ts with the globs; PLR-004 keeps it. Values to config: DRIVE_LETTER = /^\[a-z\]:/iu -&gt; packages/cli/src/config/system/paths.ts; PARENT_SEGMENT = /(?:^|\[/{,\])\\.\\.(?=\[/},\]|$)/u -&gt; packages/cli/src/config/system/paths.ts
- selectLiteral (function, 24-27): **delete**. Delete (PLR-004): options only tests used.
- patternPrefix (function, 30-47): **delete**. Delete: PLR-004 (picomatch.scan(pattern).base gives the fixed folder).
- scanFolders (function, 50-58): **delete**. Delete (PLR-004): one plain walker from each pattern's fixed folder replaces the scan code.
- scanPattern (function, 61-101): **delete**. Delete (PLR-004): one plain walker from each pattern's fixed folder replaces the scan code.
- isUnsafeSegment (function, 104-108): **move** to `packages/cli/src/system/safe-folder/names.ts` `isUnsafeSegment`. Moves to system/safe-folder/names.ts with the path safety rules. Values to config: RESERVED_SEGMENTS = \['', '.', '..'\] -&gt; packages/cli/src/config/system/safe-folder.ts
- globPaths (function exported, 118-138): **move** to `packages/cli/src/system/files.ts` `globPaths`. Moves to system/files.ts (PLR-004): one plain walker from each pattern's fixed folder, built on listFolderFiles (PLR-020). Values to config: GLOB_EXCLUDE = '!' -&gt; packages/cli/src/config/system/paths.ts; FOLDER_CONTENTS = '/\*\*' -&gt; packages/cli/src/config/system/paths.ts
- fileMode (function exported, 146-150): **move** to `packages/cli/src/system/safe-folder/reads.ts` `fileMode`. Moves to system/safe-folder/reads.ts; PLR-011 (no platform parameter); PLR-029 (one mode for every link); beside FileCopy and its users readEntry and sameEntry.
- sameEntry (function exported, 158-163): **move** to `packages/cli/src/system/safe-folder/reads.ts` `sameEntry`. Moves to system/safe-folder/reads.ts, beside FileCopy and readEntry.
- portableSegments (function exported, 170-174): **move** to `packages/cli/src/system/safe-folder/names.ts` `portableSegments`. Moves to system/safe-folder/names.ts with the path safety rules.
- nativeSegments (function exported, 181-187): **move** to `packages/cli/src/system/safe-folder/names.ts` `systemSegments`. Moves to system/safe-folder/names.ts as systemSegments (NMS-006): PathFormat 'native' becomes 'system'.
- assertNotPrivate (function exported, 193-196): **move** to `packages/cli/src/system/safe-folder/names.ts` `assertOutsideStateFolder`. Moves to system/safe-folder/names.ts as assertOutsideStateFolder: the name says which folder it refuses (.gspot/state); TCM-030 rewrites its "lifecycle" message; DT1-006 keeps it, because \[rules\] instruction_files stays, so a user can still name a path under .gspot/state.
- assertMutationTarget (function exported, 202-205): **move** to `packages/cli/src/system/safe-folder/names.ts` `assertWritablePath`. Moves to system/safe-folder/names.ts as assertWritablePath: "mutation target" is jargon; it checks that gspot may write the path (a portable name outside .gspot/state).
- blockSpan (function exported, 213-232): **move** to `packages/cli/src/system/managed-blocks.ts` `blockSpan`. Moves to system/managed-blocks.ts (TPR-055). Values to config: LEADING_NEWLINE = /^\\r?\\n/u -&gt; packages/cli/src/config/text.ts
- applyBlock (function exported, 241-250): **move** to `packages/cli/src/system/managed-blocks.ts` `applyBlock`. Moves to system/managed-blocks.ts (TPR-055).
- currentBlock (function exported, 258-264): **move** to `packages/cli/src/system/managed-blocks.ts` `currentBlock`. Moves to system/managed-blocks.ts (TPR-055).

## `packages/cli/src/platform/root/public.ts`

- packageDirectory (const, 38-38): **move** to `packages/cli/src/system/assets.ts` `cachedPackageFolder`. Moves to system/assets.ts as cachedPackageFolder (PLR-008), named with packageFolder, whose cache it is: a module variable packageFolder fills on first use; not exported.
- nearestPackage (function, 41-52): **move** to `packages/cli/src/system/assets.ts` `nearestPackage`. Moves to system/assets.ts with gspot's own package files; not exported. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts; CONFIGURATIONS_FOLDER = 'configurations' -&gt; packages/cli/src/config/configurations.ts
- packageRoot (function, 57-61): **move** to `packages/cli/src/system/assets.ts` `packageFolder`. Moves to system/assets.ts as packageFolder (PLR-008: "root" means the repository folder); not exported. Values to config: CLI_PACKAGE_JSON = '@gspothq/cli/package.json' -&gt; packages/cli/src/config/system/assets.ts
- listOf (function, 64-73): **move** to `packages/cli/src/system/safe-folder/open.ts` `listOf`. Moves to system/safe-folder/open.ts (PLR-002).
- statOf (function, 76-85): **move** to `packages/cli/src/system/safe-folder/open.ts` `statOf`. Moves to system/safe-folder/open.ts (PLR-002).
- renameDirectory (function, 88-92): **delete**. Delete (A6): install goes straight into .gspot/, with no staging folder, swap or installing state, so its only callers, installTree and recoverInstallations, go.
- removeTree (function, 95-100): **move** to `packages/cli/src/system/safe-folder/open.ts` `removeTree`. Moves to system/safe-folder/open.ts (PLR-002).
- removeEntry (function, 103-107): **move** to `packages/cli/src/system/safe-folder/open.ts` `removeEntry`. Moves to system/safe-folder/open.ts (PLR-002); it keeps its compare.
- makeDirectory (function, 110-119): **move** to `packages/cli/src/system/safe-folder/open.ts` `makeDirectory`. Moves to system/safe-folder/open.ts (PLR-002).
- releaseClaims (function, 123-133): **move** to `packages/cli/src/system/safe-folder/lock.ts` `releaseLocks`. Moves to system/safe-folder/lock.ts as releaseLocks ("lock": the file is writer.lock; TCM-030); its empty-folder test reads the folder directly, so lock.ts does not import open.ts.
- assetPath (function exported, 140-142): **move** to `packages/cli/src/system/assets.ts` `assetPath`. Moves to system/assets.ts with gspot's own package files.
- readAsset (function exported, 149-151): **move** to `packages/cli/src/system/assets.ts` `readAsset`. Moves to system/assets.ts with gspot's own package files.
- wasmPath (function exported, 158-165): **move** to `packages/cli/src/system/assets.ts` `wasmPath`. Moves to system/assets.ts; INS-021: the name guard goes; INS-008: only grammar files are left. Values to config: GRAMMARS_FOLDER = 'grammars' -&gt; packages/cli/src/config/system/assets.ts
- listAssets (function exported, 172-178): **move** to `packages/cli/src/system/assets.ts` `listAssets`. Moves to system/assets.ts with gspot's own package files. Values to config: ALL_FILES_GLOB = '\*\*/\*' -&gt; packages/cli/src/config/system/paths.ts
- openRoot (function exported, 186-229): **move** to `packages/cli/src/system/safe-folder/open.ts` `openSafeFolder`. Moves to system/safe-folder/open.ts as openSafeFolder; PLR-008; glossary (safe folder, openSafeFolder).
- walkRoot (function exported, 237-244): **move** to `packages/cli/src/system/safe-folder/open.ts` `walkSafeFolder`. Moves to system/safe-folder/open.ts as walkSafeFolder; PLR-008; PLR-020 keeps it.
- readPrefix (function exported, 256-271): **move** to `packages/cli/src/system/file-reads.ts` `readPrefix`. Moves to system/file-reads.ts (PLR-006); doctor keeps its own small read.
- readSource (function exported, 280-287): **move** to `packages/cli/src/system/file-reads.ts` `readSource`. Moves to system/file-reads.ts (PLR-049): one cache-root helper.
- readText (function exported, 297-306): **move** to `packages/cli/src/system/file-reads.ts` `readText`. Moves to system/file-reads.ts.
- createReadCache (function exported, 313-315): **move** to `packages/cli/src/system/file-reads.ts` `createReadCache`. Moves to system/file-reads.ts.

## `packages/cli/src/platform/root/reads.ts`

- preparedDirectory (function, 13-25): **move** to `packages/cli/src/system/safe-folder/reads.ts` `preparedDirectory`. Moves to system/safe-folder/reads.ts; PLR-002; PLR-048 (the create-if-missing step of the shared parent loop); not exported.
- linkRead (function, 28-32): **move** to `packages/cli/src/system/safe-folder/reads.ts` `linkRead`. Moves to system/safe-folder/reads.ts; PLR-002; PLR-029 (fixed link mode); not exported.
- fileRead (function, 35-43): **move** to `packages/cli/src/system/safe-folder/reads.ts` `fileRead`. Moves to system/safe-folder/reads.ts: one read, with no second lstat, no hard-link refusal and no EAGAIN; PLR-052 after TPR-021; not exported.
- isUnsafeLinkTarget (function, 46-49): **move** to `packages/cli/src/system/safe-folder/reads.ts` `isUnsafeLinkTarget`. Moves to system/safe-folder/reads.ts; PLR-027 (only not UTF-8, empty or absolute); not exported.
- assertLinkDestination (function, 52-57): **move** to `packages/cli/src/system/safe-folder/reads.ts` `assertLinkDestination`. Moves to system/safe-folder/reads.ts; PLR-002; not exported.
- boundsOf (function exported, 65-69): **inline** to `packages/cli/src/system/safe-folder/open.ts` `openSafeFolder`. Inline into openSafeFolder in system/safe-folder/open.ts; one-caller constructor of SafeFolderState (owner rule: one-caller wrapper).
- checkedPath (function exported, 77-88): **move** to `packages/cli/src/system/safe-folder/reads.ts` `checkedPath`. Moves to system/safe-folder/reads.ts (PLR-048): shares one parent-check loop with preparedPath.
- preparedPath (function exported, 96-107): **move** to `packages/cli/src/system/safe-folder/reads.ts` `preparedPath`. Moves to system/safe-folder/reads.ts (PLR-048).
- readEntry (function exported, 116-126): **move** to `packages/cli/src/system/safe-folder/reads.ts` `readEntry`. Moves to system/safe-folder/reads.ts (PLR-002).
- validateRead (function exported, 137-154): **move** to `packages/cli/src/system/safe-folder/reads.ts` `validateCopy`. Moves to system/safe-folder/reads.ts as validateCopy; NMS-003 table B (it checks a copy before it is written).
- canonicalPath (function exported, 162-174): **move** to `packages/cli/src/system/safe-folder/reads.ts` `realPath`. Moves to system/safe-folder/reads.ts as realPath: it returns realpathSync's result, and "canonical" is a retired filler word (glossary); TPR-002: the special case stays.
- sourcePath (function exported, 183-187): **move** to `packages/cli/src/system/safe-folder/reads.ts` `sourcePath`. Moves to system/safe-folder/reads.ts.

## `packages/cli/src/platform/root/writes.ts`

- prepareFile (function, 37-48): **merge** to `packages/cli/src/system/safe-folder/writes.ts` `flushFile`. Merges into flushFile in system/safe-folder/writes.ts: LIF-004 removes the async path that needed the split.
- flushFile (function, 51-61): **move** to `packages/cli/src/system/safe-folder/writes.ts` `flushFile`. Moves to system/safe-folder/writes.ts; not exported.
- stageFile (function, 64-100): **delete**. Delete (LIF-004, LIF-001): no staged writes are left.
- mustUnlinkFirst (function, 104-107): **move** to `packages/cli/src/system/safe-folder/writes.ts` `mustUnlinkFirst`. Moves to system/safe-folder/writes.ts; PLR-030 (Windows cannot rename over a read-only file); not exported.
- commitStaged (function, 110-125): **inline** to `packages/cli/src/system/safe-folder/writes.ts` `replaceEntry`. Inline into replaceEntry: once stageFile goes, replaceEntry is its one caller, and it exists only with the Staging type that carries four values to it; it keeps its compare.
- restoreRemoved (function, 128-134): **delete**. Delete: recovery already treats a missing target as not written.
- stage (function, 137-140): **inline** to `packages/cli/src/system/safe-folder/writes.ts` `replaceEntry`. Inline into replaceEntry in system/safe-folder/writes.ts; one-caller three-line branch (owner rule: one-caller wrapper).
- tryClaim (function, 143-151): **move** to `packages/cli/src/system/safe-folder/lock.ts` `tryLock`. Moves to system/safe-folder/lock.ts as tryLock ("lock": the file is writer.lock); TPR-021: atomic creation: the token goes in a temporary file, then linkSync; not exported.
- readClaim (function, 154-161): **delete**. Delete: PLR-052 after TPR-021: no empty or half-written lock can be read, so its EAGAIN catch goes and both callers use readEntry.
- assertAbandonedClaim (function, 164-178): **move** to `packages/cli/src/system/safe-folder/lock.ts` `assertAbandonedLock`. Moves to system/safe-folder/lock.ts as assertAbandonedLock (TCM-030: messages without "lifecycle"); ST4-003: the incomplete-lock branch goes, because after TPR-021 the lock is linked in fully written, so a lock without a process ID cannot come from gspot; not exported. Values to config: LOCK_TOKEN_SEPARATOR = ':' -&gt; packages/cli/src/config/system/safe-folder.ts
- pauseUntilClaimed (function, 181-185): **delete**. Delete (TPR-021): atomic lock creation leaves nothing to wait for.
- retireStaleClaim (function, 188-208): **move** to `packages/cli/src/system/safe-folder/lock.ts` `removeStaleLock`. Moves to system/safe-folder/lock.ts as removeStaleLock ("retire" is retired, glossary); TPR-021 keeps the .reclaim lease; PLR-047: PRIVATE_DIRECTORY; not exported. Values to config: LOCK_RECOVERY_SUFFIX = '.reclaim' -&gt; packages/cli/src/config/system/safe-folder.ts
- writeLink (function exported, 217-227): **move** to `packages/cli/src/system/safe-folder/writes.ts` `writeLink`. Moves to system/safe-folder/writes.ts (PLR-029): no mode parameter, no lchmodSync and no darwin branch.
- replaceEntry (function exported, 236-254): **move** to `packages/cli/src/system/safe-folder/writes.ts` `replaceEntry`. Moves to system/safe-folder/writes.ts with the file writes. Values to config: TEMPORARY_FILE_PREFIX = '.gspot-' -&gt; packages/cli/src/config/system/safe-folder.ts; TEMPORARY_FILE_SUFFIX = '.tmp' -&gt; packages/cli/src/config/system/safe-folder.ts
- replaceEntries (function exported, 262-270): **delete**. Delete (LIF-004): no batched entry replacement is left.
- claimPath (function exported, 277-292): **move** to `packages/cli/src/system/safe-folder/lock.ts` `takeLock`. Moves to system/safe-folder/lock.ts as takeLock ("lock": the file is writer.lock; TCM-030). Values to config: LOCK_TOKEN_SEPARATOR = ':' -&gt; packages/cli/src/config/system/safe-folder.ts

## `packages/cli/src/platform/scratch.ts`

- scratchFolder (function exported, 13-21): **move** to `packages/cli/src/system/files.ts` `scratchFolder`. Moves to system/files.ts.
- scratchEntries (function exported, 28-34): **move** to `packages/cli/src/system/files.ts` `listFolderFiles`. Moves to system/files.ts as listFolderFiles (PLR-020): one folder walker for the site check and globPaths.

## `packages/cli/src/repository/contracts.ts`

- symlinkEntry (function, 35-48): **move** to `packages/cli/src/repository/tracked.ts` `symlinkEntry`. Moves to repository/tracked.ts with the file listing; not exported.
- assertParents (function, 51-61): **delete**. Delete (PLR-053): Node's own ENOTDIR error is enough.
- entryStat (function, 63-70): **inline** to `packages/cli/src/repository/tracked.ts` `readFileEntry`. Inline into readFileEntry in repository/tracked.ts (PLR-053): without assertParents it is one lstatSync call.
- getEntry (function, 72-93): **move** to `packages/cli/src/repository/tracked.ts` `readFileEntry`. Moves to repository/tracked.ts as readFileEntry; NMS-016 (it reads the file system); FileEntry type (PLR names table); not exported.
- directoryContents (function, 95-105): **move** to `packages/cli/src/repository/tracked.ts` `directoryContents`. Moves to repository/tracked.ts with the file listing; not exported. Values to config: GITIGNORE_FILE = '.gitignore' -&gt; packages/cli/src/config/repository/tracked.ts
- isIgnored (function, 107-115): **move** to `packages/cli/src/repository/tracked.ts` `isIgnored`. Moves to repository/tracked.ts with the file listing; not exported.
- walkPaths (function, 117-136): **move** to `packages/cli/src/repository/tracked.ts` `walkPaths`. Moves to repository/tracked.ts; PLR-020 keeps it for the per-folder .gitignore rules; PLR-024: used when the folder has no Git; not exported. Values to config: GIT_FOLDER = '.git' -&gt; packages/cli/src/config/repository/tracked.ts
- listGitFiles (function, 139-150): **move** to `packages/cli/src/repository/tracked.ts` `listGitFiles`. Moves to repository/tracked.ts; PLR-024: the outside-Git branch stays for export and the check run; its two callers pass the whole ls-files argument list (INDEX_FILES_ARGV or UNTRACKED_FILES_ARGV) instead of it adding 'ls-files' and '-z'; it calls runGitBlocking(root, WORK_TREE_ARGV, { env: GIT_LOCALE }), because inspectWorkTree goes; not exported. Values to config: WORK_TREE_ARGV = \['rev-parse', '--is-inside-work-tree'\] -&gt; packages/cli/src/config/system/git.ts
- importTarget (function, 152-156): **move** to `packages/cli/src/repository/aliases.ts` `importTarget`. Moves to repository/aliases.ts; PLR-045: isRecord instead of written-out object tests; not exported.
- packageAliases (function, 158-171): **move** to `packages/cli/src/repository/aliases.ts` `packageAliases`. Moves to repository/aliases.ts with the alias reading; not exported. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts; LOCAL_PATH_PREFIX = './' -&gt; packages/cli/src/config/repository/aliases.ts
- readIndexEntries (function exported, 179-182): **move** to `packages/cli/src/repository/tracked.ts` `readIndexEntries`. Moves to repository/tracked.ts with the file listing (PLR-024). Values to config: INDEX_FILES_ARGV = \['ls-files', '--stage', '-z'\] -&gt; packages/cli/src/config/repository/tracked.ts
- getSubmodulePaths (function exported, 189-193): **move** to `packages/cli/src/repository/tracked.ts` `submodulePaths`. Moves to repository/tracked.ts as submodulePaths (NMS-016): a pure filter of index entries reads as a noun (table B's listSubmodulePaths suggests a Git run it does not make).
- trackedEntries (function exported, 202-234): **move** to `packages/cli/src/repository/tracked.ts` `listRepositoryFiles`. Moves to repository/tracked.ts as listRepositoryFiles (PLR-023): it also lists untracked files; TMF-003: the exclude parameter goes with the exclude setting, so it lists tracked files plus untracked files .gitignore does not hide, and takes the index entries only. Values to config: UNTRACKED_FILES_ARGV = \['ls-files', '--others', '--exclude-standard', '-z'\] -&gt; packages/cli/src/config/repository/tracked.ts
- getProjectDependencies (function exported, 242-252): **move** to `packages/cli/src/repository/scopes.ts` `projectDependencies`. Moves to repository/scopes.ts as projectDependencies (NMS-016: a pure lookup is a noun); it needs isInScope, and scopes.ts imports readPackageJson, so it sits in scopes.ts to avoid a value cycle. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- readPackageManifests (function exported, 260-275): **move** to `packages/cli/src/repository/dependency-files.ts` `readDependencyFiles`. Moves to repository/dependency-files.ts as readDependencyFiles (PAR-063; glossary: dependency file).
- readPackageManifest (function exported, 283-287): **move** to `packages/cli/src/repository/dependency-files.ts` `readPackageJson`. Moves to repository/dependency-files.ts as readPackageJson; PAR-063; glossary.
- installedPackage (function exported, 296-310): **move** to `packages/cli/src/repository/dependency-files.ts` `installedPackage`. Moves to repository/dependency-files.ts; LIF-055: it takes SafeFolder\['read'\] once ToolOwner goes.
- installedDependency (function exported, 319-331): **move** to `packages/cli/src/repository/dependency-files.ts` `installedDependency`. Moves to repository/dependency-files.ts; PLR-044: no pre-scan. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- aliasesFor (function exported, 340-357): **move** to `packages/cli/src/repository/aliases.ts` `aliasesFor`. Moves to repository/aliases.ts with the alias reading. Values to config: TSCONFIG_FILE = 'tsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts; PATHS_BASE_OPTION = 'pathsBasePath' -&gt; packages/cli/src/config/repository/aliases.ts

## `packages/cli/src/repository/discovery/contracts.ts`

- sniff (function, 24-29): **move** to `packages/cli/src/repository/tags.ts` `sniff`. Moves to repository/tags.ts with the tag code; not exported.
- shebangTags (function, 31-44): **move** to `packages/cli/src/repository/tags.ts` `shebangTags`. Moves to repository/tags.ts with the tag code; not exported. Values to config: DEFAULT_DIALECT = 'bash' -&gt; packages/cli/src/config/repository/inventory.ts
- textTags (function, 46-51): **move** to `packages/cli/src/repository/tags.ts` `textTags`. Moves to repository/tags.ts with the tag code; not exported. Values to config: TEXT_TAG = 'text' -&gt; packages/cli/src/config/repository/inventory.ts
- withoutTrailingVersion (function, 53-57): **move** to `packages/cli/src/repository/tags.ts` `withoutTrailingVersion`. Moves to repository/tags.ts with the tag code; not exported. Values to config: VERSION_CHARACTERS = '0123456789.' -&gt; packages/cli/src/config/repository/inventory.ts
- inspectWorkTree (function exported, 64-66): **delete**. Delete: a wrapper of one runGitBlocking call with fixed arguments; its callers (isGitRepository, findRoot, listGitFiles) call runGitBlocking(root, WORK_TREE_ARGV, { env: GIT_LOCALE }) with the config values.
- isGitRepository (function exported, 74-81): **move** to `packages/cli/src/repository/find-root.ts` `isGitRepository`. Moves to repository/find-root.ts; PLR-024: readRepository calls it once, first. Values to config: WORK_TREE_ARGV = \['rev-parse', '--is-inside-work-tree'\] -&gt; packages/cli/src/config/system/git.ts; GIT_LOCALE = { LC_ALL: 'C' } -&gt; packages/cli/src/config/system/git.ts
- findRoot (function exported, 89-103): **move** to `packages/cli/src/repository/find-root.ts` `findRoot`. Moves to repository/find-root.ts; PLR-010: start from realPath. Values to config: GIT_TOP_LEVEL_ARGV = \['rev-parse', '--show-toplevel'\] -&gt; packages/cli/src/config/system/git.ts
- tagEntry (function exported, 111-130): **move** to `packages/cli/src/repository/tags.ts` `tagEntry`. Moves to repository/tags.ts with the tag code. Values to config: DOCKERFILE_NAME = 'Dockerfile' -&gt; packages/cli/src/config/repository/inventory.ts; DOCKERFILE_EXTENSION = '.dockerfile' -&gt; packages/cli/src/config/repository/inventory.ts; DOTENV_PREFIX = '.env' -&gt; packages/cli/src/config/repository/inventory.ts; BINARY_TAG = 'binary' -&gt; packages/cli/src/config/repository/inventory.ts
- swiftSourceTags (function exported, 137-162): **move** to `packages/cli/src/parsers/swift.ts` `swiftSourceTags`. Moves to parsers/swift.ts (PLR-037): Swift parsing leaves the repository folder, and the Package.swift filter of readRepository folds in. Values to config: SWIFT_IMPORT_NODE = 'import_declaration' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_IDENTIFIER_NODE = 'identifier' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_ATTRIBUTE_NODE = 'attribute' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TYPE_NODE = 'user_type' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_CALL_NODE = 'call_expression' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TEST_MODULES = \['XCTest', 'Testing'\] -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TEST_ATTRIBUTES = \['Test', 'Suite', 'Testing.Test', 'Testing.Suite'\] -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TEST_TARGET_CALLS = \['.testTarget', 'Target.testTarget'\] -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_IMPORT_TAG = 'swift-import:' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TEST_TAG = 'swift-test' -&gt; packages/cli/src/config/repository/inventory.ts; SWIFT_TEST_TARGET_TAG = 'swift-test-target' -&gt; packages/cli/src/config/parsers/swift.ts; PACKAGE_SWIFT = 'Package.swift' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- extensionsTagged (function exported, 169-173): **move** to `packages/cli/src/repository/tags.ts` `extensionsTagged`. Moves to repository/tags.ts with the tag code.

## `packages/cli/src/repository/discovery/public.ts`

- isLintCommand (function, 41-52): **move** to `packages/cli/src/repository/tooling.ts` `isLintCommand`. Moves to repository/tooling.ts, which names what it returns; INX-003: it reads RUNNER_NAMES (the task-runner words) instead of runnerSchema.options, which goes; not exported. Values to config: COMMAND_SEPARATORS = /\[\\s;&|\]+/u -&gt; packages/cli/src/config/repository/tooling.ts; ESLINT_TOOL = 'eslint' -&gt; packages/cli/src/config/generation/eslint.ts; RUN_WORD = 'run' -&gt; packages/cli/src/config/repository/tooling.ts; LINT_TASK = 'lint' -&gt; packages/cli/src/config/repository/tooling.ts; RUNNER_NAMES = \[...NPM_CLIENTS, 'mise'\] as const -&gt; packages/cli/src/config/repository/tooling.ts
- getFiles (function, 55-65): **move** to `packages/cli/src/repository/tooling.ts` `listFolder`. Moves to repository/tooling.ts as listFolder (PLR-056); not exported. Values to config: KEPT_DOT_FILE = '.gitkeep' -&gt; packages/cli/src/config/repository/tooling.ts
- hookDirectory (function, 67-73): **move** to `packages/cli/src/repository/tooling.ts` `hookDirectory`. Moves to repository/tooling.ts with the tooling survey; not exported. Values to config: HUSKY_DIRECTORY = '.husky' -&gt; packages/cli/src/config/repository/hooks.ts
- detectRunner (function, 75-82): **delete**. Delete (INX-003): the tooling survey reports no runner: the runner setting, the init runner question and the init detection row are deleted, and hooks take the start command from the npm client selection.
- jobCommands (function, 84-95): **move** to `packages/cli/src/repository/tooling.ts` `jobCommands`. Moves to repository/tooling.ts; PLR-045 (isRecord or one small zod schema); not exported.
- isLintJob (function, 97-107): **move** to `packages/cli/src/repository/tooling.ts` `isLintJob`. Moves to repository/tooling.ts (PLR-045); not exported. Values to config: JOB_NAME_SEPARATORS = /\[-\_: \]/u -&gt; packages/cli/src/config/repository/tooling.ts
- lintJobs (function, 110-118): **move** to `packages/cli/src/repository/tooling.ts` `lintJobs`. Moves to repository/tooling.ts (PLR-045); not exported. Values to config: GITHUB_WORKFLOWS_FOLDER = '.github/workflows/' -&gt; packages/cli/src/config/repository/tooling.ts
- hasSection (function, 120-125): **move** to `packages/cli/src/repository/tooling.ts` `hasSection`. Moves to repository/tooling.ts with the tooling survey; not exported.
- planTakeoverConfigs (function, 128-148): **move** to `packages/cli/src/repository/tooling.ts` `findReplacedToolFiles`. Moves to repository/tooling.ts as findReplacedToolFiles (PLR-046; NMS-003; glossary: replace); '\*\*/' has one name, ANY_FOLDER_PREFIX (glob syntax), which the parsers import too. Values to config: ANY_FOLDER_PREFIX = '\*\*/' -&gt; packages/cli/src/config/system/paths.ts
- getToolConfigs (function, 156-163): **inline** to `packages/cli/src/repository/tooling.ts` `readTooling`. Inline into readTooling in repository/tooling.ts; one caller (owner rule: one-caller wrapper); PLR-046's getToolFiles name not needed.
- getHooks (function exported, 170-210): **move** to `packages/cli/src/repository/tooling.ts` `readHooks`. Moves to repository/tooling.ts as readHooks (NMS-016). Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts; SIMPLE_GIT_HOOKS_KEY = 'simple-git-hooks' -&gt; packages/cli/src/config/repository/hooks.ts; HOOKS_PATH_SETTING = 'core.hooksPath' -&gt; packages/cli/src/config/repository/hooks.ts; PRE_COMMIT_FILE = '.pre-commit-config.yaml' -&gt; packages/cli/src/config/repository/hooks.ts
- surveyRepository (function exported, 220-252): **inline** to `packages/cli/src/repository/tooling.ts` `readTooling`. Inline into readTooling (PLR-031). Values to config: GITLAB_CI_FILE = '.gitlab-ci.yml' -&gt; packages/cli/src/config/repository/tooling.ts; GITHUB_WORKFLOWS_FOLDER = '.github/workflows/' -&gt; packages/cli/src/config/repository/tooling.ts; GITLAB_CI_FOLDER = '.gitlab/ci/' -&gt; packages/cli/src/config/repository/tooling.ts; YAML_EXTENSIONS = \['.yml', '.yaml'\] -&gt; packages/cli/src/config/repository/tooling.ts; MARKDOWN_EXTENSION = '.md' -&gt; packages/cli/src/config/repository/inventory.ts
- getLintJobs (function exported, 260-275): **move** to `packages/cli/src/repository/tooling.ts` `readLintJobs`. Moves to repository/tooling.ts as readLintJobs; NMS-016 table B.
- getTooling (function exported, 284-300): **move** to `packages/cli/src/repository/tooling.ts` `readTooling`. Moves to repository/tooling.ts as readTooling (NMS-016).

## `packages/cli/src/repository/modules.ts`

- modulePath (function exported, 13-26): **delete**. Delete: CKG-010 deletes structure/config-logic, its only user.

## `packages/cli/src/repository/paths/contracts.ts`

- workspacePackages (function, 20-53): **move** to `packages/cli/src/repository/scopes.ts` `workspacePackages`. Moves to repository/scopes.ts; PLR-053: no parse whose result is thrown away; not exported. Values to config: PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml' -&gt; packages/cli/src/config/repository/scopes.ts; LERNA_FILE = 'lerna.json' -&gt; packages/cli/src/config/repository/scopes.ts; RUSH_FILE = 'rush.json' -&gt; packages/cli/src/config/repository/scopes.ts; PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- buildScope (function exported, 60-62): **move** to `packages/cli/src/repository/scopes.ts` `buildScope`. Moves to repository/scopes.ts with the scope code.
- plannedScopes (function exported, 72-94): **move** to `packages/cli/src/repository/scopes.ts` `findScopes`. Moves to repository/scopes.ts as findScopes; NMS-003 table B (it finds candidates and plans nothing); TPR-014 (it computes the patterns and npm names itself).
- packageWorkspaces (function exported, 101-107): **move** to `packages/cli/src/repository/scopes.ts` `packageWorkspaces`. Moves to repository/scopes.ts; EXG-023 puts workspaceSourceFiles beside it.
- projectFolder (function exported, 115-132): **move** to `packages/cli/src/repository/scopes.ts` `projectFolder`. Moves to repository/scopes.ts with the scope code.
- isLintOnlyManifest (function exported, 140-145): **move** to `packages/cli/src/repository/selectors.ts` `isToolsOnlyPackage`. Moves to repository/selectors.ts as isToolsOnlyPackage (PLR-056).
- scopeOf (function exported, 153-160): **move** to `packages/cli/src/repository/scopes.ts` `scopeOf`. Moves to repository/scopes.ts with the scope code.
- scopeAncestors (function exported, 168-175): **move** to `packages/cli/src/repository/scopes.ts` `scopeAncestors`. Moves to repository/scopes.ts with the scope code.

## `packages/cli/src/repository/paths/public.ts`

- matcherCache (const, 8-8): **move** to `packages/cli/src/repository/selectors.ts` `matcherCache`. Moves to repository/selectors.ts: a module value, a Map filled while the run works; not exported.
- pathMatcher (function exported, 15-26): **move** to `packages/cli/src/repository/selectors.ts` `pathMatcher`. Moves to repository/selectors.ts with the path matchers.
- pathExpressions (function exported, 33-43): **move** to `packages/cli/src/repository/selectors.ts` `pathExpressions`. Moves to repository/selectors.ts with the path matchers. Values to config: GLOB_EXCLUDE = '!' -&gt; packages/cli/src/config/system/paths.ts
- isInScope (function exported, 51-53): **move** to `packages/cli/src/repository/scopes.ts` `isInScope`. Moves to repository/scopes.ts; PLR-014 keeps the name.
- nestedScopes (function exported, 61-63): **move** to `packages/cli/src/repository/scopes.ts` `nestedScopes`. Moves to repository/scopes.ts with the scope code.
- byScopeDepth (function exported, 71-75): **move** to `packages/cli/src/repository/scopes.ts` `byScopeDepth`. Moves to repository/scopes.ts with the scope code.
- expandedPaths (function exported, 82-87): **move** to `packages/cli/src/repository/selectors.ts` `includeFolderContents`. Moves to repository/selectors.ts as includeFolderContents (PLR-014: a look-alike of expandPaths); withFolderContents would carry "with", a shipped banned term. Values to config: GLOB_EXCLUDE = '!' -&gt; packages/cli/src/config/system/paths.ts; FOLDER_CONTENTS = '/\*\*' -&gt; packages/cli/src/config/system/paths.ts; TRAILING_SLASH = /\\/$/u -&gt; packages/cli/src/config/system/paths.ts
- coversScope (function exported, 95-107): **move** to `packages/cli/src/repository/scopes.ts` `coversScope`. Moves to repository/scopes.ts; it escapes with literalGlob. Values to config: WHOLE_TREE_GLOBS = \['\*\*', '\*\*/\*'\] -&gt; packages/cli/src/config/system/paths.ts; GLOB_EXCLUDE = '!' -&gt; packages/cli/src/config/system/paths.ts; FOLDER_CONTENTS = '/\*\*' -&gt; packages/cli/src/config/system/paths.ts
- isOutsideChildren (function exported, 115-117): **move** to `packages/cli/src/repository/scopes.ts` `isOutsideChildren`. Moves to repository/scopes.ts with the scope code.
- isToolProjectPath (function exported, 124-126): **move** to `packages/cli/src/repository/selectors.ts` `isInGspotFolder`. Moves to repository/selectors.ts as isInGspotFolder: it tests any .gspot folder, nested ones too, and "tool project" means .gspot/package.json or pyproject.toml (glossary).
- isToolingPath (function exported, 133-135): **move** to `packages/cli/src/repository/selectors.ts` `isToolingPath`. Moves to repository/selectors.ts (PLR-021): uses INSTALLED_DEPENDENCY_FOLDERS.
- isGlob (function exported, 142-144): **delete**. Delete: a wrapper that only returns picomatch.scan(pattern).isGlob; its callers (the docs check, findReplacedToolFiles, projectFolder, includeFolderContents, filenameMatcher) call picomatch.scan directly.
- filenameMatcher (function exported, 151-158): **move** to `packages/cli/src/repository/selectors.ts` `filenameMatcher`. Moves to repository/selectors.ts; PLR-035: built once per table.
- literalGlob (function exported, 165-167): **move** to `packages/cli/src/repository/selectors.ts` `literalGlob`. Moves to repository/selectors.ts with the path matchers. Values to config: GLOB_SPECIAL_CHARACTERS = /\[\\\\\*?{}\[\\\]()!+@,\]/gu -&gt; packages/cli/src/config/system/paths.ts
- inScope (function exported, 175-177): **move** to `packages/cli/src/repository/scopes.ts` `joinScope`. Moves to repository/scopes.ts as joinScope; PLR-014; glossary (inScope becomes joinScope).
- fromScope (function exported, 185-187): **move** to `packages/cli/src/repository/scopes.ts` `relativeToScope`. Moves to repository/scopes.ts as relativeToScope (PLR-014).
- targetInScope (function exported, 195-200): **move** to `packages/cli/src/repository/scopes.ts` `targetInScope`. Moves to repository/scopes.ts.
- semgrepRuleFiles (function exported, 209-216): **move** to `packages/cli/src/checks/general/security.ts` `semgrepRuleFiles`. Moves to checks/general/security.ts (PLR-037): planning stops calling it after LIF-035; not exported. Values to config: SEMGREP_TOOL = 'semgrep' -&gt; packages/cli/src/config/checks/general/security.ts; RULES_KEY = 'rules' -&gt; packages/cli/src/config/checks/general/security.ts

## `packages/cli/src/repository/public.ts`

- trackedFile (function, 43-55): **move** to `packages/cli/src/repository/kind.ts` `classifyFile`. Moves to repository/kind.ts as classifyFile (PLR-036): one function tags, classifies and builds the TrackedFile for readRepository, planning/files.ts and the gspot.toml entry in commands.
- declaredKind (function, 58-79): **move** to `packages/cli/src/repository/kind.ts` `declaredKind`. Moves to repository/kind.ts; CFR-005: declarations hold only configuration declarations, so .gitattributes decides first and the configuration declaration second; the written-entry branch and the generator producedBy field go; not exported.
- attributeKind (function, 81-89): **move** to `packages/cli/src/repository/kind.ts` `attributeKind`. Moves to repository/kind.ts; TMF-001: the tool ignore files need the same markers, so a new reader in repository/read.ts keeps the linguist-generated and linguist-vendored rules of every tracked .gitattributes (through attributeRules), and generatedIgnores uses them; not exported. Values to config: GITATTRIBUTES_FILE = '.gitattributes' -&gt; packages/cli/src/config/repository/tracked.ts; GENERATED_ATTRIBUTE = 'linguist-generated' -&gt; packages/cli/src/config/repository/inventory.ts; VENDORED_ATTRIBUTE = 'linguist-vendored' -&gt; packages/cli/src/config/repository/inventory.ts; TEXT_ATTRIBUTE = 'text' -&gt; packages/cli/src/config/repository/inventory.ts; FILTER_ATTRIBUTE = 'filter' -&gt; packages/cli/src/config/repository/inventory.ts; SET_VALUES = \['set', 'true'\] -&gt; packages/cli/src/config/repository/inventory.ts; LFS_FILTER = 'lfs' -&gt; packages/cli/src/config/repository/inventory.ts
- isLicenseFile (function, 92-96): **move** to `packages/cli/src/repository/kind.ts` `isLicenseFile`. Moves to repository/kind.ts; not exported.
- classifyToolFile (function, 99-107): **move** to `packages/cli/src/repository/kind.ts` `fileOrigin`. Moves to repository/kind.ts as fileOrigin; NMS-003 table B (it also handles banners, build wrappers and Vale packages); not exported.
- sourceKind (function, 110-116): **move** to `packages/cli/src/repository/kind.ts` `sourceKind`. Moves to repository/kind.ts; not exported. Values to config: MARKDOWN_EXTENSION = '.md' -&gt; packages/cli/src/config/repository/inventory.ts
- readRepository (function exported, 127-177): **move** to `packages/cli/src/repository/read.ts` `readRepository`. Moves to repository/read.ts; PLR-024: one isGitRepository call, first; TMF-003, CFR-005: the exclude parameter goes, and declarations are the configuration declarations only. Values to config: SWIFT_EXTENSION = '.swift' -&gt; packages/cli/src/config/parsers/swift.ts
- isValePackageFile (function exported, 184-189): **move** to `packages/cli/src/repository/kind.ts` `isValePackageFile`. Moves to repository/kind.ts (GEN-008): one branch left.
- kindOf (function exported, 197-215): **move** to `packages/cli/src/repository/kind.ts` `kindOf`. Moves to repository/kind.ts; PLR-036: planning/files.ts calls classifyFile, so stop exporting. Values to config: TEXT_ATTRIBUTE = 'text' -&gt; packages/cli/src/config/repository/inventory.ts; ATTRIBUTE_SET = 'set' -&gt; packages/cli/src/config/repository/inventory.ts
- readAttributes (function exported, 224-258): **move** to `packages/cli/src/repository/read.ts` `readAttributes`. Moves to repository/read.ts; PLR-031: stop exporting; kinds.test.ts tests attributes through readRepository. Values to config: CHECK_ATTRIBUTES_ARGV = \['check-attr', '--stdin', '-z', 'linguist-generated', 'linguist-vendored', 'text', 'filter'\] -&gt; packages/cli/src/config/repository/inventory.ts; GITATTRIBUTES_FILE = '.gitattributes' -&gt; packages/cli/src/config/repository/tracked.ts

## `packages/cli/src/repository/revisions/contracts.ts`

- isHashPair (function, 14-17): **rename** to `packages/cli/src/repository/revisions/push.ts` `isHashPair`. Stays as isHashPair; its file becomes repository/revisions/push.ts; PLR-002 (revisions/contracts.ts renamed in place to push.ts); not exported.
- parseLine (function, 20-28): **rename** to `packages/cli/src/repository/revisions/push.ts` `parseLine`. Stays as parseLine; its file becomes repository/revisions/push.ts; PLR-002; not exported.
- peelCommits (function, 31-60): **rename** to `packages/cli/src/repository/revisions/push.ts` `peelCommits`. Moves to repository/revisions/push.ts (PLR-002); not exported. Values to config: PEEL_ARGV = \['cat-file', '--batch-check=%(objectname) %(objecttype)'\] -&gt; packages/cli/src/config/repository/revisions.ts; PEEL_SUFFIX = '^{}' -&gt; packages/cli/src/config/repository/revisions.ts
- getShallowBoundaries (function, 63-67): **rename** to `packages/cli/src/repository/revisions/push.ts` `readShallowBoundaries`. Moves to repository/revisions/push.ts as readShallowBoundaries (PLR-002; NMS-016: it runs Git and reads a file); not exported. Values to config: SHALLOW_FILE_ARGV = \['rev-parse', '--git-path', 'shallow'\] -&gt; packages/cli/src/config/repository/revisions.ts
- comparison (function, 70-83): **rename** to `packages/cli/src/repository/revisions/push.ts` `comparison`. Moves to repository/revisions/push.ts (PLR-002); COMMIT_DIFF_ARGV and LOG_ARGV stay in config/repository/revisions.ts; not exported. Values to config: REMOTES_OPTION = '--remotes' -&gt; packages/cli/src/config/repository/revisions.ts
- buildRevision (function, 86-100): **rename** to `packages/cli/src/repository/revisions/push.ts` `buildRevision`. Moves to repository/revisions/push.ts (PLR-002); not exported. Values to config: REV_LIST_ARGV = \['rev-list'\] -&gt; packages/cli/src/config/repository/revisions.ts; TREE_ARGV = \['rev-parse', '--verify'\] -&gt; packages/cli/src/config/repository/revisions.ts; TREE_SUFFIX = '^{tree}' -&gt; packages/cli/src/config/repository/revisions.ts
- recordRevision (function, 103-114): **rename** to `packages/cli/src/repository/revisions/push.ts` `recordRevision`. Stays as recordRevision; its file becomes repository/revisions/push.ts; PLR-002; not exported.
- selectLine (function, 117-130): **rename** to `packages/cli/src/repository/revisions/push.ts` `selectLine`. Stays as selectLine; its file becomes repository/revisions/push.ts; PLR-002; not exported.
- selectPush (function exported, 140-162): **rename** to `packages/cli/src/repository/revisions/push.ts` `selectPush`. Moves to repository/revisions/push.ts (PLR-002); PLR-016: one true header. Values to config: REMOTE_ARGV = \['remote'\] -&gt; packages/cli/src/config/repository/revisions.ts

## `packages/cli/src/repository/revisions/public.ts`

- getRemoteHeads (function, 15-24): **move** to `packages/cli/src/repository/revisions/changes.ts` `listRemoteHeads`. Moves to repository/revisions/changes.ts as listRemoteHeads (NMS-016); not exported. Values to config: REMOTE_HEADS_ARGV = \['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'\] -&gt; packages/cli/src/config/repository/revisions.ts; HEAD_SUFFIX = '/HEAD' -&gt; packages/cli/src/config/repository/revisions.ts
- getDefaultRef (function, 27-38): **move** to `packages/cli/src/repository/revisions/changes.ts` `readDefaultRef`. Moves to repository/revisions/changes.ts as readDefaultRef (NMS-016); not exported. Values to config: HEAD_NAME_ARGV = \['rev-parse', '--symbolic-full-name', 'HEAD'\] -&gt; packages/cli/src/config/repository/revisions.ts; UPSTREAM_ARGV = \['for-each-ref', '--format=%(upstream)', '--'\] -&gt; packages/cli/src/config/repository/revisions.ts; ORIGIN_HEAD = 'refs/remotes/origin/HEAD' -&gt; packages/cli/src/config/repository/revisions.ts
- getMergeBase (function, 41-48): **move** to `packages/cli/src/repository/revisions/changes.ts` `readMergeBase`. Moves to repository/revisions/changes.ts as readMergeBase (NMS-016); not exported. Values to config: MERGE_BASE_ARGV = \['merge-base', '--'\] -&gt; packages/cli/src/config/repository/revisions.ts
- getStaged (function exported, 56-63): **move** to `packages/cli/src/repository/revisions/changes.ts` `readStagedPaths`. Moves to repository/revisions/changes.ts as readStagedPaths (NMS-016). Values to config: STAGED_DIFF_ARGV = \['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'\] -&gt; packages/cli/src/config/repository/revisions.ts
- getChanged (function exported, 72-88): **move** to `packages/cli/src/repository/revisions/changes.ts` `readChangedPaths`. Moves to repository/revisions/changes.ts as readChangedPaths (NMS-016). Values to config: CHANGED_COMMITS_ARGV = \['rev-list', '--reverse'\] -&gt; packages/cli/src/config/repository/revisions.ts
- getPushBase (function exported, 96-103): **move** to `packages/cli/src/repository/revisions/changes.ts` `readPushBase`. Moves to repository/revisions/changes.ts as readPushBase (NMS-016); PLR-025: drop the first === '' half. Values to config: ROOT_COMMITS_ARGV = \['rev-list', '--max-parents=0', 'HEAD'\] -&gt; packages/cli/src/config/repository/revisions.ts
- getEntries (function exported, 114-122): **move** to `packages/cli/src/repository/revisions/objects.ts` `listRevisionEntries`. Moves to repository/revisions/objects.ts as listRevisionEntries (NMS-016: "get" hides a Git run); PLR-026: read.stderr.trim(). Values to config: TREE_ENTRIES_ARGV = \['ls-tree', '-r', '-z'\] -&gt; packages/cli/src/config/repository/revisions.ts
- visitGitBlobs (function exported, 131-151): **move** to `packages/cli/src/repository/revisions/objects.ts` `visitGitBlobs`. Moves to repository/revisions/objects.ts (PLR-002); PLR-025: no hash re-check. Values to config: BLOBS_ARGV = \['cat-file', '--batch'\] -&gt; packages/cli/src/config/repository/revisions.ts
- getBlobs (function exported, 160-175): **move** to `packages/cli/src/repository/revisions/objects.ts` `readBlobs`. Moves to repository/revisions/objects.ts as readBlobs; NMS-016 table B.
- getHeadEntries (function exported, 183-194): **move** to `packages/cli/src/repository/revisions/objects.ts` `listHeadEntries`. Moves to repository/revisions/objects.ts as listHeadEntries (NMS-016); PLR-053 drops the third Git call. Values to config: HEAD_ARGV = \['rev-parse', '--verify', '--quiet', 'HEAD'\] -&gt; packages/cli/src/config/repository/revisions.ts; SYMBOLIC_HEAD_ARGV = \['symbolic-ref', '--quiet', 'HEAD'\] -&gt; packages/cli/src/config/repository/revisions.ts
- pushedCommits (function exported, 203-215): **move** to `packages/cli/src/repository/revisions/changes.ts` `pushedCommits`. Moves to repository/revisions/changes.ts (PLR-002); CKG-045: gitleaks-pushed uses it too. Values to config: REV_LIST_ARGV = \['rev-list'\] -&gt; packages/cli/src/config/repository/revisions.ts

## `packages/cli/src/repository/selection/contracts.ts`

- dependencyMap (function, 18-25): **move** to `packages/cli/src/repository/detect.ts` `dependencyMap`. Moves to repository/detect.ts (LIF-009) with the configuration detection; not exported.
- layout (function, 27-59): **move** to `packages/cli/src/repository/detect.ts` `scopeContents`. Moves to repository/detect.ts as scopeContents; PLR-014; PLR-056 (its variable scopeSummaries becomes scopeDependencyFiles); not exported.
- extensionEvidence (function, 61-66): **move** to `packages/cli/src/repository/detect.ts` `extensionEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- contentEvidence (function, 68-77): **move** to `packages/cli/src/repository/detect.ts` `contentEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- evidenceFor (function, 79-90): **move** to `packages/cli/src/repository/detect.ts` `evidenceFor`. Moves to repository/detect.ts; LIF-009; not exported.
- evidenceReaders (const, 92-101): **move** to `packages/cli/src/repository/detect.ts` `evidenceReaders`. Moves to repository/detect.ts (LIF-009): a module value, a list of this file's functions; not exported.
- filenameEvidence (function, 103-107): **move** to `packages/cli/src/repository/detect.ts` `filenameEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- projectEvidence (function, 110-116): **move** to `packages/cli/src/repository/detect.ts` `projectEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- dependencyEvidence (function, 118-126): **move** to `packages/cli/src/repository/detect.ts` `dependencyEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- shebangEvidence (function, 128-131): **move** to `packages/cli/src/repository/detect.ts` `shebangEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- runtimeEvidence (function, 133-137): **move** to `packages/cli/src/repository/detect.ts` `runtimeEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- pathEvidence (function, 139-144): **move** to `packages/cli/src/repository/detect.ts` `pathEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- tagEvidence (function, 146-149): **move** to `packages/cli/src/repository/detect.ts` `tagEvidence`. Moves to repository/detect.ts; LIF-009; not exported.
- detectConfigurations (function exported, 160-181): **move** to `packages/cli/src/repository/detect.ts` `detectConfigurations`. Moves to repository/detect.ts (LIF-009) with the configuration detection.
- detectConditions (function exported, 190-203): **move** to `packages/cli/src/repository/detect.ts` `detectConditions`. Moves to repository/detect.ts (LIF-009).
- detectUnselected (function exported, 214-229): **delete**. Delete (PLR-005): no production caller; doctor does the same filter, and tests use detectConfigurations or doctor output.

## `packages/cli/src/repository/selection/public.ts`

- effectiveOwners (function, 10-19): **move** to `packages/cli/src/repository/select.ts` `addPluginExtensions`. Moves to repository/select.ts as addPluginExtensions; glossary ("effective" is filler; "owners" become "covers"); it adds the selected Prettier and ESLint plugin extensions; not exported.
- isOwned (function exported, 27-32): **move** to `packages/cli/src/repository/select.ts` `isCovered`. Moves to repository/select.ts as isCovered; NMS-010; glossary (covers); first rename the local isCovered in policy/settings/contracts.ts to applies.
- ownedBy (function exported, 43-66): **move** to `packages/cli/src/repository/select.ts` `coveredBy`. Moves to repository/select.ts as coveredBy; NMS-010; glossary; PLR-035 (matchers built once per table).
- migrationFiles (function exported, 77-93): **move** to `packages/cli/src/checks/database/postgres/migrations.ts` `migrationFiles`. Moves to the Postgres migrations check (PLR-037): planning stops calling it after LIF-035. Values to config: POSTGRES_CONFIGURATION = 'postgres' -&gt; packages/cli/src/config/checks/database.ts; SQL_EXTENSION = '.sql' -&gt; packages/cli/src/config/repository/inventory.ts
- ownersOf (function exported, 103-105): **inline** to `packages/cli/src/commands/explain/command.ts` `buildPathReport`. Inline into buildPathReport (NMS-010): a wrapper with one caller, a one-line filter over coveredBy that only explain's path report uses.
- selectForScope (function exported, 117-145): **move** to `packages/cli/src/repository/select.ts` `selectForScope`. Moves to repository/select.ts (LIF-009).
- fileDeclarations (function exported, 153-173): **move** to `packages/cli/src/repository/select.ts` `fileDeclarations`. Moves to repository/select.ts (LIF-009); CFR-005: the written-declarations parameter goes, so it returns only the generated paths of the configurations each scope selects.

## `packages/cli/src/types/platform/assets.ts`

- PinnedDownload (type exported, 2-2): **delete**. Delete (SCR-006, SCR-010): downloadPinnedFile takes two strings, so the build-only type has no use.

## `packages/cli/src/types/platform/git.ts`

- GitDiscovery (type exported, 3-7): **delete**. Delete (PLR-012): no generator.
- GitEnvironment (type exported, 9-9): **move** to `packages/cli/src/types/system/git.ts` `GitEnvironment`. Moves to types/system/git.ts with the Git types (platform becomes system); gitEnvironment returns it, and tools/run.ts calls gitEnvironment (PLR-012).
- GitRepository (type exported, 11-11): **move** to `packages/cli/src/types/system/git.ts` `GitRepository`. Moves to types/system/git.ts with the Git types (platform becomes system); one user file.
- GitSource (type exported, 13-13): **move** to `packages/cli/src/types/system/git.ts` `GitSource`. Moves to types/system/git.ts with the Git types (platform becomes system); one user file.
- GitTargetEnvironment (type exported, 15-19): **move** to `packages/cli/src/types/system/git.ts` `GitTargetEnvironment`. Moves to types/system/git.ts with the Git types (platform becomes system); one user file.

## `packages/cli/src/types/platform/managed-blocks.ts`

- BlockSpan (type exported, 3-3): **move** to `packages/cli/src/types/system/managed-blocks.ts` `BlockSpan`. Moves to types/system/managed-blocks.ts, the current file under the new folder name (platform becomes system).
- BlockStyle (type exported, 5-5): **move** to `packages/cli/src/types/system/managed-blocks.ts` `BlockStyle`. Moves to types/system/managed-blocks.ts (platform becomes system); it derives from BLOCK_STYLES in config/.
- BlockMarkers (type exported, 8-8): **delete**. Delete: dead: its only user is the annotation of MARKERS, and MARKERS (config/) may not import types/.
- BlockContext (type exported, 11-11): **move** to `packages/cli/src/types/system/managed-blocks.ts` `BlockContext`. Moves to types/system/managed-blocks.ts, the current file under the new folder name (platform becomes system).

## `packages/cli/src/types/platform/paths.ts`

- GlobOptions (type exported, 2-6): **delete**. Delete (PLR-004): the glob scan code it describes goes.
- GlobScan (type exported, 9-14): **delete**. Delete (PLR-004): the glob scan code it describes goes.
- GlobQuery (type exported, 17-17): **delete**. Delete (PLR-004): the glob scan code it describes goes.
- DirectoryEntry (type exported, 20-20): **move** to `packages/cli/src/types/checks/general.ts` `DirectoryEntry`. Moves to types/checks/general.ts: the check types are few, so there is one file per configuration group; one user, directoryTree.
- PathEntry (type exported, 23-23): **inline** to `packages/cli/src/checks/general/structure/source-files.ts` `directoryTree`. Inline into directoryTree in checks/general/structure/source-files.ts; one-line type of directoryTree's parameter ({ path: string }).

## `packages/cli/src/types/platform/reads.ts`

- MemoKey (type exported, 2-2): **move** to `packages/cli/src/types/system/files.ts` `MemoKey`. Moves to types/system/files.ts, the one topic file of the run cache and scratch folder types (types/platform/reads.ts and scratch.ts merge).
- ReadCache (type exported, 5-9): **move** to `packages/cli/src/types/system/files.ts` `ReadCache`. Moves to types/system/files.ts, the one topic file of the run cache and scratch folder types (types/platform/reads.ts and scratch.ts merge).

## `packages/cli/src/types/platform/root.ts`

- FileCopy (type exported, 4-4): **move** to `packages/cli/src/types/system/safe-folder.ts` `FileCopy`. Moves to types/system/safe-folder.ts, which replaces types/platform/root.ts; 21 users from ownership/ up.
- StagedFile (type exported, 6-6): **delete**. Delete (LIF-004): no staged writes are left.
- PathFormat (type exported, 8-8): **move** to `packages/cli/src/types/system/safe-folder.ts` `PathFormat`. Moves to types/system/safe-folder.ts, which replaces types/platform/root.ts; NMS-006: the value 'native' becomes 'system'.
- Bounds (type exported, 10-15): **move** to `packages/cli/src/types/system/safe-folder.ts` `SafeFolderState`. Moves to types/system/safe-folder.ts as SafeFolderState (PLR-008); its claims field becomes locks.
- Root (type exported, 17-52): **move** to `packages/cli/src/types/system/safe-folder.ts` `SafeFolder`. Moves to types/system/safe-folder.ts as SafeFolder (PLR-008); PLR-009: no link; PLR-028: no assertInside; LIF-004: no writeAll; lock instead of claim.
- PlannedFiles (type exported, 54-54): **move** to `packages/cli/src/types/system/safe-folder.ts` `PlannedFiles`. Moves to types/system/safe-folder.ts, which replaces types/platform/root.ts; users validateCopy and the ownership log.
- Staging (type exported, 56-56): **delete**. Delete: padding: it only carried four values to commitStaged, which is inlined into replaceEntry.

## `packages/cli/src/types/platform/runtime.ts`

- ErrorCode (type exported, 12-23): **move** to `packages/cli/src/types/errors.ts` `ErrorCode`. Moves to types/errors.ts with the types of the generic errors module; NMU-032: selection splits into arguments, git and files, and policy becomes settings.
- SpawnResult (type exported, 25-34): **move** to `packages/cli/src/types/system/processes.ts` `SpawnResult`. Moves to types/system/processes.ts with the spawn types, out of the types/platform/runtime.ts grab bag.
- SpawnOptions (type exported, 36-41): **move** to `packages/cli/src/types/system/processes.ts` `SpawnOptions`. Moves to types/system/processes.ts with the spawn types, out of the types/platform/runtime.ts grab bag.
- AsyncSpawnOptions (type exported, 43-47): **move** to `packages/cli/src/types/system/processes.ts` `AsyncSpawnOptions`. Moves to types/system/processes.ts with the spawn types, out of the types/platform/runtime.ts grab bag.
- GitOptions (type exported, 50-50): **move** to `packages/cli/src/types/system/git.ts` `GitOptions`. Moves to types/system/git.ts beside the other Git types; PLR-041: no timeoutMs override.
- ProcessTermination (type exported, 52-56): **move** to `packages/cli/src/types/system/processes.ts` `ProcessTermination`. Moves to types/system/processes.ts with the spawn types, out of the types/platform/runtime.ts grab bag; one user file.
- BinarySpawnResult (type exported, 58-58): **move** to `packages/cli/src/types/system/processes.ts` `ByteSpawnResult`. Moves to types/system/processes.ts as ByteSpawnResult (NMS-003) with the spawn types.
- SpawnCompletion (type exported, 61-64): **move** to `packages/cli/src/types/system/processes.ts` `SpawnCompletion`. Moves to types/system/processes.ts with the spawn types, out of the types/platform/runtime.ts grab bag; one user file.
- Defined (type exported, 66-66): **move** to `packages/cli/src/types/objects.ts` `Defined`. Moves to types/objects.ts with the types of the generic objects module, beside compact; types of configurations and checks also use it (PAR-006 deletes the other users).
- StdoutRead (type exported, 69-69): **move** to `packages/cli/src/types/system/processes.ts` `StdoutRead`. Moves to types/system/processes.ts with the spawn types; PLR-043: no 'base64'.

## `packages/cli/src/types/platform/scratch.ts`

- ScratchFolder (type exported, 2-2): **move** to `packages/cli/src/types/system/files.ts` `ScratchFolder`. Moves to types/system/files.ts, the one topic file of the run cache and scratch folder types; scratch.ts held one item.

## `packages/cli/src/types/repository/inventory.ts`

- PathIgnore (type exported, 10-10): **keep** to `packages/cli/src/types/repository/inventory.ts` `PathIgnore`. Stays in types/repository/inventory.ts, the repository read and tooling types; one user file.
- PathExpressions (type exported, 12-12): **keep** to `packages/cli/src/types/repository/inventory.ts` `PathExpressions`. Stays in types/repository/inventory.ts, the repository read and tooling types; users pathExpressions and the ESLint generation types, and types/generation/eslint.ts imports it.
- RawEntry (type exported, 14-14): **rename** to `packages/cli/src/types/repository/inventory.ts` `FileEntry`. Renamed FileEntry (PLR names table); stays in types/repository/inventory.ts, the repository read and tooling types.
- TrackedFile (type exported, 16-25): **keep** to `packages/cli/src/types/repository/inventory.ts` `TrackedFile`. Stays in types/repository/inventory.ts, the repository read and tooling types; PLR-006: no prefix field; classifyFile builds it.
- Repository (type exported, 27-34): **keep** to `packages/cli/src/types/repository/inventory.ts` `Repository`. Stays in types/repository/inventory.ts, the repository read and tooling types, beside readRepository's other types.
- Tagged (type exported, 36-36): **keep** to `packages/cli/src/types/repository/inventory.ts` `Tagged`. Stays in types/repository/inventory.ts, the repository read and tooling types.
- FileKind (type exported, 38-38): **keep** to `packages/cli/src/types/repository/inventory.ts` `FileKind`. Stays in types/repository/inventory.ts: TrackedFile needs it, and types/ may not import a schema, so it is (typeof FILE_KINDS)\[number\] from the config list, not z.infer of fileKindSchema.
- FileDeclaration (type exported, 41-43): **move** to `packages/cli/src/types/repository/inventory.ts` `FileDeclaration`. Stays in types/repository/inventory.ts as a plain type with no schema (CFR-005): only the configuration form is left, { kind: 'generated'; configuration: string; paths: string\[\] }, and generatedSchema and vendoredSchema go.
- Verdict (type exported, 45-45): **rename** to `packages/cli/src/types/repository/inventory.ts` `FileClassification`. Renamed FileClassification (NMS-018); stays in types/repository/inventory.ts, the repository read and tooling types.
- Runner (type exported, 48-48): **delete**. Delete (INX-003): its users (Tooling.runner and the runner parameters of detectedNpmClient and selectNpmClient) go with the runner setting; where a type is needed, (typeof RUNNER_NAMES)\[number\] is written in types/.
- Tooling (type exported, 50-64): **keep** to `packages/cli/src/types/repository/inventory.ts` `Tooling`. Stays in types/repository/inventory.ts, the repository read and tooling types; INX-003: the runner and runnerFile fields go.
- ScopeEntry (type exported, 66-71): **keep** to `packages/cli/src/types/repository/inventory.ts` `ScopeEntry`. Stays in types/repository/inventory.ts, the repository read and tooling types, beside buildScope's other types.
- ToolFile (type exported, 73-79): **rename** to `packages/cli/src/types/repository/inventory.ts` `FoundToolFile`. Renamed FoundToolFile (NMS-003): a tool file found in the repository, not one gspot writes; stays in types/repository/inventory.ts.
- ModuleContext (type exported, 82-82): **delete**. Delete (PLR-038; CKG-010): modulePath goes.
- RunnerSelection (type exported, 85-85): **delete**. Delete (INX-003): its one user detectRunner is deleted.
- ContentPrefix (type exported, 87-87): **keep** to `packages/cli/src/types/repository/inventory.ts` `ContentPrefix`. Stays in types/repository/inventory.ts, the repository read and tooling types; one user, sniff.
- DirectoryContents (type exported, 89-89): **keep** to `packages/cli/src/types/repository/inventory.ts` `DirectoryContents`. Stays in types/repository/inventory.ts, the repository read and tooling types; one user file.
- PendingDirectory (type exported, 91-91): **keep** to `packages/cli/src/types/repository/inventory.ts` `PendingDirectory`. Stays in types/repository/inventory.ts, the repository read and tooling types; one user file.
- FileClassification (type exported, 94-94): **delete**. Delete (PLR-036): kindOf takes classifyFile's arguments, so this argument bundle goes; its name moves to the result type (NMS-018).
- FileClassificationRules (type exported, 97-97): **move** to `packages/cli/src/types/repository/inventory.ts` `FileClassificationRules`. Stays in types/repository/inventory.ts: every exported type is written by hand in types/, and FileDeclaration is a plain type there.
- Layout (type exported, 100-107): **rename** to `packages/cli/src/types/repository/inventory.ts` `ScopeContents`. Renamed ScopeContents (PLR-014); stays in types/repository/inventory.ts.

## `packages/cli/src/types/repository/revisions.ts`

- Revision (type exported, 1-1): **keep** to `packages/cli/src/types/repository/revisions.ts` `Revision`. Stays in types/repository/revisions.ts with the revision types.
- PushRevision (type exported, 3-10): **keep** to `packages/cli/src/types/repository/revisions.ts` `PushRevision`. Stays in types/repository/revisions.ts with the revision types.
- PushSelection (type exported, 12-15): **keep** to `packages/cli/src/types/repository/revisions.ts` `PushSelection`. Stays in types/repository/revisions.ts with the revision types.
- PushLine (type exported, 17-17): **keep** to `packages/cli/src/types/repository/revisions.ts` `PushLine`. Stays in types/repository/revisions.ts with the revision types; one user file.
- PushInput (type exported, 20-20): **keep** to `packages/cli/src/types/repository/revisions.ts` `PushInput`. Stays in types/repository/revisions.ts: the pre-push input that selectPush reads; types/commands/check.ts and types/execution/reproduce.ts import it.
- Comparison (type exported, 22-22): **keep** to `packages/cli/src/types/repository/revisions.ts` `Comparison`. Stays in types/repository/revisions.ts with the revision types; one user file.
- PushSearch (type exported, 24-30): **keep** to `packages/cli/src/types/repository/revisions.ts` `PushSearch`. Stays in types/repository/revisions.ts with the revision types; one user file.
- ChangedPaths (type exported, 32-32): **keep** to `packages/cli/src/types/repository/revisions.ts` `ChangedPaths`. Stays in types/repository/revisions.ts with the revision types, beside readChangedPaths.
- StagedPaths (type exported, 34-34): **keep** to `packages/cli/src/types/repository/revisions.ts` `StagedPaths`. Stays in types/repository/revisions.ts with the revision types, beside readStagedPaths.
- CommitSelection (type exported, 37-37): **keep** to `packages/cli/src/types/repository/revisions.ts` `CommitSelection`. Stays in types/repository/revisions.ts with the revision types; one user, pushedCommits.
