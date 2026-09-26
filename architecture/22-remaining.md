# Remaining Work

This is the single implementation and verification backlog. Durable behavior belongs to the
linked architecture contracts. An open acceptance clause is not proof of missing code.
Where older records conflict or lack current evidence, the item remains a verification task.

Feature implementation remains: framework accessibility, test integrations, component type
checking, and component formatting have concrete gaps below. Other work includes confirmed
repairs, verification, lint remediation, and deferred external acceptance. These classifications
come from static source and test inspection; they do not certify runtime behavior.

## Constraints

Preserve public commands, configuration semantics, findings, exit codes, package exports,
all seven targets, the direct npm launcher, the independent plugin, and existing dependencies.
Keep strict coverage and both structural rules at every level. Do not add compatibility
aliases, forwarding modules, private packages, or a test framework. Work alone.
No push, public publication, deployment, DNS change, or external repository mutation is
authorized. Generate managed outputs through policy and `gspot apply`.

On 2026-09-25 the owner authorized phase 4 with the NestJS integration, the step 5.1
conversions, the package additions of step 1.1, new acceptance cases, every test lane, and one
commit per step with `[skip ci]`. Lint remediation and the other phases remain unauthorized.
Repository-wide findings block the pre-commit hook, so the owner authorized `--no-verify` for
these commits alone.

On the evening of 2026-09-25 the owner asked for three things in order. Every lane passes. The
workarounds of the phase 4 work go. The test suite holds only tests with a clear purpose. Each
step is one commit on `main`, still `[skip ci]` and `--no-verify`.

Stage 1 commits:

- step 2.1, the fixture paths
- the hook installer receives its declared input
- a per-file finding without a path belongs to its file
- a copied block is reported on the copy
- sandbox installs skip the unreleased gspot pin
- the retired baseline assertions are gone

Stage 2 commits:

- Prettier plugins are manifest data
- a check declares the configuration it `needs`
- the Svelte type check finds its tsconfig through the selection
- the tool runner has one workspace parameter
- Expo Doctor has a precondition and a pure parser
- fragments carry their own imports (K-197)
- `init` selects a recommendation only when its detection matches (K-182)
- one sandbox helper serves the framework tests
- tests of retired commands and flags are deleted
- every test file over 300 lines is split by behavior, with shared fixtures in `tests/support/`
- Bun is 1.4.2, because 1.3.11 loses every child's captured output late in a long run

Lanes after stage 2: unit and integration 1722 pass, build passes, release 12 pass, the touched
acceptance files pass, and the two Docker cases still need a daemon.

When implementation resumes, follow phases 1 through 10 and their substeps in the printed
order. Complete each phase's exit condition before proceeding to dependent work. A verification
step requires inspection and execution of existing behavior, with repairs only for established
gaps. It does not presume that the feature needs to be implemented again.

Record failures at their owning step. A blocked prerequisite blocks its dependent evidence;
it does not count as a pass. Unavailable native platforms and authorization-dependent external
work remain explicitly deferred in phase 10. A later source change reopens affected earlier
steps and invalidates affected candidate evidence.
Adding the ledger's missing tool integrations requires a separately authorized dependency scope;
the cleanup's existing-dependencies constraint does not silently remove those commitments.

### Active CI bypass

CI remains paused until explicitly re-enabled. Do not dispatch, rerun, or wait for GitHub Actions.
If commits are later authorized during this bypass, include `[skip ci]` in every commit before
pushing. Keep hooks and local staged checks enabled. Native-platform and CI-only evidence is
deferred, not passed. Local workflow work remains in the future backlog. Agree execution frequency
before restoring remote gates.

Implementation-owner paths are relative to `packages/cli/src/`, except explicit repository
paths. Build ownership is `packages/cli/scripts/`; configuration and rule ownership is under
`packages/cli/`. Each retained task below names its owner, dependencies, acceptance clauses,
and required completion evidence. Those requirements are not claims of completed execution.

Retired directory prescriptions, removed Go/Rust/Ruby configurations, generated-Markdown
inventories, project-template flags, and delegation preferences remain retired.

## 1. Settle scope and dependency decisions

Owner: policy adoption and configuration/tool owners. Read the linked contracts before edits.

Complete 1.1 before 1.2.

### Step 1.1

Enumerate the missing React, React Native, Vue, and Svelte integrations in phase 4.
Resolve their pin compatibility and dependency scope before changing manifests or lockfiles.
Preserve the existing-dependencies constraint until that feature work is authorized.

Decision, 2026-09-25. The manifests pin these packages, and each ESLint plugin accepts ESLint 9:

- React: eslint-plugin-react-hooks 7.1.1, eslint-plugin-jsx-a11y 6.10.2,
  eslint-plugin-react-refresh 0.5.7, and eslint-plugin-testing-library 7.16.2.
- React Native: @react-native/eslint-plugin 0.87.1, eslint-plugin-react-native 5.0.0, and
  expo-doctor 1.20.4.
- Vue: eslint-plugin-vuejs-accessibility 2.6.0, eslint-plugin-testing-library 7.16.2, and
  vue-tsc 3.3.11.
- Svelte: svelte-check 4.7.6, prettier-plugin-svelte 4.1.1, and eslint-plugin-testing-library
  7.16.2. The css configuration pins postcss-html 2.0.0.
- NestJS: @darraghor/eslint-plugin-nestjs-typed 7.5.5, published on 2026-09-19. The seven-day
  release age admits it from 2026-09-26.

The root development dependencies move eslint-plugin-react-hooks to 7.1.1.

### Step 1.2

Decide which nested ignore and relocated selector forms must be supported under
[configuration carryover](03-configuration.md). Keep safe refusal and preservation for other
forms. Record that decision in the owning contract before conversion changes in phase 5.

