# Swift Naming

Swift naming follows the Apple API Design Guidelines and optimizes for call-site clarity.

## Case, scope, and files

<!-- level: all -->

Preserve external names and domain notation that the team uses. Express privacy through access
modifiers, not an underscore.

Express a structural relationship through nesting rather than a longer
top-level name: `Parser.Error`, not `ParseError`. A static property does not repeat its
declaring type: `UIColor.primary`, not `UIColor.primaryColor`. Use `shared` and `default`
only when they describe the role. Use an empty enum as a namespace only for tightly related
constants or functions never instantiated.

## Roles

<!-- level: all -->

A suffix says what a type owns and means one thing across the whole codebase. If `Repository`
owns domain-facing data access in one feature, it does not own HTTP mechanics in another.
Which suffixes a project uses depends on the pattern it picked, but these framework words have
one meaning:

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

Repository protocols speak domain language and return domain results through domain
operations such as `TemplateRepository.getTemplate`; an implementation may name its technology
such as `HTTPTemplateRepository` when that distinguishes real implementations. Client types own
external API or SDK mechanics such as `TemplateAPIClient`. Coordinators own route state, destination
construction, stack mutations, and presentation flow such as `TemplateCoordinator.showEditTemplate`.
Keep route enums within their feature and name them for the flow. Give them stable domain identifiers
such as `TemplateDestination.editTemplate`. Never give them view models, views, repository implementations, SDK
clients, database records, or DTOs.

## Methods, labels, and delegates

<!-- level: all -->

When the project uses view models, name a direct UI event for the event
such as `submitButtonTapped()`, `cameraPermissionDenied()`, `selectedItemChanged(to:)`. Name domain work
with a domain verb such as `enqueueFileUpload(_:)`, `refreshOrderHistory(for:)`,
`validateEmailAddress(_:)`; `handle`, `process`, and `didTap` name neither. Reserve `handle...` for
reserved for literal UIKit target-action and notification handlers marked `@objc`.

Names form grammatical English at the call site: omit the first label when the base
name and argument form a phrase and included when it clarifies a weak type. Initializer
arguments that set stored properties use the property names with explicit `self.`, and
factories use `make...` such as `makeTemplateView(for:)`. Nonmutating methods without side effects
read as noun phrases, and mutating methods read as imperatives. Pairs follow `sort`/`sorted`,
`append`/`appending`, `formUnion`/`union`.

A delegate method passes the source object first and unlabeled, and never trims its signature because
one caller currently owns it. Name a source-only `Void` event with the source type plus a tense
phrase: `draftStore(_:didDeleteDraft:)`. A source-only `Bool` answer uses `can`, `is`, or
another predicate, never `should` or `may`: `draftStoreCanDeleteDraft`. Name a source-only value with a
noun phrase with a natural preposition: `numberOfSections(in:)`. Extra arguments make the
second label describe the event or requested value:
`messageListDataSource(_:heightForMessageAt:)`.

## Protocols and identifiers

<!-- level: all -->

A protocol carries no `I` prefix and no `Protocol` suffix. Name a domain role with a noun such as `TemplateRepository`. Name a capability for its behavior, often with `-ing`,
such as `ProgressReporting`, `ThemeColorProviding`, or `LoginCoordinating`. Avoid an automatic `-able`
name that describes no clear capability. `Provider`, `Repository`, `Client`, and
`Coordinating` appear only when the protocol serves that role, and no protocol exists per ViewModel or use
case merely to enable mocks.

Presentation identifiers provide stable interfaces for UI identity, diffable data sources,
navigation, persistence, and tests, named for what they identify rather than the framework
that consumes them. Snapshot items use stable presentation or domain IDs, never DTO identity,
array offsets, or index paths. `id` suffices when the enclosing type supplies the context
such as `MessageRow.id`; a role-qualified name such as `selectedMessageID` or `conversationID`
serves a scope with several identifiers.
