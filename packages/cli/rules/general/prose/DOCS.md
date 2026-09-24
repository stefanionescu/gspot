---
layer: prose
configuration: prose
title: Documentation
---

# Documentation

The documentation rules span six files. This one covers scope, standard, ownership, readers, the
documentation set, topic types, and maintenance. Format covers Markdown, page structure, text
formatting, lists, tables, and alerts. Content covers code examples, procedures, and links; Media covers interfaces, keyboard input,
illustrations, and accessibility. Surfaces covers CLI, API,
library, configuration, architecture, contributor, troubleshooting, and releases. Review holds the
checklists and the definition of done.

## Authority and scope

Apply this file to documentation written for developers, operators, users,
reviewers, maintainers, security teams, and contributors.

The rules cover:

- Repository and subproject `README.md` files.
- Optional `ADVANCED.md` guides.
- Documentation under a dedicated documentation directory.
- `CONTRIBUTING.md`, `SECURITY.md`, and similar project guides.
- Architecture and decision documentation.
- Command-line interface, API, configuration, and library reference material.
- Tutorials, how-to guides, migration guides, and troubleshooting topics.
- Release notes, known issues, deprecations, and retirement notices.
- Markdown examples embedded in issues, pull requests, and templates when those
  examples are intended to become durable project guidance.
- Images, diagrams, video links, and other media used by documentation.

Project-specific documentation rules may add requirements for a static site
generator, front matter, shortcodes, link syntax, or generated references.
Those local requirements override portable formatting defaults only where the
renderer requires it.

The following requirements never become optional:

- Accuracy.
- Security.
- Accessibility.
- Clear ownership.
- Present-state descriptions.
- Honest limitations.
- Runnable or explicitly illustrative examples.

Do not copy a provider-specific shortcode, Liquid tag, HTML component, or
front-matter field into a different project unless that project supports it.

## Core documentation standard

Good project documentation lets a reader answer these questions without
inspecting implementation source:

1. What is this project or component?
1. What problem does it solve?
1. Is it suitable for the reader's need?
1. What does the reader need before using it?
1. How is it installed or accessed?
1. What does normal use look like?
1. What are its important limits and risks?
1. Where is the exact reference information?
1. How are common failures diagnosed?
1. How is the project licensed and maintained?

Documentation must be:

- Correct: It matches shipped behavior, accepted inputs, outputs, defaults,
  permissions, and supported environments.
- Useful: It helps a defined reader make a decision or complete a goal.
- Discoverable: Readers can find it from the README, navigation, search terms,
  or nearby related content.
- Scannable: Headings, short paragraphs, lists, and examples expose the page
  structure.
- Complete at its chosen level: A task includes every required step. A reference
  includes the full contract it claims to cover.
- Concise: Every sentence contributes new information.
- Honest: Limitations, destructive effects, prerequisites, and uncertainty are
  visible before they affect the reader.
- Maintainable: The content has a clear owner and does not duplicate volatile
  facts without a reason.
- Accessible: Text carries the essential meaning, and formatting does not
  exclude readers who use assistive technology.
- Secure: Examples never expose credentials, personal data, or unsafe defaults.
- Portable: Standard Markdown carries the core content unless the publishing
  system requires an extension.

Length is not a quality signal. A short page can be complete, and a long page
can still omit the one fact a reader needs. Make a document as short as possible
without removing information required for correct and safe use.

Documentation defines the supported public contract. If users must inspect the
implementation to learn routine usage, the abstraction is incomplete.

## Documentation as the single source of truth

Durable product information belongs in the documentation set. Do not leave the
only explanation in:

- A pull request description.
- An issue comment.
- A chat thread.
- A commit message.
- A code review discussion.
- A private document.
- A maintainer's memory.

When a recurring question has no documented answer:

1. Identify the canonical page that owns the answer.
1. Add the missing information to that page.
1. Link to the page when answering the question elsewhere.

Prefer linking to canonical documentation over repeatedly paraphrasing it in
support conversations. Repeated paraphrases drift and create competing
contracts.

