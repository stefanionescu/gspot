---
layer: prose
preset: prose
title: Documentation Content
---

# Documentation Content

Code examples, procedures, and links.

## Write useful code examples

Examples are part of the contract. Treat them like production-facing code.

### Make examples runnable

A runnable example must:

- Use valid syntax. `unenforced`
- Include required imports or surrounding structure. `unenforced`
- Define every non-obvious value. `unenforced`
- Use supported APIs. `unenforced`
- Avoid hidden setup. `unenforced`
- Use safe example data. `unenforced`
- Produce the described result. `unenforced`
- Avoid ellipses that make a copied example invalid. `unenforced`

If an example is intentionally incomplete, label it as a fragment and explain
what has been omitted.

Keep the minimal usage example in the README small enough to understand at a `unenforced`
glance. Put a complete runnable copy in an example source file,
then keep the README version synchronized with it.

### Use fenced code blocks

Put multi-line commands, source, configuration, input, and output in fenced code `enforced-by: markdown/markdownlint MD040`
blocks.

Always specify a supported language:

````markdown
```swift
let message = "Hello"
```
````

Use `plaintext` when no more specific language applies. `unenforced`

Leave one blank line before and after every code block.

Use four backticks for an outer Markdown example that contains triple-backtick `enforced-by: markdown/markdownlint MD040`
code fences.

### Keep code blocks readable

Aim for code lines within the line length the project sets, when the language permits.
Avoid horizontal scrolling.

Do not distort idiomatic or valid syntax solely to meet a line target. `enforced-by: prose/vale gspot.idioms`

Put explanations before the block. Use comments inside the example only when a `unenforced`
comment is part of the code a reader keeps.

### Do not include command prompts

Use:

```shell
git status
```

Prompts interfere with copy and paste.

### Separate commands from output

When output matters, label it and place it in a separate block:

Run:

```shell
tool inspect
```

Example output:

```text
Status: ready
```

If a project convention keeps output in the same shell block, comment every
output line so the command remains safe to copy:

```shell
tool inspect
# Status: ready
```

### Explain the working directory

State where commands run before the first block:

```text
Run the commands from the repository root:
```

Do not rely on a prompt path that readers cannot copy. `unenforced`

Avoid repeated `cd` commands when one working-directory statement is clearer. `unenforced`

### Use consistent placeholders

Use uppercase angle-bracket placeholders:

```shell
tool deploy --project <PROJECT_ID> --token <ACCESS_TOKEN>
```

Explain the values:

```text
Replace `<PROJECT_ID>` with the project identifier and `<ACCESS_TOKEN>` with a
token that has deployment access.
```

Do not mix placeholder styles such as `YOUR_PROJECT`, `{project}`, and `enforced-by: prose/vale gspot.placeholders`
`project-name` on one page.

Do not format a placeholder as a value a reader can run unchanged. `enforced-by: prose/vale gspot.modals`

### Show enough context

For a configuration fragment, include the parent keys needed to place the
change correctly.

Use:

```yaml
service:
  logging:
    level: debug
```

For an API or library example, show the import, object construction, or request
context when a reader needs it to run the snippet.

### Keep examples focused

One example teaches one primary idea. `unenforced`

Do not combine:

- Authentication setup. `unenforced`
- Error handling. `unenforced`
- Pagination. `unenforced`
- Retry behavior. `unenforced`
- Advanced configuration. `unenforced`

into a minimal first-use example unless all are required for a valid call.

Add focused examples for variants after the normal path. `unenforced`

### Use secure defaults

Examples must:

- Use encrypted network endpoints where supported. `unenforced`
- Avoid disabling certificate validation. `unenforced`
- Avoid world-writable permissions. `unenforced`
- Avoid wildcard access unless the example is explicitly about public access. `unenforced`
- Use least-privilege roles. `unenforced`
- Pin third-party automation dependencies according to project security policy. `unenforced`
- Avoid logging secrets. `enforced-by: secrets/gitleaks`
- Avoid committing local secret files. `enforced-by: secrets/gitleaks`

