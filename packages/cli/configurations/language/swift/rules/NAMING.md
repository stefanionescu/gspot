---
title: Swift Naming
---

# Swift Naming

Swift naming follows the Apple API Design Guidelines and optimizes for call-site clarity.

## Case, scope, and files

<!-- level: all -->

Preserve external names and domain notation that the team uses. Express privacy through access
modifiers, not an underscore.

A structural relationship is expressed by nesting rather than a longer
top-level name: `Parser.Error`, not `ParseError`. A static property does not repeat its
declaring type: `UIColor.primary`, not `UIColor.primaryColor`. `shared` and `default` are
used only when they describe the role. An empty enum is a namespace only for tightly related
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
operations (`TemplateRepository.getTemplate`); an implementation may name its technology
(`HTTPTemplateRepository`) when that distinguishes real implementations. Client types own
external API or SDK mechanics (`TemplateAPIClient`). Coordinators own route state, destination
construction, stack mutations, and presentation flow (`TemplateCoordinator.showEditTemplate`).
Route enums are feature-owned, named for the flow, and carry stable domain identifiers
(`TemplateDestination.editTemplate`), never view models, views, repository implementations, SDK
clients, database records, or DTOs.

## Methods, labels, and delegates

<!-- level: all -->

When the project uses view models, name a direct UI event for the event
(`submitButtonTapped()`, `cameraPermissionDenied()`, `selectedItemChanged(to:)`). Name domain work
with a domain verb (`enqueueFileUpload(_:)`, `refreshOrderHistory(for:)`,
`validateEmailAddress(_:)`); `handle`, `process`, and `didTap` name neither. `handle...` is
reserved for literal UIKit target-action and notification handlers marked `@objc`.

Names form grammatical English at the call site: the first label is omitted when the base
name and argument form a phrase and included when it clarifies a weak type. Initializer
arguments that set stored properties use the property names with explicit `self.`, and
factories use `make...` (`makeTemplateView(for:)`). Nonmutating methods without side effects
read as noun phrases, and mutating methods read as imperatives. Pairs follow `sort`/`sorted`,
`append`/`appending`, `formUnion`/`union`.

A delegate method passes the source object first and unlabeled, and is never trimmed because
one caller currently owns it. A source-only `Void` event is the source type plus a tense
phrase: `draftStore(_:didDeleteDraft:)`. A source-only `Bool` answer uses `can`, `is`, or
another predicate, never `should` or `may`: `draftStoreCanDeleteDraft`. A source-only value is a
noun phrase with a natural preposition: `numberOfSections(in:)`. Extra arguments make the
second label describe the event or requested value:
`messageListDataSource(_:heightForMessageAt:)`.

## Protocols and identifiers

<!-- level: all -->

A protocol carries no `I` prefix and no `Protocol` suffix. A domain role is a noun
(`TemplateRepository`), a capability is a natural capability name, often `-ing`
(`ProgressReporting`, `ThemeColorProviding`, `LoginCoordinating`), and an automatic `-able`
name that describes no clear capability is avoided. `Provider`, `Repository`, `Client`, and
`Coordinating` appear only when that is the role, and no protocol exists per ViewModel or use
case merely to enable mocks.

Presentation identifiers are stable contracts for UI identity, diffable data sources,
navigation, persistence, and tests, named for what they identify rather than the framework
that consumes them. Snapshot items use stable presentation or domain IDs, never DTO identity,
array offsets, or index paths. `id` suffices when the enclosing type supplies the context
(`MessageRow.id`); a role-qualified name such as `selectedMessageID` or `conversationID`
serves a scope with several identifiers.
