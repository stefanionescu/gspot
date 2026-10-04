---
title: Documentation Media
---

# Documentation Media

User interface instructions, keyboard input, illustrations, and accessibility.

## User interface instructions

An instruction matches the current product. The label's wording, capitalization, and
punctuation are reproduced exactly in bold: `Select **Create project**.` Prose uses sentence
case even when the interface styles a label uppercase. Capitals stay when they are part of
the label. The location comes before the action: `In **Visibility**, select **Private**.` A
navigation path keeps its separator outside the bold: `**Settings** > **Access control**`.

An element is named, never identified only by position or appearance, such as "the green
icon" or "the box below." Layouts move, and appearance is not available to every reader.
Position is a secondary orientation: "In the upper-right corner, select **Account**." A
responsive difference is described only where the action becomes ambiguous, not at every
viewport: "If **Security** is not visible, expand the repository menu."

### Interaction verbs

<!-- level: all -->

Use "select" for any control. Use "click" only when the step needs a mouse. Use `enter` for
text in a field, `run`
for a command, and `press` for a key. `open` is for a page, file, or application, `expand` for
a collapsed section, and `deselect` to clear an option.

Self-explanatory fields get "Complete the fields." Only a field with a non-obvious
requirement is explained. Several such fields become a list or a configuration reference
rather than one overloaded step.

## Keyboard input

Each key is an HTML `<kbd>` element. Letters are capitalized and action keys spelled out.
A simultaneous combination has no spaces around its `+`. Write a sequence with commas:
<kbd>G</kbd>, <kbd>H</kbd>. macOS uses `Command`, `Option`, and `Control`; Windows and
Linux use `Ctrl` and `Alt`; arrows are `↑`, `↓`, `←`, and `→`.

```html
Press <kbd>Command</kbd>+<kbd>B</kbd>.
```

Platform variants come in one fixed order, macOS first in an Apple-first project and
otherwise by primary audience. When both an interface path and a shortcut exist, the visible
procedure comes first. The shortcut is documented where it is the primary or faster path.

## Illustrations

An illustration is a screenshot, diagram, chart, or static image. It exists when it
materially clarifies a complex relationship, a multi-step flow, a spatial interface state, an
architecture boundary, or a comparison prose cannot express. It never exists to make a page
look less textual, and it always supplements text rather than replacing it.

When a change makes a screenshot or diagram stale, tell the user which one.

Screenshots are PNG. Diagrams and line art are SVG when the source is safe and editable.
Photographs are JPEG or WebP where the renderer supports it and the saving is real. Images
live in a documentation-owned directory, never hotlinked. Names are lowercase kebab-case and
say subject, action, and element: `repository-create-button.png`,
`deployment-request-flow.drawio.svg`, never `image1.png`.

Without a project budget a screenshot targets 1000 by 500 pixels and 100 KB. These are
maintenance targets that never make text unreadable. A version suffix appears only when the
workflow tracks image refreshes by version. Animated GIFs are replaced by a static
screenshot, a short sequence, or an accessible video with text instructions.

A diagram serves a process, state transition, architecture, or entity relationship hard to
follow in prose. Mermaid is preferred where the renderer supports it, because the source is
searchable, reviewable, and versioned with the text. An editable SVG from an approved tool
serves a layout Mermaid cannot produce, stored with its definition. A diagram holds only
essential elements: rectangles for processes, diamonds for decisions, arrows for direction,
and consistent solid and dotted lines. Shape and label carry meaning rather than color, equal
concepts get equal shapes, and labels stay short with room around them.

Split a complex diagram into several focused ones.

````markdown
```mermaid
flowchart TD
    accTitle: Deployment request flow
    accDescr: A request moves from validation to deployment or rejection.

    A[Validate request] --> B{Valid?}
    B -->|Yes| C[Deploy]
    B -->|No| D[Reject]
```
````

A video reinforces text that already documents the complete procedure. It carries captions,
a transcript for unique information, and a publication date where staleness is likely. It is
linked rather than embedded unless the embed clearly helps, and it uses the platform's
privacy-preserving embed where available. It is not committed to the product repository
without an asset workflow, and it is removed or replaced when outdated.

## Accessibility

Every meaningful image has alt text that states its purpose in context and the relevant state
or relationship. Alt text is in sentence case, ends with punctuation, uses no formatting
syntax, and does not repeat the surrounding paragraph. It mentions a highlight when it
matters. It opens with the visual type and product context, not "Image of":

```markdown
![Screenshot of repository settings with the Private option selected.](img/repository-visibility.png)
![Diagram showing requests moving through validation before deployment.](img/deployment-flow.svg)
```

A complex diagram gets a short alt description with the full flow in nearby text. A purely
decorative image gets empty alt text, `![](img/decorative-divider.svg)`, never a missing
attribute.
