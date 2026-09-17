---
layer: template
preset: none
title: iOS Architecture
---

# iOS Architecture

Project template. Copy into `rules/project/` when the repository is a SwiftUI application that picks MVVM with Clean Architecture boundaries. Edit it to match the project;
gspot never upgrades a project file.

## Core iOS Philosophy

Architecture must make the app's domain obvious. A reader sees what the
app does, not only framework buckets such as `Views`, `ViewModels`, `Managers`,
or `Services`.

SwiftUI is the default UI framework. UIKit is an interop tool and platform API
surface, not the default app architecture.

MVVM is the default presentation pattern. It is not the whole architecture.
Clean Architecture is the boundary model: dependencies point inward, and outer
layers adapt external systems to inner business concepts.

Do not adopt VIPER, Clean Swift VIP, MVP, Presenter/Interactor/Worker template
structures, or MVC screen modules as the default architecture. Do not add
ceremony unless it reduces concrete coupling, duplication, or test friction.

Simple screens may stay simple, but they must not bypass dependency boundaries.
A small view can call a small ViewModel or use case; it never reaches into a
network client, database, SDK singleton, or process-global framework state.

## Architecture Standard

Use these default layers:

```text
App / Composition
  -> Presentation
      -> Domain
          -> Repository protocols
  -> Infrastructure implements repository protocols
  -> Platform wraps Apple/framework capabilities
```

`App` owns startup, composition, scene setup, routing, app lifecycle, app-wide
environment, and dependency graph construction.

`Presentation` owns SwiftUI views, ViewModels, navigation state, UI-local
formatting, and user interaction handling.

`Domain` owns entities, value objects, use cases, business rules, and repository
protocols.

`Infrastructure` owns network clients, persistence clients, SDK clients, DTOs,
database records, API request/response models, and repository implementations.

`Platform` owns Apple framework wrappers such as camera, microphone,
permissions, notifications, files, keychain, haptics, application lifecycle,
share sheets, and UIKit bridges.

`Tests` may depend on all layers, but production layers must not depend on test
helpers.

Dependency rules:

- Presentation may depend on Domain.
- Presentation may depend on Platform only for UI/platform presentation
  adapters.
- Domain must not depend on Presentation, Infrastructure, Platform, SwiftUI,
  UIKit, Combine, Observation, URLSession, SwiftData, Core Data, GRDB, Supabase,
  Firebase, or vendor SDKs.
- Infrastructure may depend on Domain to return domain entities.
- Platform may expose framework-neutral wrappers upward.
- Cross-feature imports are forbidden unless the imported code is a stable
  domain or UI primitive promoted to a shared owner.

## Feature Organization

Organize by feature or bounded context first, then by layer only when the
feature is large enough.

```text
Features/
  Orders/
    Presentation/
    Domain/
    Infrastructure/
    Composition/
```

Rules:

- Large features may contain `Presentation`, `Domain`, `Infrastructure`, and
  `Composition` folders.
- Small features may keep flatter colocated files, but the dependency direction
  must still match the layers.
- Feature `Composition` may construct feature coordinators/routers, ViewModels,
  use cases, repositories, and platform adapters for that feature.
- Do not create generic root-level type buckets as the primary architecture.
- Avoid generic shared or base abstractions as dumping grounds. Follow
  the naming rules for concrete examples.
- If a shared base type accumulates unrelated behavior, split behavior into
  focused composition helpers, platform adapters, view modifiers, child
  views/controllers, or feature-owned support types.
- Feature code is colocated with the feature until it proves it is a
  shared primitive.
- Promote shared code only when there is an actual repeated concept and a stable
  owner.
- Use the third repeated concept heuristic: when three related properties,
  methods, cases, or files clearly describe one concept, consider extracting a
  named owner.
- Do not apply the heuristic mechanically. Extraction must improve ownership,
  testability, or readability.
- Reusable visual primitives belong in a design system or UI foundation owner.
- Domain values and policies belong in a domain/core owner.
- SDK and OS wrappers belong in infrastructure/platform owners.
- Do not move code to shared locations just because a second caller might appear
  later.