If insecure behavior is required for an isolated local demonstration, label the
scope and explain why it must not reach a shared environment.

### Show destructive effects before commands

Place the warning before a command that:

- Deletes data. `unenforced`
- Rewrites history. `enforced-by: prose/vale gspot.present-state`
- Drops a database. `unenforced`
- Rotates a key. `unenforced`
- Revokes access. `unenforced`
- Replaces remote state. `unenforced`
- Performs a production deployment. `unenforced`

Explain:

- What changes. `unenforced`
- What cannot be recovered. `unenforced`
- Which scope is affected. `unenforced`
- What backup or confirmation is required. `unenforced`

Do not rely on a warning after the command. `unenforced`

### Keep examples current

Prefer examples that can be exercised by automated documentation checks or by a `unenforced`
normal project workflow.

Repositories validate important examples in the gate where the example can run.

Do not pin volatile output unless the exact output is part of the public `unenforced`
contract.

## Write procedures that people can complete

Procedures must describe a sequence of actions, not a narrative of what an
author once did.

### Put prerequisites before steps

List:

- Required role or access. `unenforced`
- Required software and supported version. `unenforced`
- Required starting state. `unenforced`
- Required credentials without exposing them. `enforced-by: secrets/gitleaks`
- Required backups. `unenforced`
- Platform or deployment limitations. `unenforced`

Do not reveal a prerequisite halfway through the procedure. `unenforced`

### Use ordered lists

Use an ordered list for sequential work. Start every item with `1.` so changes `unenforced`
do not require renumbering source:

```markdown
1. Open the project.
1. Select **Settings**.
1. Set **Visibility** to **Private**.
1. Select **Save**.
```

Each step must contain an action. `unenforced`

### Keep one main action per step

A step can include a reason, location, action, and expected result, but it
never contains several independent actions hidden in a paragraph.

Use this order when each part is needed:

1. Optional or recommended status. `unenforced`
1. Reason or consequence. `unenforced`
1. Location. `unenforced`
1. Action. `unenforced`
1. Expected result. `unenforced`

Example:

```text
Optional. To retain the current settings, export the configuration before you
select **Reset**.
```

### Mark optional and recommended steps

Start the step with a clear label:

```markdown
1. Optional. Add a description for the environment.
1. Recommended. Create a backup before applying the migration.
```

Do not use `should` to make the reader guess whether the step is required. `enforced-by: prose/vale gspot.modals`

### Put conditions before actions

Use:

```text
If the deployment uses a private registry, add the registry credentials.
```

The first form helps readers decide whether to skip the step before reading the
action.

### Describe expected results

State a result when the interface, command, or process does not make success `unenforced`
obvious.

```text
The status changes to `Ready`.
```

Do not add empty confirmation phrases such as "for the changes to take effect" `unenforced`
unless the action genuinely triggers a delayed apply, restart, or reload.

### Separate alternatives

When platforms or installation methods have different procedures:

- Use separate H3 sections. `unenforced`
- Use supported tabs when the documentation platform provides accessible tabs. `unenforced`
- Keep names and ordering consistent across pages. `unenforced`
- Give each path a complete procedure. `unenforced`

Do not interleave platform branches inside every numbered step. `unenforced`

### Include recovery for risky tasks

For risky operational tasks, include:

- Backup or snapshot requirement. `unenforced`
- Point of no return. `unenforced`
- Success signal. `unenforced`
- Failure signal. `unenforced`
- Rollback or recovery path. `unenforced`
- Escalation condition. `unenforced`

Do not claim rollback is possible unless it is verified. `unenforced`

## Create durable and descriptive links

Every link helps the reader understand or complete the current goal. `unenforced`

### Link only when useful

Before adding a link, ask:

- Must the reader follow it to complete the task? `unenforced`
- Does it provide important context? `unenforced`
- Is it the logical next step? `unenforced`
- Does the destination have a stable owner? `unenforced`

Remove decorative and low-value links. `enforced-by: prose/vale gspot.symbols`

Move optional background links to a related-topics section when they interrupt `unenforced`
the main procedure.

### Use descriptive link text

Use:

