# Scripts, Names, and Failure Handling

This review supplements existing fixes instead of creating a second cleanup plan. K-205 already
removes tracked reference output; K-164 already rejects incomplete releases. The changes below
close concrete gaps in those plans. They do not authorize deleting implementation files before
replacement behavior and its acceptance checks exist.

## K-303: The reference generator deletes more than it owns

**What is wrong.** `docs/reference-pages.ts` is used by the docs build and dev commands. Its `write()` recursively removes the whole reference directory before writing any page. It neither distinguishes authored files nor keeps the previous page intact on a failed write. Its `quote()` only forwards to `JSON.stringify`.

**Target.** Keep one reference generator and remove unsafe output replacement and redundant forwarding. The filename describes its job and does not need a cosmetic rename.

**Files.** `docs/reference-pages.ts`, `docs/package.json`, `.gitignore`, and the docs build checks.

**Logic.** Keep K-205: untrack generated reference pages and delete the stale-copy check mode. Render and format all pages before changing output. Mark generated pages, replace each page atomically, and prune only obsolete marked outputs. Refuse collisions with authored files.

Keep guides outside generated output. Call `JSON.stringify` directly instead of `quote`; retain front-matter and table formatting functions because they own output grammar.

**What goes.** Recursive removal of the reference root, tracked generated-page churn, the `docs/generated` gate, `--check`, and the forwarding-only `quote` function.

**Tests.** A clean build generates every public reference. An authored sentinel in the output directory survives. A formatting or write failure does not truncate an existing page. Obsolete marked pages disappear. An unknown argument fails before writing (K-305).

**Done when.** The generator is one build step, changes only owned outputs, and requires no committed generated reference copies.

## K-304: Generated reference pages are not automatically correct

**What is wrong.** `commandPage()` reads only top-level commands and local options. `settingsPage()` reads manifest settings, keeps the first repeated name, and hard-codes old command and reason prose. `decisionsPage()` publishes the entire architecture decision log and rewrites links to the default branch. Generation does not prove completeness or release accuracy.

**Target.** Generate the public reference from the same validated command, schema, and manifest definitions as the CLI. Keep design history in architecture, linked rather than copied into the public reference.

**Files.** `docs/reference-pages.ts`, `docs/astro.config.ts`, command registration, setting definitions, and reference tests. Amend S-14 rather than adding `architecture/presets.ts`.

**Logic.** Traverse supported command nesting, include inherited global options, and omit hook-only internals. Include global settings as well as manifest settings. Repeated settings either have identical definitions with all owners listed or produce a conflict; never silently select the first. Derive public usage from the actual command contract.

Delete the decision-log mirror and its URL-rewrite regexes; keep a clearly labeled link to architecture at the matching source revision. Do not add a second generator that rewrites target architecture tables from today's implementation.

**What goes.** `decisionsPage`, its copied public page and sidebar entry, hard-coded stale usage claims, first-wins conflicting settings, and the proposed second architecture generator.

**Tests.** Every public command and global option appears once in the correct context. Global config fields are represented. Conflicting duplicate settings fail generation. A released site contains no target-only architecture prose presented as implemented behavior.

**Done when.** Generated reference content matches the released public contract, and architecture remains the owner of design decisions.

## K-305: Permissive script arguments can select a destructive action

**Partial implementation.** The schema and reference entry points reject unknown options and unexpected positional arguments with exit status two before generating output. Tests preserve planted schemas and an authored reference page after malformed invocations. Help and version requests also leave those outputs unchanged.

The executable build validates every target before collecting grammars or creating output. Publisher validation checks the release tag and registry before writing checksums or spawning npm. Isolated tests replace the compiler and publisher subprocesses, verify repeated targets and dry-run forwarding, and cover stable and prerelease versions with build metadata. The plugin build uses the standard argument parser to reject unsupported flags and positional arguments before removing output. Its fixture verifies complete file preservation after argument errors and information requests. Cross-platform verification of these script regressions remains open.

