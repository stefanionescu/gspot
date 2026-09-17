---
layer: prose
preset: prose
title: Documentation Format
---

# Documentation Format

Portable Markdown, page structure, text formatting, lists, tables, and alerts. The formatter and
markdownlint own mechanical layout; these rules say what to write.

## Use portable Markdown

Use CommonMark and GitHub Flavored Markdown as the portable baseline unless the `unenforced`
project renderer defines a different supported subset.

Prefer Markdown over HTML because Markdown is:

- Easier to review. `unenforced`
- Easier to search. `unenforced`
- More portable across repository hosts. `unenforced`
- More likely to remain accessible. `unenforced`
- Less likely to break with site-wide styling changes. `unenforced`

Use HTML only when:

- Standard Markdown cannot express the required semantic element. `enforced-by: prose/vale gspot.interface-verbs`
- The project renderer supports the element. `unenforced`
- The element remains responsive and accessible. `unenforced`
- The source stays readable. `unenforced`
- The use has a clear maintenance owner. `unenforced`

Do not add custom CSS or layout HTML to routine Markdown pages. `unenforced`

### Source line length

Wrap prose at the line length the project sets. `unenforced`

Do not split:

- Markdown links across source lines. `unenforced`
- Inline code spans. `unenforced`
- Product names. `unenforced`
- Commands. `unenforced`
- Values that readers need to copy as one unit. `unenforced`
- Logical phrases when the split makes the source harder to read. `unenforced`

Long URLs, tables, and code can exceed the prose target.

Do not insert manual line breaks merely to create visual spacing in rendered `unenforced`
text. Use separate paragraphs.

### Markdown comments

Use HTML comments for author-only maintenance notes:

```html
<!-- This table is generated from the public schema. Update the schema source. -->
```

Comments must explain maintenance requirements, generation ownership, or a
non-obvious source constraint.

Do not:

- Hide obsolete documentation in comments. `unenforced`
- Store drafts in published pages. `unenforced`
- Add change history. `enforced-by: prose/vale gspot.present-state`
- Leave reviewer conversations in source. `unenforced`
- Comment out broken links instead of fixing or removing them. `enforced-by: docs/links`

Delete obsolete content. Git already preserves history. `enforced-by: prose/vale gspot.present-state`

### Platform extensions

Shortcodes, Liquid tags, custom alerts, tab components, cards, and generated
macros are acceptable only when the documentation platform owns and tests them.

For each extension:

- Confirm it renders in every supported documentation surface. `unenforced`
- Provide a useful fallback when a secondary renderer does not support it. `unenforced`
- Keep essential meaning in text. `unenforced`
- Avoid nesting components unless the platform documents that combination. `unenforced`
- Do not use a component only for visual decoration. `enforced-by: prose/vale gspot.symbols`

### Interactive documentation components

Use tabs only for parallel alternatives such as operating systems, package `unenforced`
managers, deployment methods, or version ranges.

For tabs:

- Give every tab a short, parallel title. `unenforced`
- Use the same tab order across pages. `unenforced`
- Make each tab's procedure complete. `unenforced`
- Do not put headings, other tabs, or essential cross-tab instructions inside
  a tab unless the renderer explicitly supports them. `unenforced`
- Do not link directly to one tab unless the platform guarantees a durable
  target. `unenforced`
- Confirm that unsupported renderers show a usable linear fallback. `unenforced`

Use collapsible panels only for optional secondary detail. Do not hide:

- Required prerequisites. `unenforced`
- Safety warnings. `unenforced`
- Procedure steps. `unenforced`
- Error recovery. `unenforced`
- Accessibility information. `unenforced`

Use cards only on landing pages where the primary job is routing readers to a `unenforced`
small set of destinations. Every card needs descriptive link text and a useful
fallback list.

Use glossary tooltips only for the first important occurrence of a specialized `unenforced`
term. Keep the definition to one short sentence. Use a glossary page for longer
definitions.

Do not overload a page with interactive components. Every interaction adds `unenforced`
navigation work and a new rendering failure mode.

## Structure pages predictably

Readers learn a documentation set faster when similar pages use similar
structures.

### Titles and H1 headings

Every standalone page needs one clear title. `unenforced`

For repository Markdown:

```markdown
# Configure Private Networking
```

