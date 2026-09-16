# Working on iOS Apps

These rules apply to Swift and iOS work. Keep this file focused on architecture,
style, testing, and platform boundaries rather than local command inventories.

## Contents

- [Core iOS Philosophy](#core-ios-philosophy)
- [Architecture Standard](#architecture-standard)
- [Feature Organization](#feature-organization)
- [Layers and Dependency Direction](#layers-and-dependency-direction)
- [SwiftUI Views](#swiftui-views)
- [MVVM](#mvvm)
- [Domain Layer](#domain-layer)
- [Use Cases](#use-cases)
- [Repositories](#repositories)
- [DTOs and Mapping](#dtos-and-mapping)
- [Dependency Injection](#dependency-injection)
- [Protocols and Abstractions](#protocols-and-abstractions)
- [State Management](#state-management)
- [Navigation and Coordinators](#navigation-and-coordinators)
- [Services and Platform Boundaries](#services-and-platform-boundaries)
- [Networking and API Clients](#networking-and-api-clients)
- [Concurrency](#concurrency)
- [Error Handling](#error-handling)
- [UIKit and Apple Framework Boundaries](#uikit-and-apple-framework-boundaries)
- [UIKit Lists and Data Sources](#uikit-lists-and-data-sources)
- [Swift Source Style](#swift-source-style)
- [Swift Naming](#swift-naming)
- [Swift Programming Practices](#swift-programming-practices)
- [Documentation Comments](#documentation-comments)
- [Accessibility](#accessibility)
- [Testing](#testing)

## Core iOS Philosophy

Architecture must make the app's domain obvious. A reader should see what the
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
A small view can call a small ViewModel or use case; it should not reach into a
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
  [`NAMING.md`](NAMING.md) for concrete examples.
- If a shared base type accumulates unrelated behavior, split behavior into
  focused composition helpers, platform adapters, view modifiers, child
  views/controllers, or feature-owned support types.
- Feature code should be colocated with the feature until it proves it is a
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
- Follow [`NAMING.md`](NAMING.md) for feature folder names, role suffixes,
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
- Boundary crossing should use stable domain values, not raw SDK objects.
- ViewModels call use cases, not repository implementations.
- Use cases call repository protocols, not concrete SDK clients.
- Repository implementations map DTOs/database records into domain entities
  before returning.
- Domain should be buildable and testable without the app target's UI framework.

## SwiftUI Views

SwiftUI `View` types render state and forward user intent.

Rules:

- Views may own view-local UI state with `@State`, `@FocusState`,
  `@GestureState`, and local bindings.
- Internal SwiftUI views should usually rely on synthesized memberwise
  initializers by keeping injected non-state properties internal, unless access
  command or API stability requires otherwise.
- SwiftUI configured properties such as `@State`, `@FocusState`, `@GestureState`,
  `@Environment`, `@EnvironmentObject`, `@Binding`, `@ObservedObject`, and
  `@StateObject` should be grouped near the top of the view.
- Dynamic properties that are view-private should be `private`.
- Views must not own business workflows, network calls, database calls, SDK
  calls, or durable app state.
- Views must not instantiate concrete infrastructure dependencies.
- Views may start lifecycle work with `.task`, `.onAppear`, or refresh actions,
  but the work should delegate to a ViewModel or use case owner.
- Do not add explicit `@ViewBuilder` to `body`; it is implicit.
- Use `@ViewBuilder` on helper properties or functions only when there are
  multiple conditional view branches.
- Do not write `else { EmptyView() }` when an omitted branch produces no
  content.
- Avoid heavy computation in `body`; compute in ViewModel, domain logic, or
  small pure formatting helpers.
- Keep view modifiers and subviews small enough that layout intent remains
  readable.
- Extract subviews by visual responsibility, not just to reduce line count.
- Do not store derived state in `@State` when it can be computed from source
  state.
- Do not use SwiftUI views as service locators by reading many unrelated
  environment objects.
- Avoid reusable views that secretly read broad environment objects. Prefer
  explicit inputs for reusable components.
- View-local formatting is acceptable for simple display strings; reusable or
  domain-sensitive formatting should move to a ViewModel or formatter
  dependency.

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
- ViewModels expose read-only state where possible: mutate internally, publish
  intentionally.
- ViewModels should expose user-intent methods, not raw setter APIs for every
  field. Follow [`NAMING.md`](NAMING.md) for ViewModel method names.
- For forms and user input, Views should collect raw UI values and forward a
  typed intent or input value to the ViewModel. Views should not perform
  business validation before the ViewModel or use case sees the input.
- Follow [`NAMING.md`](NAMING.md) for direct UI event, lifecycle event, and
  domain-work method names.
- ViewModels may hold UI state such as loading phase, selected tab, focused field
  proxy, sheet destination, alert model, and display strings.
- ViewModels convert domain state into presentation state, including display
  strings, loading phases, alert models, empty states, and enabled or disabled
  button state.
- ViewModels may expose row view data arrays for list screens.
- Row view data should be presentation-specific and stable enough for diffing
  when used with diffable data sources.
- A cell-level ViewModel is appropriate only when the row has independent
  lifecycle, async loading, complex actions, or reusable behavior. Otherwise,
  use a value-type row view data.
- ViewModels should expose list actions in domain or presentation terms.
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
- ViewModels should receive use cases, repositories, clocks, schedulers,
  formatters, or platform wrappers by initializer injection.
- Do not create a protocol for every ViewModel. Use protocols only when a
  boundary or multiple implementation requirement exists.
- Do not add ViewModel protocols just to allow tests to mock a child view.
  Prefer injecting data, state, or a small closure into the child view.
- Do not use ViewModels as repositories, API clients, coordinators, or service
  locators.
- ViewModels should not expose `tableView(_:cellForRowAt:)`, reuse identifiers,
  cell classes, or UIKit delegate methods.
- ViewModels should not expose lower-layer data stores, fetched-results
  controllers, repository implementations, or mutable use-case internals for the
  View to query directly.
- Loading, empty, error, and content states for list screens should be
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
- Domain errors should be typed when callers need to distinguish cases.
- Domain should not expose optional or invalid states when a stronger type can
  represent the invariant.
- Domain should not contain formatting for UI copy, localized strings, colors,
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

`MessageDraft` should not pretend to be a complete `Message`. DTOs can remain
optional-heavy; domain models should enforce stronger invariants after mapping.

## Use Cases

A use case represents an application operation, not a generic service bucket.

Rules:

- Follow [`NAMING.md`](NAMING.md) for use case names.
- Use cases may be concrete types. Do not create `UseCaseProtocol` by default.
- Use cases coordinate domain entities, repositories, clocks, validators, and
  policies.
- Use cases should be framework-independent and easy to unit test.
- A ViewModel can call multiple use cases if the screen coordinates multiple
  operations.
- Do not group unrelated operations into a broad `UserUseCases` or
  `AppUseCases` item unless they share cohesive state or policy.
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
- Reusable validation policy should be a domain value, use case dependency, or
  focused validator type rather than duplicated across screens.
- Validation failures should return typed domain/presentation errors that the
  ViewModel maps into explicit field, banner, alert, or retry state.
- When an operation is asynchronous, fallible, or needs formatting, return its
  result through ViewModel state instead of having the View pull intermediate
  values from use cases, repositories, or stores.

## Repositories

Repositories are boundary abstractions for data needed by the domain.

Rules:

- Repository protocols belong where the dependency needs to be inverted, usually
  Domain.
- Repository protocols speak domain language and return domain entities or
  domain results.
- Follow [`NAMING.md`](NAMING.md) for repository protocol, implementation, and
  method names.
- Avoid repository APIs that expose storage mechanics, such as `fetchTable`,
  `executeQuery`, `getEndpoint`, or `requestData`.
- Repository implementations live in Infrastructure/Data and adapt APIs,
  persistence, caches, or SDKs.
- Repository implementations own mapping between DTOs/records and domain
  entities.
- Repository protocols should not expose `Data`, `URLRequest`, SQL strings, SDK
  response objects, database cursors, or DTOs unless those are genuinely domain
  concepts.
- Repository protocols should not expose Core Data managed objects,
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
- Mapping should validate required fields and throw or return a typed failure
  for invalid external data.
- Do not silently invent fallback IDs, dates, enum cases, or defaults during
  mapping unless the product contract explicitly defines that fallback.
- Outbound mapping from domain to request DTO belongs in Infrastructure.
- External field names, database column names, and storage keys stay in
  DTOs/records, not domain entities. Follow [`NAMING.md`](NAMING.md) for
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
- ViewModels should not construct repository implementations.
- Use cases should not construct repository implementations.
- Avoid global service locators, hidden singleton dependencies, and
  property-wrapper DI as the default.
- Environment injection is appropriate for SwiftUI dependencies that are
  intentionally inherited by a view subtree.
- Do not hide required dependencies behind optional properties that crash later.
- Test factories can exist for complex item graphs, but production code should
  use explicit initializers.

### Scoped Factories

Composition roots may use factories or builders to create feature item graphs.

Rules:

- Factories belong in `App` or feature `Composition`, not Domain.
- A factory may depend on concrete infrastructure because composition is an
  outer layer.
- Use scoped factories when a required value unlocks a set of screens or
  operations, such as authenticated user, account, workspace, profile,
  conversation, or selected project.
- Required state should be non-optional inside the scoped factory.
- Do not pass non-optional optionals down the graph and then guard or assert in
  every consumer.
- Parent factories may create child factories. Child factories may retain parent
  factories if factories do not retain created screens or ViewModels in a cycle.
- Keep factories focused on construction. Do not put business logic,
  networking, persistence, route decisions, or SDK calls in factories.
- Follow [`NAMING.md`](NAMING.md) for factory method names.
- Do not introduce a global mutable `Current`, `World`, or equivalent
  dependency container.
- Do not wrap global singletons in another global singleton to make them easier
  to mutate in tests.
- Do not use global mutation as the default test seam.
- Direct uses of `Date()`, `UUID()`, random values, locale, calendar, time zone,
  `FileManager.default`, `UserDefaults.standard`, `URLSession.shared`, and SDK
  singletons should be wrapped or injected at the appropriate boundary when they
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
- Follow [`NAMING.md`](NAMING.md) for protocol names and capability suffixes.
- Avoid associated type protocols in app architecture unless the generic
  relationship is truly needed.
- Use an enum when the set of cases is closed and behavior is simple or
  state-like.
- Do not use an enum when each case needs substantially different behavior that
  will create large switch statements across the codebase.
- Use a struct with closures or static factories when it creates a small
  composable value without hiding external dependencies.
- Use protocols or generics when they express a real relationship the compiler
  should enforce, such as a cell type and its view data, a repository
  capability, or a transport boundary.
- Do not add protocols or generics just to look "Swifty".
- Do not erase types unless the caller genuinely needs a homogeneous collection
  or a boundary.
- Prefer local type erasure over app-wide type-erased abstractions.
- Lightweight dot-syntax APIs are acceptable when they clarify construction, but
  should not obscure ownership, side effects, or dependency boundaries.

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
  login or selected item, but should not build destination views.
- `Coordinator` or `Router` owns flow state, route enums, presentation
  destinations, stack mutations, modal state, and destination construction.
- `Composition` injects coordinators/routers and creates destination ViewModels
  and use cases.
- App routers or coordinators own root-level flows such as signed-out state,
  signed-in state, tabs, and deep link entry.
- Feature coordinators own navigation inside one bounded feature flow.

Route rules:

- Route enums must be feature-owned. Follow [`NAMING.md`](NAMING.md) for route
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

- Coordinators are presentation state owners and usually `@MainActor final
class`.
- Coordinators may own a `NavigationPath` or typed route path, selected tab,
  sheet destination, full-screen destination, and alert routing.
- Coordinators may expose narrow intent methods. Follow [`NAMING.md`](NAMING.md)
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
- Deep links should translate into route values at app or feature routing
  boundaries, not inside individual views.
- When a flow has multiple modal types, prefer typed modal destination enums over
  multiple unrelated booleans.
- Dismissal should reset the relevant presentation state to `nil` or remove the
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

- Follow [`NAMING.md`](NAMING.md) before naming a Swift type `Service`.
- Network clients belong in Infrastructure.
- Persistence clients belong in Infrastructure.
- Apple framework wrappers belong in Platform.
- Analytics, logging, crash reporting, notification, permission, and lifecycle
  adapters belong at app/platform boundaries.
- Feature code should depend on narrow wrappers, not directly on broad SDK
  objects.
- Direct calls to `.shared`, `.standard`, `.default`, or process-global
  framework state are allowed only in composition/platform owners.
- File system, keychain, notification center, application state, pasteboard,
  audio session, camera, microphone, and location access must be wrapped or
  injected.

## Networking and API Clients

Network clients belong in Infrastructure and own HTTP mechanics. Domain and
Presentation should see domain operations and domain results, not transport
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
- Endpoint definitions stay in Infrastructure and should not leak into Domain or
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
- Mapping should validate required fields and external enum values.
- Do not invent fallback IDs, dates, or enum cases unless the API or product
  contract defines the fallback.

Error rules:

- Network clients should expose typed infrastructure errors when callers need to
  distinguish encoding, decoding, transport, invalid response, invalid status,
  and cancellation.
- Repositories may translate infrastructure errors into domain errors where
  domain callers need semantic handling.
- Preserve underlying errors for diagnostics and logging, but do not expose
  transport details as user-facing copy.
- Cancellation should remain distinguishable when async tasks can be superseded
  or cancelled by navigation.

Testability rules:

- Inject transport/session abstractions where networking behavior needs unit
  tests.
- Test request construction, query encoding, method/header/body setup, status
  validation, decoding failure, cancellation, and DTO-to-domain mapping.
- Use fake transports or project URL protocols for client tests.
- Do not hit live network services in unit tests.

## Concurrency

Rules:

- Prefer structured concurrency with `async`/`await` over callback pyramids and
  unmanaged task trees.
- Prefer `async throws` APIs for asynchronous operations that can fail.
- UI state mutation belongs on the main actor.
- ViewModels are main-actor isolated; move expensive work into use cases,
  repositories, actors, or background tasks.
- Use `@MainActor` for UI-facing observable state.
- Keep `Task` creation at lifecycle owners such as ViewModels, coordinators,
  services, or views using `.task`.
- Avoid starting long-running work in initializers; expose `start()`, `load()`,
  or lifecycle methods instead.
- Do not create unstructured `Task` values without a lifecycle owner and
  cancellation strategy.
- Store task handles when work should be cancellable because a view disappears,
  the user retries, or a newer request supersedes an older one.
- Check cancellation in long-running loops and before publishing stale async
  results.
- Keep shared mutable state behind actors, main-actor isolation, locks, or other
  explicit synchronization.
- Use actors for mutable shared state that can be accessed concurrently.
- Avoid `DispatchQueue.main.async` when actor isolation can express the same
  requirement.
- Prefer `Sendable` designs the compiler can verify.
- Use `@preconcurrency import` for legacy modules when appropriate instead of
  unsafe Sendable workarounds.
- Do not mark types `@unchecked Sendable` or use `nonisolated(unsafe)` unless a
  local invariant is documented and there is no safer design.
- Any `@unchecked Sendable` exception requires a nearby explanation of the
  synchronization or invariant.
- Inject clocks or scheduling boundaries when time affects business logic or
  tests.

## Error Handling

Rules:

- Use typed errors where callers need different recovery paths.
- Use untyped `Error` only at generic boundaries where concrete cases add no
  value.
- Convert technical errors to user-facing messages at presentation boundaries.
- Do not expose API status codes, SQL errors, file paths, tokens, internal IDs,
  or SDK messages directly to users.
- Prefer throwing errors for failed operations and explicit state enums for UI
  loading/error display.
- Avoid `fatalError` in production except unrecoverable programmer errors with a
  documented invariant; local lint already restricts this further.
- Use `assertionFailure` for unexpected but recoverable states where production
  can safely continue.
- Use `precondition` only when continuing would be invalid and the invariant is
  required.
- Do not add speculative fallback handling for states that cannot occur under
  the real contract.

## UIKit and Apple Framework Boundaries

SwiftUI is the default for UI.

Rules:

- Import UIKit only in UIKit interop surfaces, app lifecycle adapters,
  representables, view controllers required by Apple APIs, or platform wrappers.
- Do not put UIKit imports in domain or use case code.
- Do not use UIKit types in ViewModel public state unless the ViewModel exists
  specifically as a UIKit bridge.
- Wrap UIKit views/controllers with `UIViewRepresentable` or
  `UIViewControllerRepresentable` at the presentation boundary.
- Keep delegate/data-source objects small and owned by the UIKit bridge or
  presentation owner.
- Keep Apple framework callbacks from leaking into Domain by translating them
  into app-level events or use case inputs.

This repository also enforces approved UIKit import paths through local
architecture lint rules. Keep new UIKit imports within interop/platform
boundaries or update the local lint rule with the architectural reason.

## UIKit Lists and Data Sources

SwiftUI `List`, `ScrollView`, `LazyVStack`, and grids remain the default for new
SwiftUI screens. `UITableView` and `UICollectionView` are UIKit interop tools
for legacy screens, platform-specific behavior, performance-sensitive lists, or
reusable UIKit components.

### Default Ownership

Rules:

- A view controller may act as `UITableViewDataSource`,
  `UITableViewDelegate`, `UICollectionViewDataSource`, or
  `UICollectionViewDelegate` only for small, one-off lists with no meaningful
  branching, reuse, or section logic.
- Move data source and delegate logic into dedicated objects when a list has
  multiple cell types, has multiple sections, supports runtime display modes, is
  reused by more than one screen, translates selection from `IndexPath` to
  domain or presentation values, contains significant dequeue/configuration
  logic, or risks turning the view controller into a mixed lifecycle/data/layout
  item.
- `UITableView.dataSource`, `UITableView.delegate`,
  `UICollectionView.dataSource`, and `UICollectionView.delegate` are weak. The
  owning view controller or presentation owner must retain dedicated data source
  and delegate objects strongly.

Responsibilities:

- `UIViewController` owns lifecycle, table/collection view installation,
  dependency wiring, binding, reload/apply-snapshot calls, navigation handoff,
  and retaining data source/delegate objects.
- `DataSource` owns section/row counts, item lookup, cell registration,
  dequeueing, and cell configuration.
- `Delegate` owns UIKit list events such as selection, highlighting, editing,
  swipe actions, sizing, prefetching, and scroll callbacks when they are
  list-specific.
- `ViewModel` owns presentation state and user intents, but should not know cell
  classes, reuse identifiers, or UIKit index-path mechanics.
- `Coordinator` or `Router` owns navigation caused by selection when navigation
  spans the flow.
- `Composition` constructs the view controller, ViewModel, data source/delegate,
  and any closures or adapters between them.

This shape is illustrative, not a required exact type layout:

```swift
@MainActor
final class MessagesViewController: UIViewController {
    private let viewModel: MessagesViewModel
    private let tableView = UITableView(frame: .zero, style: .plain)
    private var dataSource: MessageListDataSource?

    init(viewModel: MessagesViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        return nil
    }

    func apply(_ state: MessagesViewModel.State) {
        let dataSource = MessageListDataSource(
            rows: state.rows,
            onSelect: { [weak viewModel] messageID in
                viewModel?.didSelectMessage(id: messageID)
            }
        )

        self.dataSource = dataSource
        tableView.dataSource = dataSource
        tableView.delegate = dataSource
        tableView.reloadData()
    }
}
```

### Selection and Index Paths

Rules:

- Keep `IndexPath` inside UIKit list boundaries where possible.
- Translate `IndexPath` into a stable domain or presentation value before
  calling ViewModel or coordinator outputs.
- Do not make ViewModels inspect UIKit sections/rows unless the ViewModel
  explicitly owns a presentation list model.
- Selection callbacks should prefer values such as `Message.ID`,
  `SettingsRoute`, `ProfileRowAction`, or a row model action closure over raw
  `IndexPath`.
- Deselect, highlight, swipe, and edit behavior may stay in a UIKit delegate
  item when it is purely visual or list-mechanical.

```swift
func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let row = rows[indexPath.row]
    onSelect(row.id)
}
```

### Typed Cell Configuration

Cell view data rules:

- Reusable UIKit cells should usually receive typed view data or presentation
  models, not domain entities, DTOs, database records, SDK models, or
  ViewModels.
- Cell view data should contain the values needed to render the cell: strings,
  image references, accessory state, accessibility text, enabled/disabled state,
  and lightweight IDs when needed for actions.
- Cells may own visual formatting that is purely local, but reusable or
  domain-sensitive formatting belongs in a ViewModel or formatter dependency.
- Do not let cells start network requests, database reads, analytics policy, or
  business workflows.
- If a cell loads an image, inject a narrow image-loading view model/adapter or
  bind precomputed image state. Do not call shared clients directly from the
  cell.

```swift
struct MessageCellViewData: Hashable {
    let id: Message.ID
    let title: String
    let preview: String
    let timestamp: String
    let isUnread: Bool
}
```

Heterogeneous list rules:

- Avoid `[Any]` item arrays for heterogeneous lists.
- Avoid force-cast chains in `cellForRowAt`.
- Avoid duplicating the relationship between data type, cell class, reuse
  identifier, and configuration in multiple switches.
- A small closed list may use an enum row model.
- An extensible or reused heterogeneous list should use typed row/configurator
  values that keep the cell/view-data relationship in the type system.
- Do not introduce a generic list framework until there are at least two real
  call sites or a clear local repeated pattern.

Enum row models are appropriate when the set of row types is closed and
feature-owned. Keep the enum feature-owned, not global, and avoid one global
`AppRow`, `TableRow`, or `CellType` enum.

```swift
enum SettingsRow: Hashable {
    case profile(ProfileCellViewData)
    case toggle(ToggleCellViewData)
    case destructiveAction(ActionCellViewData)
}
```

A local typed configurator can be useful when the list is reused or extensible:

```swift
protocol TableCellConfiguring {
    static var reuseIdentifier: String { get }
    static var cellClass: AnyClass { get }

    func configure(_ cell: UITableViewCell)
}

struct TableCellConfigurator<Cell: UITableViewCell, ViewData>: TableCellConfiguring {
    static var reuseIdentifier: String { String(describing: Cell.self) }
    static var cellClass: AnyClass { Cell.self }

    private let viewData: ViewData
    private let configureCell: (Cell, ViewData) -> Void

    init(viewData: ViewData, configure: @escaping (Cell, ViewData) -> Void) {
        self.viewData = viewData
        self.configureCell = configure
    }

    func configure(_ cell: UITableViewCell) {
        guard let cell = cell as? Cell else {
            assertionFailure("Dequeued cell does not match configurator type")
            return
        }

        configureCell(cell, viewData)
    }
}
```

Cautions:

- This pattern should be local to a feature or UIKit support module.
- Prefer `assertionFailure` plus a safe fallback over `fatalError` in production
  paths.
- If the project has an existing typed dequeue helper, use that instead of
  adding another abstraction.
- For modern collection/table screens, also consider diffable data sources when
  they fit the UIKit surface.

### Diffable Data Sources and Snapshots

Rules:

- Use `UITableViewDiffableDataSource` or `UICollectionViewDiffableDataSource`
  when the list benefits from stable item identity, animated updates, or
  snapshot-based rendering.
- Follow [`NAMING.md`](NAMING.md) for snapshot item identifiers.
- Keep snapshot construction in the presentation layer or data source adapter.
- Do not build snapshots in Domain.
- Do not use index paths as long-lived identity.
- Test snapshot-building logic as pure presentation mapping when it contains
  branching.

```swift
enum InboxSection: Hashable {
    case unread
    case read
}

struct InboxRow: Hashable {
    let id: Message.ID
    let title: String
    let preview: String
}
```

## Swift Source Style

Swift source follows Apple API Design Guidelines, Google Swift style guidance
where it improves clarity, and the local formatting and lint configuration.

Rules:

- Swift source files use UTF-8 and end in `.swift`.
- Let formatter and lint configuration own indentation, wrapping, alignment,
  spacing, semicolon policy, and brace placement.
- Do not add manual formatting exceptions to work around local tooling.
- Use `// MARK: - Section` only for meaningful groups in larger files.
- Do not add file header comments. Let source command own history.
- File comments are optional and should appear only when the file groups
  multiple related abstractions and the grouping needs explanation.
- Use type inference when the right-hand side makes the type obvious.
- Add explicit type annotations for empty arrays/dictionaries, nil initial
  values, weak type information, or public API clarity.

Import rules:

- Import exactly the top-level modules the file uses.
- Do not rely on transitive imports.
- Prefer whole-module imports.
- Import individual declarations only when importing the whole module would
  pollute the namespace or create a known conflict.
- Imports are the first non-comment tokens in the file.
- Group imports by compiler condition where needed.
- Place `@testable import` after regular imports when test files need it.
- Remove unused imports instead of tolerating drift.

File organization:

- One primary top-level type per file by default.
- Related small helper types may live in the same file when they are
  private/fileprivate to the primary type.
- Keep overloads with the same base name adjacent.
- Extensions should have a logical organization. Do not scatter a type across
  many extension files without a clear reason.
- Follow [`NAMING.md`](NAMING.md) for Swift file names and extension filenames.

Formatting constructs:

- Use one `let` or `var` declaration per statement except tuple destructuring.
- Do not add multiple stored properties in one declaration except tuple
  destructuring where appropriate.
- Keep SwiftUI configured properties grouped by wrapper type when practical.
- Omit redundant `break` in switch cases.
- Omit redundant `return` when Swift's implicit return improves readability and
  local tooling accepts it.
- Omit redundant raw enum values unless values map to external wire or
  persistence contracts.
- When enum raw values map to external systems, document the reason.
- Prefer explicit enum case lists over `default` when future cases should force
  code review.
- Use `default` only when the behavior is intentionally the same for future
  cases.
- Use numeric separators for long numeric literals when they improve
  readability.
- Attributes with parameters go on their own line before the declaration when
  they would hurt readability inline.

## Swift Naming

Swift naming rules live in [`NAMING.md`](NAMING.md). Follow that file for Swift
case conventions, file names, MVVM names, ViewModel method names, function and
argument-label rules, delegate methods, protocol names, repository/client/
coordinator names, snapshot item identifiers, accessibility identifiers, and
examples.

Automated naming checks are authoritative when they exist for the touched
scope.

## Swift Programming Practices

Rules:

- Code must compile without warnings when feasible.
- Remove easy warnings. Do not normalize warning debt.
- Prefer code that runs tests, removes meaningful duplication, expresses intent,
  and minimizes unnecessary types and methods.
- Remove duplication after the repeated concept is understood. Do not create a
  speculative abstraction for a single call site.
- Small functions are preferred, but line count is not the rule. Split functions
  by responsibility, not arbitrary size.
- Prefer `let`; use `var` only when mutation is required.
- Use synthesized memberwise initializers for structs when they are sufficient
  and public API is not needed.
- Prefer value types for data without identity.
- Use classes for identity, reference semantics, lifecycle, observable state, or
  framework requirements.
- Mark classes `final` by default unless subclassing is intended.
- Prefer `static func` over `class func` unless overriding is intended.
- Use `AnyObject` for class-constrained protocols.
- Do not call literal protocol initializers directly, such as `integerLiteral:`.
- Avoid explicit `.init(...)` when calling a concrete type initializer directly.
- Omit `get` for read-only computed properties.
- Prefer shorthand types: `[Element]`, `[Key: Value]`, and `Wrapped?`.
- Use `Void` for function type returns, but omit `-> Void` in `func`
  declarations.
- Use optionals for valid absence, not sentinel values.
- Compare optional values to `nil` when only presence matters and the wrapped
  value is unused.
- Use typed errors when there are multiple meaningful failure states.
- Avoid `try!`, `as!`, and force unwraps in production.
- A force unwrap/cast requires a nearby invariant comment unless in tests or a
  clearly safe literal-only programmer-error case.
- Avoid implicitly unwrapped optionals except Apple lifecycle cases such as
  `@IBOutlet`, Objective-C interop nullability gaps, and test fixtures.
- Use `private` over `fileprivate` unless same-file cross-type access is
  required.
- Avoid explicit `internal`.
- Do not put explicit access command on an entire extension; mark members as
  needed.
- Nest types when the nested type only makes sense in the parent's context.
- Use caseless enums for namespaces only when grouping truly related static
  declarations.
- Avoid global mutable state.
- Prefer immutable `static let` or computed `static var` over stored mutable
  `static var`.
- Prefer methods/properties over free functions unless the free function is
  standard-library-like and symmetric.
- Prefer `guard` for early exits and invalid preconditions.
- Use `for ... where` when the whole loop body would be guarded by one
  condition.
- Prefer `for` loops over `forEach` when command flow uses `return`, `break`,
  `continue`, or async work.
- Prefer `map`, `compactMap`, and `filter` when they directly express collection
  transformation without side effects.
- Use optional binding when the value is needed; compare to `nil` when only
  presence matters.
- Prefer optional chaining for one-off optional access; use binding when
  multiple operations need the unwrapped value.
- Do not use `fallthrough` for cases that can be merged.
- In pattern matching, put `let` or `var` on each bound element rather than
  distributing it across the whole pattern when that avoids ambiguity.
- Avoid `unowned` captures; prefer `[weak self]` with an early return after
  unwrapping, or capture the specific immutable values needed.
- Do not use `print`, `debugPrint`, or `dump` for production logging; use the
  project logging system.
- Prefer `#fileID` in production diagnostics; use `#filePath` only in tests or
  developer tooling where the full path is useful.
- Avoid `#imageLiteral` and `#colorLiteral`; use named assets or explicit
  constructors.
- Avoid project operators unless the operator is a standard notation in the
  problem domain.
- Overload existing operators only when the meaning matches the standard
  semantic meaning.

Design rules:

- Avoid large `viewDidLoad`, `viewDidAppear`, app delegate, or scene delegate
  methods. Move setup into named private methods or composition objects when it
  clarifies responsibility.
- Avoid condition flags that force the same branching across multiple methods.
  Prefer separate strategy/data source objects or explicit state types when
  modes have different behavior.
- Prefer composition over inheritance for sharing UI behavior.
- Inheritance is acceptable for framework requirements or stable shared
  behavior, but not as a default reuse mechanism.

Avoid mode checks repeated across every `UITableViewDataSource` method:

```swift
if mode == .sectioned {
    // Section logic.
} else {
    // Flat logic.
}
```

Prefer swapping a focused data source when the list mode changes:

```swift
currentDataSource = SectionedProductsDataSource(products: products)
tableView.dataSource = currentDataSource
tableView.reloadData()
```

## Documentation Comments

Rules:

- Use `///` for Swift documentation comments, not block comments.
- Place doc comments before attributes and modifiers.
- Public and open declarations require documentation when the local documentation
  policy requires it.
- Internal/private declarations need comments only when they explain non-obvious
  invariants, concurrency, security, lifecycle, or domain rules.
- Start doc comments with a brief summary.
- Add `- Parameter`, `- Parameters`, `- Returns`, and `- Throws` only when they
  add information not already obvious from the summary and signature.
- Use singular `- Parameter name:` for one parameter.
- Use grouped `- Parameters:` for multiple parameters.
- Do not document overrides or protocol conformances by copying base
  documentation.
- Do not add comments that only repeat the declaration.
- Do not include change history, old names, file paths, or implementation
  chronology.
- `// MARK:` comments are regular comments, not doc comments.
- Comments before declarations should be doc comments only when they document the
  declaration's API contract.
- Use ordinary `//` comments for implementation notes, TODOs, lint/tool
  directives, and grouped blocks.
- Keep DTO payload examples short if used; they must represent the current
  external contract.
- Use Apple markup where it improves symbol clarity, especially backticks for
  parameter or type names.

## Accessibility

Accessibility is part of the feature contract, not a final pass.

Rules:

- Interactive controls need clear labels, traits, states, and hints when the
  visible label is not enough.
- Use `.accessibilityIdentifier()` for stable UI test targets and important
  interaction surfaces.
- Follow [`NAMING.md`](NAMING.md) for accessibility identifier names.
- Use `.accessibilityHidden(true)` only for decorative or duplicate content.
- Preserve Dynamic Type unless a fixed size is required by a platform command.
- Keep tap targets large enough for reliable touch interaction.
- Verify important flows with VoiceOver behavior in mind when changing
  navigation, modal presentation, focus, or project controls.

## Testing

Rules:

- Unit test domain entities, value objects, mapping, use cases, and ViewModel
  behavior.
- Test use cases with mocked repository protocols or boundary clients.
- Test repository mapping separately from use case behavior.
- Test ViewModels by asserting state transitions and user-visible behavior, not
  private method calls.
- Do not mock SwiftUI.
- Do not test trivial getters, setters, or framework behavior.
- Do not add protocols only to make a mock if the boundary to mock is
  lower-level and already injectable.
- Test invalid DTO mapping and external-data validation at boundaries.
- Test cancellation or stale-result behavior for ViewModels that launch async
  tasks.

### Test Data and Fixtures

Rules:

- Test data should make the behavior under test obvious.
- Prefer private test builders, factory methods, or stubs with sensible defaults
  when model construction noise obscures the test.
- Keep fixture helpers close to the tests unless they are shared intentionally
  across many test files.
- Shared fixture APIs should be small and follow [`NAMING.md`](NAMING.md).
- Allow key-path customization helpers only in test targets and only when they
  improve readability.
- Avoid decoding JSON fixtures for ordinary domain tests. Use JSON fixtures when
  testing actual decoding/mapping or preserving an external payload contract.
- Do not add production defaults just to make tests shorter.
- Avoid force unwraps in fixture creation unless the fixture is proving a
  programmer-error invariant.
- Prefer stable IDs, dates, clocks, and deterministic ordering in tests.

```swift
private extension Message {
    static func stub(
        id: Message.ID = .init("message-1"),
        subject: String = "Subject",
        body: String = "Body",
        sender: Person = .stub(),
        metadata: Metadata = .stub()
    ) -> Self {
        Self(
            id: id,
            subject: subject,
            body: body,
            sender: sender,
            metadata: metadata
        )
    }
}
```

Optional key-path helpers belong in test code when they improve readability:

```swift
private extension Message {
    func setting<Value>(
        _ keyPath: WritableKeyPath<Self, Value>,
        to value: Value
    ) -> Self {
        var copy = self
        copy[keyPath: keyPath] = value
        return copy
    }
}
```

These helpers belong in test code unless production preview fixtures already
have a clear owner. Test fixture APIs should not become a parallel model layer.

### Unit Tests

Rules:

- Domain tests cover value validation, invariants, domain errors, and business
  computed properties.
- Use case tests cover success, repository failure, validation failure,
  cancellation where relevant, and policy decisions.
- Repository tests cover DTO/record mapping and error translation separately
  from use case behavior.
- Network client tests cover URL/path/query construction, HTTP method and
  headers, request body encoding, non-HTTP response, non-2xx status, decoding
  failure, cancellation, and successful DTO decoding.
- ViewModel tests cover initial state, loading state transitions, success state,
  empty state, error state, retry behavior, stale result/cancellation behavior,
  and navigation output or route requests where applicable.
- Coordinator tests cover route stack changes, modal presentation state,
  dismissal, root resets, and deep-link route translation.

### XCTest and Swift Testing Style

Rules:

- In XCTest, prefer throwing test methods plus `try XCTUnwrap`.
- In Swift Testing, prefer `try #require`.
- Avoid `try!`, force unwraps, and force casts in tests unless the test is
  specifically proving a programmer-error invariant.
- Avoid guard statements in tests when assertion helpers express the failure more
  clearly.
- Follow [`NAMING.md`](NAMING.md) for test names.
- Test helpers and fixtures should be private unless shared intentionally.
- Do not add protocols only to mock a concrete type if a lower boundary can be
  injected.

### UI and Snapshot Tests

Rules:

- Snapshot test reusable visual states and regressions that unit tests cannot
  cover.
- UI test critical navigation, authentication, submission, purchase, and
  recovery flows.
- Do not mock SwiftUI itself.
- Do not rely on localized copy as UI test selectors; use accessibility
  identifiers.