- Do not introduce generic buckets as a substitute for ownership.
- Follow the naming rules for feature folder names, role suffixes,
  extension filenames, shared-code names, and generic bucket names.

## Layers and Dependency Direction

Good dependency path:

```text
OrderView
  -> OrderViewModel
      -> SubmitOrderUseCase
          -> OrderRepository protocol
              -> HTTPOrderRepository
                  -> OrderAPIClient

ProfileCoordinator
  -> ProfileViewModelFactory
      -> ProfileViewModel
          -> LoadProfileUseCase
```

Bad dependency paths:

```text
OrderView -> URLSession
OrderViewModel -> Supabase client
UseCase -> SwiftData model
Domain entity -> API response DTO
Coordinator -> database query
```

Rules:

- Inner layers define business language. Outer layers translate external
  language.
- Outer layers may know inner models, but inner layers must not know the tools
  that deliver or display those models.
- Boundary crossing uses stable domain values, not raw SDK objects.
- ViewModels call use cases, not repository implementations.
- Use cases call repository protocols, not concrete SDK clients.
- Repository implementations map DTOs/database records into domain entities
  before returning.
- Domain builds and tests without the app target's UI framework.


## MVVM

MVVM means:

- `View`: layout, rendering, gestures, view-local state, accessibility labels and
  identifiers, and presentation of ViewModel state.
- `ViewModel`: screen or flow state, async task orchestration for that
  presentation surface, calls to use cases, and conversion of domain state into
  UI state.
- `Model`: domain entities and value objects, not API DTOs or database records.

ViewModel rules:

- ViewModels are `@MainActor final class`.
- A ViewModel belongs to one screen, flow, or cohesive presentation surface.
- Use `ObservableObject`/`@Published` or Swift Observation consistently with the
  project's deployment target and tooling.
- ViewModels expose read-only state: mutate internally, publish
  intentionally.
- ViewModels expose user-intent methods, not raw setter APIs for every
  field. Follow the naming rules for ViewModel method names.
- For forms and user input, Views collect raw UI values and forward a
  typed intent or input value to the ViewModel. Views never perform
  business validation before the ViewModel or use case sees the input.
- Follow the naming rules for direct UI event, lifecycle event, and
  domain-work method names.
- ViewModels may hold UI state such as loading phase, selected tab, focused field
  proxy, sheet destination, alert model, and display strings.
- ViewModels convert domain state into presentation state, including display
  strings, loading phases, alert models, empty states, and enabled or disabled
  button state.
- ViewModels may expose row model arrays for list screens.
- Row models are presentation-specific and stable enough for diffing
  when used with diffable data sources.
- A cell-level ViewModel is appropriate only when the row has independent
  lifecycle, async loading, complex actions, or reusable behavior. Otherwise,
  use a value-type row model.
- ViewModels expose list actions in domain or presentation terms.
- ViewModels may trigger navigation indirectly through an injected
  router/coordinator interface or output closure when the navigation decision is
  presentation-level.
- If navigation is a result of business operation success, keep the business
  operation in a use case and let the ViewModel or coordinator decide the route.
- ViewModels must not contain business rules that belong in Domain.
- ViewModels must not know API paths, SQL/table names, DTO fields, SDK response
  shapes, or persistence schemas.
- ViewModels must not call `URLSession.shared`, `UserDefaults.standard`,
  database singletons, SDK singletons, or `NotificationCenter.default` directly.
- ViewModels receive use cases, repositories, clocks, schedulers,
  formatters, or platform wrappers by initializer injection.
- Do not create a protocol for every ViewModel. Use protocols only when a
  boundary or multiple implementation requirement exists.
- Do not add ViewModel protocols just to allow tests to mock a child view.
  Prefer injecting data, state, or a small closure into the child view.
- Do not use ViewModels as repositories, API clients, coordinators, or service
  locators.
- ViewModels never expose `tableView(_:cellForRowAt:)`, reuse identifiers,
  cell classes, or UIKit delegate methods.
- ViewModels never expose lower-layer data stores, fetched-results
  controllers, repository implementations, or mutable use-case internals for the
  View to query directly.
