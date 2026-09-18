---
layer: prose
preset: prose
title: Writing
---

# Writing

All project-authored text must conform to `ISO 24495-1:2023`. This requirement
applies to README files, guides, Markdown, comments, docstrings, interface help,
tooltips, labels, errors, workflow notes, examples, and generated text.

Identify the intended readers and their task. Write text that lets them:

- get the information they need; `unenforced`
- find that information; `unenforced`
- understand that information; and `unenforced`
- use that information. `unenforced`

Use short, direct sentences, and familiar words. Explain technical terms when `enforced-by: prose/vale gspot.sentence-length`
readers need them. Use the same name for the same thing. Preserve exact API identifiers and legal license text.

Describe the present state only. Keep private `enforced-by: prose/vale gspot.present-state`
reasoning, acceptance status, and temporary development notes out of public
content.

Read the changed text for clarity and correctness. Do not expand a small edit `unenforced`
into a review of unrelated pages or rendered surfaces.

## Voice and tone

Use a voice that is:

- Concise. `unenforced`
- Direct. `unenforced`
- Precise. `unenforced`
- Calm. `unenforced`
- Friendly. `unenforced`
- Confident without making unsupported claims. `unenforced`
- Conversational without becoming chatty. `unenforced`

### Prefer active voice

Use active voice when the actor matters. `unenforced`

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

Use imperative verbs for instructions. `unenforced`

Use:

```text
Select **Save**.
```

Avoid:

```text
The user should select the **Save** button.
```

Use "you" when it makes a condition or result clearer. `unenforced`

### Describe the present state

Documentation describes current behavior. Do not narrate refactors, renamed
variables, removed systems, or previous implementations.

Use release notes, migration guides, or decision records for history when `enforced-by: prose/vale gspot.present-state`
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

Use a brief scope sentence only when a reader needs it to distinguish this page `unenforced`
from a nearby topic.

### Avoid marketing language

Documentation is not sales copy.

Do not use:

- Easy. `unenforced`
- `Easily`. `enforced-by: prose/vale gspot.marketing`
- Simple. `unenforced`
- `Simply`. `enforced-by: prose/vale gspot.marketing`
- Obviously. `unenforced`
- Trivial. `unenforced`
- `Best-in-class`. `unenforced`
- `Powerful`. `enforced-by: prose/vale gspot.marketing`
- Revolutionary. `unenforced`
- `Seamless`. `enforced-by: prose/vale gspot.marketing`

These words do not explain the work, and they can make a struggling reader feel
at fault.

State measurable effects instead. `unenforced`

Use:

```text
Caching can reduce repeated database reads for identical requests.
```

Avoid:

```text
This powerful cache easily makes the application much faster.
```

### Do not use contractions

Write the full form in every document, comment, error message, and commit message. A negative `unenforced`
must be unmistakable, and the prose checker cannot tell a tutorial from a reference.

Use `Do not delete the primary key`, not `Don't delete the primary key`. `unenforced`

### Use precise modal verbs

Use direct imperatives for required actions. `unenforced`

Use:

```text
Set `DATABASE_URL` before starting the service.
```

Use "can" for capability or a clearly optional choice. `unenforced`

Use:

```text
You can store the cache on a separate volume.
```

Avoid `may`, `might`, `could`, `would`, and `should` when the reader cannot tell `enforced-by: prose/vale gspot.modals`
whether an action is required, recommended, or optional.

Label recommendations and optional steps explicitly.

### Use American English by default

Use American English spelling, grammar, and punctuation unless the project has chosen `enforced-by: prose/vale gspot.dashes`
another documented language standard.

Do not mix dialects within one documentation set. `unenforced`

## Write clear and translatable language

Write for readers and translation systems that do not share the author's local `unenforced`
context.

### Keep sentence structure direct

- Put the subject near the verb. `unenforced`
- Keep one primary idea in each sentence. `unenforced`
- Prefer short sentences over clauses joined by punctuation. `enforced-by: prose/vale gspot.dashes`
- Name the actor when the action can belong to more than one component. `enforced-by: prose/vale gspot.modals`
- Repeat a noun when a pronoun is ambiguous. `enforced-by: prose/vale gspot.modals`
- Put conditions before actions when the condition changes whether the action
  applies. `unenforced`

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

- Compresses nine distinct capabilities into one claim. `enforced-by: prose/vale gspot.interface-verbs`
- Mixes request behavior, runtime controls, observability, packaging, and
  deployment. `unenforced`
- Gives every item the same apparent importance. `unenforced`
- Hides the relationships and boundaries among the capabilities. `unenforced`
- Forces the reader to retain the entire inventory before understanding its
  structure. `enforced-by: prose/vale gspot.heading-names`
- Sounds like a feature dump instead of explaining how the system helps the
  reader. `unenforced`

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

