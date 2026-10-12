# Working in a Repository

## Running processes

Check for a running instance before you start a dev server, a build watcher, an emulator, or a
database. Look at the port, the process list and the runner's output. Reuse what runs. Start a
second instance only for a test that needs isolation, or when the user asks in this
conversation. A framework that moves to the next free port hides the duplicate: two servers then
serve different code. Stop what you started when the task ends.

## Thinking before coding

Read the relevant code before touching it. Understand the public interfaces, data flow,
and how the modules work together. Then think through your approach:

- Which change solves the problem correctly with the fewest steps?
- Which failures can occur? What happens with bad input, missing data, concurrent access, network failures?
- Does this change affect other parts of the system? Trace the call chain.

When you rename or move a file, update every reference: imports, documentation, configuration, and scripts.

Before adding a new module, directory, or helper, identify the module that implements
the behavior. When you add a file, tell the user why that module needs it.

## Scope discipline

- Complete the requested task. Do not expand scope.
- If you discover something unrelated that needs fixing, mention it to the user. Do not silently fix it unless the fix takes one small edit in a file you already edit.
- Do not add features, refactor surrounding code, or make unrequested improvements.

## Verification and tests

A check reports what it finds as a finding, and `gspot explain <check>` describes the check.

Do not run verification broader than the change. Run no full test suite, build, scan, or Docker
check unless the user asks for it or the checks of the repository include it.

Write tests when the user asks or a check requires them. When your change breaks a test, fix the
test. Language and framework instructions say how to write a test, not when.

## No defensive logic

Do not add guards, fallbacks, retries, defaults, or wrappers for states the public interface rules
out. Handle known failure modes where failures can occur: user input, network calls, persistence,
permissions, and external services. Trust an internal invariant once the public interface establishes it. When an invariant lacks a clear promise, trace the code and clarify the promised behavior instead of adding speculative protection.

## Abstractions

<!-- level: all -->

Keep one implementation for each concept in the module that implements it. Extract shared behavior only
when real callers need the same behavior and the extraction removes complexity. Do not add
forwarding wrappers, one-caller helpers, or abstractions for hypothetical reuse. Prefer local
duplication when callers have different responsibilities. Remove abstractions whose cost exceeds their benefit.

- An abstraction that gains flags, modes, optional branches, or caller-specific conditions needs a different design. Do not box loosely related behavior into one function with a parameter that
  picks the behavior.
- Inline a wrong abstraction into each caller, delete the branches each caller does not need,
  and extract only the common behavior that remains.
- You can prepare the code to support the requested change: first keep the
  behavior, then change it, in separate commits.
- Replace positional booleans and ambiguous arguments with an options parameter using named fields.
- Pass a function in only when it replaces several option flags across real callers.
- Prefer plain functions, data structures, and explicit data flow to classes, factories,
  strategies, and inheritance. Push state and I/O outward, and keep the core close to pure.

## No backward compatibility

<!-- level: all -->

Never introduce compatibility layers, wrapper functions, re-exports for renamed symbols, deprecated-but-kept code, or any other form of backward-compatible scaffolding. A published API follows the deprecation policy its project declares instead.

When you replace or rename something:

- Delete the old implementation entirely.
- Update every call site to use the new version.

## Structure

<!-- level: all -->

Group constants, types, and schemas by the behavior they belong to. Do not mirror the source
tree in tests.
