---
layer: code
kit: naming
title: Naming
---

# Naming

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

The naming rules span two files: this one (principles, vocabulary, functions, booleans) and Naming
Files (casing across languages, files and directories, boundaries and external names, tests).

## Authority and quality enforcement

<!-- level: all -->

Naming decisions must satisfy both this guide and the quality tooling.

- Follow this file when choosing names for files, directories, classes, structs, protocols, type
  aliases, interfaces, and enums. It covers functions, methods, parameters, variables, constants,
  SQL identifiers, storage objects, migration files, test helpers, and documentation examples too.

- Also follow the workspace naming quality checks.
- Also follow the banned-term and language policy checks for the affected
  scope.
- Treat quality failures as authoritative. If this guide and quality disagree,
  fix the disagreement instead of working around it locally.
- Do not duplicate quality implementation details here. The quality config owns
  exact limits, banned terms, scope exceptions, and extractor behavior.
- Do not bypass naming quality by hiding bad names in string keys, filenames,
  SQL quoted identifiers, generated wrappers, or aliases.
- Generated code may keep generator-owned names, but hand-written wrappers
  around generated code must follow this guide.

Choose a domain name, then run the checks that apply to its scope. Fix a
conflict between the guide and enforcement at its owner.

## General naming rules

<!-- level: all -->

Names are a design tool. A name lets a reader understand the concept,
scope, role, and expected value without reading the implementation first.

Rules:

- Name by role, responsibility, and domain meaning.
- Do not name by storage type, UI framework type, collection shape, or
  implementation accident.
- Use English unless representing an external identifier that must keep another
  spelling.
- Prefer the shortest name that is still clear at the use site.
- Add qualifiers only when the unqualified name is genuinely ambiguous.
- Avoid private shorthand that only the original author understands.
- Avoid contractions created by deleting letters from a word.
- Do not duplicate context already supplied by the enclosing type, module,
  directory, or package.
- Do not encode every implementation detail in a name.
- Use the same vocabulary for the same concept across a feature.
- Use singular names for single values and plural names for collections.
- Name collections by their contents, not by the collection type.
- Use role words when primitive or weak types do not carry enough meaning.
- Preserve required external names at boundaries, but translate them into domain
  names before they move inward.

| Avoid        | Prefer              | Meaning                           |
| ------------ | ------------------- | --------------------------------- |
| `string`     | `welcomeMessage`    | Greeting text.                    |
| `array`      | `availableAccounts` | Accounts available for selection. |
| `dict`       | `usersById`         | Users indexed by identifier.      |
| `userString` | `displayName`       | Name shown to the reader.         |
| `cfg`        | `appConfiguration`  | Application settings.             |
| `tmp`        | `accountSummary`    | Summary of an account.            |

| Avoid          | Prefer         | Meaning              |
| -------------- | -------------- | -------------------- |
| `u`            | `user`         | One user.            |
| `s`            | `subscription` | One subscription.    |
| `t`            | `transaction`  | Result of a charge.  |
| `userArray`    | `users`        | Collection of users. |
| `customerData` | `customer`     | One customer.        |

### Role instead of type

Names explain what the value means in the domain.

| Avoid       | Prefer            | Meaning                                |
| ----------- | ----------------- | -------------------------------------- |
| `urlString` | `avatarURLString` | Text representation of the avatar URL. |
| `data`      | `requestBody`     | Encoded request payload.               |
| `bool`      | `isEmailEmpty`    | Whether an email field is empty.       |

| Avoid    | Prefer           | Meaning                      |
| -------- | ---------------- | ---------------------------- |
| `string` | `welcomeMessage` | Greeting text.               |
| `number` | `attemptCount`   | Number of attempts.          |
| `item`   | `sessionSummary` | Summary of a session.        |
| `map`    | `usersById`      | Users indexed by identifier. |

### Avoid redundant context

Let the owner provide context. Add context only when the name is ambiguous outside the owner without it.

| Avoid          | Prefer      | Meaning       |
| -------------- | ----------- | ------------- |
| `Car.carMake`  | `Car.make`  | Manufacturer. |
| `Car.carModel` | `Car.model` | Model name.   |
| `Car.carColor` | `Car.color` | Paint color.  |

| Avoid                                     | Prefer                         | Meaning                           |
| ----------------------------------------- | ------------------------------ | --------------------------------- |
| `ProfileViewState.profileViewDisplayName` | `ProfileViewState.displayName` | Name shown by the profile view.   |
| `ProfileViewState.profileViewAvatarURL`   | `ProfileViewState.avatarURL`   | Avatar shown by the profile view. |

### Avoid type and shape duplication

Do not repeat information already expressed by the type system or declaration.

