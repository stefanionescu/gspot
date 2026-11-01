# Jest

Read this rule when you write or change a Jest test.

Read TESTING.md too. Use the Jest APIs for runtime boundaries.

- Use `jest.mocked()` for typed access to a mocked dependency. It types an existing mock; it does not replace the
  dependency's implementation.
- Use fake timers for clock-dependent behavior, advance them to the event under test, and restore real timers with
  `jest.useRealTimers()` after each test.
- Restore spies and replaced properties with `jest.restoreAllMocks()`. Reset mock functions with `jest.resetAllMocks()`
  when their implementations or recorded calls must not pass to another test.
- Use `test.each` for one behavior across several inputs. Keep module mocks beside the tests that need them, and
  restore every changed runtime boundary.