- Loading, empty, error, and content states for list screens are
  represented explicitly rather than inferred from multiple booleans and arrays.
- Do not split one ViewModel into many files unless the split is by cohesive
  responsibility and discoverable from filenames.

List ViewModel example:

```swift
@MainActor
final class InboxViewModel {
    struct Row: Hashable {
        let id: Message.ID
        let title: String
        let preview: String
        let isUnread: Bool
    }

    enum State: Equatable {
        case idle
        case loading
        case content([Row])
        case empty
        case failed(DisplayError)
    }

    private(set) var state: State = .idle

    func load() async {
        // Calls a use case and maps domain messages to Row values.
    }

    func didSelectMessage(id: Message.ID) {
        // Emits a navigation intent or calls a router.
    }
}
```

MVVM anti-patterns:

- Massive ViewModels that contain networking, mapping, validation, routing, and
  business policy.
- Anemic ViewModels that only forward every call from View to use case without
  owning presentation state.
- Per-row ViewModels for static list rows unless rows have independent lifecycle
  or async behavior.
- ViewModel-per-subview when the subview is just visual composition.
- ViewModel protocols created only for mocks.

## Domain Layer

Domain code represents the app's business concepts and rules.

Rules:

- Domain entities represent business concepts, not API responses, database rows,
  or screen display models.
- Domain entities use strong Swift types: enums, value objects, dates, IDs, and
  validated values instead of loose strings and booleans.
- Domain may contain computed properties that express business rules.
- Domain must not import SwiftUI, UIKit, Combine, Observation, Foundation
  networking APIs, persistence frameworks, analytics SDKs, or vendor SDKs.
- Domain may import Foundation only for basic value types when needed, such as
  `Date`, `UUID`, `URL`, `Decimal`, or `Measurement`.
- Domain errors are typed when callers need to distinguish cases.
- Domain never exposes optional or invalid states when a stronger type can
  represent the invariant.
- Domain never contains formatting for UI copy, localized strings, colors,
  images, layout, or accessibility.

### Model Structure

Rules:

- Split catch-all models into named value types when groups of fields represent
  a separate concept.
- Prefer model hierarchies that make invariants visible, such as
  `Message.Metadata`, `Person`, `Profile.Identity`, or `Session.Token`.
- Create specialized models for incomplete, editable, or feature-specific
  states instead of weakening a core model with many optionals.
- Use optional properties only for real domain absence, not because one feature
  does not have enough data to construct the full model.
- Recursive domain structures are acceptable when the business concept is
  genuinely recursive, such as nested folders, content groups, or threaded
  replies.
- Do not introduce recursive enums just to reuse list rendering code.
- Keep UIKit/SwiftUI types out of domain models. For images, colors, fonts, and
  icons, prefer domain-safe identifiers or presentation models.

```swift
struct Message {
    let id: Message.ID
    var subject: String
    var body: String
    var sender: Person
    var metadata: Metadata

    struct Metadata {
        let receivedAt: Date
        var tags: [Tag]
        var hasReply: Bool
    }
}

struct MessageDraft {
    var subject: String?
    var body: String?
    var recipients: [Person]
}
```

`MessageDraft` does not pretend to be a complete `Message`. DTOs can remain
optional-heavy; domain models enforce stronger invariants after mapping.

## Use Cases

A use case represents an application operation, not a generic service bucket.

Rules:

- Follow the naming rules for use case names.
- Use cases may be concrete types. Do not create `UseCaseProtocol` by default.
- Use cases coordinate domain entities, repositories, clocks, validators, and
  policies.
- Use cases are framework-independent and easy to unit test.
- A ViewModel can call multiple use cases if the screen coordinates multiple
  operations.
- Do not group unrelated operations into a broad `UserUseCases` or
  `AppUseCases` object unless they share cohesive state or policy.
- Do not put UI loading state, alert state, navigation, or SwiftUI-specific
  presentation in use cases.
- Do not put raw networking, database queries, or SDK mechanics in use cases.

### Input and Validation

Rules:

- Use cases may validate raw user input passed from a ViewModel, such as form
  text, selected options, dates, or uploaded media metadata.
- Business validation belongs in Domain/use cases, not Views, cells, UIKit
  delegates, or SwiftUI modifiers.
- UI-only constraints, such as focus movement, keyboard behavior, selection
  highlighting, and local text-field mechanics, may stay in the View or UIKit
  delegate.
- Reusable validation policy is a domain value, use case dependency, or
  focused validator type rather than duplicated across screens.
- Validation failures return typed domain/presentation errors that the
  ViewModel maps into explicit field, banner, alert, or retry state.
- When an operation is asynchronous, fallible, or needs formatting, return its
  result through ViewModel state instead of having the View pull intermediate
  values from use cases, repositories, or stores.

## Repositories

Repositories are boundary abstractions for data needed by the domain.

Rules:

- Repository protocols belong where the dependency needs to be inverted, which is
  Domain.
- Repository protocols speak domain language and return domain entities or
  domain results.
- Follow the naming rules for repository protocol, implementation, and
  method names.
- Avoid repository APIs that expose storage mechanics, such as `fetchTable`,
  `executeQuery`, `getEndpoint`, or `requestData`.
- Repository implementations live in Infrastructure/Data and adapt APIs,
  persistence, caches, or SDKs.
- Repository implementations own mapping between DTOs/records and domain
  entities.
- Repository protocols never expose `Data`, `URLRequest`, SQL strings, SDK
  response objects, database cursors, or DTOs unless those are genuinely domain
  concepts.
- Repository protocols never expose Core Data managed objects,
  `NSFetchedResultsController`, Firebase observers, Supabase query builders, or
  other live infrastructure controllers to Domain or ViewModels.
- Prefer focused repository protocols over one large app repository.
- Multiple repository implementations are appropriate when there are real
  backing stores: remote, local cache, in-memory test, or preview fixture.
- An in-memory repository is acceptable for tests and previews when it implements
  the same domain protocol.
- Do not create repository classes just to wrap one function if there is no
  boundary, state, or external dependency.
- Do not create a repository solely to rename one method on a concrete client if
  no dependency boundary or mapping exists.
- Repositories are not a substitute for use cases. Business workflows belong in
  use cases or domain services, not infrastructure repositories.

## DTOs and Mapping

DTOs mirror external wire or persistence shape.

Rules:

- DTOs are allowed to be ugly, flat, optional-heavy, and externally named because
  they belong to the boundary.
- DTO documentation may include a small sample payload only if it helps maintain
  the external contract and will be updated with that contract.
- DTOs must not leak into SwiftUI views, ViewModels, or Domain use cases.
- Map DTOs to domain entities as soon as data crosses into the app.
- Mapping code belongs near the boundary implementation, not in the domain
  entity.
- Prefer explicit mapper methods or properties when mapping has validation or
  transformation.
- Mapping validates required fields and throws or returns a typed failure
  for invalid external data.
- Do not silently invent fallback IDs, dates, enum cases, or defaults during
  mapping unless the product contract explicitly defines that fallback.
- Outbound mapping from domain to request DTO belongs in Infrastructure.
- External field names, database column names, and storage keys stay in
  DTOs/records, not domain entities. Follow the naming rules for
  boundary names.
- Keep `Codable` conformance out of domain entities when it exists only for API
  or database shape.
- Domain models may conform to `Codable` only when serialization is a true domain
  requirement or stable app-owned persistence contract.

## Dependency Injection

Use initializer injection by default.

Rules:

- Compose concrete dependencies at app, scene, or feature composition roots.
- The composition root is allowed to know concrete infrastructure types.
- Feature composition may create ViewModels and inject use cases.
- ViewModels never construct repository implementations.
- Use cases never construct repository implementations.
- Avoid global service locators, hidden singleton dependencies, and
  property-wrapper DI as the default.
- Environment injection is appropriate for SwiftUI dependencies that are
  intentionally inherited by a view subtree.
- Do not hide required dependencies behind optional properties that crash later.
- Test factories can exist for complex object graphs, but production code
  uses explicit initializers.

