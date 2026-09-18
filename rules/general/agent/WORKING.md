---
layer: agent
preset: rules
title: Working in a Repository
---

# Working in a Repository

## Working alone

Do not spawn subagents, background agents, parallel sessions, or multi-agent workflows for a
task unless the user asked for them in this conversation. One agent reads the code and makes the
edits with the whole context in view. Splitting a task across agents loses that context, repeats
work, and produces the drift these rules exist to catch. When a task looks too large for one
agent, say so and ask; do not fan out.

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

The gate runs at commit and push. Run `gspot check --staged` before committing and fix what it
reports. Do not run verification broader than the change: no full test suites, builds, scans, or
Docker checks unless the user asks for them or the gate runs them.

Create or update tests only when the user asks for tests. When implementation work reveals that
tests need updates, report that follow-up instead of editing tests unasked. Tests that exist are held to the
testing rules and the gate's assertion, focus, and coverage checks.

## No defensive logic

Do not invent defensive logic for scenarios that are not part of the real contract.

- Do not add guards, fallbacks, retries, optional handling, defaults, or wrappers for states that cannot occur under the real contract.
- Handle known failure modes at real boundaries: user input, network calls, persistence, permissions, and external services.
- Trust internal invariants after they are established. If an invariant is unclear, trace the code and clarify the contract instead of adding speculative protection.
- Do not pad the codebase with logic meant to protect against hypothetical future failures.

## Managing sprawl

Keep one clear implementation for each concept.

- Do not create multiple functions, services, types, or wrappers that do nearly the same thing.
- Do not wrap a helper with another helper unless the wrapper owns a real boundary, policy, or transformation.
- Do not add an abstraction for one call site or one concept.
- Before adding a new helper, find the owner of the behavior and put the logic
  there.
- When touching duplicated logic in the same area, collapse it into the owner
  instead of adding another layer.

## Abstractions

Abstractions are useful only when they remove real complexity. They are harmful
when they hide ownership, combine unrelated behavior, or predict reuse before
the code proves it.

### Prefer duplication over the wrong abstraction

- Duplication is cheaper than the wrong abstraction.
- Prefer duplication until there are at least two real examples that prove the
  same concept exists.
- Do not build reusable code before the code is usable.
- Do not preserve an abstraction because of sunk cost.

### Do not abstract for one caller

- Do not introduce an abstraction for one caller.
- Do not introduce an abstraction for hypothetical future reuse.

### Watch for boxing

- If a shared abstraction starts gaining flags, modes, optional branches, or
  caller-specific conditionals, treat that as evidence the abstraction is wrong.
- "Boxing" is forbidden: do not stuff loosely related behavior into one
  function/class/module with parameters deciding which behavior runs.

### Inline the wrong abstraction

- When an abstraction is wrong, inline it back into each caller, delete the
  branches each caller does not need, then extract only the common behavior that
  remains.

### Make the change easy

- Preparatory refactoring is allowed when it makes the requested change easier:
  first preserve behavior, then make the behavior change.
- Keep refactoring and behavior changes in separate commits.

### Keep granularity continuous

- Higher-level helpers must be replaceable by a small number of lower-level
  operations. Do not create API granularity gaps.

### Use inversion of control deliberately

- Use inversion of control when it prevents option explosion across multiple
  real use cases.
- Do not add inversion of control for a single use case if it makes the call
  site harder without reducing complexity.

### Prefer data flow and data structures

- Prefer plain functions and explicit data flow before classes, interfaces,
  factories, strategies, inheritance, or framework patterns.
- Prefer data structures and their relationships over code-pattern taxonomies.
- Push state and I/O outward; keep core logic pure or close to
  pure when that reduces the number of parts.

## Language discipline

Use direct, concrete language in code, comments, filenames, and documentation.

- Describe optional conditions explicitly.
- State the actual probability or condition instead of using vague hedging.
- Describe redundancy directly instead of using idioms.

If code uses vague language, improve it when touching that code.

## No backward compatibility

Never introduce compatibility layers, wrapper functions, re-exports for renamed symbols, deprecated-but-kept code, or any other form of backward-compatible scaffolding.

When something is replaced or renamed:

- Delete the old implementation entirely.
- Update every call site to use the new version.
- Remove unused files, functions, types, and variables.

The codebase must always reflect only the latest implementation.
