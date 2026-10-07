---
title: Writing
---

# Writing

All project-authored text conforms to `ISO 24495-1:2023`, plain language. That covers README
files, guides, Markdown, comments, docstrings, interface help, tooltips, labels, errors,
workflow notes, examples, and generated text.
Write text that lets them get, find, understand, and use the information. Use short, direct
sentences and familiar words. Explain technical terms when readers need them.

Preserve exact API identifiers and legal license text. Keep private reasoning, acceptance status, and temporary
development notes out of public content. Read the changed text for clarity and correctness.
Do not expand a small edit into a review of unrelated pages.

## Voice and tone

### Voice conventions

<!-- level: all -->

- Use active voice when the actor matters: "The worker retries the request three times," not
  "The request is retried three times by the worker." Passive voice serves when the result
  matters more than the actor: "The report is encrypted before storage."
- Speak directly to the reader with imperative verbs: "Select **Save**," not "The user
  selects the **Save** button." Use "you" when it makes a condition or result clearer.
- Use a direct imperative for a required action and "can" for a capability or a clearly
  optional choice, and label recommendations and optional steps.

## Clear and translatable language

<!-- level: all -->

Write for readers and translation systems that do not share the author's context.

Put the subject near the verb and keep one primary idea per sentence. Prefer short sentences
to clauses joined by punctuation. Name the actor when the action can belong to more than one
component. Repeat a noun when a pronoun is ambiguous. Put a condition before the action it
governs: "If the token has expired, request a new token."

Do not chain four or more separate facts in one sentence. Use separate sentences or a list.
Start with the real subject. Avoid an opening such as `There are`. Write `settings for custom
integrations` rather than `custom integration settings`. Use verbs: `after the workflow finishes`.

Avoid idioms, sports metaphors, pop-culture references, regional slang, and jokes that carry
operational meaning. Prefer a literal alternative to a violent metaphor: "stop the process,"
"remove the task," "replace both values."

Keep acronyms out of titles unless the audience uses the acronym as the primary name. Dates
and times for people read "January 3, 2026 at 10:30 AM UTC," with the time zone whenever readers in different regions can act on the time.
Machine-readable values, logs, APIs, and release stamps use ISO 8601: `2026-01-03T10:30:00Z`.

Preserve the official capitalization of product names, organizations, acronyms, commands,
APIs, interface labels, standards, and third-party tools: `iOS`, `GitHub`, `npm`. A feature
is not capitalized as a proper name unless the project defines it as one. Use the full
official name on first use and the same term for the same concept across the set. Do not
introduce a synonym to avoid repetition. Do not shorten a product name unless the short form
is established. Treat product names as singular and keep feature names lowercase.

Keep a project word list where capitalization or preferred terms are not obvious. Punctuation
stays restrained. Keep decorative punctuation out of headings.

## Inclusive and respectful language

Refer to people by relevant roles, not stereotypes. Use gender-neutral examples unless gender
is necessary to the scenario, and "they" for a person whose pronouns are unknown. Assume
nothing about physical ability, family structure, location, or access to expensive hardware.
Do not describe an accessibility feature as a special case. Prefer a precise neutral term to
one with an exclusionary history: "allowlist" and "denylist" for new project concepts, and
"default branch" or the actual branch name rather than an assumed `master`.

Preserve exact external API, protocol, command, and interface terms when changing them makes
the documentation inaccurate. Use "person" or a specific role for people, and "user" only as
a defined product or system role. Examples use varied fictional names and `example.com`
addresses (Alex Garcia, Sidney Jones, Zhang Wei, `alex.garcia@example.com`). They never use
real customer names, contributor addresses, account identifiers, or production data.

## Ground every statement in evidence

Check each statement against the source: code, schema, configuration, or tests.

Never invent command syntax, flags, environment variables, API fields, error codes, interface
labels, permissions, supported versions, defaults, performance figures, or security
guarantees. When evidence is incomplete, narrow the statement or state the known limitation.

### Evidence conventions

<!-- level: all -->

- When a fact comes from an external source, verify it, explain it in the project's own
  words, and link to the authoritative source.
- Reused text or media needs a license that permits the use. Follow attribution and notice
  requirements, name the source and license where the content appears, preserve copyright
  notices, and include the exact license text where the license requires it.
- Match the language to the contract. "The request times out after 30 seconds" is right only
  when 30 seconds is a defined contract. "In the current load test, the request completed
  within 30 seconds" reports a measurement.
- A benchmark, one test run, or an implementation detail is never a general promise.
- State the applicable version, platform, plan, role, or deployment mode when behavior is
  not universal, as "version 3.2 or later." Mark the scope of version details inside a
  timeless explanation.
- Before you finish, check every command, flag, and field you wrote against the source.

### Future behavior

Do not promise future behavior. Write "Issue 123 proposes support for hardware-backed keys," not "Hardware-backed
key support is coming in the next release." Describe current behavior first. Put plans in
issue trackers, roadmaps, or approved future-content sections.
