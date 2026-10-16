# Testing

Read this rule when you write or change a test.

Tests exist to catch bugs. A useful test fails when the behavior it covers breaks.

## Assertions

- Use Arrange, Act, Assert. Test behavior, not private implementation details.
- Assert exact values that the public interface defines, such as status codes, exit codes, and
  messages. Do not pin incidental configuration or internal representation.
- Cover relevant empty and null inputs, limits, expected errors, and unexpected internal errors.
- Assert every changed outcome: responses, stored rows, outbound requests, side effects, and logs.
- A test has meaningful assertions; it does not merely prove that the code called a collaborator or
  that a mock returns the value supplied to it.
- Use snapshots only for stable data, and review every change to them.
- Do not add test-only authentication bypasses, magic headers, or bypass routes.
- Do not write a test that only repeats a constant, a table, or a configuration value. A test runs code and checks
  its result.
- Do not export a function only so that a test can call it. Test it through the public function that uses it.

## Mocks

- Mock only what leaves the process: network, filesystem, subprocesses, clock, and database.
  Never mock the code under test or provider SDK internals.
- Mock the module that talks to the network or database. Use dependency injection when the
  code declares the dependencies. Replace that whole module rather than hiding selected behavior.
- Keep mocks that affect the outcome in the arrange step. Reset or redefine shared mocks before
  each test; do not use surprising global auto-mocks.
- Restore environment variables, globals, fake timers, and spies changed by a test.

## Placement and names

<!-- level: all -->

- Follow the framework or runner's test layout and keep one layout in each repository.
- Put builders, fakes, servers, and database support in the declared test support folder, never
  in `mocks/`, `helpers/`, or `utils/`. Support files contain no assertions or test blocks.
- A test name states the scenario and expected outcome. Never use `test1`, `works`, `edge cases`,
  or `happy path`. Group tests by unit, then scenario.
- Prefer role and label queries. Use a test ID last; name it in camelCase for its control, such
  as `submitButton`. Never put visible text, user data, or record IDs in it.

## Test data

- Each test creates its records directly or through an explicit builder. It does not depend on
  execution order, mystery seed state, or a globally empty database.
- Use fixed, descriptive names, emails, IDs, and references. Add a per-run suffix only for rows
  in a shared database.
- Do not share mutable IDs between tests or count unrelated data. Add unrelated records when a
  test must prove that the code leaves them unchanged.
- Use unique queue names, event IDs, operation IDs, or correlation IDs for event-driven tests.
  Never purge shared queues or tables as a substitute for isolated data.
- Do not use fixed sleeps. Use bounded polling, fake timers, or a signal that proves completion.
- Test data does not copy the current version of the project or of a tool. Read the version from the package
  manifest, or use a value outside real releases, such as `0.0.0-test`.

## Network and providers

- Block unexpected external HTTP calls. Allow only the local service under test unless the
  suite explicitly opts into a real provider through an environment variable absent by default.
- Assert outbound URLs, methods, safe headers, timeouts, and bodies. Never assert on secrets or
  full sensitive payloads.
- Where the module recovers, test timeouts, 5xx, 429, malformed JSON, missing fields, and rejected
  promises. Fake responses fail when a payload lacks required fields.