| Avoid                | Prefer         | Meaning                |
| -------------------- | -------------- | ---------------------- |
| `nameString`         | `name`         | A user name.           |
| `roleArray`          | `roles`        | Assigned roles.        |
| `userObject`         | `user`         | A user.                |
| `settingsJsonObject` | `settingsJson` | Settings in JSON form. |

| Avoid               | Prefer      | Meaning                      |
| ------------------- | ----------- | ---------------------------- |
| `messagesArray`     | `messages`  | Inbox messages.              |
| `userDictionary`    | `usersById` | Users indexed by identifier. |
| `optionalAvatarURL` | `avatarURL` | An optional avatar URL.      |

### Avoid vague and inflated words

Do not use vague words to avoid naming the real responsibility. Common bad
patterns include names that describe generic assistance, movement, or quality
instead of a concrete role.

| Avoid           | Prefer               | Meaning                             |
| --------------- | -------------------- | ----------------------------------- |
| `UserManager`   | `UserRepository`     | Persistence boundary for users.     |
| `DataProcessor` | `ProfileImageClient` | External profile image API.         |
| `LoginHandler`  | `LoginCoordinator`   | Owner of login navigation.          |
| `AppHelper`     | `SessionFactory`     | Assembly of session dependencies.   |
| `CommonUtils`   | `DateRangeFormatter` | Display formatting for date ranges. |
| `CoreService`   | `FileUploadClient`   | External file upload API.           |
| `ProfileStuff`  | `ProfileSummaryView` | Profile summary presentation.       |

Allowed framework or domain terms must be precise:

- `Repository` is valid for persistence or domain data access boundaries.
- `Client` is valid for external API or SDK boundaries.
- `Route`, `Callback`, `Observer`, and `Listener` are valid only when that
  framework shape is actually the point.
- UI-framework role words (`View`, `ViewModel`, `ViewController`,
  `Coordinator`) are defined in the language naming file that owns the
  framework.
- `Service` is not valid for app-owned names unless quality has an explicit
  exact exemption for that name. Prefer a more specific role.

## Vocabulary and role words

<!-- level: all -->

Choose suffixes and role words deterministically. A deterministic suffix tells a
reader what kind of boundary or owner they are looking at.

### Preferred role words

Use these meanings consistently:

| Role word    | Use when                                                             |
| ------------ | -------------------------------------------------------------------- |
| `UseCase`    | Application operation or business workflow.                          |
| `Repository` | Domain-facing access to persisted, cached, or remote domain data.    |
| `Client`     | External API, SDK, HTTP, storage, or platform protocol boundary.     |
| `Factory`    | Type that constructs instances and owns dependency assembly.         |
| `Formatter`  | Converts a value into a display or wire representation.              |
| `Parser`     | Converts raw input into structured data.                             |
| `Validator`  | Checks a value and returns or throws validation failure.             |
| `Mapper`     | Converts between explicit layers, such as DTO, or record to domain.  |
| `Store`      | Owns local mutable state or persistence mechanics.                   |
| `Provider`   | Supplies a capability or value, especially when the source may vary. |
| `Adapter`    | Bridges one interface or framework shape to another.                 |

Do not use a suffix just because the class needs a suffix. If the role is not
real, rename the type to the concrete domain concept.

| Avoid              | Prefer                       | Meaning                |
| ------------------ | ---------------------------- | ---------------------- |
| `SessionManager`   | `SessionRepository`          | Persistence boundary.  |
| `SessionProcessor` | `SessionTokenVerifier`       | Token verification.    |
| `SessionHelper`    | `SessionExpirationScheduler` | Expiration scheduling. |

### Service

`Service` is a reserved suffix. Do not use it in app-owned names unless the
current quality policy has an explicit exact exemption for that name.

| Avoid            | Prefer              | Meaning                        |
| ---------------- | ------------------- | ------------------------------ |
| `ProfileService` | `ProfileRepository` | Domain access to profile data. |

An external notification authorization boundary can use
`NotificationAuthorizationClient`. Its `requestAuthorization` operation names
the capability it requests.

### Manager

Do not use `Manager` in app-owned names unless an external platform contract
requires that exact name. Most `Manager` names hide a more specific role.

| Avoid           | Prefer             | Meaning              |
| --------------- | ------------------ | -------------------- |
| `UploadManager` | `FileUploadClient` | External upload API. |
| `LoginManager`  | `LoginCoordinator` | Login navigation.    |

Apple's `FileManager` type name is an external platform name. Do not copy the
suffix for local application owners.

### Helper and utility

Do not create `Helper`, `Helpers`, `Utility`, `Utilities`, `Util`, `Utils`,
`Common`, `Shared`, `Base`, or `Core` dumping grounds. Name the capability.

