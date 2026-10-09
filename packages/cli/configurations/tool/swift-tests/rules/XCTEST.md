---
title: Swift Tests
---

# Swift Tests

When you write tests, these rules cover XCTest, Swift Testing, and snapshot tests.

## What to test

- Unit test domain entities, value objects, mapping, and application operations. When the
  project uses view models, test their behavior too.
- Test a use case with mocked repository protocols or boundary clients.
- Test repository mapping apart from use case behavior.
- When the project uses view models, assert state transitions and what the user sees, never private method calls.
- Test invalid payload mapping and external data validation at the boundary.
- Test cancellation and stale results for owners that start asynchronous work.
- Do not mock SwiftUI or test its framework behavior.
- Do not test trivial getters, setters, or framework behavior.
- Do not add a protocol only to make a mock when a lower boundary is already injectable.

## Coverage by layer

- Domain tests cover value validation, invariants, domain errors, and computed business properties.
- Use case tests cover success, repository failure, validation failure, cancellation, and policy decisions.
- Repository tests cover record mapping and error translation.
- Network client tests cover the URL, the method, the headers, and the encoded body.
- Network client tests also cover a response that is not HTTP, a status outside 200 to 299, a decoding failure, and cancellation.
- When the project uses view models, test initial, loading, success, empty, and error states,
  then retry and stale results.
- When the project uses coordinators, test route stack changes, modal state, dismissal, root
  resets, and deep link translation.

## Test data

- Test data makes the behavior under test obvious.
- Prefer private builders or stubs with sensible defaults when model construction hides the point of the test.
- Keep test builders beside the tests that use them, unless many test files share them on purpose.
- Decode JSON test data only when the test is about decoding, mapping, or an external payload contract.
- Do not add a production default to make a test shorter.
- Prefer stable identifiers, dates, clocks, and ordering.

```swift
private extension Message {
    static func stub(
        id: Message.ID = .init("message-1"),
        subject: String = "Subject",
        sender: Person = .stub()
    ) -> Self {
        Self(id: id, subject: subject, sender: sender)
    }
}
```

Test builders belong in test code. A test setup API never becomes a second model layer.

## Style

<!-- level: all -->

- In XCTest, prefer throwing test methods with `try XCTUnwrap`.
- In Swift Testing, prefer `try #require`.
- Avoid `guard` in a test when an assertion helper states the failure more clearly.
- Make test helpers and test data private unless they are shared on purpose.

## Tests that are off

- Pass the reason to `XCTSkip` or `.disabled`. Name the issue, release, or platform version
  that lets the test run again.
- Delete a test that nobody plans to turn back on.

## Time

- Inject the clock, so a test advances time and never waits for it.

## Snapshot and interface tests

- Snapshot test reusable visual states and regressions that unit tests cannot cover.
- Look at every reference image before committing it.
- Keep each folder of references beside the test file it belongs to, and delete both together.
- UI test critical navigation, authentication, submission, purchase, and recovery flows.
