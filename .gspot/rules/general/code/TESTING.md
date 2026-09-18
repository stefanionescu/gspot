---
layer: code
preset: rules
title: Testing
---

# Testing

## Testing philosophy

Tests exist to catch bugs. A test that cannot fail when someone introduces a bug is wasted code.

### What makes a good test

- It tests behavior, not implementation. Assert on what the code does, not how it does it. `unenforced`
- It breaks when a real bug is introduced. If you can delete a line of production code and every test still passes, the tests are insufficient. `unenforced`
- It uses mocks only for external boundaries such as model hubs, file systems, subprocesses, and network calls. Mock the boundary, test the logic. `unenforced`
- It tests edge cases that matter: empty inputs, null values, boundary conditions, error paths. `unenforced`
- Its name identifies the scenario and expected outcome. `unenforced`

### What makes a bad test

- Testing that a mock returns what you told it to return. `unenforced`
- Testing implementation details (internal method calls, private state, call order) that change during refactors. `unenforced`
- Tests that always pass regardless of the production code's correctness. `unenforced`
- Tests with no assertions or with assertions that verify nothing useful. `enforced-by: typescript/eslint vitest/expect-expect`
- Snapshot tests that nobody reviews when they change. `enforced-by: typescript/eslint vitest/prefer-strict-equal`

### Test behavior, not values

Never write a test that asserts a parameter, config value, or return value equals a specific hardcoded literal. These tests break the moment the value changes and catch zero bugs. They test configuration, not whether the system works correctly. `unenforced`

**What to test:**

- **Constraints and invariants.** If a value must fall within a range, test the boundaries. If invalid input must be rejected, test the rejection. `unenforced`
- **Access control.** Permissions, ownership rules, and role-specific behavior. `unenforced`
- **Interactions.** Multi-entity workflows, admin actions, and cross-role behavior. `unenforced`
- **Side effects.** Functions, triggers, scheduled work, computed values, and external boundary calls. `unenforced`
- **Control and boundary behavior.** Contracts, error handling, caching, authentication flows, and edge cases. `unenforced`
- **State transitions.** What happens when valid input is given, what happens when invalid input is given, what happens at the boundaries. `unenforced`

**What not to test:**

- That a specific parameter is set to a specific value (for example `expect(config.temperature).toBe(0.7)`). `unenforced`
- That a function returns an exact hardcoded object when the object is just configuration. `unenforced`
- That an artifact field has a specific default value by reading it back and comparing. `unenforced`

**The distinction:** if the value can change freely without breaking anything, do not pin it in a test. If the value has constraints (must be between 0 and 2, must not be null, must be one of an enum set), test those constraints.

## Rules

- Use Arrange, Act, Assert. `unenforced`
- Do not mock the function under test. `unenforced`
- Mock provider, network, database, and filesystem boundaries. `unenforced`
- Prefer dependency injection over module mocks when dependencies are explicit. `unenforced`
- Use stable fake data. `unenforced`
- Do not use snapshots for unstable data. `enforced-by: typescript/eslint vitest/prefer-strict-equal`
- Clean mocks between tests. `unenforced`
- Restore any environment variable, global, fake timer, or spy changed by a test. `unenforced`
- Do not add test-only auth backdoors, magic headers, or bypass routes. `unenforced`
- Do not assert only that collaborators were called. Assert the outcome and the externally visible side effects. `enforced-by: typescript/eslint vitest/expect-expect`
- Do not commit `.only`, `.skip` placeholders, or `test.todo` entries. `enforced-by: typescript/eslint vitest/no-focused-tests`
- Cover expected errors and unknown internal errors when the change touches error handling. `unenforced`
- Bash has no test suites. Bash verification is ShellCheck, shfmt, `bash -n`, and review. `enforced-by: structure/shell-script-policy`

## Placement and names