Single source of truth does not mean that every sentence may appear only once.
Small, intentional duplication can help readers complete a task without jumping
between pages. Duplicate information only when all of these conditions hold:

- The repeated fact is necessary in both contexts.
- One location remains the canonical owner.
- The duplicate is short.
- The maintenance cost is understood.
- A change to the fact has an obvious way to find every copy.

Do not duplicate large procedures, configuration tables, or API contracts.
Link to the owner instead.

Keep source and documentation changes together when behavior changes. A feature
is not complete when its public behavior changes but its documentation still
describes the previous behavior.

## Write for a defined reader

Before writing, identify:

- The intended reader.
- The reader's goal.
- The knowledge the reader is expected to have.
- The environment the reader is using.
- The role or permissions the reader needs.
- The consequences if the reader follows the instructions incorrectly.
- The next question the reader is likely to ask.

Write for the least specialized reader who can reasonably complete the task.
Do not assume every reader knows internal project vocabulary, deployment
architecture, framework conventions, or organizational history.

Use progressive disclosure:

- Give all readers the broad purpose and normal path first.
- Give active users setup and routine tasks next.
- Give specialists internals, tuning, rare operations, and edge cases later.

Focus on reader outcomes, not implementation effort.

Use:

```text
Use branch protection to require approval before changes reach the default
branch.
```

Address the reader as "you" in task-oriented documentation. Use a named role
when permissions or responsibility matter.

Use:

```text
Project maintainers can rotate the signing key.
```

The second example is inaccurate if most readers lack the required role.

## Organize the documentation set

Give each kind of information a clear owner.

| Document                   | Primary purpose                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Root README                | Explain the whole repository, provide the shortest successful path, and route readers to owned subprojects. |
| Subproject README          | Explain one independently usable component, its normal setup, common commands, and routine operation.       |
| Advanced guide             | Hold substantial specialist material that obstructs the normal README path.                                 |
| Contributor guide          | Explain contribution setup, review expectations, development workflow, and contribution policy.             |
| Architecture guide         | Explain system boundaries, ownership, data flow, important constraints, and architectural reasoning.        |
| API reference              | Define endpoints, authentication, requests, responses, errors, limits, and examples.                        |
| CLI reference              | Define commands, arguments, options, output, exit status, and examples.                                     |
| Configuration reference    | Define keys, types, defaults, allowed values, scope, precedence, and restart requirements.                  |
| Troubleshooting guide      | Map observable symptoms to diagnosis, cause, resolution, and recovery.                                      |
| Security policy            | Define supported versions, private reporting channels, response expectations, and disclosure policy.        |
| Changelog or release notes | Record user-visible changes by release.                                                                     |
| License                    | State the legal terms for use and distribution.                                                             |

Do not use `ADVANCED.md` as a substitute for:

- A complete API reference.
- A contributor guide.
- A security policy.
- A changelog.
- A collection of architectural decisions.
- Generated reference documentation.

Create subproject documentation at real ownership boundaries. Do not add a
README to every directory. A directory README is justified when the directory
represents an independently operated component, has a distinct workflow, or
needs orientation that cannot remain clear in the parent guide.

Avoid navigation chains that force a reader through several index pages before
reaching useful content. A link moves the reader closer to the goal.

Use standard repository filenames with their established capitalization:

