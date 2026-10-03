---
title: Naming
---

# Naming

Principles, vocabulary, functions, and booleans. Naming Files covers casing across
languages, files and directories, boundaries and external names, and tests. The naming
policy reports the banned words: `Manager`, `Helper`, `Utils`, `Service`, `handler`,
`process`, the weak modal, and the rest of the policy list. It reports the reserved words,
single-letter and contracted names, and the word limit. The language tools report casing.
This file says why, and holds the decision no policy can judge: whether a name says what
the value means.

## Authority

<!-- level: all -->

A name satisfies both this file and the naming policy of the scope, and a policy finding is
authoritative: a disagreement is fixed at its owner, never worked around locally. The policy
owns exact limits, banned terms, and exceptions, so this file does not repeat them. A bad
name is not hidden in a string key, a filename, a quoted SQL identifier, a generated wrapper,
or an alias. Generated code keeps generator-owned names; hand-written wrappers around it
follow this file.

## Principles

<!-- level: all -->

A name lets a reader understand the concept, scope, role, and expected value without reading
the implementation. Name by role, responsibility, and domain meaning, never by storage type,
UI framework type, collection shape, or implementation accident. Use English unless an
external identifier keeps another spelling. Prefer the shortest name that is clear at the use
site, and add a qualifier only when the bare name is ambiguous there. Never invent private
shorthand or drop letters from a word.

Do not repeat context the enclosing type, module, directory, or package already supplies, and
do not encode every implementation detail. One concept keeps one word across a feature. Single values are singular, collections plural and
named by their contents. A role word carries meaning where a primitive or weak type does not.
Required external names survive at the boundary and become domain names before moving inward.

| Avoid               | Prefer                        | Why                                 |
| ------------------- | ----------------------------- | ----------------------------------- |
| `string`, `dict`    | `welcomeMessage`, `usersById` | The role, not the type.             |
| `u`, `tmp`, `cfg`   | `user`, `accountSummary`      | Whole words a stranger can read.    |
| `userArray`         | `users`                       | The type already says array.        |
| `Car.carMake`       | `Car.make`                    | The owner supplies the context.     |
| `optionalAvatarURL` | `avatarURL`                   | Optionality lives in the type.      |
| `UserManager`       | `UserRepository`              | The real responsibility.            |
| `DataProcessor`     | `ProfileImageClient`          | An external API boundary.           |
| `CommonUtils`       | `DateRangeFormatter`          | A capability, not a dumping ground. |

## Role words

<!-- level: all -->

A suffix tells the reader what kind of boundary or owner they see, so each is used for one
meaning. A type with no real role is named for its concrete domain concept instead.

| Role word    | Use when                                                             |
| ------------ | -------------------------------------------------------------------- |
| `UseCase`    | Application operation or business workflow.                          |
| `Repository` | Domain-facing access to persisted, cached, or remote domain data.    |
| `Client`     | External API, SDK, HTTP, storage, or platform protocol boundary.     |
| `Factory`    | Type that constructs instances and owns dependency assembly.         |
| `Formatter`  | Converts a value into a display or wire representation.              |
| `Parser`     | Converts raw input into structured data.                             |
| `Validator`  | Checks a value and returns or throws validation failure.             |
| `Mapper`     | Converts between explicit layers, such as record to domain.          |
| `Store`      | Owns local mutable state or persistence mechanics.                   |
| `Provider`   | Supplies a capability or value, especially when the source may vary. |
| `Adapter`    | Bridges one interface or framework shape to another.                 |

`Route`, `Callback`, `Observer`, and `Listener` are valid only when that framework shape is
the point, and the UI role words (`View`, `ViewModel`, `ViewController`, `Coordinator`) are
defined by the language file that owns the framework. `Service` and `Manager` are banned in
app-owned names unless an external contract requires the exact name; Apple's `FileManager` is
such a name, and no local owner copies its suffix. `Helper`, `Utility`, `Util`, `Common`,
`Shared`, `Base`, and `Core` are not names for files or types; the capability is:
`String+SearchQuery.swift` rather than `String+Helpers.swift`, `email-address-validation.ts`
rather than `common-utils.ts`, `AuthenticatedProfileViewModel` rather than `BaseViewModel`.

## Functions and methods

<!-- level: all -->

