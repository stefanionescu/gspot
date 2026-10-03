---
title: Documentation
---

# Documentation

The documentation rules span six files. This one covers scope, ownership, readers, the
documentation set, topic types, and maintenance.

## Scope

These rules cover every document a project writes for its users, operators, contributors, and
maintainers, and the media those documents use. Project rules may add what a renderer requires,
such as front matter, and override portable formatting only there. Accuracy, security,
accessibility, honest limitations, and runnable examples never become optional.

## Core standard

<!-- level: all -->

Good documentation lets a reader answer ten questions without reading the implementation.
What is the project, what problem does it solve, and does it fit their need? What do they
need before using it, how is it installed, and what does normal use look like? What are its
limits and risks, where is the exact reference, how are common failures diagnosed, and how is
it licensed and maintained?

Documentation is correct, useful to a defined reader, discoverable from the README or
navigation, scannable, complete at its chosen level, and concise. It is honest about
limitations and destructive effects before they matter. It is maintainable with a clear
owner, accessible, secure, and portable in standard Markdown. Length is not a quality
signal. A document is as short as
possible without removing what correct and safe use needs. Documentation defines the supported
public contract: if users must read the implementation to learn routine use, the abstraction
is incomplete.

## One source of truth

Durable product information belongs in the documentation set, never only in a pull request,
an issue, a chat thread, a commit message, a review, a private document, or a memory. When a
recurring question has no documented answer, add the answer to the page that owns it and link
to that page elsewhere. Small, intentional duplication is allowed only when the fact is needed
in both contexts. One location stays the owner, the copy is short, and every copy is easy to
find when the fact changes. Large procedures, configuration tables, and API contracts are
linked, not copied. A behavior change and its documentation change ship together.

## Write for a defined reader

Before writing, identify the reader, their goal, what they already know, and their
environment. Identify the role or permissions they need, what happens if they follow the
instructions incorrectly, and the next question they are likely to ask. Write for the least
specialized reader who can complete the task, and assume no internal vocabulary or
organizational history. Disclose progressively: the broad purpose and normal path first,
setup and routine tasks next, and internals and rare operations last. Focus on reader
outcomes, not implementation effort.
Address the reader as "you" in task documentation, and name a role when permissions matter.

## Organize the documentation set

<!-- level: all -->

Give each kind of information one owner.

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

Create subproject documentation at real ownership boundaries, not in every directory. Avoid
navigation chains through several index pages. Use the standard filenames with their
established capitalization: `README.md`, `ADVANCED.md`, `CONTRIBUTING.md`, `SECURITY.md`,
`CHANGELOG.md`, `LICENSE`. Keep the repository description, package description, keywords,
topics, and published title consistent with the README one-liner.

## The README and the advanced guide

<!-- level: all -->

The README is the entry point: a reader decides whether the project fits, installs it,
completes the first useful action, and understands normal operation without the advanced
guide. It holds the name, a one-sentence purpose, essential context, status when it affects
adoption, and compatibility and data-loss caveats. It holds a small runnable example,
prerequisites, setup, normal configuration, and the most used commands. It closes with a
concise architecture overview, common failures with their fixes, links to deeper references,
and license and contribution information.

`ADVANCED.md` holds coherent specialist material: detailed architecture and ownership,
internal orchestration, performance and concurrency, rare configuration, tuning, complex
deployment and recovery, deep troubleshooting, provider integration, and operational behavior
maintainers need. It may assume the README, never undocumented prerequisites. It is not a
substitute for an API reference, a contributor guide, a security policy, a changelog, or
decision records, and it stays coherent for one audience.

Split when three or more substantial specialist sections interrupt the normal path, or when
one specialist workflow forces readers to scroll past it. Split when the audiences differ or
when the README cannot stay a quick evaluation document. Keep one file when the content
scans well, the advanced material is one short section, or the split gives two thin pages.
Keep one file when readers switch pages during basic setup. Fix the structure of a long
README before splitting it.

Link the advanced guide once from the README, where normal use ends, with a descriptive name,
and open it by stating its audience and its relationship to the README.

No document lists the tree. A project layout, directory structure, file map, or table that
pairs directories with purposes is removed, not revised, whatever the size of the repository.
Document behavior, workflows, commands, and ownership boundaries instead, and mention a path
inline only when the reader must open, edit, or run it.

## Order from broad to narrow

<!-- level: all -->

The first screen of a README says what this is, who it is for, and what problem it solves, and
shows normal use. A limitation that disqualifies the project, such as an incompatible license,
an unsupported status, or a destructive default, moves near the top. The README never opens
with internals, a complete option table, or project history.

## Choose the topic type

<!-- level: all -->

- A concept topic explains what something is, why it exists, how its parts relate, and which
  constraints shape it: architecture, ownership, data flow, security and lifecycle models,
  domain terms. It hides no required procedural step in its narrative.
- A task topic completes one concrete goal: an outcome-focused title, permissions and
  prerequisites, ordered actions, and the expected result. It adds verification or recovery
  when the task carries risk, and the next step. Unrelated outcomes are separate tasks.
- A reference topic gives exact fields for lookup: endpoints, commands, configuration keys,
  events, error codes, formats, supported values. It favors completeness, consistent field
  order, tables for real matrices, and small examples, and never needs narrative reading to
  find one value.
- A tutorial teaches through a guided end-to-end result: a visible outcome, a controlled
  starting state, complete steps, enough explanation to teach the model, and cleanup. Unusual
  variants go to reference or advanced documentation.
- A troubleshooting topic starts from an observable symptom, then the conditions, the
  diagnostic check, the likely cause, the resolution, recovery or rollback, and escalation.
  Its headings name what readers can observe, not internal causes.
- A landing page routes audiences or goals in one paragraph and a few descriptive links.
- A release note tells an affected reader what changed, its effect, and whether action is
  required; it is not an implementation summary.

A README contains several topic types. Each section stays internally consistent under a
clear heading: setup reads as a task, options as reference, architecture as a concept.

## Plan before writing

<!-- level: all -->

Before writing, read the implementation, configuration, and existing pages that define the
behavior, find the page that owns the topic, and choose the topic type. List the claims that
need evidence and the caveats on security, permissions, compatibility, and data loss. A short
addition joins an existing page rather than opening a new one.

## Maintain continuously

Review documentation whenever a change affects public behavior, setup, configuration,
commands, API contracts, interface labels, or permissions. Review it when a change affects
supported versions, error messages, architecture boundaries, operational procedures,
screenshots, or diagrams. Update the guide, the public comments, the reference, the examples,
the troubleshooting, and the diagrams in the same change. Remove obsolete documentation
instead of commenting it out or marking it old; versioned documentation or migration notes
carry an older path.

When a fact changes, search for the old value, key, command, and name, and update every
intentional copy. Refresh a screenshot or diagram when the labels, layout, or architecture it
shows change. Prefer stable authoritative external sources to redirects, archived copies, and
branch line numbers.

Automation covers Markdown style, links, images, spelling, generated-reference drift, runnable
examples, front matter, and detectable accessibility rules. Human review still judges
accuracy and usability.
