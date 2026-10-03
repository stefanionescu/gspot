---
title: Writing
---

# Writing

All project-authored text conforms to `ISO 24495-1:2023`, plain language. That covers README
files, guides, Markdown, comments, docstrings, interface help, tooltips, labels, errors,
workflow notes, examples, and generated text. Identify the intended readers and their task.
Write text that lets them get, find, understand, and use the information. Use short, direct
sentences and familiar words. Explain technical terms when readers need them.

Use the same name for the same thing. Preserve exact API identifiers and legal license text.
Describe the present state only. Keep private reasoning, acceptance status, and temporary
development notes out of public content. Read the changed text for clarity and correctness.
Do not expand a small edit into a review of unrelated pages.

## Voice and tone

The voice is concise, direct, precise, calm, and friendly.

### Voice conventions

<!-- level: all -->

- Use active voice when the actor matters: "The worker retries the request three times," not
  "The request is retried three times by the worker." Passive voice serves when the result
  matters more than the actor: "The report is encrypted before storage."
- Speak directly to the reader with imperative verbs: "Select **Save**," not "The user
  selects the **Save** button." Use "you" when it makes a condition or result clearer.
- Describe the present state. Do not narrate refactors, renamed variables, removed systems, or
  previous implementations. Release notes, migration guides, and decision records hold the
  history readers need.
- Start with the subject, not the page: "Deployment uses immutable container images," not
  "This page explains how deployment works." A scope sentence appears only where a reader
  needs it to tell this page from a nearby topic.
- Documentation is not sales copy: state the measurable effect, never `easy` or `seamless`.
- Use a direct imperative for a required action and "can" for a capability or a clearly
  optional choice, and label recommendations and optional steps.
- Use American English spelling, grammar, and punctuation unless the project documents
  another standard, and never mix dialects in one set.

## Clear and translatable language

<!-- level: all -->

Write for readers and translation systems that do not share the author's context.

Put the subject near the verb and keep one primary idea per sentence. Prefer short sentences
to clauses joined by punctuation. Name the actor when the action can belong to more than one
component. Repeat a noun when a pronoun is ambiguous. Put a condition before the action it
governs: "If the token has expired, request a new token."

A sausage sentence chains many independent capabilities, modes, or concerns into one
comma-separated sentence. It compresses distinct facts into one statement, mixes conceptual
levels, gives every item the same weight, hides the relationships, and reads as a feature
dump. Four or more independent capabilities in one sentence is the signal. Expose the
structure with separate sentences, paragraphs, or a list under a lead-in. Explain each
capability beside its important condition or limit.

Semicolons, parentheses, repeated conjunctions, and "as well as" do not disguise a sausage
sentence. A run of disconnected one-sentence paragraphs does not fix it. Length alone does
not decide. Avoid a hidden subject: "Two deployment modes support private networking," not a
sentence that opens with an existential "there" and a relative clause. Break a noun stack with
a preposition: "Settings for custom project integrations," not "Project integration custom
settings." Prefer verbs to nominalizations: "After the workflow finishes, download the
report."

Avoid idioms, sports metaphors, pop-culture references, regional slang, and jokes that carry
operational meaning. Prefer a literal alternative to a violent metaphor: "stop the process,"
"remove the task," "replace both values." Use "because" for cause, "after" or "from" for
time, and "while" only for simultaneous actions. The checker names the ambiguous conjunction
that can mean either.

Keep acronyms out of titles unless the audience uses the acronym as the primary name. Dates
and times for people read "January 3, 2026 at 10:30 AM UTC," with the time zone whenever readers in different regions can act on the time.
Machine-readable values, logs, APIs, and release stamps use ISO 8601: `2026-01-03T10:30:00Z`.
Numeric dates such as `03/04/2026` are ambiguous. Name the currency when an amount can be
read in more than one, as `10 USD` or `$0.25 USD`. A bare `$10` is ambiguous across
countries.

Preserve the official capitalization of product names, organizations, acronyms, commands,
APIs, interface labels, standards, and third-party tools: `iOS`, `GitHub`, `npm`. A feature
is not capitalized as a proper name unless the project defines it as one. Use the full
official name on first use and the same term for the same concept across the set. Do not
introduce a synonym to avoid repetition. Do not shorten a product name unless the short form
is established. Treat product names as singular and keep feature names lowercase.

Keep a project word list where capitalization or preferred terms are not obvious. Punctuation
stays restrained. Split a sentence rather than join it with a semicolon. Replace em dashes and en
dashes with commas, colons, or separate sentences. Keep decorative punctuation out of headings.

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

Do not speculate about behavior. Verify each statement against its owner. Source code owns
runtime behavior, public types and schemas own contracts, configuration owns supported values
and defaults, and migration state owns database behavior. Interface code or a current build
owns labels, tests own demonstrated scenarios, provider documentation owns external
requirements, and release configuration owns version and platform support.

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
- Treat AI-generated documentation as an untrusted draft: look for fabricated commands or
  fields, wrong scope, stale names, missing permissions, and examples that cannot run. A
  retained statement needs the same evidence as human-written content.

### Future behavior

Do not promise future behavior. An unshipped feature is dated to a specific release only when
an authorized product commitment exists and the documentation system has a disclaimer
process. Write "Issue 123 proposes support for hardware-backed keys," not "Hardware-backed
key support is coming in the next release." Describe current behavior first. Put plans in
issue trackers, roadmaps, or approved future-content sections.