- Keep one primary claim in each prose sentence. `unenforced`
- Keep an inline list only when its items are short, tightly related, and part
  of the same reader concern. `unenforced`
- Convert an inline list into bullets when readers need to scan, compare, or
  remember the items independently. `unenforced`
- Split content into separate paragraphs when it crosses conceptual levels,
  such as request behavior, runtime operations, and deployment. `enforced-by: prose/vale gspot.paragraph-length`
- Explain a capability near its important condition, limitation, or effect.
  Do not bury those details behind a broad inventory sentence. `enforced-by: prose/vale gspot.heading-names`
- Treat four or more independent capabilities in one sentence as a strong
  signal that the sentence needs restructuring. `unenforced`
- Do not disguise the same problem with semicolons, parentheses, repeated
  conjunctions, or phrases such as "as well as." `unenforced`
- Do not replace one sausage sentence with several disconnected one-sentence
  paragraphs. Group related claims under a clear lead-in or heading. `enforced-by: prose/vale gspot.sentence-length`

Sentence length alone does not determine whether a sentence is a sausage
sentence. A longer sentence can remain clear when every clause supports one
claim. A shorter sentence can still fail when it compresses unrelated concepts
into a feature inventory.

### Avoid hidden subjects

Avoid opening with "there is" or "there are" when a concrete subject exists. `unenforced`

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

- Idioms. `enforced-by: prose/vale gspot.idioms`
- Sports metaphors. `enforced-by: prose/vale gspot.interface-verbs`
- Pop-culture references. `unenforced`
- Regional slang. `unenforced`
- Jokes that carry operational meaning. `unenforced`
- Violent metaphors when a literal alternative exists. `enforced-by: prose/vale gspot.interface-verbs`

Use literal descriptions such as "stop the process," "remove the task," or `unenforced`
"replace both values."

### Avoid ambiguous connectors

Use "because" for cause. `unenforced`
Use "after" or "from" for time.
Use "while" only for simultaneous actions.

Do not rely on `since` when it can mean time or cause. `enforced-by: prose/vale gspot.modals`

### Spell out abbreviations

Spell out an acronym or uncommon abbreviation on first use on each page, then
put the abbreviation in parentheses.

```text
Content delivery network (CDN)
```

Do not spell out universally familiar technical names when the expansion reduces `enforced-by: prose/vale gspot.modals`
clarity. Examples include API, URL, HTTP, JSON, and HTML.

Avoid acronyms in titles unless the intended audience uses the acronym as the `enforced-by: prose/vale gspot.acronyms`
primary name.

Do not add apostrophes to form acronym plurals. `enforced-by: prose/vale gspot.acronyms`

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

- Measurements. `unenforced`
- Versions. `unenforced`
- Dates. `enforced-by: prose/vale gspot.dates`
- Times. `unenforced`
- Percentages. `unenforced`
- Commands and code. `unenforced`
- Exact limits. `unenforced`
- Steps and table values. `unenforced`

Do not begin a sentence with a numeral. Rewrite the sentence or spell out the `enforced-by: prose/vale gspot.acronyms`
number.

### Write dates and times unambiguously

For prose intended primarily for people, use:

```text
January 3, 2026 at 10:30 AM UTC
```

Include the time zone whenever readers in different regions can act on the `enforced-by: prose/vale gspot.modals`
time.

For machine-readable values, logs, APIs, release stamps, and sortable metadata,
use ISO 8601:

```text
2026-01-03T10:30:00Z
```

Do not use ambiguous numeric dates such as `03/04/2026`. `enforced-by: prose/vale gspot.dates`

### Write currency unambiguously

Name the currency when an amount can refer to more than one currency. `enforced-by: prose/vale gspot.modals`

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

Do not write ambiguous forms such as `$10` when readers in several countries `unenforced`
can interpret the symbol differently.

### Match official capitalization

Preserve the official capitalization of product names, organization names, acronyms, commands,
APIs, user interface labels, standards, and third-party tools: `iOS`, `API`, `GitHub`, `npm`.
Do not capitalize a feature as a proper name unless the project defines it as one.

### Keep names and terminology consistent

Use the full official product, organization, framework, and standard name on `unenforced`
first use. Follow the capitalization used by the authoritative owner.

- Use the same term for the same concept across the documentation set. `unenforced`
- Do not introduce a synonym only to avoid repetition. `unenforced`
- Do not shorten product names unless the short form is established and
  unambiguous. `unenforced`
- Treat product names as singular unless the product owner defines another
  grammatical form. `unenforced`
- Keep feature names lowercase unless they are proper names. `unenforced`
- Maintain a project word list when capitalization or preferred terms are not
  obvious. `unenforced`

Avoid possessive forms for product and organization names when a noun phrase is `enforced-by: prose/vale gspot.possessives`
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

