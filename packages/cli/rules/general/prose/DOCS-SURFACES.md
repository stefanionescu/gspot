---
layer: prose
configuration: prose
title: Documentation Surfaces
---

# Documentation Surfaces

Command-line interfaces, APIs, libraries, configuration, environment variables, architecture,
contributor guides, troubleshooting, logs, audit events, and release notes.

## Document specialized technical surfaces

Different technical surfaces need additional contract details.

### Command-line interfaces

For each command, document:

- Purpose.
- Syntax.
- Required arguments.
- Optional arguments and defaults.
- Flags and accepted values.
- Environment variables.
- Working directory assumptions.
- Input files or standard input.
- Standard output and standard error behavior.
- Exit status.
- Side effects.
- Permissions.
- Safe examples.
- Destructive consequences.

Use command invocations and output, not screenshots of a terminal.

Keep a short common-command list in the README. Put exhaustive command details
in CLI reference documentation or the advanced guide when the surface is small
and specialist.

### APIs

For each endpoint or operation, document:

- HTTP method and path.
- Purpose.
- Authentication.
- Required role or scope.
- Headers.
- Path parameters.
- Query parameters.
- Request body.
- Field types and required status.
- Constraints and defaults.
- Success status and response body.
- Error statuses and stable error codes.
- Pagination.
- Rate limits.
- Idempotency.
- Retries.
- Side effects.
- Version availability.
- One valid request and response example.

Use exact field names and values from the contract owner.

Do not expose internal table names, stack traces, service topology, or other
implementation details through error examples.

Document full error messages exactly when they are part of a public terminal,
log, or API contract.

### Libraries and modules

A library README includes:

- One-line purpose.
- Installation.
- Minimal import and use.
- Supported runtime or language versions.
- Main public types and functions.
- Parameter and return behavior.
- Errors and side effects.
- Concurrency or thread-safety guarantees.
- Compatibility constraints.
- Link to complete API reference.
- License.

Reference documentation must define:

- Signatures.
- Types.
- Optional values.
- Defaults.
- Return values.
- Errors.
- Callbacks or events.
- Ownership and lifecycle when resources require cleanup.

Do not require readers to inspect source to learn routine public behavior.

### Configuration

For each configuration key, document:

- Exact key.
- Purpose.
- Type.
- Default.
- Allowed values.
- Required or optional status.
- Scope.
- Precedence.
- Environment availability.
- Secret status.
- Reload or restart requirement.
- Security effect.
- Example.

Do not duplicate default values in several narrative sections. Keep one
reference owner and link to it.

Show parent keys in YAML, TOML, or JSON examples so placement is unambiguous.

State whether an empty string, missing key, and explicit `null` have different
meanings.

### Environment variables

For each environment variable, document:

- Name.
- Purpose.
- Required status.
- Expected format.
- Example placeholder.
- Secret status.
- Process that reads it.
- When it is read.
- Failure behavior when missing or invalid.

Do not put real secret values in `.env` examples.

Use:

```dotenv
API_BASE_URL=https://api.example.com
ACCESS_TOKEN=<ACCESS_TOKEN>
```

Label committed example files clearly and ensure secret-bearing local files are
ignored.

### Architecture

Architecture documentation explains:

- System boundaries.
- Component ownership.
- Direction of dependencies.
- Primary data flows.
- Trust boundaries.
- State ownership.
- External services.
- Failure boundaries.
- Concurrency model.
- Persistence model.
- Deployment shape.
- Important invariants.

Explain why a boundary exists when the reason is not obvious from the model.

Do not list source directories or classes as an architecture overview. The
prohibition on project layout sections applies to architecture documentation.
Describe durable concepts and responsibilities without inventorying the source
tree.

Use diagrams only when they make relationships clearer than prose.

### Contributor documentation

Contributor documentation includes:

- Supported development environment.
- Setup.
- Ownership and contribution boundaries needed to complete contributor tasks,
  without a directory or file inventory.
- Normal development workflow.
- Branch and commit policy.
- Code and documentation standards.
- How to add or change generated artifacts.
- Review expectations.
- Testing and verification policy.
- Contribution licensing.
- Security reporting route.

Do not repeat product-user setup unless contributors actually use the same path.

### Troubleshooting

Write symptom-first headings:

```markdown
### Deployment remains in `Pending`
```

For each problem, include:

- Observable symptom.
- Exact message when relevant.
- Affected scope.
- Diagnostic command or UI check.
- Likely cause.
- Resolution.
- Cleanup or recovery.
- Escalation information.

Order causes from most common and least invasive to rare and destructive.

Do not start with a destructive reset when a focused diagnosis exists.

Do not present speculative causes as confirmed facts.

### Logs and errors

When showing a log or error:

- Reproduce public text exactly.
- Use inline code for a short message.
- Use a `text` block for multi-line output.
- Remove timestamps and IDs that add no diagnostic value.
- Replace sensitive values.
- Explain what part of the message matters.
- State the scope and likely cause.

Do not paste entire logs when a few relevant lines are enough.

### Audit event references

Audit events are historical records. Describe the completed event in past tense.
Use passive voice when the actor varies or is separately captured.

```text
The repository visibility was changed.
```

Do not repeat context already supplied by the event table or category.

## Document releases and lifecycle changes

Release documentation tells users what they need to know about a version.

### Feature notes

A feature note answers:

- Who is affected?
- What need can they address?
- What behavior is available?
- Where is the complete documentation?

Use present tense.

Do not use "now" unless timing contrast is essential.

### Bug-fix notes

A bug-fix note answers:

- Who was affected?
- What incorrect behavior do they observe?
- Is any action required?

Describe the previous symptom in past tense. "Fixed a bug" is implied and does
not add useful information.

Use:

```text
Workflow jobs remained queued when a matching runner became available after the
job entered the queue.
```

### Change notes

A change note answers:

- What behavior differs?
- Who is affected?
- Why does the difference matter?
- What action is required?

Use present tense for behavior in the documented release.

### Security-fix notes

Follow the project's disclosure policy.

Include only authorized details:

- Severity.
- Affected versions.
- Impact.
- Mitigation or fixed version.
- Vulnerability identifier when public.
- Required action.

Do not publish exploit details before coordinated disclosure permits them.

### Known issues

A known-issue note includes:

- Affected audience and versions.
- Observable symptom.
- Triggering condition.
- Safe workaround.
- Data-loss or security risk.
- Tracking issue when public.

Do not write "This can be ignored" unless ignoring the issue is verified as
safe.

### Deprecation and closing-down notices

State:

- What is deprecated.
- Who is affected.
- Whether it still receives support.
- Recommended replacement.
- Migration path.
- Earliest removal version or date when formally committed.

Put deprecation warnings in the reference page for the feature as well as
release notes.

### Retirement notices

State:

- What is unavailable now.
- The first version without it.
- The supported replacement.
- Data export or migration requirements.
- What support remains, if any.

Use direct language. Do not hide retirement behind "changes to availability."

### Errata

When published documentation or release notes contained a material error:

- Identify the affected statement.
- Provide the corrected fact.
- Add the correction date in the release system's standard format.
- Update the canonical documentation.

Do not silently preserve false history.

### Datestamps

Use ISO dates for update markers:

```text
[Updated: 2026-07-15]
```

Do not add datestamps to ordinary evergreen content. Version control already
tracks routine edits.