| Avoid                  | Prefer                                | Meaning                             |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| `Helpers.swift`        | `DateRangeFormatter.swift`            | Date range display.                 |
| `String+Helpers.swift` | `String+SearchQuery.swift`            | Search query operations.            |
| `common-utils.ts`      | `email-address-validation.ts`         | Email address validation.           |
| `BaseViewModel.swift`  | `AuthenticatedProfileViewModel.swift` | Authenticated profile presentation. |

## Functions and methods

<!-- level: all -->

Function and method names describe the action and the domain being acted
on without repeating context already supplied by the owner.

Rules:

- Start with the action unless a language or framework convention requires
  another shape.
- Include enough domain context to read clearly at the call site.
- Do not use generic names such as `process`, `handle`, `run`, `execute`,
  `manage`, `perform`, or `doWork` when the action can be named.
- Use `handle` only when matching an external framework callback pattern.
- Use `refresh` for replacing local presentation state from a source.
- Use `prepare` for setting up local state before a workflow.
- Use `get` for application-owned retrieval operations. Do not select a
  different retrieval verb based on I/O, optionality, pagination, or whether
  one value or many values are returned.
- Use `set` for assigning or replacing a supplied value directly.
- Use `insert` for adding a new row or storage item through a persistence
  boundary.
- Use `update` for changing an existing row or storage item through a
  persistence boundary.
- Use `delete` for destroying a durable row, object, or domain value.
- Use `reset` only for returning to an initial state.
- Use `add` and `remove` only for in-memory collection membership, not as
  persistence verbs.
- Use `create` when making a new independent domain value before persistence,
  not as a synonym for database insertion.
- Use `make` for factories that construct in-memory objects or dependencies.
- Use `build` for constructing a value from existing values.
- Use `parse` for raw input to structured data.
- Use `decode` for encoded bytes or serialized payloads into typed values.
- Use `encode` for typed values into bytes or serialized payloads.
- Use `validate` for checking and reporting invalidity.
- Use `assert` only when failure throws, traps, or stops execution.
- Use item/options parameters when positional arguments become ambiguous.
- Avoid positional boolean parameters.

### Retrieval and CRUD operations

Application-owned retrieval, state, database, and storage boundaries use the
`get`, `set`, `insert`, `update`, and `delete` vocabulary. The noun and return
type communicate multiplicity, pagination, and optionality. Do not encode
those differences by switching between synonymous verbs.

Rules:

- Use `get` for retrieving existing values from memory, caches, files,
  databases, storage, SDKs, or remote APIs.
- Use a singular noun for one value and a plural noun for a collection, such as
  `getChatConfig`, `getSession`, `getSessions`, and `getPaginatedSessions`.
- Let the return type communicate optionality. A lookup returning `T | null`
  still uses `get`, not a separate verb.
- A `get` boundary may populate its owning runtime state when returning the raw source leaks boundary mechanics, such as `getTestEnv()` loading the
  dynamic test environment.
- Do not use `read`, `find`, `fetch`, `load`, or `list` as alternate retrieval
  verbs in application-owned APIs.
- Use `set` when the caller supplies the value that directly replaces current
  state.
- Use `insert` when a database or storage boundary adds a new row or item.
- Use `update` when a database or storage boundary changes an existing row or
  item.
- Use `delete` when a database or storage boundary destroys a row or item.
- Keep the noun short. Do not append `Row`, `Record`, `Value`, `Existing`, or an
  owner such as `ForSession` when the type, parameters, or enclosing module
  already provide that information.
- Add a qualifier only when it distinguishes two operations that are both
  visible at the same use site, such as `getCachedCall` versus `getActiveCall`.
- Do not use `create`, `add`, `save`, `write`, `put`, `upsert`, or `remove` as
  synonyms for persistence insertion, update, or deletion.
- Keep `create` for constructing a new domain value and `add` or `remove` for
  in-memory collection membership.
- A transactional domain operation may keep a precise domain verb when it is
  not merely a longer synonym for one direct CRUD operation.
- Keep precise non-CRUD verbs such as `parse`, `decode`, `encode`, `validate`,
  and `build` when the function performs that operation instead of retrieving
  data. `resolve`, `load`, and `fetch` are banned as synonyms for `get`.
- `handle` is a verb only for framework callbacks: React event props such as
  `handleSubmit`, UIKit `@objc handleConfirmButtonTapped`, Python signal and
  event handlers. `Handler` is never a type or role suffix.
- Preserve framework, standard-library, SDK, generated, and external contract
  names exactly.

| Avoid                   | Prefer                 | Meaning                      |
| ----------------------- | ---------------------- | ---------------------------- |
| `readChatConfig`        | `getChatConfig`        | Retrieve configuration.      |
| `findSession`           | `getSession`           | Retrieve one session.        |
| `listPaginatedSessions` | `getPaginatedSessions` | Retrieve a page of sessions. |
| `saveCall`              | `insertCall`           | Insert a new call.           |

