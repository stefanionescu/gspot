# Working in This Repository

Use these rules when changing this application's code, quality checks, scripts, or
documentation. Start with the sections for your task, then read the linked language
or framework guide.

An **owner** is the module or component responsible for a behavior. A **contract**
defines the inputs, outputs, and behavior that callers can rely on. A **boundary**
is where code receives data or instructions from another component, process, or service.

## Contents

- [Understand the change](#understand-the-change)
- [Keep scope explicit](#keep-scope-explicit)
- [Keep one owner](#keep-one-owner)
- [Use abstractions deliberately](#use-abstractions-deliberately)
- [Handle real failure modes](#handle-real-failure-modes)
- [Protect secrets and explain errors](#protect-secrets-and-explain-errors)
- [Naming and code structure](#naming-and-code-structure)
- [Comments and documentation](#comments-and-documentation)
- [Meaningful tests](#meaningful-tests)
- [Verification](#verification)
- [Renames and replacements](#renames-and-replacements)
- [Uncommitted changes](#uncommitted-changes)

## Understand the change

Read the relevant implementation and its callers before editing. Understand the
expected inputs and outputs, how data moves, and which component is responsible.

- Identify the simplest change that solves the actual problem.
- Trace effects on callers, persisted data, authentication, and user-visible behavior.
- Consider real failure modes: invalid input, network failures, concurrent access,
  cancellation, and permission failures where the affected contract allows them.
- Check the installed framework and dependency versions before applying API guidance.
- When moving a file or renaming a declaration, find and update its imports,
  task commands, configuration references, and documentation in the same change.

## Keep scope explicit

Do the requested work. Do not add unrelated features, restructure surrounding code,
or introduce dependencies for hypothetical future needs.

- Mention unrelated findings without silently turning them into another project.
- Include refactoring when it is necessary to complete the requested change correctly.
- When practical, separate refactoring that preserves behavior from changes to behavior.
- Treat a request for review or a plan as read-only unless implementation is authorized.
- Edit agent instructions and rules only when the user explicitly requests it.

## Keep one owner

Before adding a file, function, or directory, identify the owner of its behavior.
Extend that owner when it already represents the concept.

- Do not create parallel implementations for the same responsibility.
- Avoid functions that only forward unchanged arguments, files that only re-export
  unrelated declarations, and wrappers that add no validation, policy, or error handling.
  Preserve the existing exceptions for supported barrel files and framework entries.
- Keep feature behavior local until multiple callers establish a shared concept.
- Group quality code by responsibility. Avoid runtime buckets and extra project
  wrappers for this single application.
- Keep policy values in configuration and executable behavior in implementation modules.

## Use abstractions deliberately

An abstraction should remove real complexity. Prefer plain functions and explicit
data flow when classes, factories, or interfaces would only add indirection.

- Prefer limited duplication over an abstraction that combines unrelated behavior.
- Do not predict reuse or add an abstraction merely for one caller.
- A module with its own security, resource, or runtime boundary may be justified
  independently of caller count.
- When an abstraction needs more flags, modes, or branches for individual callers,
  check whether those callers need separate implementations.
- When an abstraction is wrong, restore the separate behaviors and share only the operations that still have the
  same inputs, outputs, and meaning.
- Let callers supply a dependency when existing callers need different implementations.
  Do not add factories or dependency-injection layers for hypothetical callers.
- Keep state and I/O at clear boundaries when that simplifies the behavior.

## Handle real failure modes

Validate user input and external responses at the boundaries that receive them.
An invariant is a condition that must remain true. Once the code establishes one,
avoid repeating checks for states that the documented inputs and behavior cannot produce.

- Do not invent fallback values, retries, or guards without a supported failure mode.
- Do not add backward-compatibility paths.
- If an invariant is unclear, trace how it is established before adding another check.
- Handle expected failures explicitly. Do not silently convert an infrastructure
  failure into an empty successful result.
- Keep authorization and server validation at the server boundary, regardless of
  client-side checks.

## Protect secrets and explain errors

- Never commit credentials, tokens, or private keys.
- Access secrets through the server configuration module. Keep them
  out of client bundles, public environment variables, and browser-visible responses.
- Do not log passwords, tokens, authentication headers, or complete sensitive payloads.
- Keep internal stack traces, filesystem paths, database structure, and private
  identifiers out of user-facing errors.
- Use actionable, sentence-case messages. Explain what the user can do next when
  there is a useful next action.
- Use stable public error codes where callers need to distinguish failures, and keep
  internal diagnostics in the appropriate server logging channel.

## Naming and code structure

Follow [NAMING.md](NAMING.md) for identifiers, files, folders, role words, and external
contract exceptions. The quality configuration owns exact limits, banned terms,
and scope exceptions.

- Preserve file and function size limits, folder checks, and import spacing.
- Keep a blank line after the complete import block, including when comments follow it.
- Do not bypass checks by moving values into string keys, aliases, or generated-looking files.
- Fix a rule violation in its owner rather than weakening the checker globally.
- Keep framework-required filenames and exports; apply their existing narrow exceptions.

## Comments and documentation

Follow [WRITING.md](WRITING.md) for plain language and
[DOCUMENTATION.md](DOCUMENTATION.md) for documentation structure and maintenance.

- Describe current behavior. Git records implementation history.
- Explain non-obvious constraints, security decisions, concurrency, and domain invariants.
- Avoid narrating obvious statements or copying volatile default values into comments.
- Link to source only when readers need that definition or implementation. Update
  links when files move. Avoid comments that merely say where another symbol is defined.
- Keep doc comments accurate when parameters, return values, or behavior change.
- Follow the existing language-specific documentation checks and their scoped exceptions.
  JavaScript and TypeScript guidance lives in
  [TYPESCRIPT.md](TYPESCRIPT.md#document-public-behavior); shell comments follow
  [BASH.md](BASH.md#functions).

## Meaningful tests

Create, update, or run tests only when the user explicitly asks for tests. If a change would need
an existing test updated, report that follow-up instead of editing it unasked.

When tests are requested, cover the changed behavior and meaningful failure cases. Do not add test
frameworks, fixtures, snapshots, or production abstractions for unrequested tests.

## Verification

Run agent-initiated lint, formatting, typechecks, builds, security scans, browser checks, or other
verification commands only when the user explicitly requests them. Editing code or documentation
does not itself request verification.

Configured Git hooks are standing authorization for their deliberate, fast, read-only checks when
the user requests the Git operation that triggers them. Do not bypass those hooks. Keep tests,
E2E runs, production builds, and broad security or dependency scans out of automatic hooks;
run those separately when requested.

When verification is requested, use the existing command for the affected files or behavior.
Do not broaden the run to unrelated areas. Report the result and any checks not performed.
Keep hooks read-only; use explicit fix commands when fixes are requested.

## Renames and replacements

Update the implementation and all affected callers together. Remove superseded code in the same
change. Do not retain old APIs, compatibility aliases, shims, forwarding wrappers, dual code paths,
or deprecated implementations for backward compatibility.

Migrate required stored data directly to the current schema. Do not introduce phased compatibility
layers or preserve an old application contract. Do not discard user data as a shortcut.

## Uncommitted changes

Other contributors may have changes in the worktree.

- Do not revert, stash, clean, or overwrite changes you did not make.
- Continue when your work does not conflict with existing changes.
- Build on compatible edits and keep your diff limited to the requested work.
- Ask for clarification only when completing your change would directly contradict or
  overwrite an existing change and its intended outcome cannot be determined.
- Do not commit, reset, or discard another contributor's work as part of cleanup.
