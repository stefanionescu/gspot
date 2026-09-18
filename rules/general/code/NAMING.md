---
layer: code
preset: naming
title: Naming
---

# Naming

The naming rules span two files: this one (principles, vocabulary, functions, booleans) and Naming
Files (casing across languages, files and directories, boundaries and external names, tests).

## Authority and quality enforcement

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

Bad:

```text
Use this name because it passes a local manual interpretation of the rules,
even though the naming quality check rejects it.
```

Good:

```text
Choose the clearest domain name, then run the affected quality checks and adjust
the name if the current naming or banned-term policy rejects it.
```

## General naming rules

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

Bad:

```swift
let string = "Welcome back"
let array = accounts
let dict = usersById
let userString = user.name
let cfg = AppConfiguration()
let tmp = makeAccountSummary(account)
```

Good:

```swift
let welcomeMessage = "Welcome back"
let availableAccounts = accounts
let usersById = usersById
let displayName = user.name
let appConfiguration = AppConfiguration()
let accountSummary = makeAccountSummary(account)
```

Bad:

```ts
const u = getUser();
const s = getSubscription();
const t = charge(u, s);
const userArray = users;
const customerData = getCustomer();
```

Good:

```ts
const user = getUser();
const subscription = getSubscription();
const transaction = charge(user, subscription);
const users = getUsers();
const customer = getCustomer();
```

### Role instead of type

Names explain what the value means in the domain.

Bad:

```swift
let urlString = profile.avatarURL.absoluteString
let data = try JSONEncoder().encode(request)
let bool = form.email.isEmpty
```

Good:

```swift
let avatarURLString = profile.avatarURL.absoluteString
let requestBody = try JSONEncoder().encode(request)
let isEmailEmpty = form.email.isEmpty
```

Bad:

```ts
const string = 'Welcome back';
const number = attempts.length;
const item = buildSessionSummary(session);
const map = usersById;
```

Good:

```ts
const welcomeMessage = 'Welcome back';
const attemptCount = attempts.length;
const sessionSummary = buildSessionSummary(session);
const usersById = usersById;
```

### Avoid redundant context

Let the owner provide context. Add context only when the name is ambiguous outside the owner without it.

Bad:

```ts
type Car = {
    carMake: string;
    carModel: string;
    carColor: string;
};

function printCar(car: Car): void {
    console.log(`${car.carMake} ${car.carModel} (${car.carColor})`);
}
```

Good:

```ts
type Car = {
    make: string;
    model: string;
    color: string;
};

function print(car: Car): void {
    console.log(`${car.make} ${car.model} (${car.color})`);
}
```

Bad:

```swift
struct ProfileViewState {
    var profileViewDisplayName: String
    var profileViewAvatarURL: URL
}
```

Good:

```swift
struct ProfileViewState {
    var displayName: String
    var avatarURL: URL
}
```

### Avoid type and shape duplication

Do not repeat information already expressed by the type system or declaration.

Bad:

```ts
const nameString: string = user.name;
const roleArray: Role[] = user.roles;
const userObject: User = getUser();
const settingsJsonObject: SettingsJson = parseSettingsJson(source);
```

Good:

```ts
const name = user.name;
const roles = user.roles;
const user = getUser();
const settingsJson = parseSettingsJson(source);
```

Bad:

```swift
let messagesArray: [Message] = inbox.messages
let userDictionary: [User.ID: User] = usersById
let optionalAvatarURL: URL? = profile.avatarURL
```

Good:

```swift
let messages: [Message] = inbox.messages
let usersById: [User.ID: User] = usersById
let avatarURL: URL? = profile.avatarURL
```

### Avoid vague and inflated words

Do not use vague words to avoid naming the real responsibility. Common bad
patterns include names that describe generic assistance, movement, or quality
instead of a concrete role.

Bad:

```text
UserManager
DataProcessor
LoginHandler
AppHelper
CommonUtils
CoreService
ProfileStuff
AdvancedPainter
SmartLoader
```

Good:

```text
UserRepository
ProfileImageClient
LoginCoordinator
SessionFactory
DateRangeFormatter
FileUploadClient
ProfileSummaryView
```

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

Bad:

```ts
export class SessionManager {}
export class SessionProcessor {}
export class SessionHelper {}
```

Good:

```ts
export class SessionRepository {}
export class SessionTokenVerifier {}
export class SessionExpirationScheduler {}
```

### Service

`Service` is a reserved suffix. Do not use it in app-owned names unless the
current quality policy has an explicit exact exemption for that name.

Bad:

```swift
final class ProfileService {
    func getProfile(for userID: User.ID) async throws -> Profile { ... }
}
```

Good:

```swift
protocol ProfileRepository {
    func getProfile(for userID: User.ID) async throws -> Profile
}
```

Better for app-owned capabilities:

```swift
struct NotificationAuthorizationClient {
    func requestAuthorization() async throws -> NotificationAuthorizationStatus
}
```

### Manager

Do not use `Manager` in app-owned names unless an external platform contract
requires that exact name. Most `Manager` names hide a more specific role.

Bad:

```swift
final class UploadManager { }
final class LoginManager { }
```

Good:

```swift
final class FileUploadClient { }
final class LoginCoordinator { }
```