### Scoped Factories

Composition roots may use factories or builders to create feature object graphs.

Rules:

- Factories belong in `App` or feature `Composition`, not Domain.
- A factory may depend on concrete infrastructure because composition is an
  outer layer.
- Use scoped factories when a required value unlocks a set of screens or
  operations, such as authenticated user, account, workspace, profile,
  conversation, or selected project.
- Required state is non-optional inside the scoped factory.
- Do not pass non-optional optionals down the graph and then guard or assert in
  every consumer.
- Parent factories may create child factories. Child factories may retain parent
  factories if factories do not retain created screens or ViewModels in a cycle.
- Keep factories focused on construction. Do not put business logic,
  networking, persistence, route decisions, or SDK calls in factories.
- Follow the naming rules for factory method names.
- Do not introduce a global mutable `Current`, `World`, or equivalent
  dependency container.
- Do not wrap global singletons in another global singleton to make them easier
  to mutate in tests.
- Do not use global mutation as the default test seam.
- Direct uses of `Date()`, `UUID()`, random values, locale, calendar, time zone,
  `FileManager.default`, `UserDefaults.standard`, `URLSession.shared`, and SDK
  singletons are wrapped or injected at the appropriate boundary when they
  affect behavior or tests.
- Closure dependencies are acceptable for narrow capabilities such as clocks, ID
  generation, formatting, and simple one-method boundaries.

```swift
@MainActor
final class AppFactory {
    private let sessionRepository: SessionRepository
    private let profileRepository: ProfileRepository

    init(
        sessionRepository: SessionRepository,
        profileRepository: ProfileRepository
    ) {
        self.sessionRepository = sessionRepository
        self.profileRepository = profileRepository
    }

    func makeAuthenticatedFactory(session: UserSession) -> AuthenticatedFactory {
        AuthenticatedFactory(
            session: session,
            profileRepository: profileRepository
        )
    }
}

@MainActor
final class AuthenticatedFactory {
    private let session: UserSession
    private let profileRepository: ProfileRepository

    init(
        session: UserSession,
        profileRepository: ProfileRepository
    ) {
        self.session = session
        self.profileRepository = profileRepository
    }

    func makeProfileViewModel() -> ProfileViewModel {
        ProfileViewModel(
            userID: session.userID,
            loadProfile: LoadProfileUseCase(repository: profileRepository)
        )
    }
}
```

```swift
struct MessageTimestampFormatter {
    var now: () -> Date
    var calendar: Calendar
    var locale: Locale
    var timeZone: TimeZone

    func string(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.doesRelativeDateFormatting = calendar.isDate(date, inSameDayAs: now())
        return formatter.string(from: date)
    }
}
```

## Protocols and Abstractions

Protocols define boundaries and capabilities. They are not a default wrapper for
every concrete type.

Rules:

- Protocols are required when an inner layer needs behavior implemented by an
  outer layer.
- Protocols are optional when an outer layer calls an inner concrete type.
- Do not create protocols for concrete use cases just to mock them. Mock the
  repository boundary instead.
- Do not create protocols for every ViewModel.
- Do not create one-method protocols unless they define a real boundary or
  multiple real implementations.
- Prefer concrete structs/classes inside the same layer.
- Use `any Protocol` intentionally and avoid existential-heavy designs where
  generics or concrete types are clearer.
- Follow the naming rules for protocol names and capability suffixes.
- Avoid associated type protocols in app architecture unless the generic
  relationship is truly needed.
- Use an enum when the set of cases is closed and behavior is simple or
  state-like.
- Do not use an enum when each case needs substantially different behavior that
  will create large switch statements across the codebase.
- Use a struct with closures or static factories when it creates a small
  composable value without hiding external dependencies.
- Use protocols or generics when they express a real relationship the compiler
  must enforce, such as a cell type and its cell model, a repository
  capability, or a transport boundary.
- Do not add protocols or generics just to look "Swifty".
- Do not erase types unless the caller genuinely needs a homogeneous collection
  or a boundary.