- `README.md`
- `ADVANCED.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `LICENSE`

Do not create variants such as `ReadMe.md` or `advanced-guide.md` when the
standard name already describes the document's role.

Keep discovery metadata consistent with the documentation:

- Repository description.
- Package or module description.
- Package-manager keywords.
- Repository topics.
- Published documentation title and summary.

Use the README one-liner as the source for these short descriptions when the
platform limits permit it. Do not add unrelated popular keywords to attract
traffic.

## Split a README and an advanced guide deliberately

The default structure for a substantial project or subproject is:

- `README.md` for evaluation, first success, routine use, essential caveats, and
  navigation.
- `ADVANCED.md` only when specialist material is large enough to disrupt that
  path.

The split is a tool, not a quota. Small components need only a focused README.

### What belongs in the README

The README is the primary entry point. A reader does not need the advanced
guide to decide whether the project fits, install it, complete the first useful
action, or understand normal operation.

Include, when relevant:

- Project or component name.
- One-sentence purpose.
- Essential context and unfamiliar terminology.
- Current status when it materially affects adoption.
- Important compatibility, security, or data-loss caveats.
- A small, runnable usage example.
- Prerequisites.
- Installation or setup.
- Normal configuration.
- The commands used most often.
- A concise architecture or data-flow overview.
- Routine testing and development commands when the README serves contributors.
- Common failures and their direct fixes.
- Links to deeper references.
- License and contribution information.

Keep exhaustive internals out of the opening path.

### Never add sections that list the tree

Project layout sections are prohibited in every README, advanced guide,
contributor guide, architecture guide, and other project documentation file.
Do not add or preserve a section whose purpose is to inventory the repository's
directories or files.

This prohibition includes:

- Project layout or repository layout sections.
- Directory structure or source tree sections.
- File maps and codebase maps.
- Tables that pair directories with purposes, ownership, or descriptions.
- Lists or diagrams that walk readers through the repository hierarchy.
- Renamed equivalents that provide the same directory inventory.

Do not add a project layout section even when the repository is large, the
directory boundaries seem durable, or an older document already contains one.
Remove an existing layout section instead of revising or preserving it.

Document behavior, workflows, commands, architecture concepts, and ownership
boundaries without cataloging the source tree. Mention a path inline only when
the reader must open, edit, or run that specific path to complete the documented
task.

### What belongs in an advanced guide

Create `ADVANCED.md` for coherent, substantial material such as:

- Detailed architecture and ownership boundaries.
- Internal orchestration and lifecycle behavior.
- Performance, scaling, caching, or concurrency details.
- Rare configuration combinations.
- Environment and runtime tuning.
- Complex deployment and recovery workflows.
- Deep troubleshooting and diagnostic trees.
- Provider-specific integration details.
- Full test-suite strategy when the routine commands already live in the
  README.
- Operational behavior needed by maintainers but not by most users.

An advanced guide may assume the reader understands the README. It must not
assume undocumented prerequisites.

### When to create the split

Create an advanced guide when at least one of these conditions is true:

- Three or more substantial specialist sections interrupt the normal README
  path.
- One specialist workflow is long enough that readers must scroll past it to
  reach routine setup or usage.
- The component has distinct beginner and operator or maintainer audiences.
- Detailed internals are valuable but unnecessary for safe normal use.
- The README cannot remain a quick evaluation and onboarding document without
  hiding important specialist depth.

Keep everything in the README when:

- The total content remains easy to scan.
- Advanced material is only one short section.
- Splitting creates two thin pages.
- Readers need to switch pages during the basic setup path.
- The same information has to be repeated in both files.

If a README becomes long, fix its structure before splitting it. Remove
repetition, move true reference material to its owner, shorten oversized
examples, and group related sections. Split only when the remaining advanced
content has a coherent audience and purpose.

### Content placement matrix

| Information                   |      README       |    Advanced guide     | Different owner                              |
| ----------------------------- | :---------------: | :-------------------: | -------------------------------------------- |
| One-line purpose              |        Yes        |          No           | None                                         |
| Minimal runnable example      |        Yes        |          No           | Example file may also own runnable code      |
| Basic prerequisites and setup |        Yes        |          No           | None                                         |
| Routine commands              |        Yes        |   Optional summary    | CLI reference for exhaustive options         |
| Essential limitations         |        Yes        | More detail if useful | None                                         |
| Architecture overview         |        Yes        |    Detailed model     | Architecture guide for large systems         |
| Rare tuning options           |  Short link only  |          Yes          | Configuration reference if exhaustive        |
| Destructive recovery          | Warning and route |    Full procedure     | Operations runbook when access is restricted |
| Public API overview           |        Yes        |  Optional internals   | API reference owns the contract              |
| Contribution workflow         |    Short route    |          No           | Contributor guide                            |
| Version history               |        No         |          No           | Changelog or release notes                   |
| Security reporting            |    Short route    |          No           | Security policy                              |

### Link the two guides

Add one clearly named advanced-guide link in the README near the point where
normal use ends and specialist material begins. Describe what the reader will
find there.

Use:

```markdown
## Advanced guide

