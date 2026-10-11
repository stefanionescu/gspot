# The machine (system) and the repository

`packages/cli/src/platform/` is the bottom layer of the CLI: it starts other programs, runs Git, reads and writes files
only inside one folder (the safe folder), and finds gspot's own package files. `packages/cli/src/repository/` builds the
list of files in the user's repository, gives each file a kind and tags, finds scopes, hooks and CI files, and reads
staged, changed and pushed revisions from Git. The target: `platform/` becomes `src/system/` ("platform" stays only the
name of the Cloudflare and Supabase configuration group), every `public.ts` and `contracts.ts` grab bag splits into topic
files with plain names, and generic code that is not about the machine (`errors.ts`, `objects.ts`, `text.ts`) moves up
to `src/`. Constants go to `config/` topic files, types to `types/`, and wrappers, dead code and guards for impossible
states go.

## Findings

### PLR-002: `public.ts` and `contracts.ts` grab bags hide about 25 topics

- Where: `packages/cli/src/platform/{public,contracts}.ts`, `platform/git/{public,contracts}.ts`,
  `platform/root/{public,contracts}.ts`, `repository/{public,contracts}.ts`,
  `repository/{discovery,paths,revisions,selection}/{public,contracts}.ts`
- Kind: move
- Problem: The file names say nothing. `platform/contracts.ts` holds path functions, object functions, text functions,
  hashing and argument quoting. `platform/root/contracts.ts` holds a glob engine, a file mode compare, path safety rules
  and managed-block text editing. `repository/paths/contracts.ts` holds scopes, not paths.
  `repository/selection/contracts.ts` holds detection, and its own first line says "Detection never selects". The split
  between `public` and `contracts` follows no rule: `runGitBlocking` (6 callers) is in `git/contracts.ts` and `runGit` in
  `git/public.ts`; `readRepository` is in `repository/public.ts` and `trackedEntries` in `repository/contracts.ts`.
  Nobody can guess where a function lives. Commit `9a3851a9a` built these files from about 25 topic files whose exports
  mapped one to one onto topics.
- Fix: Split them into topic files with plain names, as "Layout" lists. No behavior change; update the imports. The unit
  tests take the same topic names under `tests/unit/cli/system/` and `tests/unit/cli/repository/`.
- Size: large

### PLR-003: The internal folder name `platform` clashes with the configuration group `platform`

- Where: `packages/cli/src/platform/`, `config/platform/`, `types/platform/`, `tests/cli/platform/`,
  `tests/config/cli/platform/`; against `packages/cli/configurations/platform/{cloudflare,supabase}`,
  `src/checks/platform/`, `src/config/checks/platform/`, `.gspot/rules/platform/`, `tests/cli/checks/platform/`,
  `src/parsers/schema/configurations.ts:258`
- Kind: rename
- Problem: One word has two unrelated meanings. A newcomer looking for Cloudflare code opens `src/platform/` and finds
  process spawning. Inside the folder the word also means "operating system" (`hostPlatform()`,
  `fileMode(file, platform)`, `toPlatform(path)`, comments such as "the platform's form"); 119 lines in this part use
  it. `tests/harness/platforms.ts` adds a third meaning (what this machine can run), and `gspot.toml:149-151` names the
  architecture module `platform`.
- Fix: Keep `platform` for the Cloudflare and Supabase configuration group (it is in manifests, docs and shipped rule
  paths). Rename the internal layer: `src/platform/` to `src/system/`, `config/platform/` to `config/system/`,
  `types/platform/` to `types/system/`, this repository's `[[architecture.module]]` named `platform` to `system`, and the
  tests to `tests/unit/cli/system/` with their data in `tests/config/system.ts`. Rename `hostPlatform()` to
  `currentOperatingSystem()`, `toPlatform()` to `toSystemPath()`, `nativeSegments()` to `systemSegments()`, and the
  `PathFormat` value `'native'` to `'system'`. The `platform` parameter of `fileMode` goes (PLR-011).
  `tests/harness/platforms.ts` becomes `tests/setup/operating-systems.ts`. Comments say "operating system".
- Size: large

### PLR-004: `globPaths` carries about 70 lines of link and folder options that only tests use

- Where: `packages/cli/src/platform/root/contracts.ts:15-138`, `packages/cli/src/types/platform/paths.ts:1-17`,
  `tests/cli/platform/globs.test.ts`
