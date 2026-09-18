---
layer: framework
preset: swift
title: UIKit
---

# UIKit

## UIKit and apple framework boundaries

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

Where a project declares approved UIKit import boundaries, keep new UIKit imports inside them, or
change the declared boundary and state the architectural reason.

## UIKit lists and data sources

SwiftUI `List`, `ScrollView`, `LazyVStack`, and grids remain the default for new
SwiftUI screens. `UITableView` and `UICollectionView` are UIKit interop tools
for existing UIKit screens, platform-specific behavior, performance-sensitive lists, or
reusable UIKit components.

### Default ownership

Rules:

- A view controller may act as `UITableViewDataSource`,
  `UITableViewDelegate`, `UICollectionViewDataSource`, or
  `UICollectionViewDelegate` only for small, one-off lists with no meaningful
  branching, reuse, or section logic.
- Move data source and delegate logic into dedicated objects when a list has multiple cell types or
  sections, supports runtime display modes, or is reused by more than one screen.

- Do the same when the list translates selection from `IndexPath` to domain or presentation values,
  or holds significant dequeue or configuration logic.
- Do the same when it risks turning the view controller into a mixed lifecycle, data, and layout
  object.
- `UITableView.dataSource`, `UITableView.delegate`,
  `UICollectionView.dataSource`, and `UICollectionView.delegate` are weak. The
  owning view controller or presentation owner must retain dedicated data source
  and delegate objects strongly.

Responsibilities:

- `UIViewController` owns lifecycle, table/collection view installation,
  dependency wiring, binding, reload or snapshot calls, navigation handoff,
  and retaining data source/delegate objects.
- `DataSource` owns section/row counts, item lookup, cell registration,
  dequeueing, and cell configuration.
- `Delegate` owns UIKit list events such as selection, highlighting, editing,
  swipe actions, sizing, prefetching, and scroll callbacks when they are
  list-specific.
- `ViewModel` owns presentation state and user intents, and never knows cell
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

### Selection and index paths

Rules:

- Keep `IndexPath` inside UIKit list boundaries.
- Translate `IndexPath` into a stable domain or presentation value before
  calling ViewModel or coordinator outputs.
- Do not make ViewModels inspect UIKit sections/rows unless the ViewModel
  explicitly owns a presentation list model.
- Selection callbacks carry values such as `Message.ID`,
  `SettingsRoute`, `ProfileRowAction`, or a row model action closure over raw
  `IndexPath`.
- Deselect, highlight, swipe, and edit behavior may stay in a UIKit delegate
  object when it is purely visual or list-mechanical.

```swift
func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let row = rows[indexPath.row]
    onSelect(row.id)
}
```

### Typed cell models

Cell model rules:

- Reusable UIKit cells receive typed cell models, not domain entities, DTOs, database records, SDK models, or
  ViewModels.
- A cell model contains the values needed to render the cell: strings,
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
struct MessageCellModel: Hashable {
    let id: Message.ID
    let title: String
    let preview: String
    let timestamp: String
    let isUnread: Bool
}
```

Heterogeneous list rules:

- Avoid `[Any]` object arrays for heterogeneous lists.
- Avoid force-cast chains in `cellForRowAt`.
- Avoid duplicating the relationship between data type, cell class, reuse
  identifier, and configuration in multiple switches.
- A small closed list may use an enum row model.
- An extensible or reused heterogeneous list uses typed row/configurator
  values that keep the cell and model relationship in the type system.
- Do not introduce a generic list framework until there are at least two real
  call sites or a clear local repeated pattern.

Enum row models are appropriate when the set of row types is closed and
feature-owned. Keep the enum feature-owned, not global, and avoid one global
`AppRow`, `TableRow`, or `CellType` enum.

```swift
enum SettingsRow: Hashable {
    case profile(ProfileCellModel)
    case toggle(ToggleCellModel)
    case destructiveAction(ActionCellModel)
}
```

A local typed configurator can be useful when the list is reused or extensible:

```swift
protocol TableCellConfiguring {
    static var reuseIdentifier: String { get }
    static var cellClass: AnyClass { get }

    func configure(_ cell: UITableViewCell)
}

struct TableCellConfigurator<Cell: UITableViewCell, Model>: TableCellConfiguring {
    static var reuseIdentifier: String { String(describing: Cell.self) }
    static var cellClass: AnyClass { Cell.self }

    private let model: Model
    private let configureCell: (Cell, Model) -> Void

    init(model: Model, configure: @escaping (Cell, Model) -> Void) {
        self.model = model
        self.configureCell = configure
    }

    func configure(_ cell: UITableViewCell) {
        guard let cell = cell as? Cell else {
            assertionFailure("Dequeued cell does not match configurator type")
            return
        }

        configureCell(cell, model)
    }
}
```

Cautions:

- This pattern stays local to a feature or UIKit support module.
- Prefer `assertionFailure` plus a safe fallback over `fatalError` in production
  paths.
- If the project has an existing typed dequeue helper, use that instead of
  adding another abstraction.
- For modern collection/table screens, also consider diffable data sources when
  they fit the UIKit surface.

### Diffable data sources and snapshots

Rules:

- Use `UITableViewDiffableDataSource` or `UICollectionViewDiffableDataSource`
  when the list benefits from stable item identity, animated updates, or
  snapshot-based rendering.
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
