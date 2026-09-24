---
layer: prose
configuration: prose
title: Writing
---

# Writing

All project-authored text must conform to `ISO 24495-1:2023`. This requirement
applies to README files, guides, Markdown, comments, docstrings, interface help,
tooltips, labels, errors, workflow notes, examples, and generated text.

Identify the intended readers and their task. Write text that lets them:

- get the information they need;
- find that information;
- understand that information; and
- use that information.

Use short, direct sentences, and familiar words. Explain technical terms when
readers need them. Use the same name for the same thing. Preserve exact API identifiers and legal license text.

Describe the present state only. Keep private
reasoning, acceptance status, and temporary development notes out of public
content.

Read the changed text for clarity and correctness. Do not expand a small edit
into a review of unrelated pages or rendered surfaces.

## Voice and tone

Use a voice that is:

- Concise.
- Direct.
- Precise.
- Calm.
- Friendly.
- Confident without making unsupported claims.
- Conversational without becoming chatty.

### Prefer active voice

Use active voice when the actor matters.

Use:

```text
The worker retries the request three times.
```

Avoid:

```text
The request is retried three times by the worker.
```

Passive voice is useful when the result matters more than the actor or the
actor is genuinely unknown.

Use:

```text
The report is encrypted before storage.
```

### Speak directly to the reader

Use imperative verbs for instructions.

Use:

```text
Select **Save**.
```

Avoid:

```text
The user should select the **Save** button.
```

Use "you" when it makes a condition or result clearer.

### Describe the present state

Documentation describes current behavior. Do not narrate refactors, renamed
variables, removed systems, or previous implementations.

Use release notes, migration guides, or decision records for history when
history has a durable reader need.

Use:

```text
The client sends audio directly to the realtime provider.
```

Avoid:

```text
The client now sends audio directly instead of routing it through the API.
```

### Avoid self-referential openings

Start with the subject, not the page.

Use:

```text
Deployment uses immutable container images.
```

Avoid:

```text
This page explains how deployment works.
```

Use a brief scope sentence only when a reader needs it to distinguish this page
from a nearby topic.

### Avoid marketing language

Documentation is not sales copy.

Do not use:

- Easy.
- `Easily`.
- Simple.
- `Simply`.
- Obviously.
- Trivial.
- `Best-in-class`.
- `Powerful`.
- Revolutionary.
- `Seamless`.

These words do not explain the work, and they can make a struggling reader feel
at fault.

State measurable effects instead.

Use:

```text
Caching can reduce repeated database reads for identical requests.
```

Avoid:

```text
This powerful cache easily makes the application much faster.
```

### Do not use contractions

Write the full form in every document, comment, error message, and commit message. A negative
must be unmistakable, and the prose checker cannot tell a tutorial from a reference.

Use `Do not delete the primary key`, not `Don't delete the primary key`.

### Use precise modal verbs

Use direct imperatives for required actions.

Use:

```text
Set `DATABASE_URL` before starting the service.
```

Use "can" for capability or a clearly optional choice.

Use:

```text
You can store the cache on a separate volume.
```

Avoid `may`, `might`, `could`, `would`, and `should` when the reader cannot tell
whether an action is required, recommended, or optional.

Label recommendations and optional steps explicitly.

### Use American English by default

Use American English spelling, grammar, and punctuation unless the project has chosen
another documented language standard.

Do not mix dialects within one documentation set.

## Write clear and translatable language

Write for readers and translation systems that do not share the author's local
context.

### Keep sentence structure direct

- Put the subject near the verb.
- Keep one primary idea in each sentence.
- Prefer short sentences over clauses joined by punctuation.
- Name the actor when the action can belong to more than one component.
- Repeat a noun when a pronoun is ambiguous.
- Put conditions before actions when the condition changes whether the action
  applies.

Use:

```text
If the token has expired, request a new token.
```

Avoid:

```text
Request a new one when it has expired.
```

### Do not write sausage sentences

A sausage sentence chains many independent claims, capabilities, modes, or
operational concerns into one comma-separated sentence. The sentence can be
grammatically correct and still be unreadable. Treat this structure as a
documentation defect, not as concise writing.

Avoid:

```text
The server provides streaming generation, persona prompts, imported history,
cancellation, rate limits, health checks, telemetry, Docker images, and host
deployment automation.
```

This sentence fails because it:

- Compresses nine distinct capabilities into one claim.
- Mixes request behavior, runtime controls, observability, packaging, and
  deployment.
- Gives every item the same apparent importance.
- Hides the relationships and boundaries among the capabilities.
- Forces the reader to retain the entire inventory before understanding its
  structure.
