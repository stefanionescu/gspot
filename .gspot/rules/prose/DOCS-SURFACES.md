---
title: Documentation Surfaces
---

# Documentation Surfaces

Command-line interfaces, APIs, libraries, configuration, environment variables, architecture,
contributor guides, troubleshooting, logs, audit events, and release notes. No tool checks
whether a surface is documented completely. The docs structure check reports the sections a
README must and must not have, and the prose checker reports tense. This file lists what
each surface owes its reader.

## Command-line interfaces

<!-- level: all -->

A command is documented as invocations and output, never as terminal screenshots. The README
keeps a short list of common commands. Exhaustive detail lives in the CLI reference or, for a
small specialist surface, in the advanced guide. Each command documents:

- Purpose and syntax.
- Required arguments, optional arguments with defaults, and flags with accepted values.
- Environment variables and working directory assumptions.
- Input files or standard input, and standard output and error behavior.
- Exit status, side effects, and permissions.
- Safe examples and destructive consequences.

## APIs and libraries

<!-- level: all -->

An API operation uses the contract owner's exact names and values. Error examples expose no
table names, stack traces, or service topology. A message that is part of a public terminal,
log, or API contract is reproduced exactly. Each operation documents:

- Method and path, purpose, authentication, and required role or scope.
- Headers, path and query parameters, and the request body with field types, required
  status, constraints, and defaults.
- Success status and body, and error statuses with stable codes.
- Pagination, rate limits, idempotency, retries, and side effects.
- Version availability and one valid request and response.

A library README holds a one-line purpose, installation, minimal import and use, and the
supported runtime or language versions. It names the main public types and functions,
parameter and return behavior, errors and side effects, concurrency guarantees, and
compatibility constraints. It links to the complete reference and states the license. The
reference defines signatures, types, optional values, defaults, return values, errors, and
callbacks or events. It defines ownership and lifecycle where resources need cleanup. No
reader inspects source for routine public behavior.

## Configuration and environment

<!-- level: all -->

A configuration key documents its exact name, purpose, type, default, and allowed values. It
states required status, scope, precedence, environment availability, secret status, and any
reload or restart requirement. It states its security effect and gives an example with its
parent keys in YAML, TOML, or JSON so placement is unambiguous. One reference owns each
default, and narrative sections link to it. The page states whether an empty string, a
missing key, and an explicit `null` differ.

An environment variable documents its name, purpose, required status, format, and an example
placeholder. It states secret status, the process that reads it and when, and the failure
when it is missing or invalid. Committed example files are labeled, secret-bearing local
files are ignored, and no example holds a real secret:

```dotenv
API_BASE_URL=https://api.example.com
ACCESS_TOKEN=<ACCESS_TOKEN>
```

## Architecture and contributors

<!-- level: all -->

Architecture documentation explains system boundaries, component ownership, dependency
direction, primary data flows, and trust boundaries. It explains state ownership, external
services, failure boundaries, the concurrency and persistence models, deployment shape, and
important invariants. It gives the reason for a boundary where the model does not make it
obvious. It describes durable concepts and responsibilities and never inventories source
directories or classes. A diagram appears only where it beats prose.

Contributor documentation covers the supported development environment, setup, and the
ownership boundaries a contributor needs without a file inventory. It covers the normal
workflow, branch and commit policy, code and documentation standards, and how to change
generated artifacts. It states review expectations, the testing and verification policy,
contribution licensing, and the security reporting route. It repeats product-user setup only
when contributors use the same path.

## Troubleshooting, logs, and audit events

A troubleshooting entry has a symptom-first heading, `### Deployment remains in \`Pending\``.
It gives the observable symptom, the exact message where relevant, and the affected scope. It
gives a diagnostic command or interface check, the likely cause, the resolution, cleanup or
recovery, and escalation information. Causes run from most common and least invasive to rare
and destructive. A destructive reset never leads where a focused diagnosis exists. A
speculative cause is not presented as confirmed.

A log or error reproduces public text exactly, inline for a short message and in a `text`
block for several lines. Timestamps and IDs that add nothing are removed and sensitive values
are replaced. The part that matters is explained, and the scope and likely cause are stated. A few
relevant lines replace a whole log.

### Audit events

<!-- level: all -->

An audit event is a historical record described in past tense. Passive voice serves when the
actor varies or is captured separately: "The repository visibility was changed." The entry
does not repeat context the event table or category supplies.

## Releases and lifecycle

<!-- level: all -->

A feature note says who is affected, what need they can address, what behavior is available,
and where the complete documentation is. It uses present tense and avoids "now" unless a
timing contrast is essential. A bug-fix note says who was affected, what incorrect behavior
they observed, and whether action is required. It describes the previous symptom in past
tense, because "Fixed a bug" adds nothing: "Workflow jobs remained queued when a matching
runner became available after the job entered the queue."

A change note says what behavior differs, who is affected, why it matters, and what action is
required, in present tense for the documented release. Update markers use ISO dates,
`[Updated: 2026-07-15]`, and only on content whose age matters. Version control tracks
routine edits.

A security-fix note follows the disclosure policy and includes only authorized details:
severity, affected versions, impact, mitigation or fixed version, the public vulnerability
identifier, and required action. Exploit details wait for coordinated disclosure. A known
issue names the affected audience and versions, the symptom, the triggering condition, a safe
workaround, any data-loss or security risk, and the public tracking issue. "This can be
ignored" appears only when ignoring it is verified safe.

A deprecation notice states what is deprecated, who is affected, whether it is still
supported, the replacement, and the migration path. It gives the earliest removal version or
date once committed. It appears on the feature's reference page as well as in the release
notes. A retirement notice states what is unavailable, the first version without it, the
supported replacement, data export or migration requirements, and any remaining support. It
uses direct language rather than "changes to availability."

An erratum identifies the affected statement, gives the corrected fact, and carries the
correction date in the release system's format. It updates the canonical documentation.
False history is never preserved silently.
