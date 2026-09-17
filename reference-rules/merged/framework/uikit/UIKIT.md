---
layer: framework
preset: swift
title: UIKit
---

# UIKit

## UIKit and Apple Framework Boundaries

SwiftUI is the default for UI.

Rules:

- Import UIKit only in UIKit interop surfaces, app lifecycle adapters,
  representables, view controllers required by Apple APIs, or platform wrappers. `enforced-by: swift/swiftlint`
- Do not put UIKit imports in domain or use case code. `enforced-by: swift/swiftlint`
- Do not use UIKit types in ViewModel public state unless the ViewModel exists
  specifically as a UIKit bridge. `enforced-by: swift/swiftlint`
- Wrap UIKit views/controllers with `UIViewRepresentable` or
  `UIViewControllerRepresentable` at the presentation boundary. `enforced-by: swift/swiftlint`
- Keep delegate/data-source objects small and owned by the UIKit bridge or
  presentation owner. `enforced-by: swift/swiftlint`
- Keep Apple framework callbacks from leaking into Domain by translating them
  into app-level events or use case inputs. `enforced-by: swift/swiftlint`

Where a project declares approved UIKit import boundaries, keep new UIKit imports inside them, or
change the declared boundary and state the architectural reason.

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
  branching, reuse, or section logic. `enforced-by: swift/swiftlint`
- Move data source and delegate logic into dedicated objects when a list has
  multiple cell types, has multiple sections, supports runtime display modes, is
  reused by more than one screen, translates selection from `IndexPath` to
  domain or presentation values, contains significant dequeue/configuration
  logic, or risks turning the view controller into a mixed lifecycle/data/layout
  object. `enforced-by: swift/swiftlint`
- `UITableView.dataSource`, `UITableView.delegate`,
  `UICollectionView.dataSource`, and `UICollectionView.delegate` are weak. The
  owning view controller or presentation owner must retain dedicated data source
  and delegate objects strongly. `enforced-by: swift/swiftlint`

Responsibilities:

- `UIViewController` owns lifecycle, table/collection view installation,
  dependency wiring, binding, reload/apply-snapshot calls, navigation handoff,
  and retaining data source/delegate objects. `enforced-by: swift/swiftlint`
- `DataSource` owns section/row counts, item lookup, cell registration,
  dequeueing, and cell configuration. `unenforced`
- `Delegate` owns UIKit list events such as selection, highlighting, editing,
  swipe actions, sizing, prefetching, and scroll callbacks when they are
  list-specific. `unenforced`
- `ViewModel` owns presentation state and user intents, and never knows cell
  classes, reuse identifiers, or UIKit index-path mechanics. `enforced-by: swift/swiftlint`
- `Coordinator` or `Router` owns navigation caused by selection when navigation
  spans the flow. `unenforced`
- `Composition` constructs the view controller, ViewModel, data source/delegate,
  and any closures or adapters between them. `unenforced`

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

- Keep `IndexPath` inside UIKit list boundaries. `enforced-by: swift/swiftlint`
- Translate `IndexPath` into a stable domain or presentation value before
  calling ViewModel or coordinator outputs. `enforced-by: swift/swiftlint`
- Do not make ViewModels inspect UIKit sections/rows unless the ViewModel
  explicitly owns a presentation list model. `unenforced`
- Selection callbacks carry values such as `Message.ID`,
  `SettingsRoute`, `ProfileRowAction`, or a row model action closure over raw
  `IndexPath`. `enforced-by: swift/swiftlint`
- Deselect, highlight, swipe, and edit behavior may stay in a UIKit delegate
  object when it is purely visual or list-mechanical. `unenforced`

```swift
func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let row = rows[indexPath.row]
    onSelect(row.id)
}
```

### Typed Cell Models

Cell model rules:

- Reusable UIKit cells receive typed cell models, not domain entities, DTOs, database records, SDK models, or
  ViewModels. `unenforced`
- A cell model contains the values needed to render the cell: strings,
  image references, accessory state, accessibility text, enabled/disabled state,
  and lightweight IDs when needed for actions. `unenforced`
- Cells may own visual formatting that is purely local, but reusable or
  domain-sensitive formatting belongs in a ViewModel or formatter dependency. `unenforced`
- Do not let cells start network requests, database reads, analytics policy, or
  business workflows. `enforced-by: security/semgrep`
- If a cell loads an image, inject a narrow image-loading view model/adapter or
  bind precomputed image state. Do not call shared clients directly from the
  cell. `unenforced`

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

- Avoid `[Any]` object arrays for heterogeneous lists. `enforced-by: swift/swiftlint`
- Avoid force-cast chains in `cellForRowAt`. `enforced-by: swift/swiftlint`
- Avoid duplicating the relationship between data type, cell class, reuse
  identifier, and configuration in multiple switches. `enforced-by: swift/swiftlint`
- A small closed list may use an enum row model. `enforced-by: swift/swiftlint`
- An extensible or reused heterogeneous list uses typed row/configurator
  values that keep the cell and model relationship in the type system. `enforced-by: swift/swiftlint`
- Do not introduce a generic list framework until there are at least two real
  call sites or a clear local repeated pattern. `enforced-by: swift/swiftlint`

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

- This pattern stays local to a feature or UIKit support module. `unenforced`
- Prefer `assertionFailure` plus a safe fallback over `fatalError` in production
  paths. `enforced-by: swift/swiftlint`
- If the project has an existing typed dequeue helper, use that instead of
  adding another abstraction. `unenforced`
- For modern collection/table screens, also consider diffable data sources when
  they fit the UIKit surface. `enforced-by: swift/swiftlint`

### Diffable Data Sources and Snapshots

Rules:

- Use `UITableViewDiffableDataSource` or `UICollectionViewDiffableDataSource`
  when the list benefits from stable item identity, animated updates, or
  snapshot-based rendering. `enforced-by: swift/swiftlint`
- Keep snapshot construction in the presentation layer or data source adapter. `enforced-by: swift/swiftlint`
- Do not build snapshots in Domain. `enforced-by: swift/swiftlint`
- Do not use index paths as long-lived identity. `unenforced`
- Test snapshot-building logic as pure presentation mapping when it contains
  branching. `enforced-by: swift/swiftlint`

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