- Sounds like a feature dump instead of explaining how the system helps the
  reader.

Use separate sentences, paragraphs, or lists to expose the structure:

```markdown
The server supports these generation workflows:

- Stream generated text.
- Apply a persona prompt.
- Import conversation history.
- Cancel an active response.

Runtime operations have separate controls:

- Rate limits control request volume.
- Health checks report service availability.
- Telemetry reports runtime behavior.

Deployment tooling includes Docker images and host automation.
```

Apply these rules:

- Keep one primary claim in each prose sentence.
- Keep an inline list only when its items are short, tightly related, and part
  of the same reader concern.
- Convert an inline list into bullets when readers need to scan, compare, or
  remember the items independently.
- Split content into separate paragraphs when it crosses conceptual levels,
  such as request behavior, runtime operations, and deployment.
- Explain a capability near its important condition, limitation, or effect.
  Do not bury those details behind a broad inventory sentence.
- Treat four or more independent capabilities in one sentence as a strong
  signal that the sentence needs restructuring.
- Do not disguise the same problem with semicolons, parentheses, repeated
  conjunctions, or phrases such as "as well as."
- Do not replace one sausage sentence with several disconnected one-sentence
  paragraphs. Group related claims under a clear lead-in or heading.

Sentence length alone does not determine whether a sentence is a sausage
sentence. A longer sentence can remain clear when every clause supports one
claim. A shorter sentence can still fail when it compresses unrelated concepts
into a feature inventory.

### Avoid hidden subjects

Avoid opening with "there is" or "there are" when a concrete subject exists.

Use:

```text
Two deployment modes support private networking.
```

Avoid:

```text
There are two deployment modes that support private networking.
```

### Avoid noun stacks

Break strings of nouns with a preposition.

Use:

```text
Settings for custom project integrations
```

Avoid:

```text
Project integration custom settings
```

### Prefer verbs over nominalizations

Use:

```text
After the workflow finishes, download the report.
```

Avoid:

```text
After completion of workflow execution, perform a download of the report.
```

### Avoid culture-specific language

Do not use:

- Idioms.
- Sports metaphors.
- Pop-culture references.
- Regional slang.
- Jokes that carry operational meaning.
- Violent metaphors when a literal alternative exists.

Use literal descriptions such as "stop the process," "remove the task," or
"replace both values."

### Avoid ambiguous connectors

Use "because" for cause.
Use "after" or "from" for time.
Use "while" only for simultaneous actions.

Do not rely on `since` when it can mean time or cause.

### Spell out abbreviations

Spell out an acronym or uncommon abbreviation on first use on each page, then
put the abbreviation in parentheses.

```text
Content delivery network (CDN)
```

Do not spell out universally familiar technical names when the expansion reduces
clarity. Examples include API, URL, HTTP, JSON, and HTML.

Avoid acronyms in titles unless the intended audience uses the acronym as the
primary name.

Do not add apostrophes to form acronym plurals.

Use:

```text
APIs
```

Avoid:

```text
API's
```

### Write numbers consistently

In prose, spell out zero through nine and use numerals for 10 and greater.
Use numerals for:

- Measurements.
- Versions.
- Dates.
- Times.
- Percentages.
- Commands and code.
- Exact limits.
- Steps and table values.

Do not begin a sentence with a numeral. Rewrite the sentence or spell out the
number.

### Write dates and times unambiguously

For prose intended primarily for people, use:

```text
January 3, 2026 at 10:30 AM UTC
```

Include the time zone whenever readers in different regions can act on the
time.

For machine-readable values, logs, APIs, release stamps, and sortable metadata,
use ISO 8601:

```text
2026-01-03T10:30:00Z
```

Do not use ambiguous numeric dates such as `03/04/2026`.

### Write currency unambiguously

Name the currency when an amount can refer to more than one currency.

On first use in a page, write the amount and currency name:

```text
10 US dollars
```

When a page contains several amounts, add the ISO currency code on first use:

```text
10 US dollars (USD)
```

Use the symbol and code for later compact references:

```text
$0.25 USD
```

Do not write ambiguous forms such as `$10` when readers in several countries
can interpret the symbol differently.

### Match official capitalization

Preserve the official capitalization of product names, organization names, acronyms, commands,
APIs, user interface labels, standards, and third-party tools: `iOS`, `API`, `GitHub`, `npm`.
Do not capitalize a feature as a proper name unless the project defines it as one.

### Keep names and terminology consistent

Use the full official product, organization, framework, and standard name on
first use. Follow the capitalization used by the authoritative owner.

- Use the same term for the same concept across the documentation set.
- Do not introduce a synonym only to avoid repetition.
- Do not shorten product names unless the short form is established and
  unambiguous.
