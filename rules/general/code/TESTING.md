---
layer: code
preset: rules
title: Testing
---

# Testing

## Testing philosophy

Tests exist to catch bugs. A test that cannot fail when someone introduces a bug is wasted code.

### What makes a good test

- It tests behavior, not implementation. Assert on what the code does, not how it does it.
- It breaks when a real bug is introduced. If you can delete a line of production code and every test still passes, the tests are insufficient.
- It uses mocks only for external boundaries such as model hubs, file systems, subprocesses, and network calls. Mock the boundary, test the logic.
- It tests edge cases that matter: empty inputs, null values, boundary conditions, error paths.
- Its name identifies the scenario and expected outcome.

### What makes a bad test

- Testing that a mock returns what you told it to return.
- Testing implementation details (internal method calls, private state, call order) that change during refactors.
- Tests that always pass regardless of the production code's correctness.
- Tests with no assertions or with assertions that verify nothing useful.
- Snapshot tests that nobody reviews when they change.

### Test behavior, not values

Never write a test that asserts a parameter, config value, or return value equals a specific hardcoded literal. These tests break the moment the value changes and catch zero bugs. They test configuration, not whether the system works correctly.

**What to test:**

- **Constraints and invariants.** If a value must fall within a range, test the boundaries. If invalid input must be rejected, test the rejection.
- **Access control.** Permissions, ownership rules, and role-specific behavior.
- **Interactions.** Multi-entity workflows, admin actions, and cross-role behavior.
- **Side effects.** Functions, triggers, scheduled work, computed values, and external boundary calls.
- **Control and boundary behavior.** Contracts, error handling, caching, authentication flows, and edge cases.
- **State transitions.** What happens when valid input is given, what happens when invalid input is given, what happens at the boundaries.

**What not to test:**

- That a specific parameter is set to a specific value (for example `expect(config.temperature).toBe(0.7)`).
- That a function returns an exact hardcoded object when the object is just configuration.
- That an artifact field has a specific default value by reading it back and comparing.

**The distinction:** if the value can change freely without breaking anything, do not pin it in a test. If the value has constraints (must be between 0 and 2, must not be null, must be one of an enum set), test those constraints.

## Rules

- Use Arrange, Act, Assert.
- Do not mock the function under test.
- Mock provider, network, database, and filesystem boundaries.
- Prefer dependency injection over module mocks when dependencies are explicit.
- Use stable fake data.
- Do not use snapshots for unstable data.
- Clean mocks between tests.
- Restore any environment variable, global, fake timer, or spy changed by a test.
- Do not add test-only auth backdoors, magic headers, or bypass routes.
- Do not assert only that collaborators were called. Assert the outcome and the externally visible side effects.
- Do not commit `.only`, `.skip` placeholders, or `test.todo` entries.
- Cover expected errors and unknown internal errors when the change touches error handling.
- Bash has no test suites. Bash verification is ShellCheck, shfmt, `bash -n`, and review.

## Placement and names

- Tests live under `tests/` or beside the unit they test. The directory is `tests/`, never `__tests__`, `test/`, or `spec/`.
- Support code (builders, fakes, servers, database helpers) lives under `tests/support/`. No `mocks/`, `helpers/`, or `utils/` directory exists.
- Support code is not test code: it has no assertions and no `describe`, `it`, or `test` blocks.
- File names follow the language: `<name>.test.ts`, never `.spec`; `test_<module>.py` mirroring the package path; `<Type>Tests.swift`; pgTAP files under `tests/` named for the table or function under test.
- A test name is a sentence that states the scenario and the expected outcome. Never `test1`, `works`, `edge cases`, `happy path`.
- Group with `describe` (or the language equivalent) by unit, then by scenario.

## Test data

Tests own the data they rely on. A test is understandable and repeatable without depending on execution order or a mystery seed state.

- Create subject records inside the test or an explicit builder under `tests/support/`.
- Use descriptive unique values for names, emails, IDs, and external references: a stable prefix plus a per-run suffix.
- Do not depend on previous tests.
- Do not depend on a globally empty database.
- Do not use count assertions that fail when unrelated data exists.
- Avoid global mutable test data and file-level mutable IDs that one test writes and another reads.
- Separate metadata, context data, and the records being tested.
- Create unrelated records when the behavior must prove it does not overreach.
- Use unique queue names, event IDs, operation IDs, or correlation IDs for event-driven tests.
- Do not purge shared queues or shared tables as a substitute for isolated test data.
- Avoid fixed sleeps. Use bounded polling, fake timers, or a runtime signal that proves completion.
- Test databases may use relaxed durability only inside explicit test infrastructure. Never copy those settings into production configuration.
- Clean up only through established test infrastructure; do not add ad hoc production cleanup code.

## Network and provider boundaries

Outbound network behavior is isolated by default. Tests fail when the code tries to reach an unexpected external service.

- Block unmocked external HTTP calls by default.
- Allow only the local service under test unless the suite explicitly opts into a real provider through an environment variable that is never set in the default run.
- Mock provider, webhook, storage, database, queue, and real-time transport boundaries at their owner.
- Assert important outgoing request shape: URL owner, method, headers that are safe to inspect, timeout, body shape, and trace metadata.
- Test provider timeout, slow response, one-time 5xx, retry and circuit behavior, malformed JSON, missing fields, and rejected promises when the module owns recovery.
- Prefer fake timers or explicit timeout controls over real network delays.
- Default mocks are realistic enough to fail when required payload fields are missing.
- Do not assert on secrets or full sensitive payloads.
- Do not test provider SDK internals. Test the contract with the provider boundary.

## Mocks

Use mocks to isolate boundaries and simulate external behavior. Do not use mocks to prove private implementation details.

- Isolation mocks replace external systems: provider HTTP, database, filesystem, timers, queues.
- Simulation mocks model realistic states: timeout, provider 429, stale lock, malformed payload, empty query result.
- Implementation mocks replace code inside the behavior under test and are a smell.
- Mock at the boundary owner whenever possible.
- Keep outcome-affecting mocks in the arrange block.
- Reset or redefine common mocks before each test.
- Avoid surprising global auto-mocks.
- Use the runner's typed mock helpers; never cast a mock to `any`.
- Use partial mocks sparingly and only when a full boundary replacement hides too much useful behavior.

## Outcomes to cover

When a behavior changes, consider every outcome it can have:

- Response: status, envelope, headers, body.
- Persisted state: rows created, updated, deleted, or deliberately unchanged.
- External calls: provider, webhook, email, storage, or database calls.
- Runtime side effects: locks, cache entries, queues, timers, readiness, circuit state.
- Observability: required logs, traces, metrics, exception reports.
