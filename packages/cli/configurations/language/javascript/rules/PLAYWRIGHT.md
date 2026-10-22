# Playwright

Read this rule when you write or change a Playwright test.

## Tests

- Give each test a coherent user journey with independent setup and observable assertions.
- Query by role and accessible name such as `getByRole('button', { name: 'Submit' })`, then by label, placeholder, or
  text.
- Do not use fixed waits such as `waitForTimeout`. Wait for the visible state, response, or URL that proves the
  operation finished. Network inactivity alone does not establish readiness.
- Start every test from a known state that the application creates through its API or its UI. Never start from shared
  seed data or leftovers.
- Assertions use the auto-retrying `expect(locator)` matchers. No manual polling loops.
- A test never reads or writes production data. The base URL and credentials come from the project configuration for
  each environment.

## Test data and page objects

- Keep shared setup in the builders folder that TESTING.md describes. Introduce page objects only when several tests
  repeat the same interactions.
- Reuse isolated authentication state for tests that do not exercise login. Login tests verify the full authentication
  journey. Keep account state isolated between concurrent workers.

## Configuration

- Use the configuration files declared by the repository. Name projects so failures identify their browser, viewport, or
  other relevant execution context.
- Declare the retry policy in the project configuration. Report retried passes apart from first-attempt ones.
- Configure trace, screenshot, and video retention for the failure evidence the project needs. Upload failure artifacts,
  restrict access, and avoid capturing credentials or unrelated private data.
- Enable parallel execution only when each test has its own accounts and mutable resources. Document any scenario that
  requires serial execution.
- Test the production build for release acceptance. Use a development server only for behavior that the production build
  lacks.