**What is wrong.** `build.ts` ignores unknown options and a missing `--target`; `--out --target bun-linux-arm64` treats `--target` as the output path. `publish.ts` uses `argv.includes('--dry-run')`, so `--dryrun` does not prevent publication. The docs and schema scripts similarly treat a misspelled `--check` as write mode. These conclusions come from read-only argument probes and source tracing; no build, write mode, or publish was executed.

**Target.** Every repository entry point validates arguments before filesystem or registry effects.

**Files.** `packages/cli/build.ts`, `packages/cli/publish.ts`, `packages/cli/schemas.ts`, `docs/reference-pages.ts`, and script contract tests.

**Logic.** Use the existing argument parser dependency or strict local parsing, not a new script framework. Reject unknown flags, missing values, unexpected positional arguments, invalid targets, and invalid versions. A flag is not another flag's value. Validate the entire invocation before collecting grammars, writing checksums, creating output, or spawning npm.

K-205 removes the docs check mode; passing that removed option must error rather than write. Keep release preflight from K-164.

**What goes.** The permissive build loop, publish flag lookup, and includes-only mode selection.

**Tests.** Missing target, misspelled target, flag-as-value, unknown option, invalid tag, and misspelled dry-run/check all fail without writes or network effects. Valid repeated target options still work. A mock publisher proves no publish command starts after an argument error.

**Done when.** No malformed invocation silently becomes a native build, a write, or a real publication.

## K-306: File URLs are used as filesystem paths

**What is wrong.** The docs generator, build scripts, schema generator, publisher, asset reader, and test harness use `new URL(...).pathname`. For a checkout containing a space, pathname retains `%20`, while the actual filesystem path contains a space. The same conversion also needs platform-correct drive handling.

**Target.** Convert file URLs through the standard file-URL API, and keep URL paths separate from filesystem paths.

**Files.** `docs/reference-pages.ts`, both package build scripts, `packages/cli/schemas.ts`, `packages/cli/publish.ts`, `packages/cli/src/platform/assets.ts`, `packages/cli/rules-lint/command.ts`, and affected tests.

**Logic.** Use `fileURLToPath` for file URLs before filesystem access. Use ordinary path operations afterwards. Do not invent a decoding helper or replace pathname uses that genuinely describe HTTP URL routes. Include this work in K-263's platform verification.

**What goes.** Filesystem-root derivation from raw URL pathname and ad hoc URL-decoding replacements.

**Tests.** A checkout path with spaces, a literal `%` character, and Unicode resolves exactly. Build/docs/schema entry points and source asset lookup run in that checkout. Windows drive-path cases run on Windows CI.

**Done when.** No repository script mistakes URL encoding for a local directory name.

**Implementation evidence, September 20, 2026.** Scripts, source, and tests use
`fileURLToPath` for filesystem paths. The development-asset regression test reproduces
an encoded-path failure before this change and passes after it. A checkout named
`workspace % café` passes schema and reference validation, both package builds, and a
source CLI explanation. The encoded-checkout asset test also passes on Windows.

The plugin uses the same
conversion for file URLs, with a regression test that reads the original encoded path.
Complete Windows acceptance remains part of K-263.

## K-307: Failure-to-empty helpers hide incomplete checks

**Partial implementation.** The manifest-policy reader validates the fields it consumes and reports read or parse failures with the manifest path. Tests cover invalid JSON and invalid field shapes, denied reads, and repositories without package manifests. File listing and root discovery distinguish a confirmed non-Git directory from failed Git observation. Tests cover a corrupt index, incomplete Git metadata, a missing executable, and non-Git ignore handling. File metadata reads and takeover reader failures remain open.

**What is wrong.** `platform/spawn.ts` maps every failed Git command to `undefined`; `repository/tracked.ts` then falls back to a non-Git walk. `entryFor()` drops a path after any stat failure, and `head()` returns empty text after any read failure. `integrity/manifest-policy.ts` treats unreadable or malformed package JSON as absent. The takeover readers also catch read and parse errors, while a separate preflight reparses only selected suffixes.

