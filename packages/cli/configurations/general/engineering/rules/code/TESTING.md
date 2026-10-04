---
title: Testing
---

# Testing

## Testing philosophy

Tests exist to catch bugs.

### What makes a good test

- It tests behavior, not implementation. Assert on what the code does, not how it does it.
- It breaks when a real bug is introduced. If you can delete a line of production code and every test still passes, the tests are insufficient.
- Mock only what leaves the process: network, filesystem, subprocesses, clock, and database.
- It tests edge cases that matter: empty inputs, null values, boundary conditions, error paths.

### What makes a bad test

- Testing that a mock returns what you told it to return.
- Tests that always pass regardless of the production code's correctness.
- Tests with no assertions or with assertions that verify nothing useful.
- Snapshot tests that nobody reviews when they change.

### Assert contractual values

Assert the exact value when the contract defines it, such as a status code, an exit code, or a
message. Do not pin incidental configuration or internal representation
that can change without affecting the contract. Test rejection, state transitions, and side
effects as well as successful results.

## Rules

- Use Arrange, Act, Assert.
- Do not mock the function under test.
- Prefer dependency injection over module mocks when dependencies are explicit.
- Use fixed fake values. Add a per-run suffix only to rows in a shared database.
- Do not use snapshots for unstable data.
- Restore any environment variable, global, fake timer, or spy changed by a test.
- Do not add test-only auth backdoors, magic headers, or bypass routes.
- Do not assert only that collaborators were called. Assert the outcome and the externally visible side effects.
- Cover expected errors and unknown internal errors when the change touches error handling.

## Placement and names

<!-- level: all -->

- Tests live under `tests/` or beside the unit they test. The directory is `tests/`, never `__tests__`, `test/`, or `spec/`.
- Support code (builders, fakes, servers, database helpers) lives in the declared test support folder. No `mocks/`, `helpers/`, or `utils/` directory exists.
- Support code is not test code: it has no assertions and no `describe`, `it`, or `test` blocks.
- File names follow the language: `<name>.test.ts`, never `.spec`; `test_<behavior>.py`, grouped by behavior; `<Type>Tests.swift`; pgTAP files under `tests/` named for the table or function under test.
- A test name is a sentence that states the scenario and the expected outcome. Never `test1`, `works`, `edge cases`, `happy path`.
- Group with `describe` (or the language equivalent) by unit, then by scenario.

Name a test ID in camelCase for the control it marks (`submitButton`). Never put visible text,
user data, or IDs in it. Prefer role and label queries, and use a test ID last. A logging test
asserts the fields and redaction, not that the logger ran.

## Test data

Tests own the data they rely on. A test is understandable and repeatable without depending on execution order or a mystery seed state.

- Create subject records inside the test or an explicit builder in the test support folder.
- Use descriptive values for names, emails, IDs, and external references.
- Do not depend on previous tests.
- Do not depend on a globally empty database.
- Do not use count assertions that fail when unrelated data exists.
- Avoid global mutable test data and file-level mutable IDs that one test writes and another reads.
- Create unrelated records when the behavior must prove it does not overreach.
- Use unique queue names, event IDs, operation IDs, or correlation IDs for event-driven tests.
- Do not purge shared queues or shared tables as a substitute for isolated test data.
- Avoid fixed sleeps. Use bounded polling, fake timers, or a runtime signal that proves completion.

## Network and provider boundaries

Outbound network behavior is isolated by default. Tests fail when the code tries to reach an unexpected external service.

- Block unmocked external HTTP calls by default.
- Allow only the local service under test unless the suite explicitly opts into a real provider through an environment variable that is never set in the default run.
- Assert the outbound request: URL, method, safe headers, timeout, and body.
- Where the module recovers, test timeouts, 5xx, 429, malformed JSON, missing fields, and rejected promises.
- Prefer fake timers or explicit timeout controls over real network delays.
- Default mocks are realistic enough to fail when required payload fields are missing.
- Do not assert on secrets or full sensitive payloads.
- Do not test provider SDK internals. Test the contract with the provider boundary.

## Mocks

Use mocks to isolate boundaries and simulate external behavior. Do not use mocks to prove private implementation details.

- Do not mock code inside the unit under test.
- Mock at the boundary owner whenever possible.
- Keep outcome-affecting mocks in the arrange block.
- Reset or redefine common mocks before each test.
- Avoid surprising global auto-mocks.
- Use partial mocks sparingly and only when a full boundary replacement hides too much useful behavior.

## Outcomes to cover

When you test a changed behavior, assert each outcome it changes: response, stored rows, outbound
calls, side effects, and logs.