```markdown
For configuration precedence, see [configuration sources](configuration.md).
```

Link text must make sense out of context for screen-reader navigation.

Use the destination title or a concise description of the destination. `unenforced`

Do not:

- Use "here," "this page," "read more," or a raw URL as link text. `enforced-by: prose/vale gspot.link-text`
- Put punctuation inside the link unless it is part of the destination title. `enforced-by: prose/vale gspot.dashes`
- Apply bold or italic formatting to a link. `unenforced`
- Put links in headings. `unenforced`
- Break link text or its destination across source lines. `enforced-by: prose/vale gspot.link-text`

### Prefer inline Markdown links

Use:

```markdown
[Configuration reference](configuration.md)
```

Avoid reference-style link definitions unless the project has an explicit `unenforced`
reason to use them. Inline links are easier to edit and review.

### Link within the repository

Use relative links for Markdown pages and assets in the same repository. `enforced-by: docs/links`

```markdown
[Advanced guide](ADVANCED.md)
```

Relative links survive repository forks and host changes.

Use the repository's established path rules when a static site generator `unenforced`
resolves pages differently.

### Link to external resources carefully

External links add maintenance risk.

Use an external link when:

- The external source is authoritative. `unenforced`
- Duplicating the information creates a stale copy. `enforced-by: prose/vale gspot.modals`
- The reader needs a standard, provider contract, license, or maintained tool
  reference. `unenforced`

Link to the most specific authoritative page that supports the statement.

Do not link to an external product home page merely because the product is `unenforced`
mentioned.

Name the destination and, when useful, its owner:

```text
See the installation guide in the provider documentation.
```

### Avoid duplicate links

Do not link to the same destination repeatedly on one page. `unenforced`

Link the first useful occurrence, then rely on clear terminology. Repeat a link
only when the page is long and a distant task cannot reasonably be completed
without it.

### Use calls to action deliberately

A call to action asks the reader to leave the current page and perform the next
meaningful action.

Use a call to action only when:

- The reader has reached a logical next step. `unenforced`
- The destination directly helps complete the reader's goal. `unenforced`
- The destination is trusted and clearly named. `unenforced`
- A normal inline link does not communicate the importance of the next step. `enforced-by: prose/vale gspot.modals`

Use action-oriented text such as "Create a repository" or "Start the tutorial." `unenforced`
Do not use vague promotional text.

Calls to action in product documentation lead to project-owned or
explicitly trusted destinations. Do not disguise an advertisement as a task
step.

### Use stable source-code links

When linking to exact lines in a hosted repository, use a commit permalink.
Branch line numbers move as the file changes.

Use branch links when the reader needs the current file as a whole. `unenforced`

### Link across documentation versions explicitly

Do not surprise a reader with a link to a different product or documentation `unenforced`
version.

When a cross-version link is necessary:

- Name the destination version in the surrounding sentence. `unenforced`
- Include the version in the destination path when the platform requires it. `unenforced`
- Prefer the same topic in the target version. `unenforced`
- Explain why the reader needs a different version. `unenforced`
- Do not use a cross-version link as a substitute for maintaining the current
  page. `unenforced`

Use current-version relative links for normal navigation. `enforced-by: docs/links`

### Treat heading anchors as contracts

Changing a heading changes its generated anchor on most platforms.

Before changing a published heading:

- Search the repository for links to the old anchor. `enforced-by: docs/links`
- Update every owned link. `unenforced`
- Consider external links and bookmarks. `unenforced`
- Preserve an old anchor only when the publishing system treats it as a public
  compatibility contract and the repository has an approved anchor mechanism. `enforced-by: docs/links`

Do not put step numbers or volatile version labels in headings unless needed. `unenforced`

### Do not link inaccessible content

Avoid links to:

- Confidential issues. `unenforced`
- Private dashboards. `unenforced`
- Internal-only documentation. `unenforced`
- Pages that require an unstated role. `unenforced`

If restricted content is essential, state the access requirement before the
link and format a raw internal URL as code when automated link checks cannot
access it.

Do not make public documentation depend on a private destination for essential `unenforced`
instructions.
