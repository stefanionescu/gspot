---
title: Playwright
---

# Playwright

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Tests

- Give each test a coherent user journey with independent setup and observable assertions.
- Query by role and accessible name (`getByRole('button', { name: 'Submit' })`), then by label,
  placeholder, or text. `data-testid` is the last resort and is named for the interaction surface.
- No fixed waits (`waitForTimeout`). Wait for the visible state, response, or URL that proves
  the operation completed. Network inactivity alone does not establish readiness.
- Every test starts from a known state it creates through the application's real setup (API or
  UI), not from shared seed data or another test's leftovers.
- Assertions use the auto-retrying `expect(locator)` matchers. No manual polling loops.
- A test never reads or writes production data. The base URL and credentials come from the
  configuration owner, per environment.

## Test data and page objects

- Keep reusable setup with its declared test-support owner. Introduce page objects only when
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
- Give each local server an explicit lifecycle and port owner. Test the production build for
  release acceptance. A development server is appropriate only when development behavior is the
  subject of the test. Shut down owned servers without stopping unrelated processes.