Use exactly one H1. Title case capitalizes the first word, the last word, and every major word; `enforced-by: prose/vale gspot.headings`
minor words stay lowercase unless first or last: articles (`a`, `an`, `the`), coordinating
conjunctions (`and`, `but`, `for`, `nor`, `or`, `so`, `yet`), and short prepositions (`as`, `at`,
`by`, `for`, `from`, `in`, `of`, `on`, `per`, `to`, `via`, `with`). `enforced-by: prose/vale gspot.headings`

If the publishing system generates the H1 from front matter, put the title in
front matter and do not add a second H1 in the Markdown body.

Titles must:

- Describe the page outcome or subject. `unenforced`
- Use title case. `enforced-by: prose/vale gspot.headings`
- Include the distinguishing term readers search for. `unenforced`
- Avoid unexplained acronyms. `enforced-by: prose/vale gspot.acronyms`
- Avoid decorative punctuation. `enforced-by: prose/vale gspot.dashes`
- Avoid links. `unenforced`
- Remain stable enough to support durable anchors. `enforced-by: docs/links`

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

Use front matter only when the documentation platform defines it. `unenforced`

Rules:

- Include only supported fields. `unenforced`
- Use valid YAML or the platform's required format. `unenforced`
- Keep the title consistent with navigation and on-page content. `unenforced`
- Do not add an H1 when the platform renders the front-matter title as H1. `unenforced`
- Use stable identifiers for generated navigation. `unenforced`
- Quote values when punctuation or type inference could change their meaning. `enforced-by: prose/vale gspot.modals`
- Do not store secrets or internal publishing credentials in metadata. `enforced-by: secrets/gitleaks`
- Remove obsolete fields instead of leaving empty values. `unenforced`

Example:

```yaml
---
title: Configure Private Networking
description: Route service traffic through private network endpoints.
---
```

### Navigation labels and short titles

When the publishing system uses separate navigation labels:

- Keep the label shorter than the page title. `unenforced`
- Use the base form of an action verb. `unenforced`
- Reuse words from the full title. `unenforced`
- Omit repeated product context only when the navigation hierarchy supplies it. `unenforced`
- Keep sibling labels parallel. `unenforced`
- Do not introduce a new term that the page title never uses. `unenforced`

Use:

```text
Configure notifications
```

### Introductions

The introduction orients the reader in one or two short paragraphs.

State:

- What the subject is. `unenforced`
- Why the reader would use it. `enforced-by: prose/vale gspot.modals`
- Any immediate scope or limitation. `unenforced`

Do not restate the title in a full sentence. `unenforced`

Use:

```text
Private networking keeps service traffic off the public internet. Configure it
before deploying workloads that require internal-only access.
```

### Heading hierarchy

- Start body sections at H2. `unenforced`
- Increment one heading level at a time. `enforced-by: prose/vale gspot.headings`
- Do not skip from H2 to H4. `unenforced`
- Avoid levels deeper than H4. Split the page when the hierarchy requires
  deeper nesting. `unenforced`
- Put introductory text between a heading and its first subheading. `unenforced`
- Make headings at the same level unique. `enforced-by: prose/vale gspot.headings`
- Keep headings short and descriptive. `unenforced`
- Use sentence case. `unenforced`
- Do not bold heading text. `unenforced`
- Do not put links in headings. `unenforced`
- Do not number headings unless the number is a stable part of the subject. `unenforced`

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

- The page has several H2 sections. `unenforced`
- Readers are likely to visit only one section. `unenforced`
- The rendered page requires substantial scrolling. `unenforced`
- The page acts as a reference. `unenforced`

Do not add a contents section to a short page. `unenforced`

Use an unordered list in document order. Include important H3 sections only `unenforced`
when they help readers choose a path.

```markdown
## Contents

- [Prerequisites](#prerequisites)
- [Configure the service](#configure-the-service)
- [Troubleshoot startup](#troubleshoot-startup)
```

Keep every anchor accurate when headings change. `enforced-by: docs/links`

Do not place a sectional contents list directly below a heading without a `unenforced`
sentence explaining how to choose among the sections.

### Section order

Use a predictable order for task-oriented pages:

1. Context. `unenforced`
1. Permissions or availability. `unenforced`
1. Prerequisites. `unenforced`
1. Procedure. `unenforced`
1. Expected result. `unenforced`
1. Troubleshooting. `unenforced`
1. Next steps or related topics. `unenforced`

