---
title: Playwright
---

# Playwright

## Tests

- Give each test a coherent user journey with independent setup and observable assertions.
- Query by role and accessible name (`getByRole('button', { name: 'Submit' })`), then by label,
  placeholder, or text.
- No fixed waits (`waitForTimeout`). Wait for the visible state, response, or URL that proves
  the operation completed. Network inactivity alone does not establish readiness.
- Every test starts from a known state it creates through the application's real setup (API or
  UI), not from shared seed data or another test's leftovers.
- Assertions use the auto-retrying `expect(locator)` matchers. No manual polling loops.
- A test never reads or writes production data. The base URL and credentials come from the
  configuration owner, per environment.

## Test data and page objects

- Keep shared setup in the test support folder. Introduce page objects only when
  repeated interactions need an owner.
- Reuse isolated authentication state for tests that do not exercise login. Login tests verify
  the actual authentication journey. Keep account state isolated between concurrent workers.

## Configuration

- Use the configuration files declared by the repository. Name projects so failures identify
  their browser, viewport, or other relevant execution context.
- Declare the retry policy in the project configuration. Report retried passes separately from
  first-attempt passes.
- Configure trace, screenshot, and video retention for the required diagnostics. Upload failure
  artifacts, restrict access, and avoid capturing credentials or unrelated private data.
- Enable parallel execution only when test accounts and mutable resources are isolated.
  Document any scenario that requires serial execution.
- Test the production build for release acceptance. Use a development server only when development
  behavior is the subject of the test.