- Prefer local type erasure over app-wide type-erased abstractions.
- Lightweight dot-syntax APIs are acceptable when they clarify construction, but
  never obscure ownership, side effects, or dependency boundaries.

Good closed state:

```swift
enum LoadingState<Value> {
    case idle
    case loading
    case loaded(Value)
    case failed(DisplayError)
}
```

Good composable strategy when dependencies are explicit:

```swift
struct ImageTransform {
    let apply: (Image) throws -> Image

    static func grayscale(level: BrightnessLevel) -> Self {
        Self { image in
            // Transform image.
            image
        }
    }
}
```

## State Management

Rules:

- Use `@State` for view-private state that dies with the view.
- Use ViewModel published state for screen or flow state.
- Use feature state owners only when state is shared across multiple screens in
  the same bounded context.
- A shared Store is allowed as a feature state owner, but MVVM remains the
  default screen presentation pattern.
- Stores are not a dumping ground for all app state. They own cohesive
  feature/domain state.
- App-wide state belongs in app composition only when truly global, such as
  session, theme, routing root, or connectivity.
- Do not duplicate the same domain state across multiple ViewModels without a
  single owner or refresh strategy.
- Prefer explicit state enums for loading flows instead of parallel booleans
  such as `isLoading`, `hasLoaded`, `error`, and `isEmpty` when states are
  mutually exclusive.
- Keep UI-local transient state out of Domain.

## Navigation and Coordinators

SwiftUI navigation APIs render navigation. Presentation owns navigation state and
flow decisions.

Default rules:

- Simple screens may use `NavigationStack`, `navigationDestination`, `sheet`,
  and `fullScreenCover` locally when the flow is small and contained.
- Use a coordinator or router when navigation spans multiple screens, sheets,
  full-screen covers, deep links, tab roots, authentication gates, or feature
  flows.
- Do not make a coordinator mandatory for every screen.

Responsibilities:

- `View` displays navigation affordances and forwards user intent.
- `ViewModel` decides that a user-visible outcome occurred, such as successful
  login or selected item, but never builds destination views.
- `Coordinator` or `Router` owns flow state, route enums, presentation
  destinations, stack mutations, modal state, and destination construction.
- `Composition` injects coordinators/routers and creates destination ViewModels
  and use cases.
- App routers or coordinators own root-level flows such as signed-out state,
  signed-in state, tabs, and deep link entry.
- Feature coordinators own navigation inside one bounded feature flow.

Route rules:

- Route enums must be feature-owned. Follow the naming rules for route
  enum names.
- Avoid global catch-all route enums unless they describe true app-root
  navigation.
- Route values may hold stable identifiers and lightweight presentation-safe
  values.
- Route values must not hold ViewModels, SwiftUI views, repository
  implementations, SDK clients, database records, or DTOs.
- Route values used with `NavigationStack` must be `Hashable`.
- Sheet and full-screen destination values must be `Identifiable` when used with
  item-based presentation.
- Use typed route enums instead of string route names.

Coordinator state rules:

- Coordinators are presentation state owners and `@MainActor final class`.
- Coordinators may own a `NavigationPath` or typed route path, selected tab,
  sheet destination, full-screen destination, and alert routing.
- Coordinators may expose narrow intent methods. Follow the naming rules
  for coordinator method names.
- Avoid overly generic APIs such as `push(_ any: AnyHashable)` or
  `present(_ string: String)`.
- Avoid broad `EnvironmentObject` coordinator injection across unrelated
  subtrees.
- Prefer passing a narrow coordinator/router or closure into a feature subtree.
- Coordinators must not perform business logic, networking, persistence,
  analytics policy, or DTO mapping.
- Coordinators must not directly call repository implementations, SDK clients,
  `URLSession`, `UserDefaults`, or database singletons.
- Coordinators may call composition factories to build destination views and
  ViewModels.

SwiftUI integration rules:

- Place `NavigationStack(path:)`, `navigationDestination`, `sheet`, and
  `fullScreenCover` at the owner view for the flow.
- Keep destination builders small and route-based.
- Do not put large switch statements in leaf views.
- Do not let child views mutate a parent path directly unless that path is the
  explicit flow API.
