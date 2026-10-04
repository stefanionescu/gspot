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

When you rename or move a file, update every reference: imports, documentation, configuration, and scripts.

Before adding a new module, directory, or helper, identify the correct owner for
the behavior. When you add a file, tell the user why its owner needs it.

## Scope discipline

- Do what was asked. Do not expand scope.
- If you discover something unrelated that needs fixing, mention it to the user. Do not silently fix it unless it is trivial and in a file you are editing.
- Do not add features, refactor surrounding code, or "improve" things that were not requested.

## Verification and tests

When the repository has checks, run `gspot check --staged` before you commit, and fix what it reports.

The rule files hold the decisions no check makes. What a check reports reaches you as a finding,
and `gspot explain <check>` describes the check.

Do not run verification broader than the change. Run no full test suite, build, scan, or Docker
check unless the user asks for it or the checks of the repository include it.

Write tests when the user asks or a check requires them. When your change breaks a test, fix the
test. Language and framework instructions say how to write a test, not when.

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
- Replace positional booleans and ambiguous arguments with an options parameter using named fields.
- Pass a function in only when it replaces several option flags across real callers.
- Prefer plain functions, data structures, and explicit data flow to classes, factories,
  strategies, and inheritance. Push state and I/O outward, and keep the core close to pure.

## No backward compatibility

<!-- level: all -->

Never introduce compatibility layers, wrapper functions, re-exports for renamed symbols, deprecated-but-kept code, or any other form of backward-compatible scaffolding. A published API follows the deprecation policy its project declares instead.

When something is replaced or renamed:

- Delete the old implementation entirely.
- Update every call site to use the new version.
