---
layer: prose
preset: prose
title: Documentation Format
---

# Documentation Format

Portable Markdown, page structure, text formatting, lists, tables, and alerts. The formatter and
markdownlint own mechanical layout; these rules say what to write.

## Use portable Markdown

Use CommonMark and GitHub Flavored Markdown as the portable baseline unless the
project renderer defines a different supported subset.

Prefer Markdown over HTML because Markdown is:

- Easier to review.
- Easier to search.
- More portable across repository hosts.
- More likely to remain accessible.
- Less likely to break with site-wide styling changes.

Use HTML only when:

- Standard Markdown cannot express the required semantic element.
- The project renderer supports the element.
- The element remains responsive and accessible.
- The source stays readable.
- The use has a clear maintenance owner.

Do not add custom CSS or layout HTML to routine Markdown pages.

### Source line length

Wrap prose at the line length the project sets.

Do not split:

- Markdown links across source lines.
- Inline code spans.
- Product names.
- Commands.
- Values that readers need to copy as one unit.
- Logical phrases when the split makes the source harder to read.

Long URLs, tables, and code can exceed the prose target.

Do not insert manual line breaks merely to create visual spacing in rendered
text. Use separate paragraphs.

### Markdown comments

Use HTML comments for author-only maintenance notes:

```html
<!-- This table is generated from the public schema. Update the schema source. -->
```

Comments must explain maintenance requirements, generation ownership, or a
non-obvious source constraint.

Do not:

- Hide obsolete documentation in comments.
- Store drafts in published pages.
- Add change history.
- Leave reviewer conversations in source.
- Comment out broken links instead of fixing or removing them.

Delete obsolete content. Git already preserves history.

### Platform extensions

Shortcodes, Liquid tags, custom alerts, tab components, cards, and generated
macros are acceptable only when the documentation platform owns and tests them.

For each extension:

- Confirm it renders in every supported documentation surface.
- Provide a useful fallback when a secondary renderer does not support it.
- Keep essential meaning in text.
- Avoid nesting components unless the platform documents that combination.
- Do not use a component only for visual decoration.

### Interactive documentation components

Use tabs only for parallel alternatives such as operating systems, package
managers, deployment methods, or version ranges.

For tabs:

- Give every tab a short, parallel title.
- Use the same tab order across pages.
- Make each tab's procedure complete.
- Do not put headings, other tabs, or essential cross-tab instructions inside
  a tab unless the renderer explicitly supports them.
- Do not link directly to one tab unless the platform guarantees a durable
  target.
- Confirm that unsupported renderers show a usable linear fallback.

Use collapsible panels only for optional secondary detail. Do not hide:

- Required prerequisites.
- Safety warnings.
- Procedure steps.
- Error recovery.
- Accessibility information.

Use cards only on landing pages where the primary job is routing readers to a
small set of destinations. Every card needs descriptive link text and a useful
fallback list.

Use glossary tooltips only for the first important occurrence of a specialized
term. Keep the definition to one short sentence. Use a glossary page for longer
definitions.

Do not overload a page with interactive components. Every interaction adds
navigation work and a new rendering failure mode.

## Structure pages predictably

Readers learn a documentation set faster when similar pages use similar
structures.

### Titles and H1 headings

Every standalone page needs one clear title.

For repository Markdown:

```markdown
# Configure Private Networking
```

Use exactly one H1. Title case capitalizes the first word, the last word, and every major word;
minor words stay lowercase unless first or last: articles (`a`, `an`, `the`), coordinating
conjunctions (`and`, `but`, `for`, `nor`, `or`, `so`, `yet`), and short prepositions (`as`, `at`,
`by`, `for`, `from`, `in`, `of`, `on`, `per`, `to`, `via`, `with`).

If the publishing system generates the H1 from front matter, put the title in
front matter and do not add a second H1 in the Markdown body.

Titles must:

- Describe the page outcome or subject.
- Use title case.
- Include the distinguishing term readers search for.
- Avoid unexplained acronyms.
- Avoid decorative punctuation.
- Avoid links.
- Remain stable enough to support durable anchors.

For tasks, prefer an imperative verb:

```text
Configure Private Networking
```

For concepts, prefer a noun phrase:

```text
Private Networking Architecture
```

For troubleshooting, prefer the observable symptom:

```text
Requests fail with `connection refused`
```

### Front matter

Use front matter only when the documentation platform defines it.

Rules:

- Include only supported fields.
- Use valid YAML or the platform's required format.
- Keep the title consistent with navigation and on-page content.
- Do not add an H1 when the platform renders the front-matter title as H1.
- Use stable identifiers for generated navigation.
- Quote values when punctuation or type inference can change their meaning.
- Do not store secrets or internal publishing credentials in metadata.
- Remove obsolete fields instead of leaving empty values.

Example:

```yaml
---
title: Configure Private Networking
description: Route service traffic through private network endpoints.
---
```

