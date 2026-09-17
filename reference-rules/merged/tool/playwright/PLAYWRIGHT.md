---
layer: tool
preset: vitest
title: Playwright
---

# Playwright

## Tests

- One test per user journey. A test that covers a screen's every control is several tests. `unenforced`
- Query by role and accessible name (`getByRole('button', { name: 'Submit' })`), then by label,
  placeholder, or text. `data-testid` is the last resort and is named for the interaction surface. `unenforced`
- No fixed waits (`waitForTimeout`). Wait for a locator, a response, a URL, or a network idle
  state. `unenforced`
- Every test starts from a known state it creates through the application's real setup (API or
  UI), not from shared seed data or another test's leftovers. `unenforced`
- Assertions use the auto-retrying `expect(locator)` matchers. No manual polling loops. `unenforced`
- A test never reads or writes production data. The base URL and credentials come from the
  configuration owner, per environment. `unenforced`

## Fixtures and Page Objects

- Shared setup is a fixture under `tests/support/`. A page object exposes intents
  (`submitOrder()`), not selectors. `unenforced`
- Authentication state is created once per worker through the storage-state fixture, never by
  logging in inside every test. `unenforced`

## Configuration

- One `playwright.config` per project. Projects are named for the browser and viewport
  (`chromium-desktop`, `webkit-mobile`). `unenforced`
- `retries` is `0` locally and at most `1` in CI; a retried pass is reported, not hidden. `unenforced`
- Traces, screenshots, and videos are recorded on failure only and uploaded as artifacts. `unenforced`
- `fullyParallel` is on; a test that cannot run in parallel is marked `serial` with a reason. `unenforced`
- The web server is started by the configuration, on a port the test owns, with the built
  application, not a dev server with hot reload. `unenforced`
