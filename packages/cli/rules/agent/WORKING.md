---
title: Working in a Repository
---

# Working in a Repository

## Running processes

Check for a running instance before you start a dev server, a build watcher, an emulator, or a
database. Look at the port, the process list and the runner's output. Reuse what runs. Start a
second instance only for a test that needs isolation, or when the user asks in this
conversation. A framework that moves to the next free port hides the duplicate: two servers then
serve different code. Stop what you started when the task ends.

## Thinking before coding

Read the relevant code before touching it. Understand the contracts, data flow,
and ownership boundaries. Then think through your approach:

- What is the simplest change that solves the problem correctly?
- What are the failure modes? What happens with bad input, missing data, concurrent access, network failures?
- Does this change affect other parts of the system? Trace the call chain.
- Will someone reading this code in six months understand what it does and why?

When you rename or move a file, audit the entire codebase for references and update them immediately. Stale imports and broken references are worse than the original problem.

Before adding a new module, directory, or helper, identify the correct owner for
the behavior. Do not create parallel implementations for a concept that has an
owner. A new file comes with the reason the owning module grows that way.

## Scope discipline

- Do what was asked. Do not expand scope.
- If you discover something unrelated that needs fixing, mention it to the user. Do not silently fix it unless it is trivial and in a file you are editing.
- Do not add features, refactor surrounding code, or "improve" things that were not requested.

## Verification and tests

The checks of the repository run at commit and at push. Run them over the staged files before
committing. Fix what they report. The instruction file of the repository names the command.

The rule files hold the decisions no check makes. What a check reports reaches you as a finding,
and `gspot explain <check>` describes the check.

Do not run verification broader than the change. Run no full test suite, build, scan, or Docker
check unless the user asks for it or the checks of the repository include it.

Create or update tests only when the user asks for tests, or when a rule of the repository asks for
them, as the database and end-to-end rules do. When implementation work reveals that other tests
need updates, report that follow-up instead of editing tests unasked. Tests that exist are held to the
testing rules and to the assertion, focus, and coverage checks of the repository.

## No defensive logic

Do not add guards, fallbacks, retries, defaults, or wrappers for states the real contract rules
out. Handle known failure modes at real boundaries: user input, network calls, persistence,
permissions, and external services. Trust an internal invariant once it is established; when one
is unclear, trace the code and clarify the contract instead of adding speculative protection.

## Abstractions

<!-- level: all -->

Keep one implementation for each concept in its existing owner. Extract shared behavior only
when real callers prove the same contract and the extraction removes complexity. Do not add
forwarding wrappers, one-caller helpers, or abstractions for hypothetical reuse. Prefer local
duplication when callers have different responsibilities. Remove abstractions whose cost exceeds their benefit.

- An abstraction that gains flags, modes, optional branches, or caller-specific conditions is
  the wrong one. Do not box loosely related behavior into one function with a parameter that
  picks the behavior.
- Inline a wrong abstraction into each caller, delete the branches each caller does not need,
  and extract only the common behavior that remains.
- A preparatory refactor that makes the requested change easy is allowed: first keep the
  behavior, then change it, in separate commits.
- A higher-level helper stays replaceable by a few lower-level operations, with no gap in
  granularity between them. Use inversion of control when it prevents an explosion of options
  across real use cases, not for a single one.
- Prefer plain functions, data structures, and explicit data flow to classes, factories,
  strategies, and inheritance. Push state and I/O outward, and keep the core close to pure.

## Language discipline

<!-- level: all -->

Use direct, concrete language in code, comments, filenames, and documentation.

- Describe optional conditions explicitly.
- State the actual probability or condition instead of using vague hedging.
- Describe redundancy directly instead of using idioms.

If code uses vague language, improve it when touching that code.

## No backward compatibility

<!-- level: all -->

Never introduce compatibility layers, wrapper functions, re-exports for renamed symbols, deprecated-but-kept code, or any other form of backward-compatible scaffolding. A published API follows the deprecation policy its project declares instead.

When something is replaced or renamed:

- Delete the old implementation entirely.
- Update every call site to use the new version.
- Remove unused files, functions, types, and variables.

The codebase must always reflect only the latest implementation.
