# Naming

This is the single source of truth for naming in this monorepo. It covers
general naming principles plus language-specific rules for Swift, TypeScript,
JavaScript, Bash, SQL, and Supabase-owned infrastructure names.

Use this file together with the automated quality checks. This document explains
how to choose names. The quality tooling enforces the current concrete policy.
Do not copy exact quality limits or banned-term lists into this document.

## Contents

- [Authority and Quality Enforcement](#authority-and-quality-enforcement)
- [General Naming Rules](#general-naming-rules)
- [Vocabulary and Role Words](#vocabulary-and-role-words)
- [Functions and Methods](#functions-and-methods)
- [Booleans and Predicates](#booleans-and-predicates)
- [Files and Directories](#files-and-directories)
- [Boundaries and External Names](#boundaries-and-external-names)
- [Tests](#tests)
- [Swift](#swift)
- [TypeScript](#typescript)
- [JavaScript](#javascript)
- [Bash](#bash)
- [SQL and Supabase](#sql-and-supabase)
- [API Naming](#api-naming)
- [Review Checklist](#review-checklist)

## Authority and Quality Enforcement

Naming decisions must satisfy both this guide and the quality tooling.

- Follow this file when choosing names for files, directories, classes, structs,
  protocols, type aliases, interfaces, enums, functions, methods, parameters,
  variables, constants, SQL identifiers, storage objects, migration files, test
  helpers, and documentation examples.
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

## General Naming Rules

Names are a design tool. A name should let a reader understand the concept,
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

### Role Instead of Type

Names should explain what the value means in the domain.

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

### Avoid Redundant Context

Let the owner provide context. Add context only when the name would otherwise be
ambiguous outside the owner.

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

### Avoid Type and Shape Duplication

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

### Avoid Vague and Inflated Words

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

- `View` is valid for SwiftUI views.
- `ViewModel` is valid for presentation state owners.
- `Repository` is valid for persistence or domain data access boundaries.
- `Client` is valid for external API or SDK boundaries.
- `Coordinator` is valid for navigation or flow ownership.
- `Route`, `Callback`, `Observer`, and `Listener` are valid only when that
  framework shape is actually the point.
- `Service` is not valid for app-owned names unless quality has an explicit
  exact exemption for that name. Prefer a more specific role.

## Vocabulary and Role Words

Choose suffixes and role words deterministically. A deterministic suffix tells a
reader what kind of boundary or owner they are looking at.

### Preferred Role Words

Use these meanings consistently:

| Role word        | Use when                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| `View`           | SwiftUI view or UIKit view type that presents UI.                                      |
| `ViewController` | UIKit screen controller.                                                               |
| `ViewModel`      | Presentation state and user intent owner for one screen, flow, or cohesive surface.    |
| `ViewState`      | Value describing screen presentation state.                                            |
| `ViewAction`     | Typed user or lifecycle intent emitted by a view.                                      |
| `UseCase`        | Application operation or business workflow.                                            |
| `Repository`     | Domain-facing access to persisted, cached, or remote domain data.                      |
| `Client`         | External API, SDK, HTTP, storage, or platform protocol boundary.                       |
| `Coordinator`    | Navigation or flow state owner.                                                        |
| `Router`         | Route mutation or destination-selection boundary, usually narrower than a coordinator. |
| `Factory`        | Type that constructs instances and owns dependency assembly.                           |
| `Formatter`      | Converts a value into a display or wire representation.                                |
| `Parser`         | Converts raw input into structured data.                                               |
| `Validator`      | Checks a value and returns or throws validation failure.                               |
| `Mapper`         | Converts between explicit layers, usually DTO/record to domain.                        |
| `Store`          | Owns local mutable state or persistence mechanics.                                     |
| `Provider`       | Supplies a capability or value, especially when the source may vary.                   |
| `DataSource`     | UIKit/list adapter or external source abstraction that feeds rows/items.               |
| `Adapter`        | Bridges one interface or framework shape to another.                                   |

Do not use a suffix just because the class needs a suffix. If the role is not
real, rename the type to the concrete domain concept.

Bad:

```swift
final class LoginManager { }
final class LoginHandler { }
final class LoginData { }
final class AccountService { }
```

Good:

```swift
@MainActor
final class LoginViewModel: ObservableObject { }

final class LoginCoordinator { }
struct LoginViewState { }
enum LoginViewAction { }
protocol AccountRepository { }
struct FileUploadClient { }
```

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

### Helper and Utility

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

## Functions and Methods

Function and method names should describe the action and the domain being acted
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

### Retrieval and CRUD Operations

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
- A `get` boundary may populate its owning runtime state when returning the raw
  source would leak boundary mechanics, such as `getTestEnv()` loading the
  configured test environment.
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
  `resolve`, and `build` when the function performs that operation instead of
  retrieving data.
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

### One Concept per Function Name

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

### Boundary Names

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

### Boundary Shape Suffixes

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

## Booleans and Predicates

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
- Do not name booleans like nouns that could be non-boolean values.
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

## Files and Directories

Files and directories define ownership. Name them for the behavior or entity
they own, not for reuse intent.

Rules:

- File names follow the language-specific case rules below.
- A source file with one primary top-level type is named after that type when
  the language uses primary-type filenames.
- A module file is named after the cohesive capability it owns.
- Do not create catch-all files or directories for unrelated code.
- Do not move code into shared locations just because a future caller might
  appear.
- Promote shared code only when there is a repeated concept and a stable owner.
- A directory named by a broad layer is acceptable only when the project
  architecture explicitly owns that layer.
- Prefer feature ownership over top-level type buckets.

Bad:

```text
Helpers.swift
Managers.swift
Data.swift
LoginStuff.swift
Extensions.swift
common-utils.ts
src/helpers/
src/models/
```

Good:

```text
LoginView.swift
LoginViewModel.swift
LoginViewState.swift
AccountRepository.swift
FileUploadClient.swift
UIViewController+ChildContainment.swift
email-address-validation.ts
session-token-verifier.ts
src/accounts/
src/accounts/avatar/
```

### Feature Organization

Organize packages and feature folders by feature or cohesive capability, not by
generic type buckets.

Bad:

```text
Views/
ViewModels/
Services/
Managers/
Helpers/
Models/
```

Good:

```text
Profile/
  Presentation/
  Domain/
  Infrastructure/
  Composition/

Checkout/
  CheckoutView.swift
  CheckoutViewModel.swift
  SubmitOrderUseCase.swift
```

Small features can stay flatter when the ownership is still clear.

## Boundaries and External Names

External systems often use names that do not match the domain language. Keep
those names at the boundary and translate them intentionally.

Rules:

- Preserve external field names in DTOs, SQL rows, generated types, wire
  payloads, and validation schemas when changing them would misrepresent the
  contract.
- Translate provider names into domain names before passing values into domain
  or presentation layers.
- Do not leak provider, database, storage, or HTTP mechanics into ViewModels,
  domain entities, use cases, or API-facing response names.
- If a name is part of an external contract, treat renaming it as a contract
  change.
- Use explicit mapping names when crossing layers.

Bad:

```ts
type ProviderOutput = {
    providerOperationId: string;
    providerStatus: string;
};
```

Good:

```ts
type ProviderSubmitOrderResponse = {
    providerOperationId: string;
    providerStatus: string;
};

type SubmittedOrder = {
    providerOperationId: ProviderOperationId;
    status: OrderStatus;
};
```

Bad:

```swift
struct Message {
    let storage_object_path: String
}
```

Good:

```swift
struct MessageAttachmentDTO: Decodable {
    let storage_object_path: String
}

struct MessageAttachment {
    let attachmentPath: StoragePath
}
```

## Tests

Test names and test data names should describe observable behavior, not private
implementation details.

Rules:

- Name tests for the behavior and expected outcome.
- Use descriptive unique values for names, emails, IDs, queue names, event IDs,
  resource IDs, and external references.
- Avoid names tied to private helper names.
- Avoid test data names that hide the scenario.
- Test helpers should be named for the behavior they create.
- Test fixtures should not become global mystery data.

Bad:

```ts
describe('Calendar', () => {
    it('2/29/2020', () => {});
    it('throws', () => {});
});
```

Good:

```ts
describe('Calendar', () => {
    it('handles leap year dates', () => {});
    it('throws when the date format is invalid', () => {});
});
```

Bad:

```swift
func test1() throws { }
func testMessages() async throws { }
```

Good:

```swift
func testMessagesShowUnreadMessagesFirst() async throws { }
func testSubmitButtonTappedShowsValidationErrorWhenEmailIsInvalid() async throws { }
```

## Swift

Swift naming follows Apple API Design Guidelines, Google Swift file guidance
where useful, and the local quality rules. Optimize for call-site clarity.

### Swift Case Rules

Rules:

- Types, protocols, actors, enums, structs, classes, and generic type parameters
  use `PascalCase`.
- Variables, constants, functions, methods, properties, parameters, argument
  labels, enum cases, and global constants use `lowerCamelCase`.
- Swift file names match the primary type or extension target pattern.
- Do not use Objective-C style app or company prefixes for Swift-only types.
- Do not use Hungarian notation, `k` prefixes, `g` prefixes, or all-caps global
  constants.
- Do not use leading underscores, suffixes, or prefixes as access command. Use
  Swift access modifiers instead.
- Use US English spellings to match Apple APIs.
- Treat common initialisms consistently and readably at call sites, such as
  `URL`, `ID`, `API`, `HTTP`, and `JSON`.
- Do not include `optional` or `maybe` in optional variable names.
- Use Unicode identifiers only for legitimate domain notation understood by the
  team.

Bad:

```swift
class YAPLoginViewModel { }
struct user_profile { }
let MAX_RETRY_COUNT = 3
let maybeAvatarURL: URL?
let userId: User.ID
```

Good:

```swift
final class LoginViewModel { }
struct UserProfile { }
let maxRetryCount = 3
let avatarURL: URL?
let userID: User.ID
```

### Swift Scoped Names

Prefer language scoping over name prefixes when a relationship is structural.
If a type is owned by another type and can be nested, nest it instead of
inventing a longer top-level name.

Rules:

- Use access command for privacy; do not signal privacy with `_privateName`.
- Nest owned errors, options, and helper types when Swift allows it.
- Do not repeat the declaring type in static or class properties that return an
  instance of that same type.
- Use lower camel case for global constants.
- Use `shared` or `default` for singleton-like values only when those words
  actually describe the role.
- Use an empty enum as a namespace only for tightly related constants or helper
  functions that should never be instantiated.

Bad:

```swift
private let _cachedProfile: Profile?

enum ParseError: Error {
    case invalidToken(String)
}

extension UIColor {
    static let primaryColor: UIColor = .blue
}

let SecondsPerMinute = 60
let kSecondsPerMinute = 60
```

Good:

```swift
private let cachedProfile: Profile?

struct Parser {
    enum Error: Swift.Error {
        case invalidToken(String)
    }
}

extension UIColor {
    static let primary: UIColor = .blue
}

let secondsPerMinute = 60
```

### Swift Files

Rules:

- A file with one primary type is named after that type.
- Related small helper types may live in the same file when they are private or
  tightly owned by the primary type.
- Split a file when there is no clear primary type.
- Extension files use `TypeName+Capability.swift` or
  `TypeName+ProtocolConformance.swift`.
- Do not use `TypeName+Extensions.swift` when a narrower capability name exists.
- Do not create broad extension dumping grounds.
- Do not prefix files with the app name unless the file is the app entry point
  or a framework collision makes the prefix unavoidable.

Bad:

```text
Data.swift
LoginStuff.swift
String+Helpers.swift
View+Utilities.swift
Extensions.swift
```

Good:

```text
LoginView.swift
LoginViewModel.swift
LoginViewState.swift
MessageTimestampFormatter.swift
String+SearchQuery.swift
UIViewController+ChildContainment.swift
UserDefaults+SessionStorage.swift
```

### Swift MVVM Names

For SwiftUI and MVVM, suffixes are deterministic.

Use:

```text
FeatureView.swift
FeatureViewModel.swift
FeatureViewState.swift
FeatureViewAction.swift
FeatureRepository.swift
FeatureClient.swift
FeatureCoordinator.swift
FeatureViewModelTests.swift
```

Rules:

- `View` presents UI and forwards user intent.
- `ViewModel` owns presentation state, async task orchestration for the
  presentation surface, and user-intent methods.
- `ViewState` is a value describing screen state.
- `ViewAction` is a typed user or lifecycle event.
- `Coordinator` owns navigation or flow state.
- `Repository` owns domain-facing data access.
- `Client` owns external API, SDK, HTTP, storage, or platform mechanics.
- `UseCase` owns an application operation or business workflow.
- `Formatter` owns domain-sensitive display formatting.
- Avoid `Manager`, `Handler`, and `Data` for MVVM owner types.

Bad:

```swift
final class LoginManager: ObservableObject { }
final class LoginHandler: ObservableObject { }
final class LoginData: ObservableObject { }
struct LoginScreen: View { }
```

Good:

```swift
@MainActor
final class LoginViewModel: ObservableObject { }

struct LoginView: View { }

struct LoginViewState {
    var email: String
    var password: String
    var isSubmitButtonEnabled: Bool
}

enum LoginViewAction {
    case emailChanged(String)
    case passwordChanged(String)
    case submitButtonTapped
}
```

### Swift ViewModel Methods

Use UI event names when a ViewModel method represents a direct UI event. Use
domain verbs when the method does domain work.

Direct UI event examples:

```swift
func submitButtonTapped()
func cameraPermissionDenied()
func fileImportStarted()
func accountPickerSelectionChanged(to account: AccountOption)
func retryButtonTapped()
func selectedItemChanged(to itemID: Item.ID)
```

Domain work examples:

```swift
func enqueueFileUpload(_ file: PendingUploadFile)
func refreshOrderHistory(for accountID: Account.ID) async
func persistDraftReport(_ report: DraftReport) async throws
func validateEmailAddress(_ emailAddress: String) -> EmailValidationResult
```

Bad:

```swift
func handle(_ action: LoginAction)
func process(_ text: String)
func update(_ value: String)
func didTap()
```

Good:

```swift
func submitButtonTapped()
func passwordFieldChanged(to password: String)
func updateDraftMessageText(_ draftMessageText: String)
func validateLoginForm(_ form: LoginForm) -> LoginValidationResult
```

UIKit target-action and notification handlers may use `handle...` when they are
literal framework handlers:

```swift
@objc
func handleConfirmButtonTapped(_ sender: UIButton) { }

@objc
func handleKeyboardDidShowNotification(_ notification: Notification) { }
```

Do not use `handle` for normal ViewModel intent methods.

### Swift Function and Argument Labels

Rules:

- Function and method names should form grammatical English at the call site.
- Omit the first argument label when the base name and first argument form a
  clear phrase.
- Include argument labels when they clarify weak types or avoid ambiguity.
- Initializer arguments that directly set stored properties should use the
  property names.
- Use explicit `self.` in initializers when parameter and stored property names
  match.
- Factory methods that create new instances should use `make...` when that
  improves clarity.
- Nonmutating methods without side effects should read as noun phrases where
  natural.
- Mutating methods with side effects should use imperative verb phrases.
- Use Swift mutating/nonmutating pairs where applicable, such as
  `sort`/`sorted`, `append`/`appending`, and `formUnion`/`union`.

Bad:

```swift
func addToDate(_ date: Date, _ value: Int) -> Date
func make(_ profile: Profile) -> ProfileView
func save(user: User)
```

Good:

```swift
func addMonthToDate(_ date: Date, monthCount: Int) -> Date
func makeProfileView(for profile: Profile) -> ProfileView
func saveUser(_ user: User)
```

Initializer example:

```swift
struct Person {
    let name: String
    let phoneNumber: String

    init(name: String, phoneNumber: String) {
        self.name = name
        self.phoneNumber = phoneNumber
    }
}
```

### Swift Delegates

Delegate methods put the delegate owner first, following Apple API patterns.

Rules:

- Pass the delegate source item as the first argument.
- Leave the source item argument unlabeled.
- For a source-only `Void` event, use the source type plus a past-tense or
  future-tense event phrase.
- For a source-only `Bool` assertion, use the source type plus `can`, `is`, or
  another allowed predicate phrase that describes the returned answer.
- Do not introduce `should` in delegate names. Preserve it only for external
  framework requirements covered by an explicit quality exemption.
- For a source-only non-Boolean value, use a noun phrase for the queried value
  and label the source item with a natural preposition.
- When there are extra arguments, use the source type as the base name, then
  make the second argument label describe the event, question, or requested
  value.
- Do not omit the source item just because the delegate is currently owned by
  one caller.

Bad:

```swift
func didDeleteDraft()
func didDeleteDraft(draft: Draft, store: DraftStore)
func heightForMessage(_ message: Message) -> CGFloat
```

Good:

```swift
func draftStore(_ draftStore: DraftStore, didDeleteDraft draft: Draft)
func draftStoreCanDeleteDraft(_ draftStore: DraftStore) -> Bool
func messageListDataSource(_ dataSource: MessageListDataSource, didSelectMessage id: Message.ID)
func numberOfSections(in dataSource: MessageListDataSource) -> Int
func messageListDataSource(
    _ dataSource: MessageListDataSource,
    heightForMessageAt indexPath: IndexPath
) -> CGFloat
```

### Swift Protocols

Rules:

- Do not prefix protocol names with `I`.
- Do not suffix protocols with `Protocol`.
- Protocols that describe what something is use nouns.
- Capability protocols use natural capability names, often `-ing` when the
  protocol describes behavior.
- Use `Provider`, `Repository`, `Client`, or `Coordinating` only when that is the
  actual role.
- Avoid automatic `-able` names that do not describe a clear capability.
- Do not create protocols for every ViewModel or use case just to make mocks.

Bad:

```swift
protocol IFooEventHandler { }
protocol LoginViewModelProtocol { }
protocol DataLoadable { }
protocol Colorable { }
protocol LoginManaging { }
```

Better:

```swift
protocol AccountLoading { }
protocol ThemeColorProviding { }
protocol LoginCoordinating { }
protocol ProfileRepository { }
protocol FileUploadClient { }
```

Good noun protocol:

```swift
protocol Collection { }
```

Good capability protocol:

```swift
protocol ProgressReporting {
    var progress: Double { get }
}
```

### Swift Repositories, Clients, and Coordinators

Rules:

- Repository protocols speak domain language and return domain entities or
  domain results.
- Repository method names are domain operations.
- Repository implementations may name their backing technology when useful.
- Client types own external API or SDK mechanics.
- Coordinators own route state, destination construction, stack mutations, and
  presentation flow.
- Route enums are feature-owned and named for the flow.
- Route values must not hold ViewModels, SwiftUI views, repository
  implementations, SDK clients, database records, or DTOs.

Bad:

```swift
protocol DataRepository {
    func fetchTable(_ name: String) async throws -> Data
}

final class ProfileCoordinator {
    func present(_ string: String) { }
}

enum AppRoute {
    case screen(AnyHashable)
}
```

Good:

```swift
protocol ProfileRepository {
    func getProfile(for userID: User.ID) async throws -> Profile
}

final class HTTPProfileRepository: ProfileRepository { }

struct ProfileAPIClient {
    func getProfileResponse(for userID: User.ID) async throws -> ProfileResponseDTO
}

@MainActor
final class ProfileCoordinator {
    func showEditProfile(userID: User.ID) { }
    func dismissSheet() { }
}

enum ProfileDestination: Hashable {
    case editProfile(User.ID)
    case avatarPreview(ProfileAvatar.ID)
}
```

### Swift Presentation Identifiers

Presentation identifiers are stable contracts for UI identity, diffable data
sources, navigation, persistence, and tests. Name them for the thing they
identify, not for the framework that consumes them.

Rules:

- Snapshot item identifiers use stable presentation or domain IDs.
- Do not use DTO item identity, array offsets, or index paths as long-lived
  item identity.
- Use `id` only when the enclosing type already supplies the domain context.
- Use a role-qualified name such as `messageID`, `avatarID`, or
  `conversationID` when the surrounding scope contains multiple identifiers.
- Keep accessibility identifiers separate from model identifiers.

Bad:

```swift
struct MessageRow {
    let dto: MessageDTO
    let indexPath: IndexPath
}

let selectedID = indexPath
```

Good:

```swift
struct MessageRow: Identifiable {
    let id: Message.ID
    let authorDisplayName: String
    let previewText: String
}

let selectedMessageID = row.id
```

### Swift Accessibility Identifiers

Accessibility identifiers are stable UI test hooks, not localized user-facing
copy.

Rules:

- Use stable `camelCase` strings.
- Name the interaction surface or important state.
- Do not include localized text.
- Do not include user content, IDs, tokens, provider names, or database names.

Bad:

```swift
.accessibilityIdentifier("Submit Button")
.accessibilityIdentifier("john@example.com-profile-button")
```

Good:

```swift
.accessibilityIdentifier("submitButton")
.accessibilityIdentifier("profileAvatarButton")
```

## TypeScript

TypeScript naming follows the project rules here. Google TypeScript guidance is
a strong default for many language choices, but this repo deliberately overrides
some external guidance.

Project decisions:

- Use `kebab-case` filenames for TypeScript source files.
- Use `type` aliases for item shapes by default.
- Do not adopt Google's blanket interface preference.
- Do not adopt Basarat's camelCase filename preference.
- Named exports are preferred for app code.
- Default exports are allowed only where ecosystem config files or frameworks
  require them.
- Prefix intentionally unused parameters or variables with `_` when needed.
- Do not introduce broad naming-lint policy changes outside an explicit
  quality-rule task.

### TypeScript Case Rules

Rules:

- Type aliases, classes, interfaces used for framework contracts, React
  components, decorators, and constructor values use `PascalCase`.
- Do not introduce TypeScript enums; if external or generated code exposes an
  enum-like type, keep its required contract name and isolate it at the
  boundary.
- Functions, methods, variables, parameters, properties, module aliases, and
  local values use `camelCase`.
- Global constants and static readonly constants may use `UPPER_SNAKE_CASE`
  when the value is intended to be fixed and conventionally constant.
- Do not use leading or trailing underscores except intentionally unused
  parameters or variables.
- Do not prefix interfaces with `I`.
- Type parameters may use a single clear uppercase letter or a descriptive
  `PascalCase` name.
- Treat abbreviations as words unless the platform name requires otherwise:
  `parseHttpUrl`, not `parseHTTPURL`, but `XMLHttpRequest` remains a platform
  name.

Bad:

```ts
interface IUserRepository {}
type user_profile = {};
const DAYS_IN_WEEK = 7;
const daysInMonth = 30;
function restore_database() {}
const URLValue = 'https://example.com';
```

Good:

```ts
type UserProfile = {};
type UserRepository = {
    getUser(userId: UserId): Promise<User>;
};

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

function restoreDatabase() {}
const urlValue = 'https://example.com';
```

### TypeScript Files and Modules

Rules:

- TypeScript source filenames use `kebab-case`.
- File names describe the primary exported type, function, route, or cohesive
  capability.
- Do not use namespaces, `module`, triple-slash references, or
  `import x = require(...)` to simulate ownership.
- Use file scope and named exports instead of static container classes.
- Do not create files named only for generic reuse.
- Keep generated file names only when generator-owned.

Bad:

```text
UserService.ts
userHelpers.ts
utils.ts
samples.ts
ReportReaderContainer.ts
```

Good:

```text
user-repository.ts
email-address-validation.ts
session-token-verifier.ts
report-reader.ts
submit-order-route.ts
```

Bad:

```ts
export default class Container {
    static FOO = 1;

    static bar() {
        return 1;
    }
}
```

Good:

```ts
export const FOO = 1;

export function bar(): number {
    return 1;
}
```

### TypeScript Variables

Rules:

- Use meaningful, pronounceable names.
- Use the same vocabulary for the same concept.
- Use explanatory destructuring names.
- Avoid mental mapping with single-letter names except tiny local scopes.
- Use named constants for meaningful repeated numbers or strings.
- Do not add context already present in the type or owner.

Bad:

```ts
function between<T>(a1: T, a2: T, a3: T): boolean {
    return a2 <= a1 && a1 <= a3;
}

declare const users: Map<string, User>;
for (const keyValue of users) {
    ...
}
```

Good:

```ts
function between<T>(value: T, left: T, right: T): boolean {
    return left <= value && value <= right;
}

declare const users: Map<string, User>;
for (const [userId, user] of users) {
    ...
}
```

Bad:

```ts
setTimeout(restart, 86_400_000);
```

Good:

```ts
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

setTimeout(restart, MILLISECONDS_PER_DAY);
```

### TypeScript Functions

Rules:

- Function names say what they do.
- Prefer two or fewer parameters.
- Use an options item for many arguments, multiple same-type arguments,
  optional groups, or boolean flags.
- Do not use boolean flags to choose separate behaviors.
- Prefer a positive predicate name plus `!` at the call site over a negative
  predicate function.
- Use async/await in names only when distinguishing from a blocking counterpart
  is necessary. Normally the return type communicates async.
- Name functions by domain work, not implementation mechanics.

Bad:

```ts
function createFile(name: string, temp: boolean) {
    if (temp) {
        fs.create(`./temp/${name}`);
    } else {
        fs.create(name);
    }
}
```

Good:

```ts
function createTempFile(name: string) {
    createFile(`./temp/${name}`);
}

function createFile(name: string) {
    fs.create(name);
}
```

Bad:

```ts
function createMenu(title: string, body: string, buttonText: string, cancellable: boolean) {
    ...
}
```

Good:

```ts
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

### TypeScript Types

Rules:

- Use `type` aliases for item shapes by default in this repo.
- Use unions and discriminated unions for alternatives.
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes an interface the clearest tool.
- Do not encode optionality in an alias name.
- Use optional fields and parameters for values that may be omitted.
- Avoid return-type-only generics. When using an existing return-type-only
  generic API, specify the generic explicitly.
- Avoid `any`; use a specific type or `unknown` with narrowing.
- Name index keys meaningfully if an index signature is needed.
- Prefer `Map` when key/value behavior is the point.

Bad:

```ts
type CoffeeResponse = Latte | Americano | undefined;

type Users = {
    [key: string]: User;
};

function nicestElement<T>(): T {
    ...
}
```

Good:

```ts
type CoffeeResponse = Latte | Americano;

function getCoffeeResponse(): CoffeeResponse | undefined {
    ...
}

type UsersById = {
    [userId: string]: User;
};

function nicestElement<T>(items: readonly T[]): T {
    ...
}
```

### TypeScript Runtime Boundaries

Rules:

- Preserve external field names in DTOs and validation schemas.
- Name parsed or validated values as trusted domain values after validation.
- Do not rename external fields just to make validation code look idiomatic if
  the runtime contract still uses the external name.
- Use explicit conversion names for DTO-to-domain mapping.

Bad:

```ts
const request = req.body as SubmitOrderRequest;
```

Good:

```ts
const submitOrderRequest = parseSubmitOrderRequest(req.body);
```

Bad:

```ts
type ProviderResponse = {
    providerOperationId: string;
    providerStatus: string;
};
```

Good:

```ts
type ProviderSubmitOrderResponse = {
    providerOperationId: string;
    providerStatus: string;
};
```

## JavaScript

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

Project decisions:

- Prefer TypeScript for app code. Use JavaScript naming rules for tooling,
  config, migration support, quality scripts, and ecosystem-owned JavaScript.
- Use `kebab-case` source filenames in this repo, even though some external
  guides also allow underscores.
- Prefer named exports in hand-written modules.
- Use default exports only for ecosystem files that require them or external
  packages that expose them.
- Do not create static container classes or nested namespaces for organization.

### JavaScript Case Rules

Rules:

- Classes, constructor values, and React components use `PascalCase`.
- JSDoc record, interface, enum item, and typedef names use `PascalCase`.
- Functions, methods, variables, parameters, properties, and module aliases use
  `camelCase`.
- Constants may use `UPPER_SNAKE_CASE` when they are fixed global or module
  constants.
- JSDoc enum members use `UPPER_SNAKE_CASE`.
- Source filenames use `kebab-case` unless an ecosystem tool owns the filename.
- Do not use default exports unless an ecosystem file requires them.
- Do not use namespaces or static classes as containers.
- Use ASCII identifier names. Keep non-ASCII characters in strings or comments
  unless an external API requires otherwise.
- Do not abbreviate by deleting letters from a word.
- Do not use a trailing underscore to signal privacy; use module scope or the
  language/framework visibility mechanism available in that file.
- Short one-letter local names are acceptable only in tiny scopes where the role
  is conventional and obvious, such as `i` in a small loop.

Bad:

```js
class user_service {}
const MAXCOUNT = 10;
function Build_User() {}
const nErr = 3;
const cstmrId = user.id;
export default {
    parseThing() {},
};
```

Good:

```js
class UserRepository {}
const MAX_RETRY_COUNT = 10;

function buildUser() {}
const errorCount = 3;
const customerId = user.id;

export { UserRepository, buildUser };
```

### JavaScript Imports and Exports

Rules:

- Namespace import aliases use `camelCase` derived from the imported filename or
  clear package name.
- Named imports keep their exported name unless a collision forces an alias.
- If aliasing a named import is required, use a domain or path component that
  explains the collision.
- Default import names follow the identifier type being imported, but default
  imports should be limited to ecosystem modules that require them.
- Named exports keep naming consistent across import sites.
- Do not export mutable variables as the public contract. Export functions or an
  item with clearly named mutable fields when mutation is intentional.

Bad:

```js
import * as FileOne from '../file-one.js';
import { Cat as OtherThing } from './domesticated-animals.js';

export default class ProfileClient {}
export let activeUser = undefined;
```

Good:

```js
import * as fileOne from '../file-one.js';
import { Cat as DomesticatedCat } from './domesticated-animals.js';

export class ProfileClient {}

let activeUser = undefined;

export function getActiveUser() {
    return activeUser;
}
```

### JavaScript Files

Bad:

```text
Helpers.js
UserService.js
sharedUtils.mjs
data.cjs
```

Good:

```text
session-token-verifier.js
user-repository.js
email-template-formatter.mjs
database-connection.cjs
```

### JavaScript Functions and Values

Bad:

```js
function process(value) {
    return JSON.parse(value);
}

const d = new Date();
const arr = users.map((u) => u.id);
```

Good:

```js
function parseUserPayload(payloadText) {
    return JSON.parse(payloadText);
}

const currentDate = new Date();
const userIds = users.map((user) => user.id);
```

### JavaScript Boundaries

JavaScript often appears in tooling, config, and quality scripts. Name the
script owner and exported functions by the contract they serve.

Bad:

```js
export function run(value) {
    ...
}
```

Good:

```js
export function collectNamingViolations(scope, policy) {
    ...
}
```

## Bash

Bash naming follows Google shell guidance where it fits this repo, with local
project overrides for file stems and quality enforcement.

### Bash Case Rules

Rules:

- Shell source file stems use `kebab-case` in this repo unless an existing tool
  or external command owns the name.
- Executable scripts use `.sh` when invoked through mise tasks or build
  rules.
- Executable scripts may omit the extension only when the file is intended to be
  a command on `PATH`.
- Sourced libraries use `.sh` and are not executable.
- Functions and mutable variables use `lower_snake_case`.
- Function-local variables use `lower_snake_case`.
- Constants, readonly values, exported environment variables, and externally
  configured values use `UPPER_SNAKE_CASE`.
- Package-like function prefixes may use `::` only when a script family already
  uses that convention.
- Do not use the `function` keyword for new functions. Use `name() { ...; }`.

Bad:

```text
DeployScript.sh
deploy_script.sh
helpers.sh
```

Good:

```text
deploy-api.sh
upload-storage-assets.sh
database-branch
```

Bad:

```bash
function Deploy() {
  local TMP="$1"
}
```

Good:

```bash
deploy_api() {
  local target_environment="$1"
}
```

### Bash Variables

Rules:

- Loop variables describe the item being iterated.
- Use `tmp_dir` or `tmp_file` only for actual temporary filesystem paths.
- Avoid vague names when a domain name is available.
- Avoid shell-reserved and shell-special names for unrelated values.
- Initialize variables before use.
- Prefer explicit empty strings or arrays over relying on unset variables.
- Declare function-specific variables with `local`.
- Separate `local`, `declare`, `readonly`, and `export` from command
  substitutions when the command status matters.

Bad:

```bash
X=/tmp/a
for i in "${things[@]}"; do
  do_it "${i}"
done

local output="$(generate_report)"
```

Good:

```bash
readonly API_ROOT="${REPO_ROOT}/api"

for migration_file in "${migration_files[@]}"; do
  lint_migration "${migration_file}"
done

local report_output
report_output="$(generate_report)" || return 1
```

### Bash Functions

Rules:

- Function names use verb phrases when the function has side effects.
- Functions that print data to STDOUT should be named for the data printed.
- Functions that validate should return status and log errors deliberately.
- Do not name scripts or functions after shell builtins or common commands.
- Do not make function names so generic that logs and stack traces lose context.

Bad:

```bash
test() {
  ...
}

run() {
  ...
}

process() {
  ...
}
```

Good:

```bash
current_branch() {
  git branch --show-current
}

deploy_staging_database() {
  ...
}

validate_supabase_project_ref() {
  ...
}
```

### Bash Environment Names

Rules:

- Environment variables are `UPPER_SNAKE_CASE`.
- Export only variables child processes need.
- Do not overwrite important shell environment names casually.
- Validate configured environment variable names before using indirect expansion.
- Name required environment values by the external contract when the deployment
  platform owns the name.

Bad:

```bash
export token="${TOKEN}"
name="$1"
printf '%s\n' "${!name}"
```

Good:

```bash
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}"

env_name="$1"
if [[ ! "${env_name}" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
  printf 'error: invalid environment variable name\n' >&2
  return 1
fi
printf '%s\n' "${!env_name}"
```

## SQL and Supabase

SQL and Supabase names are durable infrastructure contracts. Rename them only
through migrations and contract-aware code changes.

### SQL Case Rules

Rules:

- SQL schemas, tables, columns, functions, function parameters, indexes,
  triggers, constraints, and policies use `lower_snake_case`.
- SQL keywords are uppercase.
- Storage buckets use `lower_snake_case`.
- Edge Function folders use `kebab-case`.
- Environment variables and secrets use `UPPER_SNAKE_CASE`.
- Storage item keys must be stable, explicit, and validated by policy or
  trigger when user-controlled.
- Fully qualify grants and function signatures when ambiguity is possible.
- Do not use quoted sentence-style identifiers for local policy names.
- Do not use pluralization or prefixes inconsistently inside one schema.

Bad:

```sql
CREATE TABLE public.OrderItems (
    userId uuid NOT NULL,
    createdAt timestamptz NOT NULL
);

CREATE POLICY "users_can_view_order_items" ON public.OrderItems
    FOR SELECT TO authenticated USING (true);
```

Good:

```sql
CREATE TABLE public.order_items (
    userId uuid NOT NULL,
    createdAt timestamptz NOT NULL
);

CREATE POLICY users_can_view_own_order_items ON public.order_items
    FOR SELECT TO authenticated USING (true);
```

### Migration Filenames

Rules:

- Migration filenames use `YYYYMMDDHHMMSS_description.sql`.
- The timestamp is a 14-digit timestamp.
- Timestamps must be strictly increasing in sorted migration order.
- The description uses `lower_snake_case`.
- The description starts with a lowercase letter.
- Use the project migration creation command when creating blank migrations.
- Do not insert an older timestamp before an already committed migration.
- Name the migration for the durable database change, not for the app task.

Recommended migration description verbs:

- `create_*` for new schemas, tables, functions, buckets, indexes, policies, or
  cron wiring.
- `alter_*` for schema or behavior changes.
- `insert_*` for initial durable data.
- `update_*` for durable data updates.
- `delete_*` only for intentional durable data removals.

Bad:

```text
20260101120000_add_stuff.sql
20260101120000_CreateUsers.sql
20260101120000_fix.sql
```

Good:

```text
20260101120000_create_order_items.sql
20260101121500_alter_accounts_add_avatar_path.sql
20260101123000_insert_default_notification_options.sql
```

### SQL Tables and Columns

Rules:

- Table names identify the domain set stored by the relation.
- Column names identify the value, not the application layer that reads it.
- Foreign-key columns use the referenced concept plus `_id`.
- Timestamp columns should use stable event names such as `createdAt`,
  `updatedAt`, `deleted_at`, or a concrete domain event time.
- Boolean columns use concise positive assertion names without an `is_`
  prefix.
- Avoid generic columns that hide meaning.

Bad:

```sql
CREATE TABLE public.data (
    id uuid PRIMARY KEY,
    item jsonb NOT NULL,
    flag boolean NOT NULL,
    date timestamptz NOT NULL
);
```

Good:

```sql
CREATE TABLE public.message_delivery_attempts (
    id uuid PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES public.messages (id),
    provider_response jsonb NOT NULL,
    retryable boolean NOT NULL,
    attempted_at timestamptz NOT NULL
);
```

### SQL Functions and Parameters

Rules:

- SQL function names use verb phrases or domain operation names.
- Retrieval functions use `get_` regardless of whether they return one row,
  an optional row, a collection, or a paginated collection. Do not use
  `read_`, `find_`, `fetch_`, `load_`, or `list_` as retrieval synonyms.
- Data-access mutation functions use `set_`, `insert_`, `update_`, or
  `delete_` according to the operation they perform. Do not use `create_`,
  `add_`, `save_`, `write_`, `put_`, `upsert_`, or `remove_` as synonyms.
- Function parameters use `lower_snake_case`.
- Parameter names should not collide confusingly with table columns.
- `SECURITY DEFINER` functions must have names that make the privileged action
  clear.
- Do not name functions like arbitrary script tasks.

Bad:

```sql
CREATE FUNCTION public.run(id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    ...
END;
$$;
```

Good:

```sql
CREATE FUNCTION public.archive_expired_orders(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    ...
END;
$$;
```

### Indexes, Constraints, Triggers, and Policies

Rules:

- Name constraints and scope them to their table or concept.
- Name indexes by table plus indexed columns or purpose.
- Name triggers by event and action.
- Name policies by actor plus allowed action.
- Keep names stable because they appear in migrations, errors, grants, and
  database inspection output.

Bad:

```sql
CREATE INDEX idx1 ON public.messages (userId);
ALTER TABLE public.messages ADD CONSTRAINT check_status CHECK (status <> '');
CREATE TRIGGER trigger1 BEFORE UPDATE ON public.messages EXECUTE FUNCTION public.update_updated_at();
CREATE POLICY select_policy ON public.messages FOR SELECT USING (true);
```

Good:

```sql
CREATE INDEX messages_user_id_created_at_idx ON public.messages (userId, createdAt);

ALTER TABLE public.messages
    ADD CONSTRAINT messages_status_not_empty_check CHECK (status <> '');

CREATE TRIGGER messages_set_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY users_can_view_own_messages
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (userId = auth.uid());
```

### Supabase Edge Functions

Rules:

- Function folders use `kebab-case`.
- The folder name, config entry, and deployable function name must match.
- Shared function code belongs under approved shared function folders and
  follows TypeScript naming.
- Name Edge Functions by the externally callable operation.
- Do not name Edge Functions after implementation technology.

Bad:

```text
functions/SubmitOrder/
functions/provider_handler/
functions/functions/src/submit-order/
```

Good:

```text
functions/submit-order/
functions/refresh-provider-token/
functions/shared-code/
functions/provider-config/
functions/generated-types/
```

### Storage Names

Rules:

- Storage buckets use `lower_snake_case`.
- Storage item keys are stable and explicit.
- User-controlled key segments must be validated and bounded before use.
- Do not embed secrets, provider tokens, raw user text, or private identifiers in
  item keys.
- Do not use display text as storage identity.

Bad:

```text
Profile Pictures
avatars/john@example.com/avatar image.png
uploads/latest
```

Good:

```text
avatar_images
avatars/user_01hxx8j2r6/profile.png
reports/report_01hxx8j2r6/export.pdf
```

## API Naming

API names are public and operational contracts. They must distinguish API-facing
language, domain language, provider language, database language, and log
metadata.

### API Response Names

Rules:

- Response payload names use API-facing names intentionally.
- Do not leak provider or database field names unless the public API contract is
  explicitly provider-shaped.
- Map provider/database shapes into response shapes at the endpoint or module
  owner.
- Public envelope fields stay stable.

Bad:

```ts
function buildSubmitOrderResponse(result: SubmitOrderSuccess) {
    return {
        providerOperationId: result.providerOperationId,
        providerStatus: result.providerStatus,
        row_created_at: result.createdAt,
    };
}
```

Good:

```ts
function buildSubmitOrderResponse(result: SubmitOrderSuccess): SubmitOrderHttpResponse {
    return {
        order: {
            id: result.orderId,
            status: result.status,
            confirmationExpiresAt: result.confirmationExpiresAt,
        },
        usage: result.usage,
    };
}
```

### API Domain and Data Access Names

Rules:

- Keep domain objects independent from storage or provider naming when shapes
  differ.
- Cross-module functions use stable names and domain-shaped parameters.
- Application-owned database, cache, storage, SDK, and remote API retrieval
  functions use `get`. Multiplicity, pagination, and optionality belong in the
  noun and type, not in alternate verbs.
- Application-owned database and storage mutation functions use `set`,
  `insert`, `update`, or `delete` according to whether they replace a supplied
  value, add a new row or item, change an existing row or item, or destroy it.
- Database row names stay inside the platform database boundary.
- Use `dbRow` only inside database boundary code when naming a database wire
  shape.
- Do not concatenate SQL, RPC names, table names, column names, filters, or
  order clauses from user input.

Bad:

```ts
export async function generateReport(req: AuthenticatedRequest) {
    return executeReportPipeline(req.body.documentId, req.user.id, req.headers);
}

const order = await getOrderRowById(orderId);
```

Good:

```ts
export async function generateReport(input: GenerateReportInput, trace: RequestTrace) {
    return executeReportPipeline(input, trace);
}

const activeOrder = await getActiveOrder(orderId);
```

### API Configuration and Environment Names

Rules:

- Environment variable names are external deployment contracts and use
  `UPPER_SNAKE_CASE`.
- Config module values use concrete domain names.
- Do not add a hierarchy or generic config owner for one value.
- Do not read environment values outside the environment owner.

Bad:

```ts
export const config = {
    value: process.env.TOKEN,
};
```

Good:

```ts
export const providerConfig = {
    apiKey: providerApiKey,
    requestTimeoutMilliseconds,
};
```

### Logs and Telemetry Names

Rules:

- Event names and log item keys are operational contracts.
- Keep event names stable.
- Keep log item keys stable.
- Renaming log fields is an observability contract change.
- Put searchable values in structured fields, not configured message strings.
- Use stable names for request IDs, correlation IDs, provider request IDs,
  operation IDs, resource IDs, and safe user IDs.
- Do not put provider messages, user text, serialized payloads, or raw IDs into
  event names.

Bad:

```ts
logger.info(`operation ${operationId} for ${userEmail} failed with ${providerMessage}`);
```

Good:

```ts
logger.info(
    {
        requestId,
        operationId,
        resourceId,
        providerName,
        failureCode,
    },
    'Provider operation failed',
);
```

## Review Checklist

Before accepting a new name, ask:

- Does the name describe the role or domain concept instead of the type shape?
- Is the name clear at the call site?
- Is context supplied by the owner omitted from the local name?
- Does the name avoid vague role words unless the role is real?
- Does the name use the language-specific case rule?
- Does the file or directory name describe ownership?
- Does the function name name the action and domain item?
- Do application-owned retrieval operations consistently use `get`?
- Does each boolean read as a positive assertion?
- Are external names isolated to boundary types?
- Are SQL and API names treated as contracts?
- Does the name satisfy the automated naming checks for the affected scope?
