# UIKit

Read this rule when you change UIKit screens, lists, or cells.

## Framework boundaries

Keep UI updates on the main actor. Translate framework callbacks into application operations without moving network,
persistence, or authorization work into reusable views.

### Presentation organization

<!-- level: all -->

Keep framework types out of domain contracts unless they explicitly represent UI. Follow declared import boundaries. Put
reusable delegate or data-source behavior in a dedicated type when multiple screens need it or the controller mixes
unrelated responsibilities. A view controller can own a small list's data source and delegate directly.

## View-controller lifecycle

<!-- level: all -->

Preserve supported storyboard, nib, and programmatic construction paths. Mark an initializer unavailable only when the
construction contract of the component excludes it.

## Lists and reusable cells

- Retain separately owned data sources and delegates. Table and collection views do not keep these weakly referenced
  objects alive for the screen.
- Use stable, unique item identifiers, never mutable display text. An `IndexPath` identifies a position in the current
  collection, not an item across insertions, removals, or asynchronous work.
- Look up the current item before handling selection. Do not retain an old index path as identity.
- Configure every reusable cell's visible and accessibility state for its current item.
- Cancel or replace image work when the table reuses a cell. Apply a result only when its item identity still matches.
- Preserve the relationship between cell registration, dequeueing, and the expected type. Do not force-cast unrelated
  cells to conceal a registration mismatch.
- Keep list mutations and data-source updates consistent so the view never receives impossible row or section counts.

### Cell registration

Create a `UICollectionView.CellRegistration` outside the diffable data source's cell-provider closure and reuse it for
configured dequeueing. Creating it inside that closure prevents cell reuse and can raise an exception. See the
[Apple cell-registration documentation](https://developer.apple.com/documentation/uikit/uicollectionviewcellregistration?language=swift).

## Diffable data sources

Use diffable data sources when snapshot-based updates fit the screen.

## Accessibility and interaction

Expose meaningful values, traits, and actions, and keep accessibility state correct after cell reuse and snapshot
updates. When you write tests, cover focus and selection after content changes or a modal screen closes.

Use constraints that fit Dynamic Type, safe areas, and every supported size class.