- Deep links translate into route values at app or feature routing
  boundaries, not inside individual views.
- When a flow has multiple modal types, prefer typed modal destination enums over
  multiple unrelated booleans.
- Dismissal resets the relevant presentation state to `nil` or removes the
  route from the path.

Testing rules:

- Test coordinators by asserting route, path, and modal state after intent
  methods.
- Test deep-link translation into route state.
- Do not unit test SwiftUI's `NavigationStack` internals.
- Use UI tests only for critical navigation paths that must work end to end.

## Services and Platform Boundaries

A service owns a higher-level capability, stateful coordination, external
communication, or OS/SDK integration.

Rules:

- Follow the naming rules before naming a Swift type `Service`.
- Network clients belong in Infrastructure.
- Persistence clients belong in Infrastructure.
- Apple framework wrappers belong in Platform.
- Analytics, logging, crash reporting, notification, permission, and lifecycle
  adapters belong at app/platform boundaries.
- Feature code depends on narrow wrappers, not directly on broad SDK
  objects.
- Direct calls to `.shared`, `.standard`, `.default`, or process-global
  framework state are allowed only in composition/platform owners.
- File system, keychain, notification center, application state, pasteboard,
  audio session, camera, microphone, and location access must be wrapped or
  injected.

## Networking and API Clients

Network clients belong in Infrastructure and own HTTP mechanics. Domain and
Presentation see domain operations and domain results, not transport
details.

Ownership rules:

- A network client owns base URL, path construction, query items, method,
  headers, body encoding, transport calls, response status validation, and
  response decoding.
- A repository owns domain mapping and domain-facing data operations.
- A use case owns business workflow and policy.
- ViewModels and views must never construct `URLRequest`, call `URLSession`,
  decode response DTOs, or inspect HTTP status codes.

URL construction rules:

- Use `URLComponents`, structured endpoint types, or request builders for paths
  and query parameters.
- Do not concatenate query strings by hand.
- Static URLs must be validated safely. Avoid `URL(string:)!` in production
  unless the invariant is documented and the project lacks a compile-time URL
  helper.
- Environment-specific base URLs come from configuration injected at
  composition, not hardcoded in feature logic.
- Endpoint definitions stay in Infrastructure and never leak into Domain or
  Presentation.

Request rules:

- Use typed request DTOs for JSON request bodies.
- Set HTTP method and content type explicitly when sending a body.
- Do not pass loose `[String: Any]` dictionaries for request bodies when an
  `Encodable` type can represent the contract.
- Keep authentication headers, retry policy, and common request decoration in
  the client or boundary layer, not in individual ViewModels.
- Avoid third-party networking frameworks by default when Foundation
  `URLSession` and async/await are sufficient.

Response rules:

- `URLSession` succeeds for many non-2xx responses, so clients must validate
  `HTTPURLResponse` status codes explicitly.
- Treat missing or non-HTTP responses as transport failures.
- Decode into DTOs, then map DTOs into domain entities.
- Do not return raw `Data` from a repository unless raw bytes are the domain
  concept.
- Do not return `HTTPURLResponse`, `URLRequest`, endpoint enum values, or DTOs
  to use cases or ViewModels.
- Mapping validates required fields and external enum values.
- Do not invent fallback IDs, dates, or enum cases unless the API or product
  contract defines the fallback.

Error rules:

- Network clients expose typed infrastructure errors when callers need to
  distinguish encoding, decoding, transport, invalid response, invalid status,
  and cancellation.
- Repositories may translate infrastructure errors into domain errors where
  domain callers need semantic handling.
- Preserve underlying errors for diagnostics and logging, but do not expose
  transport details as user-facing copy.
- Cancellation remains distinguishable when async tasks can be superseded
  or cancelled by navigation.

Testability rules:

- Inject transport/session abstractions where networking behavior needs unit
  tests.
- Test request construction, query encoding, method/header/body setup, status
  validation, decoding failure, cancellation, and DTO-to-domain mapping.
- Use fake transports or project URL protocols for client tests.
- Do not hit live network services in unit tests.
