---
title: Vitest
---

# Vitest

The general testing rules apply. Use the Vitest APIs for its runtime boundaries.

- Use `vi.stubGlobal('fetch', ...)` or the project's interceptor to control external HTTP. Restore
  stubbed globals through `vi.unstubAllGlobals()`.
- Use `vi.mocked()` for typed access to a mocked dependency. A partial module mock calls
  `importOriginal` when the unchanged exports still matter.
- Restore fake timers with `vi.useRealTimers()` and mock implementations with `vi.restoreAllMocks()`.
- Use `it.each` for one behavior across several inputs. Stop `describe()` nesting when it separates
  no distinct behavior.

```ts
vi.mock('./email-client.js', async (importOriginal) => ({
    ...(await importOriginal()),
    sendEmail: vi.fn(),
}));
```