Decision, 2026-09-25: nested `.prettierignore` files and negated override selectors become
supported conversions. [Carrying configuration](03-configuration.md#carrying-configuration)
records their meaning. Other refused forms keep their originals active.

Exit: the dependency scope and conversion boundary are explicit. Acceptance: K-193, K-211,
K-248, K-251, K-269, K-270. No implementation is authorized by this documentation task.

## 2. Repair fixtures and establish shared contracts

<a id="confirmed-defects"></a>

Confirmed defects come first where later evidence depends on them. Inspect existing shared
contracts before changing their consumers. Complete the following substeps in order.

### Relocated test fixture paths

Step 2.1. Confirmed defect.

Test moves changed paths inside fixture source strings. In
[scoped execution](../tests/integration/cli/execution/scoped-engines.test.ts), imports point to
`../run/private/router.js` although the fixture creates local `private/router.ts`.
[Flat ESLint adoption](../tests/integration/cli/policy/adoption/eslint-flat.test.ts) imports
`../../adoption/rules.mjs` although the module is created at the fixture root. The same pattern
appears in adoption isolation and evaluation fixtures. These paths can fail module resolution
or bypass the behavior the scenario intends to exercise.

Owner: execution and adoption tests. Task: restore fixture-relative paths independently of test
file imports, including attempted evaluator side-effect destinations. Dependencies: none beyond
the current test layout. Completion evidence: focused scenarios reach their intended assertions,
then deterministic discovery and execution retain all scenarios. Acceptance: T-1, T-2, T-3, T-7,
T-13, K-193.

Done 2026-09-25: the fixtures import `./rules.mjs`, `./plugin.cjs`, `./processing.mjs`, and
`./private/router.js`, and the evaluator side-effect destination sits inside the sandbox.

### Manifest and schema ownership

Step 2.2. Verification and confirmed repairs.

Verify feature-owned policy, tool metadata, fragments, schemas, and check dispatch. Derive parsed types and choices from definitions. Reject conflicting identities and invalid variants; keep shared parsers outside check definitions.

Owner: `configurations/ and policy/`. Dependencies: contract audit. Completion evidence: Runtime/editor schemas, choices, fragments, identity collisions, and dispatch agree with feature-owned definitions.

Acceptance: K-100, K-79, K-39, K-14, K-107, K-13, K-38, K-17, K-85, K-113, K-177, K-203, K-197, K-223, K-199, K-220, K-105, K-183, K-106, K-55, K-77, K-124, K-131, K-165, K-94, K-169, K-119, K-255, K-99, K-104.

Done 2026-09-26, K-197. No template names another configuration. The template helpers have no
`has()`. What moved:

- Library selectors and component file globs live in their manifests as `[[configs.selectors]]`
  and `code_files`; the base ESLint template joins them.
- The TypeScript imports are the typescript configuration's own imports template.
- The import style default is a setting default: `js` from javascript, `extensionless` from nextjs.
  The static-site configuration sets none, because a site served as files imports with a suffix.
- Component script languages are `tools.eslint.script_languages`, declared by vue, svelte, and
  typescript.
- The at-rules Stylelint accepts are `tools.stylelint.ignore_at_rules`. The css and nextjs
  configurations declare it.
- The extra Ruff families and test ignores are `tools.ruff.select`, `tools.ruff.test_files`, and
  `tools.ruff.test_ignores`, declared by python, pytest, and fastapi.
- Knip entries come from `entry_files` in the javascript manifest plus `tools.knip.entry`.
- The harness folder reaches the base template through `role = "harness"` on the jest and vitest
  settings; the `tests-directory-contents` rule is emitted by the runner fragments alone.

Done 2026-09-26, K-38: a tool row carries `crash_pattern` and `rule_page`. The nine check-level
patterns moved onto their tool rows, and `explain` prints the rule page a manifest declares
instead of a table in code. A plugin rule finds the page of the plugin whose prefix it carries.

Checked without change, 2026-09-26:

- K-119: the engine enum, tested.
- K-255: a repeated check name fails to load, tested.
- K-104: no `docsBase` remains.
- K-99: no `editor` or `imports_allowed` default remains.
- K-105: the manifest types derive from the schema.

The architecture folder holds one sentence for K-100 and no text for the names below. Nothing
verifiable remains under them.

- K-14, K-107, K-13, K-17, K-85, K-113, K-177
- K-203, K-223, K-199, K-220, K-183, K-106
- K-77, K-124, K-131, K-165, K-94, K-169

### Configuration and scopes

Step 2.3. Verification and confirmed repairs.

Verify readable comment-preserving writes, deepest-scope selection, consistent formatting settings, canonical setting names, and destination-safe serialization. Separate syntax failure from recoverable policy findings.

Owner: `policy/`. Dependencies: step 2.2 schemas and existing generation; repeat affected assertions after generated-output changes. Completion evidence: Root and nested scopes preserve comments, settings precedence, serialization, and malformed-input diagnostics.

Acceptance: K-147, K-238, K-51, K-88, K-215, K-224, K-48, K-222, K-228, K-116.

Done 2026-09-26, K-147: `readPolicy` returns the policy and its problems. A wrong entry or key is
dropped with its line recorded, and `check` reports each one as a finding of `integrity/policy`
while the other checks run. `apply` and the edit commands still refuse such a policy. A syntax
error, an unknown key, or a wrong shape still stops every command.

Done 2026-09-26, K-51: both policy writers wrap an array whose line passes 120 characters. Each
item stands on its own line as written, with the indentation the format table asks for. `gspot ignore`
adds its paths to the entry with the same check, rule, and reason, and only a new reason adds an
entry. A scope setting written into a sub-table or an inline table loads with the ones there.
This repository's own policy is rewrapped.

Open under K-51: a list item that is one inline table longer than 120 characters stays on one
line, because TOML allows no line break inside an inline table. This repository's policy holds 50
such items, each a reason sentence with its paths. Writing such a list as `[[tools.<name>.<key>]]`
blocks is the remaining step.

Done 2026-09-26, K-48: `[detect] project_files` names the files that mark a project, and `init`
proposes a scope for every folder that holds one, workspace members included. The project file
names live in the javascript, python, swift, xcode, and supabase manifests. `scopeFile(scope,
name)` in `configurations/targets.ts` is the one function that spells the path of a scope's
generated file.

Checked without change, 2026-09-26: K-88 (a folder selector means everything under it, the
deepest scope holds a file), K-215 (the vocabulary test), K-222 (one indent width, no YAML block
in the EditorConfig template), K-116 (one output schema), K-238 (the serialization tests). K-224
and K-228 have no text in the architecture folder.

Done 2026-09-26, K-233 (step 2.4): the css configuration detects and claims `.css` alone. The
css checks read `.module.css` and no Sass; a `.scss` file is a language init lists without a
configuration.

### CSS claims contradict the contract

Step 2.4. Confirmed defect.

[Acceptance K-233](06-enforcement-ledger.md#acceptance-k-233) limits CSS claims to `.css` and
requires Sass to be reported as unsupported. The
[CSS manifest](../packages/cli/configurations/language/css/manifest.toml) instead detects and
claims `.scss` and `.pcss` alongside `.css`.

Owner: CSS configuration and detection. Task: align detection and check claims with the agreed
contract. Dependencies: scope/claim selection. Completion evidence: `.css` receives the intended
checks, unsupported files receive no CSS findings, and Sass detection explains unsupported
coverage. Acceptance: K-233.

### Lifecycle confinement

Step 2.5. Verification and confirmed repairs.

Verify managed reads, replacements, deletions, path escapes, existing links, and native filesystem behavior. Hostile concurrent directory swaps remain outside the contract.

Owner: `platform/filesystem.ts`. Dependencies: shared policy/path contracts; integration with ownership/recovery is verified in step 2.6. Completion evidence: Unsafe links, read-only bytes, full-disk failure, and native replacement/recovery scenarios pass.

Acceptance: K-298.

### Ownership and recovery

Step 2.6. Verification and confirmed repairs.

Verify common ownership routing, proposal publication, pruning, and interrupted recovery across init, apply, remove, and uninstall. Preserve unowned files, later edits, original bytes and modes, and fresh-clone files.

Owner: `lifecycle/ownership.ts`. Dependencies: confinement. Completion evidence: Init, apply, remove, uninstall, and interrupted batches preserve authored bytes and modes.

Acceptance: K-257, K-252, K-118, K-299.

Checked without change, 2026-09-26, steps 2.5 and 2.6. The confinement tests hold escaped,
linked, private, and missing targets, a second writer, read-only identities, and empty-directory
removal. The ownership tests hold two replacements, later edits through apply and uninstall,
interrupted journals, damaged backups, a full disk during a batch, a failed rename, and a fresh
clone. K-252 has no text in the architecture folder.

Exit: fixture scenarios reach their intended assertions; schemas, scopes, CSS claims, and
local publication/recovery contracts agree. Verify confinement primitives in 2.5, then their
publication/recovery integration in 2.6. Native-only evidence remains assigned to phase 10.

## 3. Establish installation and normal acquisition

These prerequisites must work before native tool compatibility can be established.

### Tool installation

Step 3.1. Verification and confirmed repairs.

Verify immutable installation under each supported package manager, workspace and private-registry configuration. Verify manifest-owned install metadata, missing-host advice, isolation, retries, and tracked-file preservation. Resolve changed locks only during apply.

Owner: `tools/`. Dependencies: publication and package locks. Completion evidence: Fresh npm, Bun, pnpm, Yarn Classic/modern, Python, workspaces, and authenticated registries install locked tools without tracked changes.

Acceptance: K-237, K-264, K-265, K-266, K-283, K-267, K-268, K-297, K-180, K-240.

Checked 2026-09-26, steps 3.1 and 3.2. The tools lane holds the package-manager matrix: npm,
Bun, pnpm, Yarn, a workspace, and an authenticated registry. It holds the installer failures too.
The release lane installs from the built binary.

A cold `gspot install` of the formatting tools with no `GITHUB_TOKEN` succeeded on 2026-09-26.
The boundary is GitHub's anonymous limit of 60 requests an hour. The editorconfig-checker npm
wrapper 7.0.0 meets it when it fetches v3.4.0 at install time. A failed package installation
whose output shows that refusal now names `GITHUB_TOKEN` as the fix. K-265, K-266, K-283, and
K-240 have no text in the architecture folder.

### Resolve acquisition failures

Step 3.2. Acquisition repair.

Owner: tool installation. Resolve EditorConfig Checker 3.4.0 GitHub HTTP 403 failures and failed
mise acquisitions through normal installation. Record versions and exact failing boundaries.
Do not substitute host executables, bypass downloads, or call a preinstalled tool fresh acquisition.
Dependencies: step 3.1 and provider availability. Completion evidence: normal cold installation
succeeds, with failed-download and corrupt-cache behavior preserved. Acceptance: K-237,
K-264 through K-268, K-283, K-297.

Exit: native tools can be acquired through supported paths. Provider failures remain failures
and block dependent journeys; the full source/installed manager matrix belongs to phase 9.

## 4. Implement the agreed framework capabilities

<a id="missing-implementation"></a>

Implement the confirmed missing capabilities using the contracts and dependency decisions from
phase 1 and installation from phase 3. For each substep, change feature definitions before
consumers, regenerate through the owning generation path, and verify focused defect/correction
cases before moving to the next framework.

### React accessibility and test integration

Step 4.1. Missing implementation.

The [React contract](06-enforcement-ledger.md#configuration-react) includes React recommended
and JSX-runtime sets, JSX accessibility, refresh rules, and Testing Library. The current
[manifest](../packages/cli/configurations/framework/react/manifest.toml) and
[fragment](../packages/cli/configurations/framework/react/eslint.fragment.js.tmpl) provide
React and Hooks rules but omit those integrations. Reconcile the Hooks pin with the ledger
as part of compatibility verification; a version difference alone does not prove incompatibility.

Owner: React configuration and ESLint generation. Task: supply the agreed rule sets with their
scope and level behavior. Dependencies: authorized dependency changes and compatible pins.
Completion evidence: generated configurations at both levels reject planted defects and accept
corrections, including test-file scoping and native exclusion of DOM accessibility rules.
Acceptance: K-211, K-248, K-251.

### React Native tooling

Step 4.2. Missing implementation.

The [React Native contract](06-enforcement-ledger.md#configuration-react-native) requires native
ESLint plugins and Expo Doctor. The current
[manifest](../packages/cli/configurations/framework/react-native/manifest.toml) supplies the Expo
ESLint plugin, but omits the native plugins and Doctor check. Existing JavaScript template
selectors already cover Touchable, list keys, scrolling, and AsyncStorage; retain and verify them.

Owner: React Native configuration and check execution. Task: add the agreed native plugin rules
and Expo-only push-stage Doctor behavior. Dependencies: compatible pins and native acceptance.
Completion evidence: native rule defects/corrections, Expo/non-Expo scope selection, and truthful
Doctor failures without commit-stage network activity. Acceptance: K-211, K-248, K-251.

### Vue and Svelte component support

Step 4.3. Missing implementation.

The [Vue](06-enforcement-ledger.md#configuration-vue) and
[Svelte](06-enforcement-ledger.md#configuration-svelte) contracts exceed the current ESLint
integrations. Their [Vue manifest](../packages/cli/configurations/framework/vue/manifest.toml)
and [Svelte manifest](../packages/cli/configurations/framework/svelte/manifest.toml) omit
`vue-tsc`, `svelte-check`, Vue accessibility, and Testing Library integrations. Component
formatting also lacks `prettier-plugin-svelte` and component CSS lacks `postcss-html` integration.
Svelte fragments mention runes-module filenames, but the Svelte check claims only `.svelte`;
verify which selected check actually receives `.svelte.js` and `.svelte.ts` before repairing claims.

Owner: Vue/Svelte definitions, ESLint/formatter generation, and component check selection.
Task: implement the contracted type checking and takeover, accessibility, test-file rules,
formatting, and component style checks. Dependencies: authorized pins, parser compatibility,
and scope selection. Completion evidence: native defect/correction cases for each component
language, warning failures, type-check takeover without duplicate checks, scoped test rules,
and correction of component styles and formatting. Acceptance: K-211, K-248, K-251, K-233.

### Tool compatibility and release pins

Step 4.4. Native compatibility verification.

Execute the pinned tools with generated configurations and parse actual results. Registry existence and peer ranges are necessary metadata, not compatibility evidence. Preserve distinct installer versions and supported generated rule names.

Owner: `configurations/ and tools/`. Dependencies: normal pinned acquisition. Completion evidence: Pinned executables consume generated configuration and emit actual parsed results; installer versions remain distinct.

Acceptance: K-251, K-207, K-249, K-206, K-250, K-213.

Done 2026-09-26, step 4.4. `tests/acceptance/release/pins.test.ts` asks npm, PyPI, crates.io, and
GitHub for every pin (K-206). It holds each pin at or above the floor its manifest names
(K-249), and the ESLint pin inside the peer range of every plugin (K-207). A tool the repository
supplies carries a floor and no pin.

`tests/integration/tools/flags.test.ts` runs the help of every pinned tool a command names and
holds each flag it passes (K-251). A tool absent from the machine is a visible skip. K-250 holds
through the licenses and readme-shape tests. K-213 has no text in the architecture folder.

### NestJS integration

Step 4.5. Missing implementation.

The [NestJS contract](06-enforcement-ledger.md#configuration-nestjs) requires the recommended
set of `@darraghor/eslint-plugin-nestjs-typed`, the `tools.nestjs.swagger` setting, and both
decorator options in a NestJS scope. The current
[manifest](../packages/cli/configurations/framework/nestjs/manifest.toml) supplies the selectors
and two turned-off rules alone.

Owner: NestJS configuration, ESLint generation, and `typescript/tsconfig-options`.
Dependencies: the pin decision of step 1.1. Completion evidence: planted route, Swagger, and
decorator defects with their corrections. Setting detection at `init` stays with K-93.
Acceptance: K-211, K-248.

Within 4.3, complete Vue first, then Svelte. For each, order the changes as tool definitions
and pins, parser/check selection and type-check takeover, ESLint accessibility/test rules,
formatter/style integration, then generated outputs and focused acceptance.

Exit: the agreed framework capabilities and generated configurations run with compatible pins
at both levels. Remaining native-platform evidence is explicitly deferred to phase 10.

## 5. Complete carryover and lifecycle consumers

Use the verified publication contracts before changing adoption or command consumers.

### Bounded configuration conversion

Step 5.1. Scoped conversion implementation.

[Formatter adoption](../packages/cli/src/policy/adoption/formatting.ts) refuses nested ignore
files; [formatter generation](../packages/cli/src/generation/format.ts) refuses some relocated
negated override selectors. These are unsupported conversion forms. Safe refusal with preserved
originals complies with the preservation contract; it is not evidence of data loss. Root Prettier
ordered ignore negations already have implementation and retained acceptance scenarios.

Owner: policy adoption and formatter generation. Task: decide and document which refused forms
must become supported under [configuration carryover](03-configuration.md), then implement
those conversions when authorized. Dependencies: effective native semantics and publication.
Completion evidence: existing/future-file comparisons, correction and recovery; every remaining
unsupported form preserves its active original and reports every uncarried setting.
Acceptance: K-36, K-193, K-217, K-269, K-270.

### Configuration carryover

Step 5.2. Verification and confirmed repairs.

Verify lossless effective configuration resolution for path-specific rules, shared manifests, formatter overrides, and every supported root pointer. Retain unsupported source configuration and list every uncarried setting. Keep developer ESLint and its dependencies intact.

Owner: `policy/adoption/`. Dependencies: lifecycle publication. Completion evidence: Native before/after comparisons retain effective configuration for existing and future files; unsupported settings retain originals.

Acceptance: K-36, K-193, K-41, K-120, K-59, K-217, K-239, K-269, K-270.

### Initialization and detection

Step 5.3. Verification and confirmed repairs.

Verify project and dependency detection, grouped configuration selection, detected defaults, and one read-only proposal. Initialize new and existing repositories without running checks; a missing tool differs from invalid configuration or failed lock resolution.

Owner: `commands/init/`. Dependencies: adoption and tools. Completion evidence: New/existing project journeys distinguish invalid configuration, unavailable tools, and failed lock resolution without running checks.

Acceptance: K-182, K-214, K-247, K-53, K-93, K-40, K-64, K-127, K-126, K-128.

### Commands and reusable profiles

Step 5.4. Verification and confirmed repairs.

Verify the exact public command surface and selectors. Preserve export and init --from, including pathless ignores and integration choices; report omitted repository-specific values. Verify dry-run preservation and effective add/remove dependencies.

Owner: `commands/ and policy/profiles/`. Dependencies: policy and lifecycle. Completion evidence: Public help, selectors, dry runs, add/remove, export, and init --from match the command contract.

Acceptance: D-129, K-62, K-63, K-95, K-98, K-284, K-285, K-287, K-288, K-291, K-290, K-289.

### Exceptions and public vocabulary

Step 5.5. Verification and confirmed repairs.

Verify one tracked exception policy and public definition/reference names. Preserve external tool directives, optional reasons and require_reasons, scoped ignores, and executable fixer results. No repository-wide synonym campaign is required.

Owner: `policy/ and commands/`. Dependencies: schema/command agreement. Completion evidence: Reasons, scoped exceptions, external directives, definitions, and fixer outcomes preserve their public contracts.

Acceptance: K-89, K-66, K-308, K-111, K-115, K-234, K-110, K-114.

### Generated metadata and drift

Step 5.6. Verification and confirmed repairs.

Verify supported root pointers, meaningful generated-drift findings, and merge-conflict recovery. The managed-block generator already derives untracked paths from manifests; verify its no-Git behavior. Preserve recovery metadata and retire obsolete local skip behavior.

Owner: `generation/ and lifecycle/drift.ts`. Dependencies: publication and ownership. Completion evidence: Root pointers, meaningful drift, conflict recovery, metadata retention, and manifest-derived ignore paths pass.

Acceptance: D-100, K-47, K-259, K-246, A-5, K-296, K-274.

Done 2026-09-26, steps 5.2 to 5.6. Repairs: the setting messages say a configuration has a
setting, and a unit test holds every message function to the words of the config (K-89);
`integrity/generated-drift` is declared in the structure manifest and tested (K-246); a
generated file holding merge conflict markers is a drift finding that names `gspot apply` and
`gspot install`, and `apply` writes it again (K-274); the manifest key `stub` is `pointer`, and
`generation/pointers.ts` writes them (K-269). Checked without change: K-36, K-193, K-120, K-59,
K-217, K-182, K-53, K-64, K-126, K-128, K-62, K-95, K-284, K-287, K-291, K-290, K-66, K-111,
K-114, K-234, A-5, K-296, D-100, D-129, K-308, K-259.

Done 2026-09-26, K-93 and K-40: a setting takes `detect`, and `init` fills it from the tree.
`tools.nestjs.swagger` comes from the `@nestjs/swagger` dependency, `architecture.types_directory`
from the first of `types` and `src/types` that exists, and `tools.sqlfluff.dialect` (K-160) from
the database driver or a `supabase` folder. The build command and the Xcode destination stay
proposed by code in `commands/init/`. No text exists in the architecture folder for K-41, K-239, K-270, K-214,
K-247, K-127, K-63, K-98, K-285, K-288, K-289, K-115, K-110, or K-47.

Exit: supported carryover is lossless, unsupported originals remain active, and command,
profile, exception, generated-output, and recovery behavior agree with policy.

## 6. Verify execution and enforcement in dependency order

<a id="verification-still-required"></a>

These are unresolved verification requirements, not declarations of absent features. Inspect and
exercise each behavior, repair confirmed gaps in its owner, then repeat its focused evidence.
Older partial passes do not close a clause.

### Immutable Git selection

Step 6.1. Verification and confirmed repairs.

Verify exact staged and pushed object selection, all ref pairs, first pushes, deleted branches, shallow clones, submodules, linked worktrees, and config below the Git root. Keep whole-project findings and failures for affected scopes; no-Git mode remains supported.

Owner: `repository/revisions/`. Dependencies: confinement and dependency copying. Completion evidence: Staged and all pushed objects, shallow clones, worktrees, submodules, and nested policy use immutable selected inputs.

Current evidence: revision dependency copying includes POSIX and Windows launcher relocation
and known editable Python loaders. Audit other executable `.pth` forms for host-checkout imports;
do not classify all Windows launcher handling as absent. Include corrected or safely refused
loader forms in immutable staged/pushed acceptance.

Acceptance: K-70, K-293, K-294, K-295, K-271, K-272.

### Session observations and parsing

Step 6.2. Verification and confirmed repairs.

Verify session-owned file, scope, parse, and Git observation reuse. Refresh after edits and between sessions. Preserve scoped SQL history, staged Xcode symlinks, unusual filenames, malformed-input failures, and language-specific parsing.

Owner: `execution/session.ts and parsers/`. Dependencies: repository observations. Completion evidence: Read/parse/Git reuse remains session-scoped and refreshes after edits; malformed input and unusual filenames remain visible.

Acceptance: K-138, K-148, K-176, K-24, K-139, K-171, K-190, K-162.

### Process execution and failure reporting

Step 6.3. Verification and confirmed repairs.

Verify routing tools and fixers through shared resolution, batching, deadlines, cancellation, and capture. Audit remaining failure-to-empty readers. The plugin directory reader already propagates read failures. Distinguish absent, skipped, failed, changed, and unchanged results.

Owner: `platform/spawn.ts and execution/`. Dependencies: tool observations. Completion evidence: Native fatal, malformed, finding, corrected, cancellation, and deadline cases retain exact exits and cleanup.

Unresolved risk: a real plist diagnostic combined with an inaccessible input might conceal tool
inability. Native malformed/missing/inaccessible combinations must establish classification;
static inspection alone has not confirmed that failure. Also audit remaining failure-to-empty
readers rather than assuming every adapter is broken.

Acceptance: K-42, K-158, K-307, K-140, K-157, K-258.

### Cache correctness and performance

Step 6.4. Verification and confirmed repairs.

Verify configuration, tool, scope, and declared-input invalidation; relocate platform build caches. Preserve owned 30-day retention and narrowed-run behavior. Measure bounded commit and initialization cost under stated cold/warm conditions.

Owner: `execution/cache.ts`. Dependencies: stable source and normal acquisition. Completion evidence: Tool/configuration/scope/declared-input changes invalidate results; owned retention and cold/warm timing meet the contract.

Acceptance: K-43, K-44, K-71, K-196, T-12, K-69.

### Isolated generators and builds

Step 6.5. Verification and confirmed repairs.

Verify isolated generation and build checks without modifying authored or untracked working-tree files. Swift incremental compilation is locally implemented; native Xcode reuse and complete build isolation remain open.

Owner: `checks/`. Dependencies: revision isolation. Completion evidence: Build/generator checks preserve authored and untracked files; native Xcode reuse and per-language build settings pass.

Acceptance: K-156, K-159, K-154, K-143.

### Shared language and plugin enforcement

Step 6.6. Verification and confirmed repairs.

Verify equivalent shared enforcement across Swift, JavaScript, TypeScript, Python, and framework components. Preserve all standalone plugin exports and options, alias and type-only import handling, valid exemptions, locations, and corrected cases.

Owner: `checks/ and packages/eslint-plugin/src/`. Dependencies: parsers and generated configurations. Completion evidence: Cross-language defects/corrections preserve locations, aliases, type-only imports, valid exemptions, options, and plugin exports.

Audit inline documentation trivia and lock-format edge cases against existing enforcement.
Computed ESLint comparisons already have lifecycle/evaluator implementations and retained tests;
verify their effective-rule behavior rather than scheduling a new comparison feature.

Acceptance: K-188, K-208, K-209, K-210, K-50, K-133, K-136, K-49, K-137, K-87, K-235, K-86, K-102, K-187, K-186, K-189.

### Domain-specific scope behavior

Step 6.7. Verification and confirmed repairs.

Verify per-scope inputs and layout-independent behavior for Python, Swift, SQL dialects, Docker, and route tests. Preserve TypeScript project references, statement locations, Bash/Zsh/Bats distinctions, and external protocol names.

Owner: `checks/`. Dependencies: scope resolution and parsers. Completion evidence: Python, Swift, SQL, Docker, routes, TypeScript references, and shell variants retain scoped inputs and external names.

Acceptance: K-155, K-163, K-90, K-150, K-153, K-160, K-184, K-191, K-226, K-144, K-149, K-172, K-178, K-254, K-134, K-192.

### Strictness levels and adoption usefulness

Step 6.8. Verification and confirmed repairs.

Verify one level owner across planning, templates, plugin, prose, and guides. Recommended includes defect checks and mandatory trivial-function and trivial-file rules on
ordinary and established projects. Keep both structural rules enabled by default at every level,
root and nested scope, and standalone plugin surface. Retain other opt-in naming, layout, and
style rules at all. Do not add blanket callback or framework exemptions during cleanup.

Owner: `policy/ and generation/`. Dependencies: schemas and shared enforcement. Completion evidence: Both levels and inherited scopes execute required structural rules; optional style/naming rules retain their declared level.

Acceptance: K-198, K-52, K-221, K-135, K-141, K-142, K-123, K-152, K-227, K-174, K-161, K-167, K-112, K-200, K-175, T-19, T-33, K-75, K-91, K-301, K-101, K-151, K-201, K-74.

### Integration and configuration coverage

Step 6.9. Verification and confirmed repairs.

Verify the agreed ledger capabilities. Jest and nginx already have manifests, check execution,
and acceptance suites; their remaining work is execution and coverage verification. Framework
gaps are recorded in phase 4. Verify scoped security packs, non-npm
licenses, database lint, and Swift test overrides against native results. Do not expand this into
adding every available linter.

Owner: `configurations/ and checks/`. Dependencies: ledger reconciliation. Completion evidence: Each agreed capability has native defect/correction evidence, including Jest, nginx, accessibility, security packs, licenses, databases, and Swift overrides.

Acceptance: K-218, K-211, K-212, K-233, K-236, K-80, K-248, K-256.

### Hook composition and runner tasks

Step 6.10. Verification and confirmed repairs.

Verify each supported hook manager and runner, reachable existing-hook composition, independently replayed stdin, failures, clone-local setup, and owned restoration. Preserve developer tasks and never inject prepare scripts.

Owner: `lifecycle/hooks/`. Dependencies: installation and recovery. Completion evidence: Every manager/runner clone journey preserves locks and tasks, forwards stdin, rejects defects, and restores owned hooks.

Acceptance: K-109, K-76, K-78, K-56, K-57, K-58, K-60, K-292, K-275, K-37, K-108.

### Reports, doctor, and check coverage

Step 6.11. Verification and confirmed repairs.

Verify progress output, truthful summaries and cached results, Git hook diagnostics, per-kind check coverage, scoped explanations, and useful configuration errors. Message-stage runs must preserve the prior report.

Owner: `output/ and commands/doctor/`. Dependencies: execution and comparison owners. Completion evidence: Progress, summaries, caching, coverage, explanations, hook readiness, and message-stage report preservation are exercised.

Acceptance: K-84, K-117, K-82, K-83, S-6, K-122, K-132, K-130, K-185, K-243, K-81, K-166, K-45.

### Consumer CI generation

Step 6.12. Verification and confirmed repairs.

Verify GitHub fork/private/merge-queue behavior, least permissions, useful SARIF, GitLab CodeClimate reports and clone depth, and documented commands for other CI systems. Preserve no-CI selection and existing workflow ownership.

Owner: `generation/workflow.ts`. Dependencies: workflow ownership and report schemas. Completion evidence: Local GitHub/GitLab fixtures cover forks, private repositories, merge queues, permissions, reports, clone depth, and no-CI selection.

Acceptance: K-253, K-96, K-276, K-277, K-278.

Done 2026-09-26, steps 6.1 to 6.12. The repairs:

- A check takes `needs_git`. `secrets/gitleaks-files` scans the files of a folder with no git,
  the git scans wait for a repository, and `init` leaves the commits configuration out without
  git (K-271, K-182).
- Vale reads every language by path: Python and CSS by their own extension, and shell and SQL
  through `[formats]` (K-176).
- The naming extractor skips a binding from `require` or `await import` alone (K-137).
- pydoclint reads its docstring style from `[tool.pydoclint]` (K-152).
- A unit test holds that every check needing a setting with an empty default waits for it
  (K-157).

The other clauses with text were checked without change: their named tests exist in the unit,
integration, tools, and acceptance lanes.

Done 2026-09-26, K-50: a framework manifest carries `[[naming.rules]]` for its own files. The
react, nextjs, express, and nestjs manifests declare theirs, and the Next.js rule left the shipped
policy. The svelte manifest's default for `structure.single_file_folder_allowed` exempts
`src/routes/**`, and react-native recommends jest.

Open under section 6:

- `[[rules_off]]` in a manifest (K-208); a framework turns a shared rule off inside its own
  fragment today.
- A static-site case that tracks `dist` (K-154).
- `glab ci lint` over the GitLab file (K-277).
- The three plan lines for `bitbucket-pipelines.yml` (K-278).
- The `[tool.ruff.lint.pydocstyle]` mapping (K-152).

No text exists in the architecture folder for these names:

- K-294, K-148, K-139, K-171, K-190, K-158, K-44, K-71, K-159
- K-188, K-209, K-210, K-133, K-136, K-235, K-86, K-187
- K-155, K-163, K-90, K-150, K-52, K-221, K-141, K-142, K-123, K-227
- K-161, K-167, K-112, K-200, T-33, K-91, K-151, K-212, K-80
- K-78, K-57, K-84, K-117, K-83, S-6, K-132, K-130, K-185, K-243

Exit: local execution, enforcement, hooks, reports, and generated consumer workflows satisfy
their contracts. Step 6.4 establishes cache correctness; final cold/warm performance measurement
uses the unchanged candidate in phase 9. Remote CI remains paused.

## 7. Complete guides, examples, and verification tooling

Stabilize behavior before finalizing executable documentation and the repository gates.

### Rule guides and agent instructions

Step 7.1. Verification and confirmed repairs.

Verify level-aware rule assembly, conditional selection, and executable example
acceptance. Retain outstanding verification for decimal ports, deletion roots, Python
limits/suppressions, and SQL ownership. Preserve shared agent blocks and authored Cursor files.

Owner: `agents/ and rules/`. Dependencies: selection and executable examples. Completion evidence: Decimal ports, deletion roots, Python limits/suppressions, SQL ownership, conditional guides, shared blocks, and Cursor preservation pass.

Acceptance: K-229, K-241, K-261, K-230, K-179, K-232, K-231, K-260, K-242, K-262, K-65, K-67, K-279, S-10.

### Reference content loaders

Step 7.2. Verification and confirmed repairs.

Execute defect/correction examples for every shipped check and plugin reference. Keep the existing Astro loader, public URLs, validation, and attribution.

Owner: `docs/src/content/reference/`. Dependencies: released definitions and native examples. Completion evidence: Every shipped reference has executable defect/correction evidence, validated identity, source attribution, and accurate public metadata.

Acceptance: S-4, S-5, S-11, S-14, S-16, S-17, K-225, S-15, K-304, K-205, K-303.

### Behavioral acceptance quality

Step 7.3. Verification and confirmed repairs.

Verify executable examples, acquisition-blocked journeys, and supported-platform acceptance.

Owner: `tests/`. Dependencies: stable source, native tools, isolated registry. Completion evidence: Every retained scenario is discovered in its proper lane; planted failures have corrected cases and exact results; no required skip is a pass.

Acceptance: T-27, T-4, T-8, T-21, T-24, T-1, T-2, T-32, T-3, T-6, T-7, T-13, T-28, T-17, T-14, T-30, G-2, T-29, T-26, T-5, T-18, T-23, T-10, T-15, T-16, K-28, T-36, T-22, T-25, T-20, T-35, T-9.

Audit 2026-09-25: every test file under `tests/` read in full. Every retained test plants a defect
and its correction through gspot, or feeds a pure function fixture input. The deleted assertions
covered retired behavior: the `allow` and `declare` commands, `apply --check`,
`--lower-baselines`, `--baseline`, `init --presets`, the `[preset]` manifest table, and the
`presets` policy field.
Two files stay over 300 lines because each is one test callback:
`tests/integration/tools/hooks/lefthook.test.ts` and
`tests/integration/tools/tools/packages/project.test.ts`; step 8.1 splits them with the other
long callbacks. bun runs test files breadth-first by depth, so a file moved into a folder runs
after every file above it.

### Repository checks and tooling

Step 7.4. Verification and confirmed repairs.

Verify template validation at both levels, meaningful unit/plugin push checks, and required prerequisite failures. Keep Bun and mise, feature-owned constants, schemas and assets with consumers, and no source/test symmetry or new private packages.

Owner: `gspot.toml and .mise/conf.d/repo.toml`. Dependencies: all behavior owners. Completion evidence: Both generation levels, unit/plugin checks, prerequisites, Bun coverage substitution, and final repository checks execute.

Acceptance: S-1, S-2, S-3, S-7, S-8, S-12, G-13, K-306.

Done 2026-09-26, steps 7.1 to 7.4. The repairs:

- The rules lint reports a list item that ends with a comma, with `and`, or without a full
  stop (K-229). A parent that ends with a colon before a nested list is whole.
- The corpus holds 185 such items in 12 files, 71 of them in the Docker guide. They are stage 4
  findings.
- `CONTRIBUTING.md` explains local verification and how to read CI results (S-3).
- A completion test asks the completion engine for every command and every visible flag of
  the program, and holds that each shell script defers to the program (T-22).
- A generation test renders every configuration at both levels and parses each JSON, TOML,
  YAML, and JavaScript output with its reader (S-1). The formatter pass belongs to the tools lane.

Checked without change: the rules lint tests, the managed block tests, the reference loader
tests, the asset path tests (K-306), and the agent file tests (K-279).

Open under section 7:

- K-230: rule files do not vary by level, so the two assemblies have nothing to compare.
- K-231: a word list built from every manifest's tool names flags ordinary words such as
  `next` and `globals`. The lint keeps its curated boundary terms.
- K-241: no lint holds a rule file against the check that refuses what it asks for.

No text exists in the architecture folder for these names:

- K-232, K-260, K-242, K-262, S-5, S-11, S-14, S-16, S-17, K-225
- S-2, S-7, S-8, S-12
- T-4, T-8, T-21, T-1, T-2, T-32, T-6, T-7, T-13, T-17, T-14, T-30, G-2
- T-26, T-5, T-18, T-10, T-15, T-16, T-25, T-35, T-9

Exit: examples exercise the intended rules, all retained scenarios are discovered in the
proper lane, and repository gates detect required failures. This prepares the final gate;
release-matched site and installed acceptance execute in phase 9.

## 8. Complete repository-wide lint remediation

This is a required separate future phase. This documentation task preserves the findings; it does not establish
a clean repository. The historical full and staged counts are diagnostic observations, not current
completion evidence. Owner: the source/configuration owners named by each finding. Dependencies:
phases 1 through 7 and current generated policy. Completion: rerun the unchanged candidate's
full and manual checks with every required check executed and passing; record final staged
evidence in step 9.8.

### Step 8.1

Repair TypeScript and ESLint findings, including authored build code.

Measured 2026-09-25 at level all: 8,881 ESLint findings (tests 3,667; cli 4,898; plugin 201;
docs 115). 4,410 are `gspot/no-trivial-functions`, which reports every arrow callback of two
statements or fewer, so the rule's treatment of inline callbacks is decided here before the
repairs. 131 test callbacks are over 60 lines; 52 files are over 300 lines, 14 of them under
`packages/cli/src`.

Record 2026-09-26. The ESLint count fell from 9,314 to 6,002 in eighteen commits on main, `579b18fb` to
`3efef435`. Every rule outside the complexity family is clear. The cleared rules cover unsafe values, nullable
conditions, template expressions, magic numbers, callback references, nested templates, import layout, floating
promises, non-null assertions, unsafe regular expressions, and trivial files. Commands export the types of their
JSON output, and tests parse reports through the report schema. Bun types every asymmetric matcher as any, so
typed matcher wrappers in `tests/support/expectations.ts` stand in for them.

Nine trivial modules folded into their owners. The nginx, SQL, and Xcode tokenizers read one lexeme kind per function.

Remaining: 4,791 `gspot/no-trivial-functions`, of which about 3,800 are inline callbacks of one or two statements.
The owner decides whether the rule keeps counting anonymous callbacks passed as call arguments before those
repairs start. The complexity family stands at 277 `no-await-expression-member`, 254 `complexity`, 198
`cognitive-complexity`, 185 `max-lines-per-function`, and 104 `max-depth`. It also holds 90
`no-nested-conditional`, 84 `max-statements`, and 19 `max-lines`. The densest files are
`revisions/dependencies.ts`, `lifecycle/ownership.ts`, and `evaluation/eslint.ts`.

Open: `gspot install` cannot
fetch the unpublished plugin, so the private plugin copy is refreshed by hand after plugin changes (D-158). The
`@npmcli/config` definitions import keeps its index path with a reason, because the package defines the values
there.

Record 2026-09-26, later. The ESLint count fell to 5,570 by `b84bd00c`. Every rule outside the trivial-function rule
and the complexity family is clear, including `no-await-expression-member`. The trivial-function rule reports 734
named functions of two statements or fewer and 4,292 inline callbacks. The owner has ruled that one-statement helper
functions are not acceptable; whether the rule keeps counting inline callbacks is still open. The complexity family
stands at 544 findings, most of them test callbacks over 60 lines.

A sweep of the tests and the CLI source ran the same day, in six commits from `6f518800` to `39caa4c5`. It found no
import cycle, no dead source, no duplicated source, and no unreasoned suppression. Three test files that exercised
only the test harness are gone, with one assertion that a retired page is absent and one redundant case. Five
manifest invariants are part of manifest validation instead of tests, so a tool without a pin or a check that
reads an empty setting fails to load. The duplication check passes on the tests again through shared install, corrected-run,
engine-input, and hook-status helpers. The hooks directory, the proposal types, the retained paths, and the runner
task plan moved to their owners, and the `cached` field the contract names now exists in the schema.

### Step 8.2

Repair naming, placement, structure, and trivial-function/file findings in their behavior owners.

### Step 8.3

Remove confirmed duplication without introducing forwarding or configurable generic services.

### Step 8.4

Repair prose, Markdown, documentation paths, and executable example findings.

### Step 8.5

Reconcile unused dependencies, including the retained documentation YAML dependency, in the
authorized dependency scope from phase 1. Preserve dependencies outside that scope.

### Step 8.6

Resolve external-tool failures separately from source findings, including Pinact GitHub quotas
and native installation failures. Re-run the affected check after the cause is resolved.

Do not disable rules, lower strictness, pad code, introduce blanket exceptions, skip required
checks, or replace native findings with mocked success. Acceptance: S-1, S-2, S-3, S-7, S-8,
S-12, K-306, and the owning language/enforcement clauses.

Run remediation in the order listed above. Resolve prerequisite tool failures before retrying
the affected check. Verify behavior affected by any repair before declaring this phase complete.
Exit: required full and manual checks pass without suppressing findings or weakening rules.
The final staged check remains the last local candidate action in phase 9.

## 9. Verify one unchanged candidate

Freeze the source after phases 1 through 8. Follow the numbered candidate gate below exactly.
The detail sections after it define required evidence within that gate; they are not additional
passes or permission to repeat expensive publication per test file.

### Candidate gate

This gate is deferred during the architecture-only task.

Owner: repository verification and release tooling. Record the base revision, source digest,
version, artifact hashes, commands, exit statuses, and active CI bypass. A source change requires
rebuilding affected artifacts and repeating affected acceptance. Required evidence:

#### Step 9.1

Discover every retained scenario in unit, deterministic integration, native integration,
source acceptance, and installed-release acceptance. Keep one registry lifecycle for release
journeys and no global fixture cache. Measure coverage without introducing a quota.

#### Step 9.2

Verify types, schema parity, commands, generation at both levels, ownership/recovery,
cancellation, caching, revision isolation, and plugin RuleTester behavior.

#### Step 9.3

Verify cold/warm inputs, download failures, corrupt caches, all seven binaries, standalone
embedded parsers, legal payloads, ESM/CommonJS plugin imports, launcher behavior, and eight
CLI package dry runs plus the plugin dry run. Do not publish publicly.

#### Step 9.4

Run source acceptance and installed-release acceptance sequentially after source settles.
Treat acquisition failures as failures and unavailable platforms as deferred evidence.

#### Step 9.5

Validate architecture links, documentation references and examples, schema endpoint, site
build, links, and fragments. Keep screen-reader acceptance outside the agreed scope.

#### Step 9.6

Measure the cold/warm performance cases below after normal acquisition and source/installed
acceptance succeed. Record actual conditions and results without relaxing bounds.

#### Step 9.7

Run repository checks at `level = "all"`, manual checks, and doctor. The existing Bun
`tests/unit` and `tests/coverage` substitution for Jest coverage remains the only substitution.
No required missing tool or skipped check establishes a pass.

#### Step 9.8

Verify repeated apply, drift preview, immutable installation in a disposable checkout, and
real rejecting/corrected hook journeys. Run `gspot check --staged` last through a disposable
index, and verify the real index remains byte-identical. Do not make a commit for verification.

Dependencies: confirmed repairs, normal acquisition, local tools, and phase 8.
Acceptance: K-24, K-28, K-55, K-300, K-303 through K-307, K-204, K-219, K-310; all applicable behavior clauses above.

### Packaging and installed-product acceptance

Evidence for steps 9.3 and 9.4.

Verify frozen-candidate artifact validation, installed CLI acceptance, legal payloads,
provenance/signing verification, and native execution on supported platforms. The build declares seven targets; prior cross-compilation does not establish current-candidate
build success or native execution on each target.

Owner: `build/ and tests/support/release/`. Dependencies: all seven builds and normal acquisition. Completion evidence: Launcher/platform/plugin payloads, legal notices, parser independence, ESM/CommonJS exports, provenance, and installed journeys pass.

Acceptance: K-164, K-145, K-121, K-244, K-245, K-280.

### Acquisition and package-manager journeys

Evidence for step 9.4. Repeat normal acquisition against the frozen candidate; if it fails,
return the failure to step 3.2 before continuing dependent acceptance.

Owner: tool installation and release acceptance. Resolve the EditorConfig Checker 3.4.0
GitHub HTTP 403 acquisition failures, plus failed mise acquisitions, through normal installation.
Do not substitute host executables, skip downloads, or treat an already installed tool as fresh
acquisition evidence. Rerun npm with no runner, Bun, pnpm, Yarn Classic and modern Yarn,
Python locks, authenticated registries, workspaces, and fresh-clone hooks. Record versions and
exact failing acquisition boundaries. Completion requires source and installed journeys to pass
sequentially on the same source. Depends on network/provider availability and candidate artifacts.
Acceptance: K-237, K-264 through K-268, K-280, K-283, K-297.

### Guides and site acceptance

Evidence for step 9.5.

Verify executable guide examples and release-matched site acceptance. Local visual evidence does not establish deployed behavior.

Owner: `docs/`. Dependencies: reference examples and candidate artifacts. Completion evidence: Authored examples execute; site build, local links/fragments, keyboard, themes, zoom, and reduced motion remain valid.

Acceptance: G-10, K-202, S-19.

### Performance validation

Evidence for step 9.6.

Owner: execution cache and lifecycle installation. Measure cold and warm initialization,
commit checks, parser reuse, and build caches under the contract's stated conditions. The prior
performance case failed during acquisition. It has no complete replacement result. Record
hardware, versions, inputs, elapsed times, and cache state without relaxing bounds. Depends on
successful normal acquisition and stable source. Acceptance: K-43, K-44, K-69, K-71, K-196, T-12.

Exit: all local candidate evidence identifies the same source and artifacts, required checks
pass, and the real index remains unchanged. Record unavailable-platform evidence separately.
If a source repair is needed, return to its owning phase, rebuild affected artifacts, and repeat
affected acceptance before performing steps 9.7 and 9.8 again.

## 10. Complete deferred external gates when authorized

These substeps remain deferred until their stated hosts or authorization are available. They
do not authorize CI activation, publication, deployment, or external repository changes. Execute
in the order below after phase 9. A product fix returns to the owning local phase and candidate
gate before dependent external evidence can pass.

### Native platforms

Step 10.1. Deferred external work.

Owner: platform/release verification. Execute Linux glibc and musl,
macOS x64, and Windows journeys on the supported platform. Cross-compilation and a Rosetta
version smoke test do not establish native acceptance. Verify Windows permissions, links,
replacement/recovery, Python launchers, uninstall, Git attributes, and process termination.
Completion: exact-candidate native results. Depends on available hosts. Acceptance: K-263,
K-298, K-299, K-72, K-273, K-280.

### Remote CI

Step 10.2. Deferred external work.

Owner: authored workflows. Keep local workflow validation active, including
affected-object selection and generated customer workflows. Remote required-check behavior,
platform execution, and timing require explicit CI reactivation. Completion: successful jobs
for the exact candidate and agreed cadence. Acceptance: K-309, S-12.

### Public release and website

Step 10.3. Deferred external work.

Owner: release tooling and documentation deployment. Public
registry ownership, stable release, signing/provenance, protected Pages environment, domain
ownership, HTTPS cutover, and live rollback remain external gates. Local dry runs and guarded
deployment-definition checks remain required. Completion: release-aligned public artifacts,
schema, site, and tested rollback after authorization. Acceptance: K-164, K-280, K-302, S-19.

### External adoption

Step 10.4. Deferred external work.

Owner: the deferred Yap migration. Do not modify Yap or reference
repositories during this cleanup. Resume only after candidate tests and self-lint pass and
the migration task resumes. Re-read branch/status/worktree history before acting. The old
bounded authorization concerns only local `chore/gspot`, based on local `master`, with the
old tip and chosen base recorded. Changed work requires review; do not reset, clean, stash,
pull, overwrite an existing `chore/gspot-adoption`, or discard newly discovered work.
Use the installed candidate through the isolated registry, preserve nested Semgrep/CodeQL/
Trivy/Bearer exceptions or document justified removal, and record results in
`GSPOT-MIGRATION.md`. Verify no machine-local paths, credentials, or registry routing enter
generated locks/configuration. Measure checks, manual checks, doctor, and hooks without a
remote push. Separate app findings from product defects. Product crashes, false positives,
lost policy, unsafe mutation, or failed recovery require repair and re-verification.
Leave the adoption diff uncommitted; no merge precedes installable public artifacts.
Completion: reviewed installed migration and recovery evidence after authorization.
Dependencies: the candidate gate and external task resumption. Acceptance: T-19, T-33, K-301.

Exit: native acceptance, explicitly reactivated CI, authorized release/site, and resumed
external adoption each have their required evidence. Deferred items remain open until then.

## Evidence limits

This reconciliation used static source, manifest, template, and retained-test inspection.
No tests, lint, builds, installation, or apply were run for this documentation task. No runtime
pass is inferred from a test file existing, and no interrupted run closes an acceptance clause.
Phase 4 records confirmed framework gaps found in this audit; remaining grouped
clauses require verification before claiming that all other features are complete.