- Treat product names as singular unless the product owner defines another
  grammatical form.
- Keep feature names lowercase unless they are proper names.
- Maintain a project word list when capitalization or preferred terms are not
  obvious.

Avoid possessive forms for product and organization names when a noun phrase is
clearer.

Use:

```text
The Docker command-line interface
```

Avoid:

```text
Docker's command-line interface
```

Ending a sentence with a preposition is acceptable when the alternative sounds unnatural or overly formal. Clarity matters more than a mechanical
grammar preference.

### Use restrained punctuation

- End complete sentences with a period.
- Use the serial comma in a list of three or more items.
- Use one space between sentences.
- Use straight quotation marks in source.
- Use a colon to introduce a list, code example, or explanation.
- Split a sentence instead of using a semicolon.
- Use commas, parentheses, colons, or separate sentences instead of em dashes
  or en dashes.

Do not use punctuation as decoration in headings.

## Use inclusive and respectful language

Use language that welcomes people across cultures, identities, abilities, and
experience levels.

- Refer to people by relevant roles, not stereotypes.
- Use gender-neutral examples unless gender is necessary to the scenario.
- Use "they" for a person whose pronouns are unknown.
- Avoid assumptions about physical ability, family structure, location, or
  access to expensive hardware.
- Do not describe an accessibility feature as a special case.
- Avoid terms with exclusionary or harmful histories when a precise neutral
  term exists.
- Use "allowlist" and "denylist" for newly named project concepts.
- Use "default branch" or the branch's actual name instead of assuming a branch
  is named `master`.
- Preserve exact external API, protocol, command, and user interface terms when
  changing them makes the documentation inaccurate.

Use "person" or a specific role when describing people. Use "user" when it is a
defined product or system role.

Examples use varied, fictional names. Use `example.com` addresses:

```text
Alex Garcia
Sidney Jones
Zhang Wei
alex.garcia@example.com
```

Do not use real customer names, contributor email addresses, account
identifiers, or production data in examples.

## Ground every claim in evidence

Do not speculate about behavior.

Verify claims against the sources that own them:

- Source code for runtime behavior.
- Public types and schemas for contracts.
- Configuration for supported values and defaults.
- Migration state for database behavior.
- User interface code or a current product build for labels and navigation.
- Tests for demonstrated scenarios, without treating test data as the
  public contract by themselves.
- Provider documentation for external requirements.
- Release configuration for version and platform support.

Do not invent:

- Command syntax.
- Flags.
- Environment variables.
- API fields.
- Error codes.
- User interface labels.
- Permissions.
- Supported versions.
- Defaults.
- Performance claims.
- Security guarantees.

If evidence is incomplete, narrow the claim or state the known limitation.
Do not fill gaps with plausible behavior.

### Reuse external material with attribution

When a fact comes from an external source, verify it, explain it in the project's own words, and
link to the authoritative source for full detail. When text or media is reused rather than
paraphrased:

- Confirm that the source license permits the intended use.
- Follow attribution, notice, and share-alike requirements.
- Identify the source and license where the reused content appears.
- Preserve required copyright notices.
- Use the exact license text supplied by the source when full license text is required.
- Keep the attribution close enough that readers can identify the adapted material.

### Distinguish guarantees from observations

Use language that matches the contract.

```text
The request times out after 30 seconds.
```

This sentence is appropriate only when 30 seconds is a defined contract.

```text
In the current load test, the request completed within 30 seconds.
```

This sentence describes an observation, not a guarantee.

Do not convert a benchmark, one test run, or implementation detail into a
general promise.

### Scope version-specific statements

State the applicable version, platform, plan, role, or deployment mode when the
behavior is not universal.

Use `version 3.2 or later`, not `version 3.2 or above`.

Do not put temporary version details into a timeless conceptual explanation
without marking their scope.

### Review AI-assisted content

Treat AI-generated documentation as an untrusted draft.

Review for:

- Repetition.
- Fabricated commands or fields.
- Vague claims.
- Incorrect scope.
- Stale names.
- Unnecessary new pages.
- Missing permissions.
- Hidden safety consequences.
- Examples that look valid but cannot run.
- Confident statements unsupported by the codebase.

Every retained claim needs the same evidence as human-written content.

### Do not promise future behavior

Do not state that an unshipped feature will arrive in a specific release unless
an authorized product commitment exists and the documentation system has a
defined disclaimer process.

Use:

```text
Issue 123 proposes support for hardware-backed keys.
```

Avoid:

```text
Hardware-backed key support is coming in the next release.
```

Describe current behavior first. Put proposals in issue trackers, roadmaps, or
approved future-content sections.
