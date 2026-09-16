# Testing

## Testing Philosophy

Tests exist to catch bugs. A test that cannot fail when someone introduces a bug is wasted code.

### What Makes a Good Test

- It tests behavior, not implementation. Assert on what the code does, not how it does it.
- It breaks when a real bug is introduced. If you can delete a line of production code and every test still passes, the tests are insufficient.
- It uses mocks only for external boundaries such as model hubs, file systems, subprocesses, and network calls. Mock the boundary, test the logic.
- It tests edge cases that matter: empty inputs, null values, boundary conditions, error paths.
- Its name identifies the scenario and expected outcome.

### What Makes a Bad Test

- Testing that a mock returns what you told it to return.
- Testing implementation details (internal method calls, private state, call order) that change during refactors.
- Tests that always pass regardless of the production code's correctness.
- Tests with no assertions or with assertions that verify nothing useful.
- Snapshot tests that nobody reviews when they change.

### Test Behavior, Not Values

Never write a test that asserts a parameter, config value, or return value equals a specific hardcoded literal. These tests break the moment the value changes and catch zero bugs. They test configuration, not whether the system works correctly.

**What to test:**

- **Constraints and invariants.** If a value must fall within a range, test the boundaries. If invalid input must be rejected, test the rejection.
- **Access control.** Permissions, ownership rules, and role-specific behavior.
- **Interactions.** Multi-entity workflows, admin actions, and cross-role behavior.
- **Side effects.** Functions, triggers, scheduled work, computed values, and external boundary calls.
- **Command and boundary behavior.** Contracts, error handling, caching, authentication flows, and edge cases.
- **State transitions.** What happens when valid input is given, what happens when invalid input is given, what happens at the boundaries.

**What not to test:**

- That a specific parameter is set to a specific value (e.g., `expect(config.temperature).toBe(0.7)`).
- That a function returns an exact hardcoded item when the item is just configuration.
- That an artifact field has a specific default value by reading it back and comparing.

**The distinction:** if the value can change freely without breaking anything, do not pin it in a test. If the value has constraints (must be between 0 and 2, must not be null, must be one of an enum set), test those constraints.

### Rules

- Create or update tests only when the user asks for tests.
- Use Arrange, Act, Assert.
- Do not mock the function under test.
- Mock provider, network, database, and filesystem boundaries.
- Prefer dependency injection over module mocks when dependencies are explicit.
- Use stable fake data.
- Do not use snapshots for unstable data.
- Clean mocks between tests.
- Restore any environment variable changed by a test.
- Do not add test-only auth backdoors, magic headers, or bypass routes.
- Do not assert only that collaborators were called. Assert the outcome and the externally visible side effects.
- Do not commit `.only`, `.skip` placeholders, or todo tests unless the user explicitly asks for a known temporary marker.
- Cover expected errors and unknown internal errors when the change touches error handling.