### Navigation labels and short titles

When the publishing system uses separate navigation labels:

- Keep the label shorter than the page title.
- Use the base form of an action verb.
- Reuse words from the full title.
- Omit repeated product context only when the navigation hierarchy supplies it.
- Keep sibling labels parallel.
- Do not introduce a new term that the page title never uses.

Use:

```text
Configure notifications
```

### Introductions

The introduction orients the reader in one or two short paragraphs.

State:

- What the subject is.
- Why the reader uses it.
- Any immediate scope or limitation.

Do not restate the title in a full sentence.

Use:

```text
Private networking keeps service traffic off the public internet. Configure it
before deploying workloads that require internal-only access.
```

### Heading hierarchy

- Start body sections at H2.
- Increment one heading level at a time.
- Do not skip from H2 to H4.
- Avoid levels deeper than H4. Split the page when the hierarchy requires
  deeper nesting.
- Put introductory text between a heading and its first subheading.
- Make headings at the same level unique.
- Keep headings short and descriptive.
- Use sentence case.
- Do not bold heading text.
- Do not put links in headings.
- Do not number headings unless the number is a stable part of the subject.

Use:

```markdown
## Configure authentication

Choose the authentication method that matches the deployment environment.

### Use workload identity
```

### Contents sections

Long pages need a `## Contents` section with links to the sections readers use
most.

Add a contents section when:

- The page has several H2 sections.
- Readers are likely to visit only one section.
- The rendered page requires substantial scrolling.
- The page acts as a reference.

Do not add a contents section to a short page.

Use an unordered list in document order. Include important H3 sections only
when they help readers choose a path.

```markdown
## Contents

- [Prerequisites](#prerequisites)
- [Configure the service](#configure-the-service)
- [Troubleshoot startup](#troubleshoot-startup)
```

Keep every anchor accurate when headings change.

Do not place a sectional contents list directly below a heading without a
sentence explaining how to choose among the sections.

### Section order

Use a predictable order for task-oriented pages:

1. Context.
1. Permissions or availability.
1. Prerequisites.
1. Procedure.
1. Expected result.
1. Troubleshooting.
1. Next steps or related topics.

Use a predictable order for reference pages:

1. Scope.
1. Contract summary.
1. Syntax or schema.
1. Fields or options.
1. Examples.
1. Errors and limits.
1. Related topics.

### Paragraphs

Keep paragraphs focused. Two to four sentences is a useful default, not a hard
limit.

Start a new paragraph when:

- The subject changes.
- The reader must switch from concept to action.
- A condition changes the applicable audience.
- A safety consequence needs visibility.

Do not use a one-sentence paragraph for every sentence. Excessive fragmentation
makes related ideas harder to follow.

## Format text by meaning

Formatting communicates semantics. Do not use formatting only to make a page
look more interesting.

### Bold

Use bold for:

- Interactive user interface labels.
- A short term that must be visually located in a mixed UI instruction.
- Rare, brief emphasis when the sentence cannot be made clear through wording
  alone.

Do not use bold:

- As a substitute for headings.
- For every keyword.
- For whole sentences.
- As the only way to signal danger or required behavior.
- Inside code formatting.

Keep punctuation outside bold formatting unless the punctuation is part of the
exact user interface label.

```markdown
Select **Settings** > **Access control**.
```

### Italics

Avoid italics for emphasis. Italics are harder to scan in many sans-serif
interfaces and can reduce readability.

Use italics only for established editorial purposes, such as the title of a
published work, when the project style permits it.

### Inline code

Use inline code for:

- Commands and subcommands.
- Options and flags.
- File and directory names.
- Environment variables.
- Configuration keys and literal values.
- Function, method, type, and property names.
- HTTP methods and status codes.
- Short inputs and outputs.
- Branch and repository names.
- Exact error messages from terminals, logs, or APIs.
- HTML elements, including angle brackets.

```markdown
Set `LOG_LEVEL` to `debug`, then run `service start`.
```

Do not use inline code for product names or general technical concepts.

### Quotation marks

Use straight quotation marks.

Prefer code formatting for exact text that a reader enters or sees in a
terminal.

Use quotation marks for non-interactive user interface text when the wording
must be reproduced exactly:

```text
The page displays "Deployment completed."
```

Do not put quotation marks around links, headings, or code-formatted text.

### Definition terms

Use a description list only when the renderer supports it consistently.
Otherwise, use a short list or a two-column table.

Do not simulate definitions with a long series of bold labels.

### Blockquotes

Use blockquotes only for quoted source material.

Do not use blockquotes as generic callout boxes. Use a supported alert or a
normal paragraph instead.

Keep quotations short, cite the source, and prefer paraphrasing when the exact
wording is not important.

### Badges

Each badge adds noise and external maintenance. Include a badge only when its state matters to the
typical README reader, the destination is useful, the badge remains accurate, and text elsewhere
does not communicate the information better. Do not use badges as decoration.

