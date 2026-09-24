---
layer: tool
configuration: vitest
title: Playwright
---

# Playwright

## Tests

- One test per user journey. A test that covers a screen's every control is several tests.
- Query by role and accessible name (`getByRole('button', { name: 'Submit' })`), then by label,
  placeholder, or text. `data-testid` is the last resort and is named for the interaction surface.
- No fixed waits (`waitForTimeout`). Wait for a locator, a response, a URL, or a network idle
  state.
- Every test starts from a known state it creates through the application's real setup (API or
  UI), not from shared seed data or another test's leftovers.
- Assertions use the auto-retrying `expect(locator)` matchers. No manual polling loops.
- A test never reads or writes production data. The base URL and credentials come from the
  configuration owner, per environment.

## Test data and page objects

- Shared setup lives under `tests/support/`. A page object exposes intents
  (`submitOrder()`), not selectors.
- Authentication state is created once per worker through shared storage-state setup, never by
  logging in inside every test.

## Configuration

- One `playwright.config` per project. Projects are named for the browser and viewport
  (`chromium-desktop`, `webkit-mobile`).
- `retries` is `0` locally and at most `1` in CI; a retried pass is reported, not hidden.
- Traces, screenshots, and videos are recorded on failure only and uploaded as artifacts.
- `fullyParallel` is on; a test that cannot run in parallel is marked `serial` with a reason.
- The web server is started by the configuration, on a port the test owns, with the built
  application, not a dev server with hot reload.
