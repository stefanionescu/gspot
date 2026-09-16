# Working in a Repository

## Thinking Before Coding

Read the relevant code before touching it. Understand the contracts, data flow,
and ownership boundaries. Then think through your approach:

- What is the simplest change that solves the problem correctly?
- What are the failure modes? What happens with bad input, missing data, concurrent access, network failures?
- Does this change affect other parts of the system? Trace the call chain.
- Will someone reading this code in six months understand what it does and why?

When you rename or move a file, audit the entire codebase for references and update them immediately. Stale imports and broken references are worse than the original problem.

Before adding a new module, directory, or helper, identify the correct owner for
the behavior. Do not create parallel implementations for a concept that has an
owner. If a new file is needed, be ready to explain why the owning module should
grow that way.

## Scope Discipline

- Do what was asked. Do not expand scope.
- If you discover something unrelated that needs fixing, mention it to the user. Do not silently fix it unless it is trivial and in a file you are editing.
- Do not add features, refactor surrounding code, or "improve" things that were not requested.

## No Defensive Logic

Do not invent defensive logic for scenarios that are not part of the real contract.

- Do not add guards, fallbacks, retries, optional handling, defaults, or wrappers for states that cannot occur under the real contract.
- Handle known failure modes at real boundaries: user input, network calls, persistence, permissions, and external services.
- Trust internal invariants after they are established. If an invariant is unclear, trace the code and clarify the contract instead of adding speculative protection.
- Do not pad the codebase with logic meant to protect against hypothetical future failures.

## Managing Sprawl

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

### Prefer Duplication Over the Wrong Abstraction

- Duplication is cheaper than the wrong abstraction.
- Prefer duplication until there are at least two real examples that prove the
  same concept exists.
- Do not build reusable code before the code is usable.
- Do not preserve an abstraction because of sunk cost.

### Do Not Abstract for One Caller

- Do not introduce an abstraction for one caller.
- Do not introduce an abstraction for hypothetical future reuse.

### Watch for Boxing

- If a shared abstraction starts gaining flags, modes, optional branches, or
  caller-specific conditionals, treat that as evidence the abstraction is wrong.
- "Boxing" is forbidden: do not stuff loosely related behavior into one
  function/class/module with parameters deciding which behavior runs.

### Inline the Wrong Abstraction

- When an abstraction is wrong, inline it back into each caller, delete the
  branches each caller does not need, then extract only the common behavior that
  remains.

### Make the Change Easy

- Preparatory refactoring is allowed when it makes the requested change easier:
  first preserve behavior, then make the behavior change.
- Keep refactoring and behavior changes separate when practical.

### Keep Granularity Continuous

- Higher-level helpers must be replaceable by a small number of lower-level
  operations. Do not create API granularity gaps.

### Use Inversion of Control Deliberately

- Use inversion of control when it prevents option explosion across multiple
  real use cases.
- Do not add inversion of control for a single use case if it makes the call
  site harder without reducing complexity.

### Prefer Data Flow and Data Structures

- Prefer plain functions and explicit data flow before classes, interfaces,
  factories, strategies, inheritance, or framework patterns.
- Prefer data structures and their relationships over code-pattern taxonomies.
- Push state and I/O outward where practical; keep core logic pure or close to
  pure when that reduces moving parts.

## Language Discipline

Use direct, concrete language in code, comments, filenames, and documentation.

- Describe optional conditions explicitly.
- State the actual probability or condition instead of using vague hedging.
- Describe redundancy directly instead of using idioms.

If code uses vague language, improve it when touching that code.

## No Backward Compatibility

Never introduce compatibility layers, wrapper functions, re-exports for renamed symbols, deprecated-but-kept code, or any other form of backward-compatible scaffolding.

When something is replaced or renamed:

- Delete the old implementation entirely.
- Update every call site to use the new version.
- Remove unused files, functions, types, and variables.

The codebase must always reflect only the latest implementation.