A function name starts with the action and carries enough domain context to read at the call
site, without repeating its owner. A generic verb (`process`, `handle`, `run`, `execute`,
`manage`, `perform`) never stands where the action can be named. `handle` exists only in a
framework callback such as a React `handleSubmit` or a UIKit `@objc handleConfirmButtonTapped`.
`Handler` is never a type suffix. A name that needs `and`, `or`, `with`, or an umbrella verb
marks a function that owns too many concepts. A transactional domain operation is still not
split into forwarding functions to satisfy a pattern.

Positional booleans and ambiguous
positional arguments become an options parameter with named fields, such as `isCancellable`
in `MenuOptions`. A month increment is `monthCount`, not `month`, and a function that only
forwards to a date library is replaced by the direct call.

A fixed verb vocabulary spares the reader a guess at which synonym a boundary chose:

| Verb                 | Meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `get`                | Retrieve an existing value from memory, cache, file, database, SDK, or API.     |
| `set`                | Assign or replace current state with the supplied value.                        |
| `insert`, `update`   | Add or change a row or item through a persistence boundary.                     |
| `delete`             | Destroy a durable row, object, or domain value.                                 |
| `add`, `remove`      | In-memory collection membership only.                                           |
| `create`             | Make a new independent domain value before persistence.                         |
| `make`, `build`      | Construct an object or dependency; construct a value from existing values.      |
| `parse`, `decode`    | Raw input to structured data; encoded bytes or payloads to typed values.        |
| `encode`             | Typed values to bytes or serialized payloads.                                   |
| `validate`, `assert` | Report invalidity; stop execution on failure.                                   |
| `refresh`, `prepare` | Replace presentation state from a source; set up local state before a workflow. |
| `reset`              | Return to an initial state.                                                     |

Each act keeps one verb across the codebase: once retrieval is `get`, no boundary reads, finds,
fetches, or loads instead. The noun and the return type carry multiplicity and optionality
(`getSession`, `getSessions`), and a qualifier appears only to tell apart two operations at one
use site. A domain operation that is more than one CRUD act keeps its precise domain verb, and
framework, SDK, generated, and external names are preserved exactly.

| Avoid                    | Prefer                   | Meaning                        |
| ------------------------ | ------------------------ | ------------------------------ |
| `saveCall`               | `insertCall`             | Insert a new call.             |
| `handleData`             | `decodeAccountResponse`  | Decode account response bytes. |
| `process`                | `validateEmailAddress`   | Validate an email address.     |
| `update`                 | `updateDraftMessageText` | Replace draft message text.    |
| `mapUserRowToUserDomain` | `mapUser`                | The parameter type says row.   |

At a boundary the conversion is named for the operation and the concept, `decodeUserResponse`
rather than `transform`. Shape suffixes such as `Row`, `DTO`, `Request`, and `Response` stay on
the type that declares the shape and never travel onto domain entities, view models, or the
functions that accept the shape.

## Booleans and predicates

<!-- level: all -->

Stored boolean columns and direct domain mappings are concise positive states without a
prefix: `enabled`, `active`, `retryable`, `webSearchEnabled`. Predicates, computed
predicates, and presentation-state assertions ask their question with `is` for state, `has`
for presence, and `can` for capability. An action is named by what it does even when it
returns a boolean (`askConfirmation`, `runFixer`). A proposed answer or control parameter is
named by its role (`defaultAnswer`, `useDefaults`); a boolean type does not make a function a
predicate.

Negative names (`isNotReady`, `isEmailNotUsed`) give way to the positive form that
matches the branch without double negation. A boolean never reads like a noun value, and the
weak modal enters no new local name. Externally owned boolean names, including framework, SDK,
protocol, wire, and generated relationship names, are preserved exactly.

| Avoid                    | Prefer                 | Meaning                                      |
| ------------------------ | ---------------------- | -------------------------------------------- |
| `SearchPolicy.isEnabled` | `SearchPolicy.enabled` | Stored policy state.                         |
| `email`                  | `hasEmailAddress`      | Presence of an email address.                |
| `textFile`               | `isTextFile`           | Whether a file meets the text-file contract. |
| `isEmailNotUsed`         | `isEmailUsed`          | Whether an email address is already used.    |
| `ready`                  | `is_ready`             | A computed readiness predicate in Bash.      |