- Kind: simplify
- Problem: `globPaths` wraps Node's `fs.globSync` in a 120-line engine with the options `dot`, `onlyFiles` and
  `followSymlinks`, a map of visited real paths, a duplicate-target check, link-prefix checks, and extra "hidden folder"
  queries. All three production callers (`checks/general/docs.ts:138`, `checks/general/generated-code.ts:46`,
  `listAssets`) use `{ dot: true }` and nothing else, so `followSymlinks: true`, `onlyFiles: false` and `dot: false` are
  reached only by tests. Its comments are jargon ("Native globstar queries apply exclusion callbacks on the supported
  Node 24.2 floor").
- Fix: Replace the engine with one plain walk built on `listFolderFiles` (PLR-020) in `system/files.ts`: start at each
  pattern's fixed folder (the part before the first wildcard, `picomatch.scan(pattern).base`), never follow links,
  include dot files, skip folders whose whole content a `!folder/**` pattern excludes, and keep the files that
  `picomatch(patterns, { dot: true })` matches. Keep `assertInsideFolder`. Delete the options, `GlobOptions`,
  `GlobScan`, `GlobQuery`, `selectLiteral`, `patternPrefix`, `scanFolders`, `scanPattern`, and the test cases for the
  removed options. The glob syntax values (`GLOB_EXCLUDE`, `FOLDER_CONTENTS`) go to `config/system/paths.ts`. Starting
  at the fixed folder matters: `checks/general/docs.ts:138` globs the files of one folder under a scope from the
  repository root, and a walk from the root would read every folder, `node_modules` included.
- Size: medium

### PLR-005: `detectUnselected` has no production caller and repeats code in doctor

- Where: `packages/cli/src/repository/selection/contracts.ts:205-229`,
  `packages/cli/src/commands/doctor/contracts.ts:66-68`
- Kind: delete
- Problem: No production code calls `detectUnselected`. Doctor does the same filter and map inline
  (`detected.filter((entry) => entry.kind !== 'general' && !selected.has(entry.configuration))`). Three test files
  (`tests/cli/checks/library/swift-snapshot-testing.test.ts:136`, `tests/cli/configurations/detect.test.ts`,
  `tests/cli/repository/package-manifests.test.ts:175`) test the unused copy, not the code users run. knip does not
  report it, because `knip.json` makes every test file an entry point.
- Fix: Delete `detectUnselected`. The three tests use `detectConfigurations` or doctor's `detected` rows.
- Size: small

### PLR-006: Every tracked file keeps its first 4 KB in memory, and nothing reads it

- Where: `packages/cli/src/types/repository/inventory.ts:18`, `packages/cli/src/repository/public.ts:43-55,146`,
  `packages/cli/src/planning/files.ts:113`, `packages/cli/src/commands/public.ts:172`, `tests/harness/tracked.ts:13`
- Kind: delete
- Problem: `TrackedFile.prefix: Buffer` stores up to `FILE_PREFIX_BYTES` (4096) bytes per file. The bytes are needed only
  while the file is classified; after that no code reads the field. In a repository with 50,000 files that is up to
  200 MB held for the whole run.
- Fix: Remove `prefix` from `TrackedFile`. `classifyFile` takes the prefix as an argument (PLR-036), so `readRepository`
  and `planning/files.ts` keep it as a local value. Drop it from `commands/public.ts:172`, `tests/harness/tracked.ts:13`
  and `tests/cli/parsers/tree-sitter.test.ts:127`. Doctor reads the few tool files it needs itself.
- Size: small

### PLR-008: The safe-folder object is called `Root`, but 48 callers name it `files`

- Where: `packages/cli/src/types/platform/root.ts:17-52`, `platform/root/public.ts:186,237`, the folder
  `platform/root/`, and 25 `openRoot(` call sites
- Kind: rename
- Problem: `openRoot(path)` returns an object that reads and writes files only inside one folder and refuses links and
  unsafe names. Callers invent their own names for it: `files` 48 times, `root` 6 times, and `installed`,
  `destination`, `boundary`, `owner`, `source`, `directory`, `authored`, `first`, `second`. Many functions then take
  both `files: Root` and `root: string` (for example `installedPackage(files, root, ...)` in
  `repository/contracts.ts:296`), which reads as nonsense, because "root" already means the repository folder. "Root"
  also names the scope at path `''` (`ROOT_SCOPE`), the folder gspot is installed in (`packageRoot`,
  `ROOT_SEARCH_DEPTH`), and Git's first commit.
- Fix: Rename the type `Root` to `SafeFolder`, `openRoot` to `openSafeFolder`, `walkRoot` to `walkSafeFolder`, the folder
  `platform/root/` to `system/safe-folder/` (`open.ts`, `names.ts`, `reads.ts`, `writes.ts`, `lock.ts`), and the
  internal `Bounds` to `SafeFolderState`; `boundsOf`, its one-caller constructor, moves into `openSafeFolder`. Keep the
  variable name `files`. Rename `packageRoot` to `packageFolder`, the cached `packageDirectory` to
  `cachedPackageFolder`, and `ROOT_SEARCH_DEPTH` to `PACKAGE_SEARCH_DEPTH` (S06-013).
- Size: medium

### PLR-009: `Root.link` is never called

- Where: `packages/cli/src/types/platform/root.ts:36-37`, `packages/cli/src/platform/root/public.ts:213-215`
- Kind: delete
- Problem: The method exists on every safe-folder object but has no caller. The ownership code writes links through
  `write`, which stages links itself (`writes.ts:136-140`).
- Fix: Delete `link` from `SafeFolder` and from `openSafeFolder`.
- Size: small

### PLR-010: `findRoot` can miss the Git top level when the start path goes through a link

- Where: `packages/cli/src/repository/discovery/contracts.ts:89-103`, `packages/cli/src/commands/public.ts:214-216`
- Kind: fix-bug
- Problem: `findRoot` walks up from `resolve(start)` and stops when `current === gitRoot`. `gitRoot` comes from
  `git rev-parse --show-toplevel`, which prints the real path, without links. `start` can go through a link (on macOS,
  `/tmp` and the temporary folders under `/var/folders` are links into `/private`) or hold short (8.3) folder names on
  Windows. Then the two never compare equal: without a `gspot.toml`, the function returns the start folder instead of
  the Git top level (its own doc says it uses the top level), and with a `gspot.toml` in a folder above the repository
  it picks that one. `scratchFolder` already calls `realpathSync.native` for this reason.
- Fix: In `repository/find-root.ts`, start from `realPath(start)` (today `canonicalPath`) instead of `resolve(start)`.
  No new test is planned; the untested-logic rule decides after the cut whether this case gets one.
- Size: small

### PLR-011: `fileMode` has a `platform` parameter only for one test, and the test setup copies the function

- Where: `packages/cli/src/platform/root/contracts.ts:146-150`, `tests/cli/platform/root.test.ts:155-174`,
  `tests/harness/platforms.ts` (`getKeptMode`)
- Kind: delete
- Problem: Production calls `fileMode(file)` 5 times and never gives `platform`. Only `root.test.ts` gives `'win32'`,
  `'darwin'` and `'linux'` to fake another operating system: an option for one caller. Separately, `getKeptMode` in the
  test harness writes the same Windows rule again (`(mode & 0o200) === 0 ? 0o444 : 0o666`), and 14 test files use it.
- Fix: Remove the `platform` parameter of `fileMode` (in `system/safe-folder/reads.ts`). Delete the fake-OS test at
  `root.test.ts:155-174`; Windows CI covers the real Windows branch. Delete `getKeptMode` and import `fileMode` in its
  14 test files: one copy of the Windows mode rule is enough, and these tests check that a mode is kept, not the rule
  itself.
- Size: small

### PLR-012: Git environment isolation uses a generator with two driver loops and asks Git again before every command

- Where: `packages/cli/src/platform/git/contracts.ts:36-177`, `packages/cli/src/types/platform/git.ts`,
  `packages/cli/src/config/platform/git.ts`, `packages/cli/src/tools/contracts.ts:334`
- Kind: simplify
- Problem: When gspot runs inside a Git hook, Git sets `GIT_DIR`, `GIT_INDEX_FILE` and similar variables. The code
  removes or keeps them per command, after up to four `git rev-parse` calls. To share this between the async `runGit`
  and the blocking `runGitBlocking`, it is written as a generator (`Generator<GitDiscovery, GitEnvironment, SpawnResult>`) with two copies of the driver loop (`getGitEnvironment` lines 142-155, `runGitBlocking` lines
  164-177). Few readers understand it. Inside a hook, the `rev-parse` calls also run again before every Git command and
  every tool run (`runTool` calls `getGitEnvironment`), although the inherited variables and the starting folder never
  change during a run. Outside a hook the function returns at once.
- Fix: Make the `rev-parse` calls plain blocking calls (`runBlocking`; they are short). One function
  `gitEnvironment(root, argv, explicit)` in `system/git.ts` then serves `runGit`, `runGitBlocking` and `runTool`
  (`tools/run.ts`); `getGitEnvironment` merges into it. Delete the generator, `GitDiscovery` and the second loop. Compute
  the source-repository part (`--local-env-vars` and `sourceGitEnvironment`) once per process. The Git arguments and
  `GIT_LOCALE` go to `config/system/git.ts`. `'git.exe'` and `'init'` go (PLR-025).
- Size: medium

### PLR-013: The lefthook file list is built by slicing three constants; it is a plain cross product

- Where: `packages/cli/src/repository/discovery/public.ts:175-188`, `packages/cli/src/config/repository/hooks.ts:3-7`
- Kind: simplify
- Problem: `getHooks` builds lefthook file names with `LEFTHOOK_EXTENSIONS.slice(0, LEFTHOOK_YAML_EXTENSION_COUNT)`,
  `LEFTHOOK_PREFIXES.slice(0, -1)`, a separate `LEFTHOOK_CONFIG_PREFIX` loop and
  `.slice(LEFTHOOK_YAML_EXTENSION_COUNT)`. Together the parts are every name × every extension × every prefix (the same
  30 names), but nobody can see that by reading.
- Fix: In `readHooks` (today `getHooks`), write
  ``LEFTHOOK_NAMES.flatMap((name) => LEFTHOOK_EXTENSIONS.flatMap((extension) => LEFTHOOK_PREFIXES.map((prefix) => `${prefix}${name}.${extension}`)))``.
  Delete `LEFTHOOK_YAML_EXTENSION_COUNT` and `LEFTHOOK_CONFIG_PREFIX` (write `'.config/'` in `LEFTHOOK_PREFIXES`).
- Size: small

### PLR-014: Look-alike names with different jobs: `inScope`/`isInScope` and `expandPaths`/`expandedPaths`

- Where: `packages/cli/src/repository/paths/public.ts:51,82,175,185`, `packages/cli/src/platform/contracts.ts:174`
- Kind: rename
- Problem: `inScope(scope, path)` joins a scope and a path; `isInScope(path, scope)` tests containment, with the
  arguments in the opposite order. `expandPaths(paths)` adds every parent folder; `expandedPaths(patterns)` adds `/**`
  after each literal folder. Same stem, unrelated jobs.
- Fix: Rename `inScope` to `joinScope(scope, path)` and `fromScope` to `relativeToScope(scope, path)` (both in
  `repository/scopes.ts`), `expandPaths` to `includeParentFolders` (`system/paths.ts`), and `expandedPaths` to
  `includeFolderContents` (`repository/selectors.ts`). Keep `isInScope`.
- Size: small

### PLR-016: Comment debris from the merge, and file headers that describe the wrong file

- Where: `packages/cli/src/repository/revisions/public.ts:1-3,105`, `repository/revisions/contracts.ts:1-3`,
  `platform/public.ts:1,32,66-67,284-285`, `platform/root/public.ts:54-56,246`, `repository/public.ts:41,56`
- Kind: rewrite-text
- Problem: `revisions/public.ts` and `revisions/contracts.ts` start with the same two header lines; the second ("The
  revisions a push sends...") is wrong for `public.ts`. Section headers left from merged files float between functions
  ("// Read immutable Git entries and objects ...", "// Reading the bytes of a repository file ..."). `platform/public.ts`
  says "Reads the host and process environment" but mostly runs programs. Some comments are cut from their function by a
  blank line. `repository/public.ts` puts its header after the imports. The `GspotError` comment says "Other errors use
  the `gspot stopped` prefix", which is about other code.
- Fix: With the split of PLR-002, each topic file gets one true first-line comment. Delete the floating section headers,
  the duplicate header and the `GspotError` remark about other code, and join each comment to its function.
- Size: small

### PLR-020: Four separate folder walkers

- Where: `packages/cli/src/repository/contracts.ts:117-136` (`walkPaths`), `platform/root/public.ts:237-244`
  (`walkRoot`), `platform/scratch.ts:28-34` (`scratchEntries`), `platform/root/contracts.ts:50-101` (the glob engine)
- Kind: merge
- Problem: Four functions "visit every file under a folder". `scratchEntries` has one user
  (`checks/general/site/contracts.ts:81`), and the glob engine is PLR-004.
- Fix: `scratchEntries` becomes the one plain walker `listFolderFiles(folder, skipFolder?)` in `system/files.ts` (no
  link following, dot files included); the site check and `globPaths` use it. Keep `walkSafeFolder`, which goes through
  the safe-folder checks, and `walkPaths` (in `repository/tracked.ts`), which applies `.gitignore` rules per folder for a
  folder without Git (PLR-024).
- Size: medium

### PLR-021: Lists of third-party folders have names that hide their different jobs

- Where: `packages/cli/src/config/repository/inventory.ts:4-12` (`DEPENDENCY_FOLDERS`), `:33-41`
  (`VENDORED_DIRECTORIES`), `packages/cli/src/config/execution/copy.ts:9` (`SCRATCH_DIRECTORIES`),
  `packages/cli/src/repository/paths/public.ts:134` (`'node_modules'` written inline)
- Kind: rename
- Problem: `node_modules`, `Pods` and `.build` appear in both inventory lists, and `.venv` in two lists. The lists answer
  different questions, but the names do not say so. `DEPENDENCY_FOLDERS` names folders a package manager installs
  (gspot does not follow links inside them, and the structure checks skip them). `VENDORED_DIRECTORIES` names folders of
  third-party code committed to the repository (files there are classified "vendored"). `SCRATCH_DIRECTORIES` names the
  installed folders the copy step carries into a scratch copy. Only the inline `'node_modules'` in `isToolingPath`
  repeats a list.
- Fix: Rename `DEPENDENCY_FOLDERS` to `INSTALLED_DEPENDENCY_FOLDERS` (in `config/repository/tracked.ts`) and
  `VENDORED_DIRECTORIES` to `VENDORED_FOLDERS` (in `config/repository/inventory.ts`). `isToolingPath` uses
  `INSTALLED_DEPENDENCY_FOLDERS` instead of the inline string. Do not merge the two: links under `vendor/` and
  `third_party/` would stop being listed, and tracked files under `venv/` or `DerivedData/` would become vendored. The
  copy list holds only `node_modules` and merges into `NODE_MODULES` in `config/repository/tracked.ts` (EXG-055).
- Size: small

### PLR-023: `trackedEntries` also returns untracked files, and its optional inputs are never left out

- Where: `packages/cli/src/repository/contracts.ts:195-234`
- Kind: rename
- Problem: The name says "tracked", and the doc says "Tracked and about-to-be-tracked files"; the function adds
  `git ls-files --others`. Both callers (`repository/public.ts:136`, `checks/general/contracts.ts:30`) give `exclude` and
  the index, so the defaults `exclude = []` and `indexEntries?` (with a fallback read "for standalone discovery") never
  run.
- Fix: Rename it `listRepositoryFiles(root, index)` in `repository/tracked.ts`. Delete the `exclude` parameter (the root
  `exclude` setting goes, TMF-003), make `index` required, and delete the fallback `?? await readIndexEntries(root)`.
  Its Git arguments are `UNTRACKED_FILES_ARGV` in `config/repository/tracked.ts`.
- Size: small

### PLR-024: Reading the file list asks Git the same question up to five times

- Where: `packages/cli/src/repository/contracts.ts:139-150` (`listGitFiles`), `repository/public.ts:135-139`
- Kind: simplify
- Problem: `readRepository` calls `readIndexEntries` (`git ls-files`), then `trackedEntries` (`ls-files --others`), then
  `isGitRepository` (`rev-parse`). In a folder without Git, each failed `ls-files` also runs `inspectWorkTree`
  (`rev-parse`) and walks every parent folder looking for `.git`. `listGitFiles` carries a failure-classification layer
  only because it does not know yet whether this is a Git folder. The check run (`execution/public.ts:248`) reads the
  index a second time, although the session's repository already holds it.
- Fix: Call `isGitRepository(root)` once at the start of `readRepository` (`repository/read.ts`). Without Git, use
  `walkPaths` and skip Git. With Git, run the two `ls-files` calls and throw on failure; each caller gives
  `listGitFiles` its whole argument list (`INDEX_FILES_ARGV` or `UNTRACKED_FILES_ARGV` in
  `config/repository/tracked.ts`). Keep the outside-Git branch of `listGitFiles`: `gspot export`
  (`commands/contracts.ts:210`) and the check run also call `readIndexEntries` and need an empty list outside Git. The
  check run takes the index from `opened.repository.index` instead of reading it again.
- Size: small

### PLR-025: Guards for states that cannot happen

- Where: `packages/cli/src/repository/revisions/public.ts:101,139-140`, `packages/cli/src/config/platform/git.ts:22,25`,
  `packages/cli/src/platform/git/contracts.ts`
- Kind: delete
- Problem: Each guard adds a branch and an error message for a state the code itself rules out:
    - `repository/revisions/public.ts:101`: the `first === ''` half of the check, because `gitLines` already drops empty
      lines (`platform/git/public.ts:103`).

    - `repository/revisions/public.ts:139-140`: `visitGitBlobs` checks again that hashes are full object IDs, but every
      hash comes from Git's own `ls-tree` and index output.

    - `config/platform/git.ts:22,25`: `'init'` and `'git.exe'` in `GIT_CREATION_COMMANDS` and `GIT_EXECUTABLES`.
      Production creates a repository only with `git clone` (`execution/copy/public.ts:214`), and that call uses the
      literal `'git'` as `argv[0]`.

- Fix: Delete the `first === ''` half (keep `first === undefined`), the hash check in `visitGitBlobs`, and `'init'` and
  `'git.exe'`. The Git special case becomes `argv[0] === GIT_EXECUTABLE && argv[1] === GIT_CLONE_COMMAND`, with
  `GIT_EXECUTABLE = 'git'` and `GIT_CLONE_COMMAND = 'clone'` in `config/system/git.ts`; the `argv[0]` test stays,
  because every tool run goes through this code, not only Git. Keep the `=== undefined` checks after
  `const [executable] = command` (`platform/public.ts:216,265`), after `hashes[index]`
  (`repository/revisions/contracts.ts:54`) and after `pop()` (`platform/root/reads.ts:80,99`,
  `platform/contracts.ts:157`): with `noUncheckedIndexedAccess` on and the `!` operator forbidden, they let the code
  type-check. The `wasmPath` name guard goes with INS-021.
- Size: small

### PLR-026: `getEntries` turns a string into a buffer and back into the same string

- Where: `packages/cli/src/repository/revisions/public.ts:119`
- Kind: simplify
- Problem: `Buffer.from(read.stderr).toString('utf8')`. `read.stderr` is already a string: `BinarySpawnResult` changes
  only `stdout` (`types/platform/runtime.ts:58`).
- Fix: In `listRevisionEntries` (today `getEntries`), use `read.stderr.trim()`.
- Size: small

### PLR-027: Link targets are checked twice for the same bad characters

- Where: `packages/cli/src/platform/root/reads.ts:45-49,137-154`, `packages/cli/src/config/platform/root.ts:3`
- Kind: delete
- Problem: `isUnsafeLinkTarget` tests the target with `PORTABLE_LINK_TARGET` (backslash, colon, control characters), or
  for NUL in the `'native'` path format. Then `validateRead` splits the destination into segments with
  `UNSAFE_CHARACTERS` (a superset) or the NUL check, and refuses any target that is not already normalized. Any bad
  character either stays in the destination (caught there) or disappears in normalization (refused by the
  normalization check). NUL cannot appear in a link target at all.
- Fix: Keep only "not UTF-8, empty, or absolute" in `isUnsafeLinkTarget`, and delete `PORTABLE_LINK_TARGET`.
  `validateRead` becomes `validateCopy` in `system/safe-folder/reads.ts`.
- Size: small

### PLR-028: `assertInside` is `realPath` with the result thrown away

- Where: `packages/cli/src/types/platform/root.ts:18-21`, `platform/root/public.ts:198-201`
- Kind: merge
- Problem: The two methods run the same code (`sourcePath(...)`). `assertInside` has 5 production callers
  (`checks/language/contracts.ts:69,239`, `checks/language/swift/public.ts:25`, `execution/copy/contracts.ts:152`,
  `tools/contracts.ts:65`).
- Fix: Delete `assertInside` from `SafeFolder`; its callers call `realPath` and ignore the result.
- Size: small

### PLR-029: Link modes force a macOS-only `lchmod` call and two lint suppressions

- Where: `packages/cli/src/platform/root/writes.ts:27,211-227`, `platform/root/contracts.ts:146-150`,
  `platform/root/reads.ts:28-32`, `config/repository/revisions.ts:25`
- Kind: simplify
- Problem: A symbolic link has no useful permission bits: Git records only "120000", Linux always reports 0o777, and
  Windows reports a flag. gspot still records a link's mode, compares it in `sameEntry`, and on macOS calls the
  deprecated `lchmodSync` so the mode matches. That needs two `eslint-disable` lines (`n/no-deprecated-api`,
  `@typescript-eslint/no-deprecated`) and a darwin-only branch. `fileMode` already returns a fixed value for links on
  Windows.
- Fix: `fileMode` returns `PERMISSION_BITS` for every link on every operating system. Delete the `lchmodSync` call, both
  suppressions, the darwin branch, and the `mode` parameter of `writeLink`.
- Size: small

### PLR-030: Per-OS branches in this part, and whether each is needed

- Where: the 13 branches that `git grep -nE "process\.platform|win32|darwin"` finds under `packages/cli/src/platform/`
  and `packages/cli/src/repository/`
- Kind: simplify
- Problem: This part has 13 branches for one operating system. Eleven have a reason; two do not.
- Fix: Keep or delete each branch as listed:
    - `system/executables.ts` with `EXECUTABLE_LAYOUTS` in `config/system/paths.ts` (Windows `.cmd` and `.exe`, venv
      `Scripts`): needed. The module value `systemExecutables` picks the layout once, when the module starts.

    - `missingExecutable` in `system/processes.ts` (Windows `PATHEXT`, default `PATHEXT_DEFAULT` in
      `config/system/processes.ts`): needed while the pre-check exists, because a missing file on Windows ends as exit 1,
      not "not found" (`8a6f676b3`).

    - macOS `EPERM` on an exited, unreaped process group (`platform/public.ts:107-114`): needed (`5da886f52`).
    - Windows `taskkill /T /F` and `TASKKILL_GONE_CODE` (`platform/public.ts:120-128`): needed; Windows has no process
      groups.

    - Process groups only on POSIX, and the group kill 10 ms after the leader exits (`platform/public.ts:146,169`): needed;
      the second is a deliberate workaround for Bun on macOS and stays.

    - Windows upper-case environment names (`platform/public.ts:333`): needed; code reads `env['PATH']`.
    - `fileMode` and the Windows read-only flag: needed; its test-only parameter goes (PLR-011), and links get one mode
      (PLR-029).

    - Windows uses the portable name rules (`platform/root/contracts.ts:182`): needed.
    - `mustUnlinkFirst`, because Windows cannot rename over a read-only file (`platform/root/writes.ts:104-107`): needed.
    - macOS `lchmod` (`platform/root/writes.ts:219`): not needed; it goes with PLR-029.
    - Windows reads the executable bit from the Git index (`repository/contracts.ts:215-223`): needed. On macOS and Linux
      the bit in the working tree can differ from the index (a `chmod` not yet staged), and checks read the working tree,
      so taking the bit from the index on every system would change results.

    - `'git.exe'` (`config/platform/git.ts:25`): not needed; it goes with PLR-025.
    - `realpathSync.native` in `scratchFolder` for Windows short names (`platform/scratch.ts:14`): needed.

- Size: small

### PLR-031: Exports used only by tests or by their own file

- Where: `packages/cli/src/repository/discovery/public.ts:220` (`surveyRepository`), `repository/public.ts:224`
  (`readAttributes`, 1 test user), `config/platform/managed-blocks.ts:3,5,7` (`HASH_BLOCK_END`, `HASH_BLOCK_START`,
  `MANAGED_BLOCK_END`)
- Kind: simplify
- Problem: These names are exported but have no user outside their file, or only a test. `surveyRepository` is called
  only by `getTooling` in the same file.
- Fix: Inline `surveyRepository` into `readTooling` (today `getTooling`). Write the marker constants inside `MARKERS` and
  stop exporting them. Stop exporting `readAttributes` (in `repository/read.ts`); its test checks attributes through
  `readRepository`.
- Size: small

### PLR-035: `isOwned` builds its matchers again for every file

- Where: `packages/cli/src/repository/selection/public.ts:27-32,58-65`, `repository/paths/public.ts:151-158`
- Kind: simplify
- Problem: `ownedBy` calls `isOwned` once per file (twice with languages). Each call runs
  `filenameMatcher(owners.filenames)`, which builds a new `Set`, runs `picomatch.scan` on every file-name pattern, and
  looks up `pathMatcher` by `JSON.stringify`. With thousands of files and dozens of configurations this repeats the same
  work hundreds of thousands of times.
- Fix: `coveredBy` (today `ownedBy`, in `repository/select.ts`) builds the matchers once per table of file patterns,
  then tests each file with them; `isCovered` (today `isOwned`) uses the built matchers.
- Size: small

### PLR-036: Three places build a tracked-file record

- Where: `packages/cli/src/repository/public.ts:145-156`, `packages/cli/src/planning/files.ts:105-114`,
  `packages/cli/src/commands/public.ts:168-178`
- Kind: merge
- Problem: Each place tags, classifies and assembles a `TrackedFile` by hand.
- Fix: One `classifyFile(root, entry, prefix, rules): TrackedFile` in `repository/kind.ts` (today the local
  `trackedFile`), used by `readRepository`, `planning/files.ts`, and the gspot.toml entry in `commands/public.ts`.
  `kindOf` takes the same arguments and stops being exported. The argument type `FileClassification` goes, and
  `Verdict` takes its name: `FileClassification` is the file's kind and where gspot learned it.
- Size: small

### PLR-037: Language- and tool-specific code inside the generic repository folder

- Where: `packages/cli/src/repository/selection/public.ts:77-93` (`migrationFiles`, hard-codes `'postgres'`),
  `repository/paths/public.ts:209-216` (`semgrepRuleFiles`), `repository/discovery/contracts.ts:137-162`
  (`swiftSourceTags`), `repository/public.ts:150-155` (Swift tag filter)
- Kind: move
- Problem: Postgres, Semgrep and Swift rules sit in the folder that should only list and classify files.
  `migrationFiles` is used by `checks/database/postgres/public.ts`, `checks/platform/public.ts` and
  `planning/files.ts`; `semgrepRuleFiles` by `checks/general/security.ts` and `planning/contracts.ts`.
- Fix: Move `migrationFiles` to `checks/database/postgres/migrations.ts` (its values: `POSTGRES_CONFIGURATION` in
  `config/checks/database.ts`, `SQL_EXTENSION` in `config/repository/inventory.ts`), `semgrepRuleFiles` to
  `checks/general/security.ts`, and `swiftSourceTags`, with the `Package.swift` filter of `readRepository` folded in, to
  `parsers/swift.ts`. Do after LIF-035: planning calls the first two, and the import rules do not let planning import
  from `checks`.
- Size: small

### PLR-038: `repository/modules.ts` serves only a check that goes

- Where: `packages/cli/src/repository/modules.ts`, `packages/cli/src/types/repository/inventory.ts` (`ModuleContext`)
- Kind: delete
- Problem: `modules.ts` holds one function, `modulePath`, and its only user is
  `checks/general/structure/config-logic.ts`, which CKG-010 deletes.
- Fix: Delete `repository/modules.ts`, `modulePath` and `ModuleContext` together with that check (CKG-010).
  `TRAILING_STAR` stays in `config/repository/aliases.ts`.
- Size: small

### PLR-040: Git diff argument lists disagree, and one is written inline

- Where: `packages/cli/src/config/repository/revisions.ts:5-17`, `packages/cli/src/repository/revisions/public.ts:57`
- Kind: simplify
- Problem: `COMMIT_DIFF_ARGV`, `LOG_ARGV` and `WORKTREE_DIFF_ARGV` are constants, but the staged diff list in
  `getStaged` is written inline. `COMMIT_DIFF_ARGV` adds `--no-ext-diff` and the other diffs do not, although
  `--name-only` never runs an external diff tool.
- Fix: Name the inline list `STAGED_DIFF_ARGV = ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z']`
  in `config/repository/revisions.ts`, beside the other three, and drop `--no-ext-diff` from `COMMIT_DIFF_ARGV`.
- Size: small

### PLR-041: Git calls take a timeout that no caller changes, and it is too short for the slow ones

- Where: `packages/cli/src/platform/git/public.ts:14-50`, `platform/git/contracts.ts:147,169,176`,
  `packages/cli/src/types/platform/runtime.ts:50`, `packages/cli/src/config/platform/git.ts` (`GIT_TIMEOUT_MS`)
- Kind: delete
- Problem: `{ timeoutMs: GIT_TIMEOUT_MS, ...options }` lets a caller change the Git timeout, and no Git caller does (only
  `tools/contracts.ts` sets `timeoutMs`, for tools). The doc calls it "the one Git deadline". The same 30 seconds also
  cover `git clone --shared` and the streaming `git cat-file --batch` of every blob, which can take longer in a large
  repository.
- Fix: Delete `GIT_TIMEOUT_MS` and the `timeoutMs` field of `GitOptions`. Local Git commands run without a time limit
  and stop on Ctrl-C, like the downloads of ROOT-021: one setting per concern.
- Size: small

### PLR-043: `runStream` has three output modes, a base64 detour, and a one-caller wrapper

- Where: `packages/cli/src/platform/public.ts:209-282`, `packages/cli/src/platform/git/public.ts:30`,
  `packages/cli/src/types/platform/runtime.ts:69`
- Kind: simplify
- Problem: `StdoutRead` is `'utf8' | 'base64' | (consumer)`. `runBinary` asks for base64 text and decodes it again ("Bun
  requires a Node encoding name"), although the consumer mode already delivers raw buffers. The only production caller
  of `runBinary` is `runGitBinary`; its other callers are tests.
- Fix: Drop the `'base64'` mode, so the output is text or a consumer. Delete `runBinary`: `runGitForBytes` (today
  `runGitBinary`, in `system/git.ts`) calls `runGit` with a consumer that collects the chunks and joins them with
  `Buffer.concat`. `BinarySpawnResult` becomes `ByteSpawnResult`.
- Size: small

### PLR-044: `installedDependency` checks "is it installed" twice

- Where: `packages/cli/src/repository/contracts.ts:319-331`
- Kind: simplify
- Problem: It first scans `require.resolve.paths(name)` with `existsSync`, then calls `require.resolve` inside a
  `MODULE_NOT_FOUND` catch. Both answer the same question.
- Fix: Keep the `try`/`catch` and delete the first scan. The function moves to `repository/dependency-files.ts`.
- Size: small

### PLR-045: CI file parsing uses hand-written object checks

- Where: `packages/cli/src/repository/discovery/public.ts:84-118`, `repository/contracts.ts:152-156`
- Kind: simplify
- Problem: `jobCommands`, `isLintJob`, `lintJobs` and `importTarget` repeat `typeof x === 'object' && x !== null`
  checks, although `isRecord` exists and the project checks other files with zod.
- Fix: Parse a CI document with one small zod schema (a `jobs` table of
  `{ steps?: { run?: string }[], script?: string | string[] }`) beside its one reader in `repository/tooling.ts`, and
  drop the object checks in `jobCommands`, `isLintJob` and `lintJobs`. `importTarget` (in `repository/aliases.ts`) uses
  `isRecord`.
- Size: small

### PLR-046: Stale comments on constants, and "takeover" and "configs" names for found tool files

- Where: `packages/cli/src/config/repository/inventory.ts:16,214,237-238`,
  `packages/cli/src/repository/discovery/public.ts:128` (`planTakeoverConfigs`), `:150-156` (`getToolConfigs`)
- Kind: rewrite-text
- Problem: The `LINT_PAIRS` comment says "and the package managers whose lint task counts", but the set holds only three
  two-word commands. The `ROOT_SCOPE` comment says "Root scope metadata; each repository owns its configuration list".
  `planTakeoverConfigs` and `getToolConfigs` return `ToolFile[]` and say "takeover" and "configs" for what the rest of
  the code calls tool files.
- Fix: Delete the stale half of the `LINT_PAIRS` comment. The `ROOT_SCOPE` comment says "The scope for the whole
  repository." Keep `TASK_AFTER_RUN`: the shipped `no-magic-numbers` rule allows only -1, 0 and 1, so a bare 2 fails.
  Rename `planTakeoverConfigs` to `findReplacedToolFiles` and `ToolFile` to `FoundToolFile` (a tool file found in the
  repository, not one gspot writes). `getToolConfigs` has one caller and is inlined into `readTooling`.
- Size: small

### PLR-047: `retireStaleClaim` writes the private folder mode as a literal

- Where: `packages/cli/src/platform/root/writes.ts:191`, `packages/cli/src/config/platform/modes.ts:22,30`
- Kind: simplify
- Problem: `retireStaleClaim` writes `0o700` as a literal although `PRIVATE_DIRECTORY` exists. The values are equal, so
  nothing behaves wrongly; only the name is missing. The other misnamed mode, `EXECUTABLE_FILE` for a folder in
  `installTree`, goes with `installTree` (LIF-001).
- Fix: `removeStaleLock` (today `retireStaleClaim`, in `system/safe-folder/lock.ts`) uses `PRIVATE_DIRECTORY`.
- Size: small

### PLR-048: `checkedPath` and `preparedPath` are the same loop twice

- Where: `packages/cli/src/platform/root/reads.ts:77-107`
- Kind: merge
- Problem: Both split the path, walk the parents, and refuse a parent that is a link or not a folder. They differ only
  in `lstatSync` versus "create if missing".
- Fix: One parent walk `checkParents(state, path, statParent)` in `system/safe-folder/reads.ts`; `checkedPath` and
  `preparedPath` call it with their own `statParent`.
- Size: small

### PLR-049: The same "use the cache root if it is this root" expression twice

- Where: `packages/cli/src/platform/root/public.ts:258,281,284`
- Kind: simplify
- Problem: `reads?.root === root ? reads.root : canonicalPath(root)` appears twice. When the two are equal, `reads.root`
  is `root`.
- Fix: One local function `realRoot(root, reads)` that returns `root` when the read cache holds it, else
  `realPath(root)`.
- Size: small

### PLR-050: The `RegExp.escape` global type patch hides inside a process types file

- Where: `packages/cli/src/types/platform/runtime.ts:3-9`; `packages/cli/src/types/checks/general/spdx.d.ts`
- Kind: move
- Problem: A `declare global` block (with an `eslint-disable` that interface merging needs) sits among process types.
  TypeScript 5.9 lacks `RegExp.escape`, and 16 call sites use it. Readers do not expect a global type change there. The SPDX `declare module` blocks sit in `types/checks/general/spdx.d.ts`, which would be the only file left in that folder once its check types move (LAY-005); ambient declarations are not a topic of the checks.
- Fix: One file, `packages/cli/src/types/global.d.ts`, holds both: the `RegExp.escape` block, with one line saying why, and the two SPDX `declare module` blocks; delete `spdx.d.ts`. Delete the `RegExp.escape` block when TypeScript ships the type.
- Size: small

### PLR-052: Every safe-folder read checks size and times twice, only for the writer lock

- Where: `packages/cli/src/platform/root/reads.ts:34-43`, `platform/root/writes.ts:153-161`
- Kind: simplify
- Problem: Every regular read compares size and times before and after, and throws a fake `EAGAIN` error if they
  changed. Only `readClaim` catches it, to wait for a half-written lock file.
- Fix: Delete the before/after check and the fake `EAGAIN` from plain reads, and delete `readClaim`: both lock callers
  use `readEntry`. Do after TPR-021, which creates the lock file whole with `linkSync`, so no reader can see a
  half-written lock.
- Size: small

### PLR-053: Small defensive checks with weak value

- Where: `packages/cli/src/platform/git/contracts.ts:25-34,127-133` (`hasGitEntry`), `repository/contracts.ts:50-70`
  (`assertParents`, `entryStat`), `repository/paths/contracts.ts:45`, `repository/revisions/public.ts:183-194`
- Kind: simplify
- Problem: Each handles a rare race or a broken repository with extra code and its own message. After Git says "not a
  repository", `hasGitEntry` walks every parent folder for any `.git` entry and fails if one exists. `assertParents` and
  `entryStat` raise a custom `ENOTDIR` error for a folder replaced by a file between two calls.
  `repository/paths/contracts.ts:45` parses a workspace file with zod and throws the result away. Three Git calls tell
  an unborn branch from a broken one.
- Fix: Rely on Git's own exit codes and Node's own errors: delete `hasGitEntry`, `assertParents` and the thrown-away
  parse, and fold `entryStat` (then one `lstatSync` call) into `readFileEntry` (today `getEntry`). Keep the plain
  unborn-branch check (`rev-parse --verify` fails and `symbolic-ref` succeeds) and drop the third Git call.
- Size: small

### PLR-056: Names that hide what the function does

- Where: `packages/cli/src/repository/discovery/public.ts:55` (`getFiles`), `repository/paths/contracts.ts:140`
  (`isLintOnlyManifest`), `repository/public.ts:99` (`classifyToolFile`), `config/platform/operating-systems.ts` (field
  `node`), `repository/selection/contracts.ts:27` (`layout`)
- Kind: rename
- Problem: Each name says something other than the code. `getFiles` lists one folder and skips dot files.
  `isLintOnlyManifest` is true when a package.json holds only gspot's npm tools or hook packages. `classifyToolFile`
  also handles banners, build wrappers and Vale packages. The `node` field of `OPERATING_SYSTEMS` holds Node's name for
  the system (`darwin`, `linux`, `win32`). `layout` builds a scope's contents, and its variable `scopeSummaries` holds
  the scope's dependency files.
- Fix: Rename `getFiles` to `listFolder`, `isLintOnlyManifest` to `isToolsOnlyPackage`, `classifyToolFile` to
  `fileOrigin`, the field `node` to `nodeName`, and `layout` to `scopeContents` (type `Layout` to `ScopeContents`) with
  the variable `scopeDependencyFiles`.
- Size: small

### S06-001: `run` only forwards to `runStream`

- Where: `packages/cli/src/platform/public.ts:252-254`
- Kind: merge
- Problem: `run(command, options)` is one line: `runStream(command, options, 'utf8')`. Two names do one job. `run` has
  11 users; `runStream` has three production users (`run`, `runBinary`, `streamGit`).
- Fix: One function `run(command, options, output = 'utf8')` in `packages/cli/src/system/processes.ts`: `runStream`
  takes the name `run`, and the one-line `run` merges into it. The 11 `run` callers do not change. With PLR-043,
  `output` is text or a consumer of raw chunks.
- Size: small

### S06-003: `streamGit` is `runGit` with one more argument

- Where: `packages/cli/src/platform/git/public.ts:41-50`
- Kind: merge
- Problem: `runGit`, `runGitBinary` and `streamGit` repeat the same three lines (find the Git environment, return its
  failure, call the runner). `streamGit` differs from `runGit` only by its consumer, and its one caller is
  `visitGitBlobs` (`repository/revisions/public.ts:141`).
- Fix: `runGit(root, argv, options = {}, output = 'utf8')` in `system/git.ts`, like `run` (S06-001). `streamGit` merges
  into `runGit`, and `visitGitBlobs` gives its consumer as the fourth argument.
- Size: small

### S06-004: `commitStaged` and the `Staging` type serve only the batch writer that goes

- Where: `packages/cli/src/platform/root/writes.ts:95,110-125,249`, `packages/cli/src/types/platform/root.ts:56`
- Kind: simplify
- Problem: `commitStaged` has two callers, `stageFile` (`writes.ts:95`) and `replaceEntry` (`:249`), and the `Staging`
  type exists only to carry four values (`bounds`, `path`, `target`, `temporary`) into it. LIF-004 deletes `stageFile`,
  which leaves `replaceEntry` as the one caller.
- Fix: Inline `commitStaged` and `stage` into `replaceEntry` (about 20 lines in all) and delete `Staging`. Do after
  LIF-004.
- Size: small

### S06-005: `isGlob` only calls picomatch

- Where: `packages/cli/src/repository/paths/public.ts:142-144`
- Kind: delete
- Problem: The body is `return picomatch.scan(pattern).isGlob;`.
- Fix: Delete it. Its callers (the docs check, `findReplacedToolFiles`, `projectFolder`, `includeFolderContents`,
  `filenameMatcher`) write `picomatch.scan(pattern).isGlob`.
- Size: small

### S06-006: `inspectWorkTree` only calls `runGitBlocking` with fixed arguments

- Where: `packages/cli/src/repository/discovery/contracts.ts:64-66`
- Kind: delete
- Problem: It is one line: `runGitBlocking(root, ['rev-parse', '--is-inside-work-tree'], { env: { LC_ALL: 'C' } })`.
  Its callers are `isGitRepository`, `findRoot` and `listGitFiles` (`repository/contracts.ts:146`).
- Fix: Delete it. With `WORK_TREE_ARGV` and `GIT_LOCALE` in `packages/cli/src/config/system/git.ts`, each caller writes
  one plain call: `runGitBlocking(root, WORK_TREE_ARGV, { env: GIT_LOCALE })`.
- Size: small

### S06-007: `ownersOf` is a one-line filter with one caller

- Where: `packages/cli/src/repository/selection/public.ts:103-105`
- Kind: merge
- Problem: `selected.filter((manifest) => ownedBy(...).length > 0)` is used only by explain's path report
  (`commands/explain/public.ts:200`, inside `buildPathReport`).
- Fix: Inline it into `buildPathReport` in `packages/cli/src/commands/explain/command.ts`, as a filter over `coveredBy`.
- Size: small

### S06-009: Three config files of this area import from outside `config/`

- Where: `packages/cli/src/config/platform/managed-blocks.ts:1`, `config/platform/runtime.ts:1`,
  `config/repository/inventory.ts:1`
- Kind: move
- Problem: `config/` may import only `config/`. `config/platform/managed-blocks.ts` imports `BlockStyle` and
  `BlockMarkers` from `types/`; `config/platform/runtime.ts` imports the package file (`#cli-package`) for the version;
  `config/repository/inventory.ts` imports the type `Verdict` to annotate `SOURCE_KIND`.
- Fix:
    - `MARKERS` becomes `as const` with no annotation, and `BlockMarkers` goes.
      `BlockStyle = (typeof BLOCK_STYLES)[number]` stays in `types/system/managed-blocks.ts`.

    - `RUNNING_VERSION` leaves `config/`: it is the module value `GSPOT_VERSION` in `apply/version-pin.ts`, read from
      `package.json` through an import. The rest of `runtime.ts` splits (S06-013).

    - `SOURCE_KIND = { kind: 'source', source: 'default' } as const` with no annotation; the return type of its user
      (`FileClassification`) checks it.

    - Type-only imports of library types in `types/` (`Ignore`, `Dirent`, `Stats`, the execa `Result`) stay.

- Size: small

### S06-010: The repository types are built from zod schemas

- Where: `packages/cli/src/types/repository/inventory.ts:1,7-8,38,41-43,48,97`
- Kind: move
- Problem: `types/repository/inventory.ts` imports `zod` and three schemas (`fileKindSchema`, `vendoredSchema`,
  `generatedSchema`) and builds `FileKind`, `FileDeclaration` and `FileClassificationRules` with `z.infer`. `types/`
  may import only `config/` and `types/`, and every exported type is written by hand. `Runner` comes from
  `runnerSchema` the same way; INX-003 deletes it.
- Fix: In `types/repository/inventory.ts`, write `FileKind = (typeof FILE_KINDS)[number]` (`FILE_KINDS` is config, and
  the schema stays `z.enum(FILE_KINDS)`), and write `FileDeclaration`
  (`{ kind: 'generated'; configuration: string; paths: string[] }`, CFR-005) and `FileClassificationRules` by hand.
  `vendoredSchema` and `generatedSchema` go with CFR-005, and the `zod` import goes.
- Size: small

### S06-011: Constants sit in mirror files whose names no longer match their users

- Where: all of `packages/cli/src/config/platform/`, `config/repository/`, `types/platform/` and `types/repository/`
- Kind: move
- Problem: The `config/` and `types/` files of this area carry the names of source files that no longer exist, so a
  reader cannot find a constant from its user, or the user from the constant. `config/platform/runtime.ts` serves
  `platform/public.ts` and five other places; `config/platform/paths.ts` and `text.ts` serve `platform/contracts.ts`;
  `config/platform/root.ts` serves three files under `platform/root/`; `types/platform/reads.ts` holds the run cache
  types, while `platform/root/reads.ts` is unrelated path code; `types/platform/paths.ts` serves the glob engine;
  `types/platform/assets.ts` serves a build script.
- Fix: Every constant goes to one `config/` topic file and every type to one `types/` topic file, as "Config and types
  files" lists: all `.gspot` paths in `config/system/locations.ts` (with `STATE_FOLDER_PATTERN`, built from
  `STATE_DIRECTORY`); all file modes in `config/system/modes.ts`; Git entry modes stay in
  `config/repository/revisions.ts`; unit constants go to `config/units.ts`; file kinds and tags stay in
  `config/repository/inventory.ts`; hook values stay in `config/repository/hooks.ts`; the lists `readTooling` searches
  go to `config/repository/tooling.ts`; `ROOT_SCOPE` goes to `config/repository/scopes.ts`; and
  `INSTALLED_DEPENDENCY_FOLDERS` to `config/repository/tracked.ts`.
- Size: medium

### S06-013: `config/platform/runtime.ts` is a grab bag

- Where: `packages/cli/src/config/platform/runtime.ts`
- Kind: move
- Problem: It mixes gspot's exit codes (`EXIT_ERROR`, `EXIT_FINDINGS`, `MAX_EXIT_CODE`), process internals (`DRAIN_MS`,
  `REAP_MS`, `TASKKILL_GONE_CODE`, `MISSING_CODE`, `FAILED_CODE`), a path rule (`DECLARATION_EXTENSIONS`), package lookup
  (`ROOT_SEARCH_DEPTH`), the version, and unit constants (`MS_PER_SECOND`, `SECONDS_PER_DAY`, `BYTES_PER_KB`,
  `FULL_PERCENTAGE`). `FAILED_CODE` and `EXIT_FINDINGS` are both `1` for different reasons.
- Fix: Split it into topic files: the unit constants to `config/units.ts`; `EXIT_ERROR` and `EXIT_FINDINGS` to the
  existing `config/terminal.ts`; `MISSING_CODE`, `FAILED_CODE`, `TASKKILL_GONE_CODE`, `DRAIN_MS` and `REAP_MS` to
  `config/system/processes.ts`; `ROOT_SEARCH_DEPTH` as `PACKAGE_SEARCH_DEPTH` to `config/system/assets.ts`;
  `DECLARATION_EXTENSIONS` to `config/system/paths.ts`; `MAX_EXIT_CODE` to the existing `config/configurations.ts`.
  `RUNNING_VERSION` leaves `config/` (S06-009). Delete `PROGRAM_ARGUMENT_OFFSET`: destructuring makes it unneeded
  (ROOT-020).
- Size: small

## Layout

The target files of this area, with the functions each holds. Generic code that is not about the machine sits in
`src/`.

```text
packages/cli/src/
  errors.ts                GspotError
  objects.ts               compact, isRecord, isRecordArray, valueAt, normalizeTables, createTable
  text.ts                  similar, codeList, contentDigest, decodeUtf8, quoteArgument, positionAt
  system/
    processes.ts           run, runBlocking, commandOptions, missingExecutable, notFound, isUnfinished, completed,
                           isGroupGone, terminate, supervise
    environment.ts         isInteractive, environmentVariables, miseHome, cacheDirectory, currentOperatingSystem
    executables.ts         executableNames, virtualEnvironmentBin, virtualEnvironmentExecutable, systemExecutables
    git.ts                 runGit, runGitBlocking, runGitForBytes, gitText, gitLines, gitPaths, readGitSetting,
                           hooksDirectory, isShallow, isOutsideGit, gitPrefix, gitEnvironment, sourceGitEnvironment,
                           targetGitEnvironment, parseLocalEnvironment
    paths.ts               toPosix, toolOutputPath, toSystemPath, isInside, extensionOf, stemOf, directoryOf,
                           trimTrailingSlashes, pathKey, includeParentFolders
    files.ts               listFolderFiles, globPaths, assertInsideFolder, scratchFolder
    file-reads.ts          readPrefix, readSource, readText, createReadCache, memo
    assets.ts              assetPath, readAsset, listAssets, wasmPath, packageFolder, nearestPackage,
                           cachedPackageFolder
    managed-blocks.ts      blockSpan, applyBlock, currentBlock
    safe-folder/
      open.ts              openSafeFolder, walkSafeFolder, listOf, statOf, makeDirectory, removeEntry, removeTree
      names.ts             portableSegments, systemSegments, isUnsafeSegment, assertOutsideStateFolder,
                           assertWritablePath
      reads.ts             checkedPath, preparedPath, readEntry, validateCopy, realPath, sourcePath, fileMode, sameEntry,
                           preparedDirectory, linkRead, fileRead, isUnsafeLinkTarget, assertLinkDestination
      writes.ts            replaceEntry, writeLink, flushFile, mustUnlinkFirst
      lock.ts              takeLock, tryLock, releaseLocks, assertAbandonedLock, removeStaleLock
  repository/
    read.ts                readRepository, readAttributes
    kind.ts                classifyFile, kindOf, fileOrigin, declaredKind, attributeKind, sourceKind, isLicenseFile,
                           isValePackageFile
    tags.ts                tagEntry, extensionsTagged, sniff, shebangTags, textTags, withoutTrailingVersion
    tracked.ts             readIndexEntries, listRepositoryFiles, submodulePaths, listGitFiles, walkPaths,
                           directoryContents, isIgnored, readFileEntry, symlinkEntry
    find-root.ts           findRoot, isGitRepository
    dependency-files.ts    readDependencyFiles, readPackageJson, installedPackage, installedDependency
    aliases.ts             aliasesFor, packageAliases, importTarget
    tooling.ts             readTooling, readHooks, readLintJobs, findReplacedToolFiles, listFolder, hookDirectory,
                           isLintCommand, jobCommands, isLintJob, lintJobs, hasSection, parseSharedFile,
                           hasToolSection, hasIniSection
    scopes.ts              buildScope, findScopes, packageWorkspaces, workspacePackages, workspaceSourceFiles,
                           projectFolder, projectDependencies, scopeOf, scopeAncestors, isInScope, nestedScopes,
                           byScopeDepth, joinScope, relativeToScope, coversScope, isOutsideChildren, targetInScope
    selectors.ts           pathMatcher, pathExpressions, includeFolderContents, filenameMatcher, literalGlob,
                           isInGspotFolder, isToolingPath, isToolsOnlyPackage, matcherCache
    detect.ts              detectConfigurations, detectConditions, scopeContents, dependencyMap, evidenceFor,
                           evidenceReaders and the evidence functions (extension, content, file name, project,
                           dependency, shebang, runtime, path, tag)
    select.ts              coveredBy, isCovered, selectForScope, fileDeclarations, addPluginExtensions
    revisions/
      push.ts              selectPush, selectLine, parseLine, isHashPair, peelCommits, readShallowBoundaries,
                           comparison, buildRevision, recordRevision
      changes.ts           readStagedPaths, readChangedPaths, readPushBase, pushedCommits, listRemoteHeads,
                           readDefaultRef, readMergeBase
      objects.ts           listRevisionEntries, visitGitBlobs, readBlobs, listHeadEntries
```

Moved out of this area: `migrationFiles`, `semgrepRuleFiles` and `swiftSourceTags` (PLR-037); `prefixOf` to
`checks/general/structure/shared-prefixes.ts`; `directoryTree` to `checks/general/structure/source-files.ts` (its
one-line `PathEntry` type folds into the parameter); `ownersOf` into `commands/explain/command.ts` (S06-007);
`GRAMMAR_PACKAGES` and `SWIFT_GRAMMAR_FILE` to `scripts/config/grammars.ts`; `RUNNING_VERSION` as `GSPOT_VERSION` to
`apply/version-pin.ts` (S06-009).

Deleted by findings of other areas: `RUNTIME_WASM` (INS-008), `DOWNLOAD_TIMEOUT_MS` (ROOT-021),
`PinnedDownload` (SCR-010), `TOOLS_PROJECT` (INX-010), `VALE_OWN_PREFIXES` (GEN-008), `stageFile`, `replaceEntries`,
`writeAll`, `FILE_WRITE_BATCH` and `StagedFile` (LIF-004), `renameDirectory` (LIF-001), and `pauseUntilClaimed` with
the `CLAIM_INITIALIZATION_MS`, `CLAIM_POLL_MS` and `CLAIM_WAIT_BYTES` wait (TPR-021).

## Config and types files

Each file holds one topic. `config/` imports only `config/`; `types/` imports only `config/` and `types/`.

| File                                                  | What it holds                                                                                                                                                                                                   | Comes from                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/cli/src/config/system/locations.ts`         | gspot's own paths and file names in a repository (`.gspot/...`, `gspot.toml`, `.gspot/mise.toml`, `STATE_FOLDER_PATTERN`)                                                                                       | `config/platform/locations.ts`, `config/platform/root.ts` |
| `packages/cli/src/config/system/modes.ts`             | file and folder modes                                                                                                                                                                                           | `config/platform/modes.ts`                                |
| `packages/cli/src/config/system/git.ts`               | Git environment variable names, Git query arguments (`WORK_TREE_ARGV`, `GIT_TOP_LEVEL_ARGV`, `GIT_SOURCE_ARGV`), `GIT_LOCALE`, `GIT_EXECUTABLE`, `GIT_CLONE_COMMAND`, Git's "not a repository" code and message | `config/platform/git.ts`                                  |
| `packages/cli/src/config/system/managed-blocks.ts`    | managed block markers (`MARKERS`) and `BLOCK_STYLES`                                                                                                                                                            | `config/platform/managed-blocks.ts`                       |
| `packages/cli/src/config/system/operating-systems.ts` | operating system names and install commands (one table)                                                                                                                                                         | `config/platform/operating-systems.ts`                    |
| `packages/cli/src/config/system/paths.ts`             | executable layouts, declaration extensions, glob syntax (`GLOB_EXCLUDE`, `FOLDER_CONTENTS`, `WHOLE_TREE_GLOBS`, `ANY_FOLDER_PREFIX`), `TRAILING_SLASH`                                                          | `config/platform/paths.ts`, `config/platform/runtime.ts`  |
| `packages/cli/src/config/system/safe-folder.ts`       | unsafe name rules, temporary file and lock file names                                                                                                                                                           | `config/platform/root.ts`                                 |
| `packages/cli/src/config/system/processes.ts`         | child process exit codes and wait times, Windows `taskkill` and `PATHEXT`                                                                                                                                       | `config/platform/runtime.ts`                              |
| `packages/cli/src/config/system/assets.ts`            | where gspot finds its own package files (`PACKAGE_SEARCH_DEPTH`, `GRAMMARS_FOLDER`)                                                                                                                             | `config/platform/runtime.ts`, new                         |
| `packages/cli/src/config/system/environment.ts`       | environment variable names and folders for mise and the cache                                                                                                                                                   | new                                                       |
| `packages/cli/src/config/units.ts`                    | ms per second, seconds per day, bytes per kB, 100 percent                                                                                                                                                       | `config/platform/runtime.ts`                              |
| `packages/cli/src/config/text.ts`                     | suggestion and list limits, text patterns, digest algorithm                                                                                                                                                     | `config/platform/text.ts`                                 |
| `packages/cli/src/config/terminal.ts`                 | gspot's exit codes (`EXIT_ERROR`, `EXIT_FINDINGS`)                                                                                                                                                              | `config/platform/runtime.ts`, into the existing file      |
| `packages/cli/src/config/configurations.ts`           | `MAX_EXIT_CODE`, the largest exit code a manifest may declare                                                                                                                                                   | `config/platform/runtime.ts`, into the existing file      |
| `packages/cli/src/config/parsers/dependency-files.ts` | `PACKAGE_JSON`, `PACKAGE_SWIFT`                                                                                                                                                                                 | new, into the existing file                               |
| `packages/cli/src/config/parsers/swift.ts`            | Swift grammar node names, test markers, `SWIFT_EXTENSION` for `swiftSourceTags`                                                                                                                                 | new, into the existing file                               |
| `packages/cli/src/config/checks/general/security.ts`  | the Semgrep tool name and rules key                                                                                                                                                                             | new, into the existing file                               |
| `packages/cli/src/config/checks/database.ts`          | `POSTGRES_CONFIGURATION`                                                                                                                                                                                        | new                                                       |
| `packages/cli/src/config/repository/inventory.ts`     | file kinds and tags, Git attribute names, `VENDORED_FOLDERS`, `SQL_EXTENSION`                                                                                                                                   | the current file stays                                    |
| `packages/cli/src/config/repository/tooling.ts`       | lint folders, `AGENTS.md` and similar files, CI files, mise files, `MISE_TOML`, `RUNNER_NAMES`                                                                                                                  | `config/repository/inventory.ts`, new                     |
| `packages/cli/src/config/repository/hooks.ts`         | other hook tools and hook folders, `HOOKS_PATH_SETTING`, `PRE_COMMIT_FILE`                                                                                                                                      | the current file stays                                    |
| `packages/cli/src/config/repository/tracked.ts`       | the file listing: `INSTALLED_DEPENDENCY_FOLDERS`, `GITIGNORE_FILE`, `GITATTRIBUTES_FILE`, `GIT_FOLDER`, `NODE_MODULES`, `INDEX_FILES_ARGV`, `UNTRACKED_FILES_ARGV`                                              | `config/repository/inventory.ts`, new                     |
| `packages/cli/src/config/repository/scopes.ts`        | `ROOT_SCOPE`, workspace files                                                                                                                                                                                   | `config/repository/inventory.ts`, new                     |
| `packages/cli/src/config/repository/aliases.ts`       | import alias file names, `TRAILING_STAR`                                                                                                                                                                        | the current file stays                                    |
| `packages/cli/src/config/repository/revisions.ts`     | Git arguments for staged, changed and pushed revisions; Git entry modes                                                                                                                                         | the current file stays                                    |
| `scripts/config/grammars.ts`                          | grammar packages and the Swift grammar file for the build                                                                                                                                                       | `config/platform/assets.ts`                               |
| `packages/cli/src/types/system/processes.ts`          | spawn options and results (`SpawnResult`, `ByteSpawnResult`, `StdoutRead`, ...)                                                                                                                                 | `types/platform/runtime.ts`                               |
| `packages/cli/src/types/system/git.ts`                | Git environment and options                                                                                                                                                                                     | `types/platform/git.ts`, `types/platform/runtime.ts`      |
| `packages/cli/src/types/system/managed-blocks.ts`     | block span, style, context                                                                                                                                                                                      | `types/platform/managed-blocks.ts`                        |
| `packages/cli/src/types/system/files.ts`              | run read cache, memo key, scratch folder                                                                                                                                                                        | `types/platform/reads.ts`, `types/platform/scratch.ts`    |
| `packages/cli/src/types/system/safe-folder.ts`        | `SafeFolder`, `SafeFolderState`, `FileCopy`, `PathFormat`, `PlannedFiles`                                                                                                                                       | `types/platform/root.ts`                                  |
| `packages/cli/src/types/errors.ts`                    | `ErrorCode`                                                                                                                                                                                                     | `types/platform/runtime.ts`                               |
| `packages/cli/src/types/objects.ts`                   | `Defined`                                                                                                                                                                                                       | `types/platform/runtime.ts`                               |
| `packages/cli/src/types/checks/general.ts`            | `DirectoryEntry` for the structure checks                                                                                                                                                                       | `types/platform/paths.ts`                                 |
| `packages/cli/src/types/global.d.ts`                  | the `RegExp.escape` global (PLR-050)                                                                                                                                                                            | `types/platform/runtime.ts`                               |
| `packages/cli/src/types/repository/inventory.ts`      | the repository read and tooling types (`TrackedFile`, `FileEntry`, `FileKind`, `FileClassification`, `FileDeclaration`, `Tooling`, `FoundToolFile`, `ScopeContents`, ...)                                       | the current file stays                                    |
| `packages/cli/src/types/repository/revisions.ts`      | revision and push types                                                                                                                                                                                         | the current file stays                                    |

## Values written inside functions

Every fixed value written inside a function of this area gets a name in a `config/` topic file; each placement row lists
its values. The main ones:

1. The Git argument lists of the revision code, for example `STAGED_DIFF_ARGV` (PLR-040), `CHANGED_COMMITS_ARGV`,
   `ROOT_COMMITS_ARGV`, `TREE_ENTRIES_ARGV` and `BLOBS_ARGV`, go to `config/repository/revisions.ts`.
2. The Git values of `system/git.ts`, for example `GIT_SOURCE_ARGV = ['rev-parse', '--is-bare-repository',
'--absolute-git-dir']`, `GIT_LOCALE = { LC_ALL: 'C' }`, and `NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository
(or any '`, the Git message `isOutsideGit` depends on, go to `config/system/git.ts`.
3. `CHECK_ATTRIBUTES_ARGV = ['check-attr', '--stdin', '-z', 'linguist-generated', 'linguist-vendored', 'text', 'filter']` and the attribute names `attributeKind` repeats go to `config/repository/inventory.ts`.
4. `PATHEXT_DEFAULT = '.COM;.EXE;.BAT;.CMD'`, `TASKKILL_PROGRAM = 'taskkill'` and `TASKKILL_OPTIONS = ['/T', '/F']` go
   to `config/system/processes.ts`.
5. `PACKAGE_JSON = 'package.json'`, written in seven functions of two areas, and `PACKAGE_SWIFT = 'Package.swift'` go to
   `config/parsers/dependency-files.ts`.
6. The glob syntax of `globPaths` and the selectors (`GLOB_EXCLUDE = '!'`, `FOLDER_CONTENTS = '/**'`,
   `WHOLE_TREE_GLOBS = ['**', '**/*']`, `GLOB_SPECIAL_CHARACTERS = /[\\*?{}[\]()!+@,]/gu`, `ANY_FOLDER_PREFIX = '**/'`)
   goes to `config/system/paths.ts`.
7. The Swift values of `swiftSourceTags`, for example `SWIFT_TEST_ATTRIBUTES = ['Test', 'Suite', 'Testing.Test', 'Testing.Suite']`, go to `config/parsers/swift.ts`.
8. `MISE_DATA_VARIABLE = 'MISE_DATA_DIR'`, `XDG_DATA_VARIABLE = 'XDG_DATA_HOME'` and
   `MISE_DATA_FOLDER = '.local/share/mise'` go to `config/system/environment.ts`.
9. Hook and CI file names: `PRE_COMMIT_FILE = '.pre-commit-config.yaml'` and `HOOKS_PATH_SETTING = 'core.hooksPath'` go
   to `config/repository/hooks.ts`; `GITLAB_CI_FILE = '.gitlab-ci.yml'` and `GITHUB_WORKFLOWS_FOLDER = '.github/workflows/'` go to `config/repository/tooling.ts`.

These stay in the code: user-facing messages and the kind-source labels explain shows (`'gspot'`, `'banner'`,
`'build wrapper'`, `'every repository'`), Node error codes (`'ENOENT'`, `'EEXIST'`), signal names, open flags (`'wx'`,
`'r'`), `'utf8'`, `'NFC'`, `'\0'`, whitespace splits, discriminant literals of union types (`'package.json'` as a
dependency file kind, `'markdown'` as a block style, `'dir'` and `'file'`), and the keys of parsed CI documents (`jobs`,
`steps`, `script`, `run`), which the CI schema of PLR-045 names. The module values `systemExecutables`,
`cachedPackageFolder`, `matcherCache` and `evidenceReaders` stay in their modules: they are made when the module starts
or filled during the run.