- Tests live under `tests/` or beside the unit they test. The directory is `tests/`, never `__tests__`, `test/`, or `spec/`. `enforced-by: naming/identifiers`
- Support code (builders, fakes, servers, database helpers) lives under `tests/support/`. No `fixtures/`, `mocks/`, `helpers/`, or `utils/` directory exists. `enforced-by: naming/identifiers`
- Support code is not test code: it has no assertions and no `describe`, `it`, or `test` blocks. `enforced-by: typescript/eslint vitest/expect-expect`
- File names follow the language: `<name>.test.ts`, never `.spec`; `test_<module>.py` mirroring the package path; `<Type>Tests.swift`; pgTAP files under `tests/` named for the table or function under test. `enforced-by: naming/identifiers`
- A test name is a sentence that states the scenario and the expected outcome. Never `test1`, `works`, `edge cases`, `happy path`. `enforced-by: naming/identifiers`
- Group with `describe` (or the language equivalent) by unit, then by scenario. `unenforced`

## Test data

Tests own the data they rely on. A test is understandable and repeatable without depending on execution order or a mystery seed state.

- Create subject records inside the test or an explicit builder under `tests/support/`. `enforced-by: naming/identifiers`
- Use descriptive unique values for names, emails, IDs, and external references: a stable prefix plus a per-run suffix. `unenforced`
- Do not depend on previous tests. `unenforced`
- Do not depend on a globally empty database. `unenforced`
- Do not use count assertions that fail when unrelated data exists. `unenforced`
- Avoid global mutable fixtures and file-level mutable IDs that one test writes and another reads. `unenforced`
- Separate metadata, context data, and the records being tested. `unenforced`
- Create unrelated records when the behavior must prove it does not overreach. `unenforced`
- Use unique queue names, event IDs, operation IDs, or correlation IDs for event-driven tests. `unenforced`
- Do not purge shared queues or shared tables as a substitute for isolated test data. `unenforced`
- Avoid fixed sleeps. Use bounded polling, fake timers, or a runtime signal that proves completion. `unenforced`
- Test databases may use relaxed durability only inside explicit test infrastructure. Never copy those settings into production configuration. `unenforced`
- Clean up only through established test infrastructure; do not add ad hoc production cleanup code. `unenforced`

## Network and provider boundaries

Outbound network behavior is isolated by default. Tests fail when the code tries to reach an unexpected external service.

- Block unmocked external HTTP calls by default. `unenforced`
- Allow only the local service under test unless the suite explicitly opts into a real provider through an environment variable that is never set in the default run. `unenforced`
- Mock provider, webhook, storage, database, queue, and real-time transport boundaries at their owner. `unenforced`
- Assert important outgoing request shape: URL owner, method, headers that are safe to inspect, timeout, body shape, and trace metadata. `unenforced`
- Test provider timeout, slow response, one-time 5xx, retry and circuit behavior, malformed JSON, missing fields, and rejected promises when the module owns recovery. `unenforced`
- Prefer fake timers or explicit timeout controls over real network delays. `unenforced`
- Default mocks are realistic enough to fail when required payload fields are missing. `unenforced`
- Do not assert on secrets or full sensitive payloads. `unenforced`
- Do not test provider SDK internals. Test the contract with the provider boundary. `unenforced`

## Mocks

Use mocks to isolate boundaries and simulate external behavior. Do not use mocks to prove private implementation details. `unenforced`

- Isolation mocks replace external systems: provider HTTP, database, filesystem, timers, queues. `unenforced`
- Simulation mocks model realistic states: timeout, provider 429, stale lock, malformed payload, empty query result. `unenforced`
- Implementation mocks replace code inside the behavior under test and are a smell. `unenforced`
- Mock at the boundary owner whenever possible. `unenforced`
- Keep outcome-affecting mocks in the arrange block. `unenforced`
- Reset or redefine common mocks before each test. `unenforced`
- Avoid surprising global auto-mocks. `unenforced`
- Use the runner's typed mock helpers; never cast a mock to `any`. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Use partial mocks sparingly and only when a full boundary replacement hides too much useful behavior. `unenforced`

## Outcomes to cover

When a behavior changes, consider every outcome it can have:

- Response: status, envelope, headers, body. `unenforced`
- Persisted state: rows created, updated, deleted, or deliberately unchanged. `unenforced`
- External calls: provider, webhook, email, storage, or database calls. `unenforced`
- Runtime side effects: locks, cache entries, queues, timers, readiness, circuit state. `unenforced`
- Observability: required logs, traces, metrics, exception reports. `unenforced`
