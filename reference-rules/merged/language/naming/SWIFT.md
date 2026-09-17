---
layer: language
preset: swift
title: Swift Naming
---

# Swift Naming

Swift naming follows Apple API Design Guidelines, Google Swift file guidance
where useful, and the local quality rules. Optimize for call-site clarity.

## Swift Case Rules

Rules:

- Types, protocols, actors, enums, structs, classes, and generic type parameters
  use `PascalCase`. `enforced-by: naming/identifiers`
- Variables, constants, functions, methods, properties, parameters, argument
  labels, enum cases, and global constants use `lowerCamelCase`. `enforced-by: naming/identifiers`
- Swift file names match the primary type or extension target pattern. `enforced-by: naming/identifiers`
- Do not use Objective-C style app or company prefixes for Swift-only types. `unenforced`
- Do not use Hungarian notation, `k` prefixes, `g` prefixes, or all-caps global
  constants. `enforced-by: naming/identifiers`
- Do not use leading underscores, suffixes, or prefixes as access control. Use
  Swift access modifiers instead. `unenforced`
- Use US English spellings to match Apple APIs. `unenforced`
- Treat common initialisms consistently and readably at call sites, such as
  `URL`, `ID`, `API`, `HTTP`, and `JSON`. `unenforced`
- Do not include `optional` or `maybe` in optional variable names. `unenforced`
- Use Unicode identifiers only for legitimate domain notation understood by the
  team. `unenforced`

Bad:

```swift
class HTTPLoginViewModel { }
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

## Swift Scoped Names

Prefer language scoping over name prefixes when a relationship is structural. `unenforced`
If a type is owned by another type and can be nested, nest it instead of
inventing a longer top-level name.

Rules:

- Use access control for privacy; do not signal privacy with `_privateName`. `unenforced`
- Nest owned errors, options, and helper types when Swift allows it. `enforced-by: naming/identifiers`
- Do not repeat the declaring type in static or class properties that return an
  instance of that same type. `unenforced`
- Use lower camel case for global constants. `unenforced`
- Use `shared` or `default` for singleton-like values only when those words
  actually describe the role. `unenforced`
- Use an empty enum as a namespace only for tightly related constants or helper
  functions that are never instantiated. `enforced-by: naming/identifiers`

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

## Swift Files

Rules:

- A file with one primary type is named after that type. `unenforced`
- Related small helper types may live in the same file when they are private or
  tightly owned by the primary type. `enforced-by: naming/identifiers`
- Split a file when there is no clear primary type. `unenforced`
- Extension files use `TypeName+Capability.swift` or
  `TypeName+ProtocolConformance.swift`. `unenforced`
- Do not use `TypeName+Extensions.swift` when a narrower capability name exists. `unenforced`
- Do not create broad extension dumping grounds. `unenforced`
- Do not prefix files with the app name unless the file is the app entry point
  or a framework collision makes the prefix unavoidable. `enforced-by: naming/identifiers`
- Directories are PascalCase and mirror the type or feature they group: `Features/Login/`,
  `Platform/Networking/`. `enforced-by: naming/identifiers`
- Test files are `<Type>Tests.swift` in the test target, mirroring the source directory. `unenforced`

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

## Suffixes that name a role

A type's suffix says what it owns. Which suffixes a project uses depends on the pattern it picked,
and that list is the project's own. These framework role words have one meaning:

| Role word        | Use when                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| `View`           | SwiftUI view or UIKit view type that presents UI.                                      |
| `ViewController` | UIKit screen controller.                                                               |
| `ViewModel`      | Presentation state and user intent owner for one screen, flow, or cohesive surface.    |
| `ViewState`      | Value describing screen presentation state.                                            |
| `ViewAction`     | Typed user or lifecycle intent emitted by a view.                                      |
| `Coordinator`    | Navigation or flow state owner.                                                        |
| `Router`         | Route mutation or destination-selection boundary, narrower than a coordinator.         |
| `DataSource`     | UIKit list adapter that feeds rows and sections.                                       |
| `CellModel`      | Values a reusable cell renders: strings, image references, state, and lightweight IDs. |

Two rules hold whatever the list is:

- A suffix means one thing across the whole codebase. If `Repository` owns domain-facing data
  access in one feature, it does not own HTTP mechanics in another. `enforced-by: naming/identifiers`
- `Manager`, `Handler`, `Helper`, `Util` and `Data` are not roles. They name a position in an
  imagined architecture rather than a behaviour, and the naming policy bans them. `enforced-by: naming/identifiers`

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

## Swift ViewModel Methods

Use UI event names when a ViewModel method represents a direct UI event. Use `unenforced`
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

Do not use `handle` for normal ViewModel intent methods. `unenforced`

## Swift Function and Argument Labels

Rules:

- Function and method names form grammatical English at the call site. `unenforced`
- Omit the first argument label when the base name and first argument form a
  clear phrase. `unenforced`
- Include argument labels when they clarify weak types or avoid ambiguity. `unenforced`
- Initializer arguments that directly set stored properties use the
  property names. `unenforced`
- Use explicit `self.` in initializers when parameter and stored property names
  match. `unenforced`
- Factory methods that create new instances use `make...` when that
  improves clarity. `unenforced`
- Nonmutating methods without side effects read as noun phrases where
  natural. `unenforced`
- Mutating methods with side effects use imperative verb phrases. `unenforced`
- Use Swift mutating/nonmutating pairs where applicable, such as
  `sort`/`sorted`, `append`/`appending`, and `formUnion`/`union`. `unenforced`

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

## Swift Delegates

Delegate methods put the delegate owner first, following Apple API patterns.

Rules:

- Pass the delegate source object as the first argument. `unenforced`
- Leave the source object argument unlabeled. `unenforced`
- For a source-only `Void` event, use the source type plus a past-tense or
  future-tense event phrase. `unenforced`
- For a source-only `Bool` assertion, use the source type plus `can`, `is`, or
  another allowed predicate phrase that describes the returned answer. `enforced-by: naming/identifiers`
- Do not introduce `should` in delegate names. Preserve it only for external
  framework requirements covered by an explicit quality exemption. `unenforced`
- For a source-only non-Boolean value, use a noun phrase for the queried value
  and label the source object with a natural preposition. `unenforced`
- When there are extra arguments, use the source type as the base name, then
  make the second argument label describe the event, question, or requested
  value. `unenforced`
- Do not omit the source object just because the delegate is currently owned by
  one caller. `unenforced`

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

## Swift Protocols

Rules:

- Do not prefix protocol names with `I`. `enforced-by: naming/identifiers`
- Do not suffix protocols with `Protocol`. `enforced-by: naming/identifiers`
- Protocols that describe what something is use nouns. `unenforced`
- Capability protocols use natural capability names, often `-ing` when the
  protocol describes behavior. `unenforced`
- Use `Provider`, `Repository`, `Client`, or `Coordinating` only when that is the
  actual role. `unenforced`
- Avoid automatic `-able` names that do not describe a clear capability. `unenforced`
- Do not create protocols for every ViewModel or use case just to make mocks. `unenforced`

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

## Swift Repositories, Clients, and Coordinators

Rules:

- Repository protocols speak domain language and return domain entities or
  domain results. `unenforced`
- Repository method names are domain operations. `unenforced`
- Repository implementations may name their backing technology when useful. `unenforced`
- Client types own external API or SDK mechanics. `unenforced`
- Coordinators own route state, destination construction, stack mutations, and
  presentation flow. `unenforced`
- Route enums are feature-owned and named for the flow. `unenforced`
- Route values must not hold ViewModels, SwiftUI views, repository
  implementations, SDK clients, database records, or DTOs. `unenforced`

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

## Swift Presentation Identifiers

Presentation identifiers are stable contracts for UI identity, diffable data
sources, navigation, persistence, and tests. Name them for the thing they
identify, not for the framework that consumes them.

Rules:

- Snapshot item identifiers use stable presentation or domain IDs. `unenforced`
- Do not use DTO item identity, array offsets, or index paths as long-lived
  item identity. `unenforced`
- Use `id` only when the enclosing type already supplies the domain context. `unenforced`
- Use a role-qualified name such as `messageID`, `avatarID`, or
  `conversationID` when the surrounding scope contains multiple identifiers. `unenforced`
- Keep accessibility identifiers separate from model identifiers. `unenforced`

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

## Swift Accessibility Identifiers

Accessibility identifiers are stable UI test hooks, not localized user-facing
copy.

Rules:

- Use stable `camelCase` strings. `enforced-by: naming/identifiers`
- Name the interaction surface or important state. `unenforced`
- Do not include localized text. `unenforced`
- Do not include user content, IDs, tokens, provider names, or database names. `unenforced`

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

