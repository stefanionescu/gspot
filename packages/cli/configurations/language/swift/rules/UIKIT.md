---
title: UIKit
---

# UIKit

## Framework boundaries

Use UIKit for UIKit screens and components. Use SwiftUI for SwiftUI screens. Preserve the
project's chosen presentation framework; importing UIKit does not require a SwiftUI migration.
When the two frameworks meet, use `UIViewRepresentable`, `UIViewControllerRepresentable`, or
`UIHostingController` at the presentation boundary appropriate to the direction of integration.

Keep UI updates on the main actor. Translate framework callbacks into application operations
without moving network, persistence, or authorization work into reusable views.

### Presentation organization

<!-- level: all -->

Keep framework types out of domain contracts unless those contracts explicitly represent UI.
Follow declared import boundaries. Put reusable delegate or data-source behavior in a dedicated
owner when multiple screens need it or the controller mixes unrelated responsibilities.
A view controller can own a small list's data source and delegate directly.

Use existing navigation and dependency-construction owners. Do not introduce a coordinator,
router, view model, or composition type solely to satisfy a prescribed type layout.

## View-controller lifecycle

Install and constrain owned views through the controller's lifecycle. Balance child-controller
containment calls when embedding controllers. Retain objects whose lifetime the screen owns,
and cancel screen-owned asynchronous work when its results become irrelevant.

An asynchronous result must still belong to the visible item
or current screen before it changes the UI.

### Controller responsibilities

<!-- level: all -->

Large `viewDidLoad`, `viewDidAppear`, app delegate, or scene delegate methods move their
setup into named private methods or composition objects. A mode flag that forces the same
branching across several methods becomes separate strategy or data source objects or an
explicit state type. Composition shares UI behavior. Inheritance serves framework
requirements or stable shared behavior rather than default reuse:

```swift
currentDataSource = SectionedProductsDataSource(products: products)
tableView.dataSource = currentDataSource
tableView.reloadData()
```

Preserve supported storyboard, nib, and programmatic construction paths. Mark an initializer
unavailable only when the component's actual construction contract excludes it.

## Lists and reusable cells

- Retain separately owned data sources and delegates. Table and collection views do not keep
  these weakly referenced owners alive for the screen.
- Use stable item identifiers. An `IndexPath` identifies a position in the current collection,
  not an item across insertions, removals, or asynchronous work.
- Look up the current item before handling selection. Do not retain an old index path as identity.
- Configure every reusable cell's visible and accessibility state for its current item.
- Cancel or replace image work when a cell is reused. Apply a result only when its item identity
  still matches, and keep UI updates on the main actor.
- Preserve the relationship between cell registration, dequeueing, and the expected cell type.
  Do not force-cast unrelated cells to conceal a registration mismatch.
- Keep list mutations and data-source updates consistent so the view never receives impossible
  row or section counts.

### Cell registration

Create a `UICollectionView.CellRegistration` outside the diffable data source's cell-provider
closure and reuse it for configured dequeueing. Creating it inside that closure prevents cell
reuse and can raise an exception. See [Apple's cell-registration documentation](https://developer.apple.com/documentation/uikit/uicollectionviewcellregistration?language=swift).

### Cell models

<!-- level: all -->

Pass cells the values needed for rendering and interaction. Keep provider records and database
mechanics at their existing boundary. Use a feature-owned enum for a closed set of heterogeneous
rows when it makes the relationship explicit. Add a shared configurator only for repeated
behavior that existing registration APIs do not already own.

## Diffable data sources

Use diffable data sources when snapshot-based updates fit the screen. Keep item identifiers
unique and stable across snapshots. Mutable display text is not item identity.

Build each snapshot from a consistent state. Resolve cells and selection through the current
data source. When you write tests, cover insertion, removal, reordering, and asynchronous refresh
when the screen owns those transitions. Keep snapshot-building code with the presentation behavior
it serves.

## Accessibility and interaction

Expose meaningful values, traits, and actions, and keep accessibility state correct after cell
reuse and snapshot updates. When you write tests, cover focus and selection when content changes
or a modal screen closes.

Use constraints that fit Dynamic Type, safe areas, and every supported size class.