Apple's `FileManager` type name is an external platform name. Do not copy the
suffix for local application owners.

### Helper and utility

Do not create `Helper`, `Helpers`, `Utility`, `Utilities`, `Util`, `Utils`,
`Common`, `Shared`, `Base`, or `Core` dumping grounds. Name the capability.

Bad:

```text
Helpers.swift
String+Helpers.swift
common-utils.ts
BaseViewModel.swift
```

Good:

```text
DateRangeFormatter.swift
String+SearchQuery.swift
email-address-validation.ts
AuthenticatedProfileViewModel.swift
```

## Functions and methods

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

Bad:

```ts
const config = await readChatConfig();
const session = await findSession(sessionId);
const sessions = await listPaginatedSessions(cursor);
```

Good:

```ts
const config = await getChatConfig();
const session = await getSession(sessionId);
const sessions = await getPaginatedSessions(cursor);
const call = await insertCall(sessionId, userId, providerCallId);
```

Bad:

```swift
func handleData(_ data: Data) { }
func process(_ value: String) { }
func didTap() { }
func update(_ text: String) { }
```

Good:

```swift
func decodeAccountResponse(_ responsePayload: Data) throws -> [Account]
func validateEmailAddress(_ emailAddress: String) -> EmailValidationResult
func submitButtonTapped()
func updateDraftMessageText(_ draftMessageText: String)
```

Bad:

```ts
function addToDate(date: Date, month: number): Date {
    return dateFns.addMonths(date, month);
}

function createMenu(title: string, body: string, buttonText: string, cancellable: boolean) {
    ...
}
```

Good:

```ts
function addMonthToDate(date: Date, monthCount: number): Date {
    return dateFns.addMonths(date, monthCount);
}

type MenuOptions = {
    title: string;
    body: string;
    buttonText: string;
    isCancellable: boolean;
};

function createMenu(options: MenuOptions) {
    ...
}
```

### One concept per function name

If the function name needs `and`, `or`, `with`, `plus`, or a vague umbrella
verb, the function may own too many concepts.

Bad:

```ts
function validateAndSaveProfile(profile: Profile): Promise<void> {
    ...
}
```

Good:

```ts
function validateProfile(profile: Profile): ProfileValidationResult {
    ...
}

async function saveProfile(profile: Profile): Promise<void> {
    ...
}
```

### Boundary names

At boundaries, name the conversion explicitly.

Bad:

```swift
func data(_ response: URLResponse) -> User
func convert(_ row: UserRow) -> User
```

Good:

```swift
func decodeUserResponse(_ responsePayload: Data) throws -> UserDTO
func mapUserRecordToDomain(_ record: UserRecord) throws -> User
```

Bad:

```ts
function transform(input: unknown): SubmitOrderRequest {
    ...
}
```

Good:

```ts
function parseSubmitOrderRequest(input: unknown): SubmitOrderRequest {
    ...
}
```

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

Bad:

```ts
type AccountDeletionRequest = {
    success: boolean;
};

function parseDeletionRequest(value: Json): AccountDeletionRequest {
    ...
}

function mapUserRowToUserDomain(row: UserRow): User {
    ...
}
```

Good:

```ts
type AccountDeletionRequestRow = {
    success: boolean;
};

function parseDeletionRequest(value: Json): AccountDeletionRequestRow {
    ...
}

function mapUser(row: UserRow): User {
    ...
}
```

## Booleans and predicates

Boolean names use positive states. Stored values stay concise; predicates state
the question they answer.

Rules:

- Stored Boolean columns and direct domain mappings use concise positive states
  without an `is` prefix, such as `enabled`, `active`, `retryable`,
  `webSearchEnabled`, or `defaultForCharacter`.
- Predicate functions, predicate methods, computed predicates, and
  presentation-state assertions use `is` for state or characteristics, `has`
  for possession or presence, and `can` for capability.
- Preserve externally owned Boolean names exactly, including framework, SDK,
  protocol, wire, and generated relationship names.
- Do not introduce `should` in new local names. Preserve it only for external
  framework or protocol requirements covered by an explicit quality exemption.
- Avoid negative names such as `isNotReady` or `isEmailNotUsed` when the
  positive form is clearer.
- Do not name booleans like nouns that read as non-boolean values.
- Prefer the boolean name that matches the branch without double negation.

Bad:

```swift
struct SearchPolicy {
    let isEnabled: Bool
}

let email = user.email != nil
let notReady = state != .ready
```

Good:

```swift
struct SearchPolicy {
    let enabled: Bool
}

let isSubmitButtonDisabled = form.email.isEmpty
let hasEmailAddress = user.email != nil
let isReady = state == .ready
```

Bad:

```ts
function textFile(fileName: string): boolean {
    return fileName.endsWith(".txt");
}

function isEmailNotUsed(email: string): boolean {
    ...
}
```

Good:

```ts
function isTextFile(fileName: string): boolean {
    return fileName.endsWith(".txt");
}

function isEmailUsed(email: string): boolean {
    ...
}
```

Bad:

```bash
ready='false'
if [[ "${ready}" != 'true' ]]; then
  fail 'not ready'
fi
```

Good:

```bash
is_ready='false'
if [[ "${is_ready}" != 'true' ]]; then
  fail 'not ready'
fi
```
