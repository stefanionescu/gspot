---
title: Documentation
---

# Documentation

The documentation rules span five files. This one covers scope, ownership, readers, the
documentation set, topic types, maintenance, and review.

## Scope

These rules cover every document a project writes for its users, operators, contributors, and
maintainers, and the media those documents use. A project rule may add front matter or other
renderer needs.

## Core standard

<!-- level: all -->

Good documentation lets a reader answer ten questions without reading the implementation.
What is the project, what problem does it solve, and does it fit their need? What do they
need before using it, how is it installed, and what does normal use look like? What are its
limits and risks, where is the exact reference, how are common failures diagnosed, and how is
it licensed and maintained?

## One source of truth

Durable product information belongs in the documentation set, never only in a pull request,
an issue, a chat thread, a commit message, a review, a private document, or a memory. When a
recurring question has no documented answer, add the answer to the page that owns it and link
to that page elsewhere. Small, intentional duplication is allowed only when the fact is needed
in both contexts. One location stays the owner, the copy is short, and every copy is easy to
find when the fact changes. Large procedures, configuration tables, and API contracts are
linked, not copied.

## Write for a defined reader

Before writing, read the implementation, configuration, and existing pages that define the
behavior. Find the page that owns the topic and choose the topic type. Identify the reader,
their goal, what they already know, and their environment.

Identify the role or permissions they need, what happens if they follow the
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
| Specialist guide           | Explain a specialist task that needs its own page.                                                          |
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
established capitalization: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
`CHANGELOG.md`, `LICENSE`. Keep the repository description, package description, keywords,
topics, and published title consistent with the README one-liner.

## The README and specialist guides

<!-- level: all -->

The README is the entry point: a reader decides whether the project fits, installs it,
completes the first useful action, and understands normal operation. It holds the name, a one-sentence purpose, essential context, status when it affects
adoption, and compatibility and data-loss caveats. It holds a small runnable example,
prerequisites, setup, normal configuration, and the most used commands. It closes with a
concise architecture overview, common failures with their fixes, links to deeper references,
and license and contribution information.

Put specialist material in a guide that the README links to. Move it out of the README when
it pushes setup off the first screen. Open a specialist guide by stating its audience and
its relationship to the README.

The first screen says what the project is, who it is for, and what problem it solves, and
shows normal use. Put a limitation that rules out use near the top. Examples include an incompatible
license and a destructive default. Keep internals, complete option tables, and project history
after setup.

Do not add a directory tree or a folder table. Tell the user about any you find. Document
behavior, workflows, commands, and ownership boundaries. Mention a path when the reader must
open, edit, or run it.

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

The configured Markdown, link, spelling, and prose tools check their declared rules. Review
accuracy and usability against the implementation.

## Documentation review

The review an agent runs over changed documentation before the checks of the repository, and the
definition of done. The other documentation rules say how to write each part; the review says how
to read the result.

### Review against the source

Check every claim against the implementation or another authoritative source, not against memory:

- Commands, flags, fields, labels, outputs, defaults, and supported versions are exact and
  current.
- Permissions, limitations, and risks are visible before the step that needs them.
- Examples run as written and are safe to run.
- The page describes the present behavior and promises nothing about the future.

### Review as the reader

Read the page as its intended reader, from the top:

- The reader can tell whether the project fits, and reach the first useful result.
- Prerequisites come before the procedure, and each task has one outcome.
- Each step says whether it is required or optional, and what the reader sees after it.
- Risky work has a way back.

### Definition of done

Documentation work is done when the content has a clear owner and audience, every claim rests on
an authoritative source, and the procedures are complete and in order. Related pages stay
consistent, and no stale, duplicated, or placeholder content remains. Never publish an empty
heading, placeholder prose, or a checklist as content.