Use a predictable order for reference pages:

1. Scope. `unenforced`
1. Contract summary. `unenforced`
1. Syntax or schema. `unenforced`
1. Fields or options. `unenforced`
1. Examples. `unenforced`
1. Errors and limits. `unenforced`
1. Related topics. `unenforced`

### Paragraphs

Keep paragraphs focused. Two to four sentences is a useful default, not a hard `enforced-by: prose/vale gspot.paragraph-length`
limit.

Start a new paragraph when:

- The subject changes. `unenforced`
- The reader must switch from concept to action. `unenforced`
- A condition changes the applicable audience. `unenforced`
- A safety consequence needs visibility. `unenforced`

Do not use a one-sentence paragraph for every sentence. Excessive fragmentation `enforced-by: prose/vale gspot.paragraph-length`
makes related ideas harder to follow.

## Format text by meaning

Formatting communicates semantics. Do not use formatting only to make a page
look more interesting.

### Bold

Use bold for:

- Interactive user interface labels. `unenforced`
- A short term that must be visually located in a mixed UI instruction. `unenforced`
- Rare, brief emphasis when the sentence cannot be made clear through wording
  alone. `unenforced`

Do not use bold:

- As a substitute for headings. `unenforced`
- For every keyword. `unenforced`
- For whole sentences. `unenforced`
- As the only way to signal danger or required behavior. `unenforced`
- Inside code formatting. `unenforced`

Keep punctuation outside bold formatting unless the punctuation is part of the `enforced-by: prose/vale gspot.dashes`
exact user interface label.

```markdown
Select **Settings** > **Access control**.
```

### Italics

Avoid italics for emphasis. Italics are harder to scan in many sans-serif `unenforced`
interfaces and can reduce readability.

Use italics only for established editorial purposes, such as the title of a `unenforced`
published work, when the project style permits it.

### Inline code

Use inline code for:

- Commands and subcommands. `unenforced`
- Options and flags. `unenforced`
- File and directory names. `unenforced`
- Environment variables. `unenforced`
- Configuration keys and literal values. `unenforced`
- Function, method, type, and property names. `unenforced`
- HTTP methods and status codes. `unenforced`
- Short inputs and outputs. `unenforced`
- Branch and repository names. `unenforced`
- Exact error messages from terminals, logs, or APIs. `unenforced`
- HTML elements, including angle brackets. `unenforced`

```markdown
Set `LOG_LEVEL` to `debug`, then run `service start`.
```

Do not use inline code for product names or general technical concepts. `unenforced`

### Quotation marks

Use straight quotation marks. `unenforced`

Prefer code formatting for exact text that a reader enters or sees in a `enforced-by: prose/vale gspot.interface-verbs`
terminal.

Use quotation marks for non-interactive user interface text when the wording `unenforced`
must be reproduced exactly:

```text
The page displays "Deployment completed."
```

Do not put quotation marks around links, headings, or code-formatted text. `unenforced`

### Definition terms

Use a description list only when the renderer supports it consistently. `unenforced`
Otherwise, use a short list or a two-column table.

Do not simulate definitions with a long series of bold labels. `unenforced`

### Blockquotes

Use blockquotes only for quoted source material. `unenforced`

Do not use blockquotes as generic callout boxes. Use a supported alert or a `unenforced`
normal paragraph instead.

Keep quotations short, cite the source, and prefer paraphrasing when the exact `unenforced`
wording is not important.

### Badges

Each badge adds noise and external maintenance. Include a badge only when its state matters to the `unenforced`
typical README reader, the destination is useful, the badge remains accurate, and text elsewhere
does not communicate the information better. Do not use badges as decoration.

### Emoji and icons

Do not use emoji for decoration, status, warnings, or navigation. `enforced-by: prose/vale gspot.symbols`

Use a project-owned icon only when the icon appears in the interface and helps `enforced-by: prose/vale gspot.symbols`
the reader identify an otherwise unlabeled control.

When an icon has hover or accessible text:

```text
Select **Edit** (ICON).
```

Name the action first. Do not require the reader to interpret the icon's shape. `enforced-by: prose/vale gspot.symbols`

When an interface control has no accessible name, describe it literally and
report the interface accessibility problem through the project's normal issue
process.

## Use lists for scannable information

Use a list when readers need to scan several parallel items. `unenforced`

### Introduce the list

Use a complete introductory sentence followed by a colon:

```markdown
The service requires these values:

- Endpoint URL
- Access token
- Region
```

Avoid vague introductions such as "The following" when the subject can be `unenforced`
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

- Start every item with a capital letter. `unenforced`
- End complete sentences with periods. `unenforced`
- Do not add periods to fragments. `unenforced`
- Use the same punctuation pattern for every item. `enforced-by: prose/vale gspot.dashes`
- Do not end list items with commas or semicolons. `unenforced`

### Choose ordered or unordered lists

Use ordered lists when order matters:

- Procedures. `unenforced`
- Priority. `unenforced`
- Rank. `unenforced`
- Lifecycle stages. `unenforced`

Use unordered lists when order does not matter. `unenforced`

Order unordered items by:

1. Importance to the reader. `unenforced`
1. Typical workflow. `unenforced`
1. Logical grouping. `unenforced`
1. Alphabetical order when no other order adds meaning. `unenforced`

### Avoid sentence fragments that depend on the introduction

Use:

```markdown
You can obtain the token in two ways:

- Copy the token from the setup response.
- Create a token in **Access settings**.
```

The independent sentences translate more reliably.

### Nest lists carefully

Avoid more than two levels of nested lists. `unenforced`

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

- A reference section. `unenforced`
- A supported description list. `unenforced`
- A table with meaningful columns. `unenforced`
- Separate H3 headings for substantial topics. `unenforced`

Bold labels are acceptable for exact user interface labels, not as a default
content structure.

## Use tables only for real comparisons

Use a table when readers must compare values across two or more attributes. `unenforced`

Good table uses include:

- Configuration keys, defaults, and descriptions. `unenforced`
- Feature support across platforms. `unenforced`
- Roles and permissions. `unenforced`
- API fields, types, requirements, and meanings. `unenforced`
- Limits by plan or environment. `unenforced`

Use a list instead when each item has only one short description. `unenforced`

### Write accessible tables

- Provide a header for every column. `unenforced`
- Use sentence case for headers. `unenforced`
- Put a meaningful value in every cell. `unenforced`
- Use "None" or "Not applicable" instead of leaving cells blank. `unenforced`
- Avoid `N/A`, which can mean several things. `unenforced`
- Put the description column last. `unenforced`
- Keep cell content short. `unenforced`
- Explain abbreviations outside the table. `enforced-by: prose/vale gspot.acronyms`
- Use text in addition to symbols. `enforced-by: prose/vale gspot.symbols`
- Do not communicate status by color alone. `unenforced`
- Provide row-header markup when the publishing system supports it and the first
  column identifies each row. `unenforced`

### Keep tables narrow

Wide tables are difficult on small screens and for screen magnification.

Before adding a column, ask whether:

- The attribute is required for comparison. `unenforced`
- The value can move to a linked reference. `unenforced`
- The table is better as several smaller tables. `unenforced`
- A list would be clearer. `enforced-by: prose/vale gspot.modals`

Do not put paragraphs, large code blocks, or nested lists in table cells. `enforced-by: prose/vale gspot.paragraph-length`

### Use footnotes sparingly

Move information into the table or surrounding text first. `unenforced`

Use a footnote only when:

- The same qualification applies to several cells. `unenforced`
- Inline content would make the table unreadable. `enforced-by: prose/vale gspot.modals`
- The note is secondary but necessary. `unenforced`

Prefer Markdown-native footnotes when the renderer supports them:

```markdown
The legacy mode remains available.[^legacy]

[^legacy]: Legacy mode does not support encrypted backups.
```

Do not use footnotes for safety information or required steps. `unenforced`

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

Use the alert types supported by the project renderer. Do not assume every `unenforced`
renderer supports the same names.

Rules:

- Keep alerts concise. `unenforced`
- Put the alert before the action it qualifies. `unenforced`
- Do not place alerts back to back. `unenforced`
- Avoid more than one alert in a section. `unenforced`
- Do not put a long procedure or large list in an alert. `unenforced`
- Do not use an alert for information that belongs in the normal paragraph. `enforced-by: prose/vale gspot.paragraph-length`
- Do not use alert styling as decoration. `enforced-by: prose/vale gspot.symbols`
- Do not rely on the alert color or icon to communicate meaning. `enforced-by: prose/vale gspot.symbols`

Create a heading and normal section when the content needs more than a short
paragraph.