**Target.** Keep real boundary validation, but do not turn failed observation into valid empty input or a clean verdict.

**Files.** `platform/spawn.ts`, `repository/tracked.ts`, `integrity/manifest-policy.ts`, `lifecycle/carry.ts`, `lifecycle/unreadable.ts`, and their callers.

**Logic.** Use the existing structured process result to distinguish no Git repository from a failed Git operation. Fall back to a directory walk only after the no-Git case is established. Report permission, corruption, parse, and unexpected I/O errors with their path or command.

Treat `ENOENT` as optional only where the caller's contract permits absence. A tracked deletion remains a change trigger, not an unreadable source to hide. Make one takeover reader return parsed content or its error; retain unsupported formats explicitly instead of a second suffix-based preflight.

**What goes.** Lossy Git-output convenience handling at callers that require failure status, catch-all empty strings/undefined in required reads, and duplicated takeover read/parse ownership.

**Tests.** No-Git folders still work. A failed Git listing inside a repository does not silently walk a different file set. Unreadable or malformed package JSON reports a failure. Takeover keeps originals after read errors. Missing optional files and deleted tracked paths retain their documented behavior.

**Done when.** A reader can distinguish absent, unsupported, and failed inputs, and none produces a false clean verdict.

## K-308: The naming specification contradicts its own examples

**What is wrong.** The names guide endorsed a writing action called `didWrite` while rejecting
`didRunFixer`. It prescribed `name` for a finding's check reference, although ignores and
findings use `check`. The glossary retained runner surface, inspection, and project templates.
Repository checks used `fix` for executable correction while manifests used it for advice.
Several CLI examples still used `<id>` and `<key>`.

**Target.** [19-names.md](../19-names.md) owns the exact vocabulary. Names distinguish definitions
from references, objects from name strings, actions from predicates, and advice from execution.

**Files.** Check, finding, manifest, config, and report types and schemas; command registration;
`run/fixers.ts`; `lifecycle/questions.ts`; `output/prompts.ts`; manifest files; the coverage
planner; generated references; and terminology contract tests.

**Logic.** Definitions use `name`; finding, result, and ignore references use `check`.
Parameters use `checkName` for the string, `check` for a definition, and `plannedCheck`
for an execution plan. Apply the corresponding preset, setting, scope, and path mappings.

Use `help` for advice and `fix_command` with `fix_order` for executable correction in both
preset and repository checks. Use `runFixer`, `askRuleFiles`, and `askConfirmation` for
actions. Keep predicates such as `isFixable` and `canAsk`. Rename manifest `[inspections]`
and check `inspection` to their specified `coverage` forms.

Follow the action/result and root/path contracts without adding alias fields or wrapper exports.
Before release, update all callers together; after release, configuration migrations follow D-159.

**What goes.** Predicate-shaped action names, generic identity aliases, the prose `fix` field,
the repository command `fix` alias, and stale glossary entries. Remove blanket word bans that
reject real map keys, Git IDs, third-party fields, or historical evidence.

**Tests.** Verify representative definition/reference serialization, parameter roles, and
manifest/repository fixer schemas. Exercise prompt defaults and cancellation after renaming.
Assert that a fixer failure is not reported as unchanged or changed. Compare command help and
generated docs with the vocabulary. Scan target examples for old spellings while excluding
explicit before/after evidence and mandated external fields.

**Done when.** The schema, types, action names, help, reference output, and architecture examples
agree without forcing different concepts to share one ambiguous name.

## What stays

Build and publish entry points have real consumers in CI and release workflows. The schema
generator publishes schemas that editors and report consumers need. The reference generator
keeps volatile public facts aligned with the CLI. None becomes unnecessary merely because it is
a script.

Keep validation of external data, command failures, permissions, and missing optional inputs.
Keep format-aware serialization and helpers that own actual grammar or lifecycle behavior.
Do not delete every `catch`, optional value, short function, or `safeParse` call by spelling.
A proposed deletion must identify the current caller and the owner that takes over its work.
