---
title: Documentation Content
---

# Documentation Content

Code examples, procedures, and links. The Markdown linter reports a fence without a language,
a missing blank line around a fence, and ordered-list numbering. The link checks report a
broken destination and a stale repository path. The prose checker reports "here" and "click
here" as link text and the weak modal in a step. This file holds the decisions those tools
cannot judge.

## Code examples

Examples are part of the contract and are treated like production-facing code. A runnable
example uses valid syntax and supported APIs, includes its imports and surrounding structure,
and defines every non-obvious value. It hides no setup, uses safe example data, produces the
described result, and has no ellipsis that invalidates a copy. An intentionally incomplete
example is labeled a fragment with a note of what is omitted.

The README keeps its minimal usage example small enough to read at a glance. A complete
runnable copy lives in an example source file, and the README version is kept in sync with
it. Repositories validate important examples automatically where the example can run.
Volatile output is not pinned unless the exact output is part of the public contract.

Multi-line commands, source, configuration, input, and output go in fenced blocks with a
supported language. `plaintext` serves when nothing more specific applies, and four backticks
wrap a Markdown example that itself contains fences. Lines stay within the project's line
length where the language permits, without distorting idiomatic syntax to get there. The
explanation comes before the block. A comment inside the example exists only when a reader
keeps it in the code.

Command blocks carry no prompt. Output goes in a separate labeled block. When a project
convention keeps output in the shell block, every output line is a comment so the block stays
safe to copy:

````markdown
Run the commands from the repository root:

```shell
tool inspect
```

Example output:

```text
Status: ready
```
````

State the working directory once before the first block rather than through a prompt path
or repeated `cd` commands. Placeholders are uppercase in angle brackets, explained after the
block, one style per page, and never formatted as a value a reader can run unchanged:

```shell
tool deploy --project <PROJECT_ID>
```

A configuration fragment includes the parent keys that place the change. An API example shows
the import, construction, or request context a reader needs to run it.

### Example scope

<!-- level: all -->

One example teaches one idea. Authentication, error handling, pagination, retry behavior, and
advanced configuration stay out of the minimal first-use example unless a valid call needs
them. Each variant gets its own focused example after the normal path.

### Secure and destructive examples

Examples use secure defaults: encrypted endpoints, certificate validation left on, no
world-writable permissions, and no wildcard access unless the example is about public access.
They use least-privilege roles, pin third-party automation per the project's security policy,
and log or commit no secrets. Insecure behavior needed for an isolated local demonstration is
labeled with its scope and why it must not reach a shared environment.

A destructive command carries its warning before the command. That covers a command that
deletes data, rewrites history, drops a database, rotates a key, revokes access, replaces
remote state, or deploys to production. The warning says what changes, what cannot be
recovered, which scope is affected, and what backup or confirmation is required.

## Procedures

A procedure is a sequence of actions a reader can complete, not a narrative of what an
author once did. Prerequisites come first and in full: required role or access, software and
supported version, starting state, credentials without their values, backups, and platform
or deployment limits. Sequential work is an ordered list with every item numbered `1.` so
edits need no renumbering, and every step contains an action.

A condition comes before its action, so the reader can skip the step before reading it: "If
the deployment uses a private registry, add the registry credentials." State the expected
result when success is not obvious: "The status changes to `Ready`." Omit empty confirmations
such as "for the changes to take effect" unless the action really triggers a delayed apply,
restart, or reload.

### Step shape

<!-- level: all -->

A step holds one main action. It may carry, in this order, an optional or recommended label,
a reason, a location, the action, and the expected result. It never holds several
independent actions in one paragraph. Optional and recommended steps start with that label
rather than a weak modal that leaves the reader guessing:

```markdown
1. Optional. Add a description for the environment.
1. Recommended. Create a backup before applying the migration.
```

### Alternatives and risky tasks

Platforms or installation methods with different procedures get separate H3 sections or
accessible tabs. Names and order stay consistent across pages, each path has a complete
procedure, and platform branches are never interleaved inside each step. A risky operational
task names its backup or snapshot requirement, its point of no return, its success signal,
its failure signal, its rollback or recovery path, and its escalation condition. It never claims a rollback that
is not verified.

## Links

Every link helps the reader understand or complete the current goal. The reader must follow
it, it gives important context, it is the logical next step, and its destination has a stable
owner. Decorative and low-value links go. Optional background links move to a related topics
section when they interrupt a procedure. Link text is the destination title or a concise
description that makes sense out of context for screen-reader navigation, never a raw URL.
Links carry no inner punctuation beyond the destination title, no bold or italic, no heading
placement, and no line break inside the text or destination.

```markdown
For configuration precedence, see [configuration sources](configuration.md).
```

### Link conventions

<!-- level: all -->

Inline links replace reference-style definitions unless the project has a reason. One
destination is linked once per page. A repeat is allowed only when a distant task on a long
page cannot be completed without it.

### Link destinations

Pages and assets in the same repository use relative links, which survive forks and host
changes. They follow the path rules of the site generator where one resolves pages
differently. An external link exists when the source is authoritative, when a copy goes
stale, or when the reader needs a standard, provider contract, license, or maintained tool
reference. It points at the most specific page that supports the statement, never a product
home page because the product is mentioned, and it names the destination and its owner.

Exact lines in a hosted repository are linked by commit permalink, whole current files by
branch. A cross-version link names the destination version in the sentence, prefers the same
topic, and explains why the reader needs it. It never substitutes for maintaining the current
page.

A call to action asks the reader to leave the page for the next meaningful step. It appears
only when the reader has reached that step and the destination directly helps the goal. The
destination is trusted and named, and an inline link understates the importance of the step.
Its text is an action ("Create a repository"), and it never disguises an advertisement as a
task step.

A heading is a published anchor. Before changing one, search the repository for links to the
old anchor, update every owned link, and consider external bookmarks. Preserve the old anchor
only when the publishing system treats it as a compatibility contract through an approved
mechanism. Headings carry no step numbers or volatile version labels without need.

Links do not lead to confidential issues, private dashboards, internal-only documentation, or
pages that need an unstated role. When restricted content is essential, the access
requirement precedes the link. A raw internal URL is formatted as code so automated link
checks skip it. Public documentation never depends on a private destination for essential
instructions.