### Emoji and icons

Do not use emoji for decoration, status, warnings, or navigation.

Use a project-owned icon only when the icon appears in the interface and helps
the reader identify an otherwise unlabeled control.

When an icon has hover or accessible text:

```text
Select **Edit** (ICON).
```

Name the action first. Do not require the reader to interpret the icon's shape.

When an interface control has no accessible name, describe it literally and
report the interface accessibility problem through the project's normal issue
process.

## Use lists for scannable information

Use a list when readers need to scan several parallel items.

### Introduce the list

Use a complete introductory sentence followed by a colon:

```markdown
The service requires these values:

- Endpoint URL
- Access token
- Region
```

Avoid vague introductions such as "The following" when the subject can be
named.

### Keep items parallel

Start all items in a list with the same grammatical form.

Use:

```markdown
- Validate the request.
- Store the record.
- Return the identifier.
```

### Capitalize and punctuate consistently

- Start every item with a capital letter.
- End complete sentences with periods.
- Do not add periods to fragments.
- Use the same punctuation pattern for every item.
- Do not end list items with commas or semicolons.

### Choose ordered or unordered lists

Use ordered lists when order matters:

- Procedures.
- Priority.
- Rank.
- Lifecycle stages.

Use unordered lists when order does not matter.

Order unordered items by:

1. Importance to the reader.
1. Typical workflow.
1. Logical grouping.
1. Alphabetical order when no other order adds meaning.

### Avoid sentence fragments that depend on the introduction

Use:

```markdown
You can obtain the token in two ways:

- Copy the token from the setup response.
- Create a token in **Access settings**.
```

The independent sentences translate more reliably.

### Nest lists carefully

Avoid more than two levels of nested lists.

For unordered lists, indent nested content by two spaces:

````markdown
- Parent item

  Additional context for the parent.

  ```text
  Nested example
  ```
````

For ordered lists, indent nested blocks to align with the first character after
the list marker:

````markdown
1. Run the command:

   ```shell
   tool start
   ```
````

If nesting becomes complex, create a heading instead.

### Do not use bold labels as miniature headings

When several items need definitions, prefer:

- A reference section.
- A supported description list.
- A table with meaningful columns.
- Separate H3 headings for substantial topics.

Bold labels are acceptable for exact user interface labels, not as a default
content structure.

## Use tables only for real comparisons

Use a table when readers must compare values across two or more attributes.

Good table uses include:

- Configuration keys, defaults, and descriptions.
- Feature support across platforms.
- Roles and permissions.
- API fields, types, requirements, and meanings.
- Limits by plan or environment.

Use a list instead when each item has only one short description.

### Write accessible tables

- Provide a header for every column.
- Use sentence case for headers.
- Put a meaningful value in every cell.
- Use "None" or "Not applicable" instead of leaving cells blank.
- Avoid `N/A`, which can mean several things.
- Put the description column last.
- Keep cell content short.
- Explain abbreviations outside the table.
- Use text in addition to symbols.
- Do not communicate status by color alone.
- Provide row-header markup when the publishing system supports it and the first
  column identifies each row.

### Keep tables narrow

Wide tables are difficult on small screens and for screen magnification.

Before adding a column, ask whether:

- The attribute is required for comparison.
- The value can move to a linked reference.
- The table is better as several smaller tables.
- A list is clearer.

Do not put paragraphs, large code blocks, or nested lists in table cells.

### Use footnotes sparingly

Move information into the table or surrounding text first.

Use a footnote only when:

- The same qualification applies to several cells.
- Inline content makes the table unreadable.
- The note is secondary but necessary.

Prefer Markdown-native footnotes when the renderer supports them:

```markdown
The legacy mode remains available.[^legacy]

[^legacy]: Legacy mode does not support encrypted backups.
```

Do not use footnotes for safety information or required steps.

## Use alerts sparingly

Alerts interrupt the reading flow. Use them only when the content warrants the
interruption.

Supported GitHub Flavored Markdown alerts are:

```markdown
> [!NOTE]
> Additional context that some readers need.
```

```markdown
> [!TIP]
> An optional practice that can improve the result.
```

```markdown
> [!IMPORTANT]
> Information required to complete the goal.
```

```markdown
> [!WARNING]
> A meaningful risk that readers must understand before continuing.
```

```markdown
> [!CAUTION]
> A dangerous or destructive action with serious security or data-loss risk.
```

Use the alert types supported by the project renderer. Do not assume every
renderer supports the same names.

Rules:

- Keep alerts concise.
- Put the alert before the action it qualifies.
- Do not place alerts back to back.
- Avoid more than one alert in a section.
- Do not put a long procedure or large list in an alert.
- Do not use an alert for information that belongs in the normal paragraph.
- Do not use alert styling as decoration.
- Do not rely on the alert color or icon to communicate meaning.

Create a heading and normal section when the content needs more than a short
paragraph.
