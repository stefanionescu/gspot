---
title: Documentation Format
---

# Documentation Format

Portable Markdown, page structure, text formatting, lists, tables, and alerts. The formatter
and the Markdown linter own mechanical layout: line wrapping, blank lines, heading increments,
list markers, and table alignment. These rules say what to write.

## Use portable Markdown

Use CommonMark and GitHub Flavored Markdown as the baseline unless the project renderer
defines a different supported subset. Markdown is easier to review, search, and keep
accessible than HTML. Use HTML only when Markdown cannot express the required semantic
element. The HTML must render in the platform, stay responsive and accessible, keep the source
readable, and have a maintenance owner. Routine pages carry no custom CSS or layout HTML.

Do not split a link, an inline code span, a product name, a command, or a value the reader
copies as one unit across source lines. Do not insert manual line breaks for visual spacing;
use paragraphs.

### Comments and components

<!-- level: all -->

HTML comments hold author-only maintenance notes: generation ownership, a non-obvious source
constraint, a maintenance requirement. They never hide obsolete documentation, drafts, change
history, reviewer conversations, or commented-out broken links. Delete obsolete content; Git
keeps the history.

Shortcodes, tabs, cards, and other components are acceptable only when the documentation
platform owns and tests them, essential meaning stays in text, and a secondary renderer gets a
useful fallback. Tabs hold parallel alternatives, such as operating systems, each with a complete
procedure. Prerequisites, safety warnings, and steps never sit in a collapsed panel.

## Structure pages predictably

<!-- level: all -->

A title describes the outcome or subject and includes the term readers search for. It avoids unexplained acronyms, decorative punctuation, and links. A
task title starts with an imperative verb (`Configure Private Networking`). A concept title is
a noun phrase (`Private Networking Architecture`). A troubleshooting title is the observable
symptom (Requests fail with `connection refused`).

Front matter exists only when the platform defines it. It holds only supported fields in valid YAML, keeps
the title consistent with navigation and the page, and uses stable identifiers. Quote a value
that punctuation or type inference can change, and never store a secret. Remove obsolete
fields instead of leaving them empty.

A separate navigation label is shorter than the title and uses the base form of the verb. It
reuses the title's words, stays parallel with its siblings, and introduces no new term. The
introduction orients the reader in one or two short paragraphs: what the subject is, why the
reader uses it, and any immediate scope or limitation. It does not restate the title.

Avoid H4 and deeper: split the page instead. Put introductory text between a heading and its
first subheading. Keep headings short and descriptive. Do not put a link or a number in a
heading unless the number identifies the subject.

A long page with several H2 sections that readers visit one at a time gets a `## Contents`
section, as does a reference page. The list is unordered, in document order, with important
H3 entries only when they help readers choose a path. Anchors stay accurate when headings
change. A sectional contents list follows a sentence that explains how to choose.

A task page runs context, permissions or availability, prerequisites, procedure, expected
result, troubleshooting, then next steps. A reference page runs scope, contract summary, syntax
or schema, fields or options, examples, errors and limits, then related topics.

Keep a paragraph to two to four sentences. At level `all`, the check stops at six. Start a new
paragraph when the subject changes, the reader switches from concept to action, a condition
changes the audience, or a safety consequence needs visibility. Do not fragment every
sentence into its own paragraph.

## Format text by meaning

Formatting carries meaning, never decoration. Bold marks interactive interface labels, a
short term that must be located in a mixed interface instruction, and rare brief emphasis
that wording alone cannot give. It is not a heading substitute, not for every keyword, not
for whole sentences, not the only signal of danger, and never inside code. Punctuation stays
outside bold unless it is part of the exact label. Italics are avoided for emphasis; they
serve established editorial uses such as the title of a published work.

Inline code marks commands, options, file and directory names, environment variables, and
configuration keys and literal values. It also marks function and type names, HTTP methods,
status codes, short inputs and outputs, branch and repository names, exact error messages, and
HTML elements with their brackets. Product names and general concepts are not code.

Quotation marks are straight. Exact text a reader types or sees in a terminal is code;
non-interactive interface text reproduced exactly is quoted. Links, headings, and code are
never quoted. A description list is used only where the renderer supports it consistently.
Elsewhere, use a short list or a two-column table. A series of bold labels does not simulate
definitions.

Blockquotes hold quoted source material only, short and cited; a callout is an alert or a
paragraph.

A badge appears only when its state matters to the typical README reader, its destination is
useful, it stays accurate, and no text says it better. Emoji do not decorate, mark status,
warn, or navigate. A project-owned icon appears only when it stands in the interface for an
unlabeled control. It follows the action name: `Select **Edit** (ICON).` A control with no
accessible name is described literally and reported through the project's issue process.

## Use lists for scannable information

<!-- level: all -->

A list holds several parallel items a reader scans. A complete introductory sentence ending
in a colon names the subject, not "the following." Every item starts in the same grammatical
form. Items are complete sentences or consistent fragments: complete sentences end with a
period, fragments do not. No item ends with a comma or a semicolon. Items stand on their own
so translation does not depend on the introduction.

Ordered lists carry procedures, priority, rank, and lifecycle stages. Unordered lists carry
the rest, ordered by importance to the reader, then typical workflow, then logical grouping,
then alphabetically when nothing else adds meaning. Nesting stops at two levels. Complex
nesting becomes a heading.
Bold labels are not miniature headings: several items that need definitions get a reference
section, a description list, a table, or H3 headings.

## Use tables only for real comparisons

A table compares values across two or more attributes. Configuration keys with defaults and
descriptions, feature support across platforms, roles and permissions, API fields with types
and meanings, and limits by plan are tables. Items with one short description each are a
list.

### Table conventions

<!-- level: all -->

Every column has a header in sentence case. Every cell holds a meaningful value, "None" or
"Not applicable," never blank and never `N/A`. The description column comes last, cell
content stays short, and abbreviations are explained outside the table. Symbols are paired
with text, and status is never color alone. Row-header markup is used where the platform
supports it.

### Table size and footnotes

Keep tables narrow: a cell holds no paragraph, large code block, or nested list. A footnote
qualifies several cells at once and never carries safety information or a required step.

## Use alerts sparingly

Alerts interrupt reading. The GitHub Flavored Markdown types are `NOTE`, `TIP`, `IMPORTANT`,
`WARNING`, and `CAUTION`. `NOTE` is context some readers need and `TIP` an optional practice.
`IMPORTANT` is information required to complete the goal. `WARNING` is a meaningful risk to
understand before continuing. `CAUTION` is a dangerous or destructive action with serious
security or data-loss risk:

```markdown
> [!WARNING]
> Rotating the key invalidates every existing session.
```

Use only the types the project renderer supports, and put a short alert before the action it
qualifies, at most one per section. Content that needs more than a short paragraph gets a
heading and a normal section instead.