- End complete sentences with a period. `unenforced`
- Use the serial comma in a list of three or more items. `unenforced`
- Use one space between sentences. `unenforced`
- Use straight quotation marks in source. `unenforced`
- Use a colon to introduce a list, code example, or explanation. `unenforced`
- Split a sentence instead of using a semicolon. `unenforced`
- Use commas, parentheses, colons, or separate sentences instead of em dashes
  or en dashes. `enforced-by: prose/vale gspot.dashes`

Do not use punctuation as decoration in headings. `enforced-by: prose/vale gspot.dashes`

## Use inclusive and respectful language

Use language that welcomes people across cultures, identities, abilities, and `unenforced`
experience levels.

- Refer to people by relevant roles, not stereotypes. `unenforced`
- Use gender-neutral examples unless gender is necessary to the scenario. `unenforced`
- Use "they" for a person whose pronouns are unknown. `unenforced`
- Avoid assumptions about physical ability, family structure, location, or
  access to expensive hardware. `unenforced`
- Do not describe an accessibility feature as a special case. `unenforced`
- Avoid terms with exclusionary or harmful histories when a precise neutral
  term exists. `unenforced`
- Use "allowlist" and "denylist" for newly named project concepts. `unenforced`
- Use "default branch" or the branch's actual name instead of assuming a branch
  is named `master`. `unenforced`
- Preserve exact external API, protocol, command, and user interface terms when
  changing them makes the documentation inaccurate. `enforced-by: prose/vale gspot.modals`

Use "person" or a specific role when describing people. Use "user" when it is a `unenforced`
defined product or system role.

Examples use varied, fictional names. Use `example.com` addresses:

```text
Alex Garcia
Sidney Jones
Zhang Wei
alex.garcia@example.com
```

Do not use real customer names, contributor email addresses, account `unenforced`
identifiers, or production data in examples.

## Ground every claim in evidence

Do not speculate about behavior. `unenforced`

Verify claims against the sources that own them:

- Source code for runtime behavior. `unenforced`
- Public types and schemas for contracts. `unenforced`
- Configuration for supported values and defaults. `unenforced`
- Migration state for database behavior. `unenforced`
- User interface code or a current product build for labels and navigation. `unenforced`
- Tests for demonstrated scenarios, without treating test fixtures as the
  public contract by themselves. `unenforced`
- Provider documentation for external requirements. `unenforced`
- Release configuration for version and platform support. `unenforced`

Do not invent:

- Command syntax. `unenforced`
- Flags. `unenforced`
- Environment variables. `unenforced`
- API fields. `unenforced`
- Error codes. `unenforced`
- User interface labels. `unenforced`
- Permissions. `unenforced`
- Supported versions. `unenforced`
- Defaults. `unenforced`
- Performance claims. `unenforced`
- Security guarantees. `unenforced`

If evidence is incomplete, narrow the claim or state the known limitation.
Do not fill gaps with plausible behavior.

### Reuse external material with attribution

When a fact comes from an external source, verify it, explain it in the project's own words, and
link to the authoritative source for full detail. When text or media is reused rather than
paraphrased:

- Confirm that the source license permits the intended use. `unenforced`
- Follow attribution, notice, and share-alike requirements. `unenforced`
- Identify the source and license where the reused content appears. `unenforced`
- Preserve required copyright notices. `unenforced`
- Use the exact license text supplied by the source when full license text is required. `unenforced`
- Keep the attribution close enough that readers can identify the adapted material. `unenforced`

### Distinguish guarantees from observations

Use language that matches the contract. `unenforced`

```text
The request times out after 30 seconds.
```

This sentence is appropriate only when 30 seconds is a defined contract.

```text
In the current load test, the request completed within 30 seconds.
```

This sentence describes an observation, not a guarantee.

Do not convert a benchmark, one test run, or implementation detail into a `unenforced`
general promise.

### Scope version-specific statements

State the applicable version, platform, plan, role, or deployment mode when the `unenforced`
behavior is not universal.

Use `version 3.2 or later`, not `version 3.2 or above`. `enforced-by: prose/vale gspot.version-range`

Do not put temporary version details into a timeless conceptual explanation `unenforced`
without marking their scope.

### Review AI-assisted content

Treat AI-generated documentation as an untrusted draft. `unenforced`

Review for:

- Repetition. `unenforced`
- Fabricated commands or fields. `unenforced`
- Vague claims. `unenforced`
- Incorrect scope. `unenforced`
- Stale names. `unenforced`
- Unnecessary new pages. `unenforced`
- Missing permissions. `unenforced`
- Hidden safety consequences. `unenforced`
- Examples that look valid but cannot run. `unenforced`
- Confident statements unsupported by the codebase. `unenforced`

Every retained claim needs the same evidence as human-written content. `unenforced`

### Do not promise future behavior

Do not state that an unshipped feature will arrive in a specific release unless `unenforced`
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

Describe current behavior first. Put proposals in issue trackers, roadmaps, or `enforced-by: prose/vale gspot.present-state`
approved future-content sections.