See [the advanced guide](ADVANCED.md) for runtime tuning, deployment recovery,
and detailed architecture.
```

Avoid a bare link named "More" or "Click here."

At the top of the advanced guide, state its audience, and relationship to the
README. Do not repeat the README introduction, setup procedure, or routine
command list.

### Keep the advanced guide coherent

An advanced guide is not a junk drawer. Every section must support the same
specialist audience.

Move content elsewhere when it has a different owner:

- Put contribution policy in a contributor guide.
- Put exact endpoint schemas in API reference documentation.
- Put historical changes in release notes.
- Put isolated design decisions in decision records.
- Put incident-only commands in a restricted runbook when publishing them is unsafe.

Delete the advanced guide and merge its unique material back into the README if
the guide becomes small or stops serving a distinct audience.

## Use cognitive funneling

Order information from broad and widely relevant to narrow and specialized.
This structure helps readers decide quickly whether to continue.

The first screen of a README answers:

- What is this?
- Who is it for?
- What problem does it solve?
- What does a normal use look like?
- Is there a limitation that immediately disqualifies it?

A practical README order is:

1. Name.
1. One-sentence purpose.
1. Essential status or caveat.
1. Minimal example or result.
1. Key capabilities.
1. Prerequisites.
1. Setup.
1. Normal usage.
1. Configuration.
1. Architecture overview.
1. Common problems.
1. Deeper documentation.
1. Contribution and license.

Change the order when reader risk demands it. Put an incompatible license,
unsupported status, destructive default, security limitation, or platform
restriction near the top if it can immediately rule out use.

Do not optimize the README to maximize adoption. Optimize it to help the right
reader decide quickly and the wrong reader leave confidently.

Readers gain progressively deeper knowledge as they continue. Do not
open with implementation internals, a complete option table, or a long project
history before explaining the purpose.

## Choose the correct topic type

Different reader goals need different structures. Identify the topic type
before writing.

### Concept

A concept topic explains what something is, why it exists, how major parts
relate, and which constraints shape it.

Use concept topics for:

- Architecture.
- Ownership.
- Data flow.
- Security models.
- Lifecycle models.
- Important domain terminology.

Do not hide required procedural steps inside a concept narrative.

### Task

A task topic helps a reader complete one concrete goal.

A task includes:

- Outcome-focused title.
- Required permissions and prerequisites.
- Ordered actions.
- Expected result.
- Verification or recovery information when the task carries risk.
- Relevant next step.

Use one task for one primary outcome. Split unrelated outcomes.

### Reference

A reference topic provides exact facts for lookup.

Use reference topics for:

- API endpoints.
- CLI commands.
- Configuration keys.
- Events.
- Error codes.
- File formats.
- Supported values.

Reference content favors completeness, consistent field order, tables for real
matrices, and small examples. It never requires narrative reading to find a
single value.

### Tutorial

A tutorial teaches through a guided, end-to-end result.

A tutorial includes:

- A visible final outcome.
- A controlled starting state.
- Complete steps.
- Enough explanation to teach the important model.
- A cleanup path for created resources.

Keep unusual variants out of the main tutorial. Route them to reference or
advanced documentation.

### Troubleshooting topic

A troubleshooting topic starts from an observable symptom.

Use this order:

1. Symptom.
1. Conditions in which it appears.
1. Diagnostic check.
1. Likely cause.
1. Resolution.
1. Recovery or rollback.
1. Escalation information if the problem remains.

Do not title troubleshooting sections only with internal causes. Readers search
for the message or behavior they can observe.

### Landing page

A landing page routes distinct audiences or goals. Keep it short.

Use:

- A one-paragraph orientation.
- A small number of descriptive links.
- Categories based on reader goals.

Do not turn a landing page into a duplicate guide.

### Release note

A release note tells an affected reader what changed, what the effect is, and
whether action is required.

Release notes are not implementation summaries. See
[Document releases and lifecycle changes](DOCS-SURFACES.md#document-releases-and-lifecycle-changes).

### Combining topic types

A README can contain several topic types because it is an entry document.
Keep each section internally consistent. A setup section reads as a task,
an options section as reference, and an architecture section as a concept.

Do not alternate between narrative, steps, and reference fields without clear
headings.

## Plan documentation before writing

For non-trivial documentation work:

1. Inspect the implementation, configuration, user interface, and existing
   documentation that define the behavior.
1. Identify the reader and primary goal.
1. Find the current owner for the topic.
1. Decide whether to update an existing page or create a new page.
1. Select the topic type.
1. List the claims that require evidence.
1. Identify security, permission, compatibility, and data-loss caveats.
1. Choose the smallest example that proves normal use.
1. Outline sections in cognitive-funnel order.
1. Identify links, images, and examples that need maintenance ownership.

Do not create a new page for one paragraph that belongs naturally on an
existing page.

Do not begin by copying source comments, tickets, or implementation notes.
Translate verified behavior into a reader-focused explanation.

A documentation plan follows the same rules as a code plan. Include the exact
text diff when the user asks for a plan rather than implementation.

## Maintain documentation continuously

Documentation evolves with the product.

### Update documentation in the same change

Review documentation whenever a change affects:

- Public behavior.
- Setup.
- Configuration.
- Commands.
- API contracts.
- User interface labels or navigation.
- Permissions.
- Supported versions.
- Error messages.
- Architecture boundaries.
- Operational procedures.
- Screenshots or diagrams.

Do not defer a required documentation update as optional cleanup.

### Keep comments and guides aligned

When public behavior changes:

- Update the reader-facing guide.
- Update public code comments.
- Update API or generated reference.
- Update examples.
- Update troubleshooting.
- Update diagrams.

Do not describe the same behavior differently at each layer.

### Delete stale content

Remove documentation that does not apply.

Do not:

- Comment it out.
- Mark it "old" indefinitely.
- Keep obsolete commands for historical interest.
- Preserve screenshots that show a removed interface.

Use release notes, migrations, or versioned documentation when readers still
need an older-version path.

### Maintain external links

Prefer stable authoritative sources. Replace or remove:

- Redirect chains.
- Archived unofficial copies.
- Links to branch line numbers.
- Private destinations.
- Pages that do not support the claim.

Do not inline all external information to avoid link rot. Copying creates a
different form of drift. Keep essential project instructions local and link to
authoritative external contracts.

### Maintain duplicated facts

When a fact changes, search for:

- The exact old value.
- The configuration key.
- The command.
- The error code.
- The feature name.
- Known synonyms.

Update every intentional duplicate or replace duplicates with a link to the
owner.

### Maintain visuals

Treat screenshots and diagrams as documentation source.

Refresh them when:

- Labels change.
- Layout changes enough to confuse a task.
- The highlighted control moves.
- The architecture changes.
- The theme makes the image illegible.
- Example data does not match the text.

Do not delete shared image assets until all versioned and localized pages have
stopped referencing them.

### Preserve localization quality

When changing translated documentation:

- Update the source language first.
- Follow the project's translation ownership workflow.
- Do not use machine translation as final copy without review.
- Do not embed text in images when the text carries essential meaning.
- Allow user interface strings room to expand in translated products.

### Automate durable checks

Repositories automate:

- Markdown syntax and style.
- Broken internal links.
- Broken image references.
- Spelling and terminology.
- Generated reference drift.
- Runnable examples.
- Front-matter schemas.
- Accessibility rules that tools can detect.

Automation does not prove factual accuracy or usability. Human review remains
required.

Agents must follow the current repository rule on whether verification commands
are authorized. The subject here is project design, not permission to run
checks.
