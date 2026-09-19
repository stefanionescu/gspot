---
layer: tool
preset: xctest
title: Swift Tests
---

# Swift Tests

These rules cover XCTest, Swift Testing, and snapshot tests.

## What to test

- Unit test domain entities, value objects, mapping, use cases, and view model behavior.
- Test a use case with mocked repository protocols or boundary clients.
- Test repository mapping apart from use case behavior.
- Test a view model by asserting state transitions and what the user sees, never private method calls.
- Test invalid payload mapping and external data validation at the boundary.
- Test cancellation and stale results for a view model that starts async tasks.
- Do not mock SwiftUI.
- Do not test trivial getters, setters, or framework behavior.
- Do not add a protocol only to make a mock when a lower boundary is already injectable.

## Coverage by layer

- Domain tests cover value validation, invariants, domain errors, and computed business properties.
- Use case tests cover success, repository failure, validation failure, cancellation, and policy decisions.
- Repository tests cover record mapping and error translation.
- Network client tests cover the URL, the method, the headers, and the encoded body.
- Network client tests also cover a response that is not HTTP, a status outside 200 to 299, a decoding failure, and cancellation.
- View model tests cover the initial, loading, success, empty, and error states, then retry and stale results.
- Coordinator tests cover route stack changes, modal state, dismissal, root resets, and deep link translation.

## Test data

- Test data makes the behavior under test obvious.
- Prefer private builders or stubs with sensible defaults when model construction hides the point of the test.
- Keep fixture helpers beside the tests that use them, unless many test files share them on purpose.
- Keep a shared fixture API small, and name it by the naming rules of the language.
- Allow key path customization helpers in test targets only, and only when they make a test easier to read.
- Decode JSON fixtures only when the test is about decoding, mapping, or an external payload contract.
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

Fixture helpers belong in test code. A fixture API never becomes a second model layer.

## Style

- In XCTest, prefer throwing test methods with `try XCTUnwrap`.
- In Swift Testing, prefer `try #require`.
- Avoid `try!`, force unwraps, and force casts, unless the test proves a programmer error invariant.
- Avoid `guard` in a test when an assertion helper states the failure more clearly.
- Make test helpers and fixtures private unless they are shared on purpose.
- Mark a test case class `final`.

## Tests that are off

- A skipped or disabled test says why, on the same line or in a comment directly above it.
- The reason names what turns the test back on: an issue, a release, or a platform version.
- Delete a test that nobody plans to turn back on.

## Time

- A test never sleeps. Wait on an expectation, a confirmation, or a polled condition with a timeout.
- Inject the clock, so a test advances time and never waits for it.

## Snapshot and interface tests

- Snapshot test reusable visual states and regressions that unit tests cannot cover.
- Never commit a snapshot test in a recording mode. A recording test writes a new reference and passes.
- Look at every reference image before committing it.
- Keep each folder of references beside the test file it belongs to, and delete both together.
- UI test critical navigation, authentication, submission, purchase, and recovery flows.
- Select elements by accessibility identifier, never by localized copy.