| Avoid        | Prefer                   | Meaning                        |
| ------------ | ------------------------ | ------------------------------ |
| `handleData` | `decodeAccountResponse`  | Decode account response bytes. |
| `process`    | `validateEmailAddress`   | Validate an email address.     |
| `didTap`     | `submitButtonTapped`     | React to the submit button.    |
| `update`     | `updateDraftMessageText` | Replace draft message text.    |

Name a month increment `monthCount`, not `month`. Call an existing date
library directly when a local function only forwards its arguments.

For a menu constructor with several text fields, group related inputs in
`MenuOptions`. A named `isCancellable` field communicates more than a positional
Boolean argument.

### One concept per function name

If the function name needs `and`, `or`, `with`, `plus`, or a vague umbrella
verb, the function may own too many concepts.

Keep validation in `validateProfile` and persistence updates in `updateProfile`
when they have separate callers and contracts. Do not split a transactional
domain operation into forwarding functions only to satisfy a naming pattern.

### Boundary names

At boundaries, name the conversion explicitly.

| Avoid     | Prefer               | Meaning                           |
| --------- | -------------------- | --------------------------------- |
| `data`    | `decodeUserResponse` | Decode response bytes.            |
| `convert` | `mapUser`            | Map a storage record into a user. |

| Avoid       | Prefer                    | Meaning                              |
| ----------- | ------------------------- | ------------------------------------ |
| `transform` | `parseSubmitOrderRequest` | Parse and validate an order request. |

### Boundary shape suffixes

Use suffixes such as `Row`, `DTO`, `Request`, and `Response` only where they
describe the declared shape. Do not carry the suffix into every function that
accepts or returns that shape.

Rules:

- Keep `Row` on a type alias, interface, or generated contract when it is a
  database row, RPC row, or row-shaped storage boundary.
- Do not add `Row` to domain entities, ViewModels, use cases, API response
  objects, or UI state just because the value originally came from storage.
- Do not keep `Row` on parser, mapper, validator, or conversion function names
  when the parameter or return type already carries the row shape.
- Name boundary functions for the operation and domain concept they perform.
- Use `row` or `dbRow` for a local variable only inside database boundary code
  where the value is still a database wire shape.

| Avoid                    | Prefer                      | Meaning                                   |
| ------------------------ | --------------------------- | ----------------------------------------- |
| `AccountDeletionRequest` | `AccountDeletionRequestRow` | A database row shape.                     |
| `mapUserRowToUserDomain` | `mapUser`                   | Convert a user row into the domain shape. |

## Booleans and predicates

<!-- level: all -->

Boolean names use positive states. Stored values stay concise; predicates state
the question they answer.

Rules:

- Stored Boolean columns and direct domain mappings use concise positive states
  without an `is` prefix, such as `enabled`, `active`, `retryable`,
  `webSearchEnabled`, or `defaultForCharacter`.
- Predicate functions, predicate methods, computed predicates, and
  presentation-state assertions use `is` for state or characteristics, `has`
  for possession or presence, and `can` for capability.
- Name actions by what they do, even when they return a Boolean. Use
  `askConfirmation` for a prompt and `runFixer` for execution.
- Name proposed answers and control parameters by their role, such as
  `defaultAnswer` and `useDefaults`. A Boolean type does not establish that a
  function is a predicate.
- Preserve externally owned Boolean names exactly, including framework, SDK,
  protocol, wire, and generated relationship names.
- Do not introduce `should` in new local names. Preserve it only for external
  framework or protocol requirements covered by an explicit quality exemption.
- Avoid negative names such as `isNotReady` or `isEmailNotUsed` when the
  positive form is clearer.
- Do not name booleans like nouns that read as non-boolean values.
- Prefer the boolean name that matches the branch without double negation.

| Avoid                    | Prefer                 | Meaning                         |
| ------------------------ | ---------------------- | ------------------------------- |
| `SearchPolicy.isEnabled` | `SearchPolicy.enabled` | Stored policy state.            |
| `email`                  | `hasEmailAddress`      | Presence of an email address.   |
| `notReady`               | `isReady`              | A positive readiness predicate. |

| Avoid            | Prefer        | Meaning                                      |
| ---------------- | ------------- | -------------------------------------------- |
| `textFile`       | `isTextFile`  | Whether a file meets the text-file contract. |
| `isEmailNotUsed` | `isEmailUsed` | Whether an email address is already used.    |

| Avoid   | Prefer     | Meaning                                 |
| ------- | ---------- | --------------------------------------- |
| `ready` | `is_ready` | A computed readiness predicate in Bash. |
