---
layer: prose
preset: prose
title: Documentation Surfaces
---

# Documentation Surfaces

Command-line interfaces, APIs, libraries, configuration, environment variables, architecture,
contributor guides, troubleshooting, logs, audit events, and release notes.

## Document specialized technical surfaces

Different technical surfaces need additional contract details.

### Command-line interfaces

For each command, document:

- Purpose. `unenforced`
- Syntax. `unenforced`
- Required arguments. `unenforced`
- Optional arguments and defaults. `unenforced`
- Flags and accepted values. `unenforced`
- Environment variables. `unenforced`
- Working directory assumptions. `unenforced`
- Input files or standard input. `unenforced`
- Standard output and standard error behavior. `unenforced`
- Exit status. `unenforced`
- Side effects. `unenforced`
- Permissions. `unenforced`
- Safe examples. `unenforced`
- Destructive consequences. `unenforced`

Use command invocations and output, not screenshots of a terminal. `unenforced`

Keep a short common-command list in the README. Put exhaustive command details `unenforced`
in CLI reference documentation or the advanced guide when the surface is small
and specialist.

### APIs

For each endpoint or operation, document:

- HTTP method and path. `unenforced`
- Purpose. `unenforced`
- Authentication. `unenforced`
- Required role or scope. `unenforced`
- Headers. `unenforced`
- Path parameters. `unenforced`
- Query parameters. `unenforced`
- Request body. `unenforced`
- Field types and required status. `unenforced`
- Constraints and defaults. `unenforced`
- Success status and response body. `unenforced`
- Error statuses and stable error codes. `unenforced`
- Pagination. `unenforced`
- Rate limits. `unenforced`
- Idempotency. `unenforced`
- Retries. `unenforced`
- Side effects. `unenforced`
- Version availability. `unenforced`
- One valid request and response example. `unenforced`

Use exact field names and values from the contract owner. `unenforced`

Do not expose internal table names, stack traces, service topology, or other `unenforced`
implementation details through error examples.

Document full error messages exactly when they are part of a public terminal, `unenforced`
log, or API contract.

### Libraries and modules

A library README includes:

- One-line purpose. `unenforced`
- Installation. `unenforced`
- Minimal import and use. `unenforced`
- Supported runtime or language versions. `unenforced`
- Main public types and functions. `unenforced`
- Parameter and return behavior. `unenforced`
- Errors and side effects. `unenforced`
- Concurrency or thread-safety guarantees. `enforced-by: prose/vale gspot.currency`
- Compatibility constraints. `unenforced`
- Link to complete API reference. `unenforced`
- License. `unenforced`

Reference documentation must define:

- Signatures. `unenforced`
- Types. `unenforced`
- Optional values. `unenforced`
- Defaults. `unenforced`
- Return values. `unenforced`
- Errors. `unenforced`
- Callbacks or events. `unenforced`
- Ownership and lifecycle when resources require cleanup. `unenforced`

Do not require readers to inspect source to learn routine public behavior. `unenforced`

### Configuration

For each configuration key, document:

- Exact key. `unenforced`
- Purpose. `unenforced`
- Type. `unenforced`
- Default. `unenforced`
- Allowed values. `unenforced`
- Required or optional status. `unenforced`
- Scope. `unenforced`
- Precedence. `unenforced`
- Environment availability. `unenforced`
- Secret status. `enforced-by: secrets/gitleaks`
- Reload or restart requirement. `unenforced`
- Security effect. `unenforced`
- Example. `unenforced`

Do not duplicate default values in several narrative sections. Keep one `unenforced`
reference owner and link to it.

Show parent keys in YAML, TOML, or JSON examples so placement is unambiguous.

State whether an empty string, missing key, and explicit `null` have different `unenforced`
meanings.

### Environment variables

For each environment variable, document:

- Name. `unenforced`
- Purpose. `unenforced`
- Required status. `unenforced`
- Expected format. `unenforced`
- Example placeholder. `enforced-by: prose/vale gspot.placeholders`
- Secret status. `enforced-by: secrets/gitleaks`
- Process that reads it. `unenforced`
- When it is read. `unenforced`
- Failure behavior when missing or invalid. `unenforced`

Do not put real secret values in `.env` examples. `enforced-by: secrets/gitleaks`

Use:

```dotenv
API_BASE_URL=https://api.example.com
ACCESS_TOKEN=<ACCESS_TOKEN>
```

Label committed example files clearly and ensure secret-bearing local files are
ignored.

### Architecture

Architecture documentation explains:

- System boundaries. `unenforced`
- Component ownership. `unenforced`
- Direction of dependencies. `unenforced`
- Primary data flows. `unenforced`
- Trust boundaries. `unenforced`
- State ownership. `unenforced`
- External services. `unenforced`
- Failure boundaries. `unenforced`
- Concurrency model. `enforced-by: prose/vale gspot.currency`
- Persistence model. `unenforced`
- Deployment shape. `unenforced`
- Important invariants. `unenforced`

Explain why a boundary exists when the reason is not obvious from the model. `unenforced`

Do not list source directories or classes as an architecture overview. The `enforced-by: prose/vale gspot.interface-verbs`
prohibition on project layout sections applies to architecture documentation.
Describe durable concepts and responsibilities without inventorying the source
tree.

Use diagrams only when they make relationships clearer than prose. `unenforced`

### Contributor documentation

Contributor documentation includes:

- Supported development environment. `unenforced`
- Setup. `unenforced`
- Ownership and contribution boundaries needed to complete contributor tasks,
  without a directory or file inventory. `enforced-by: prose/vale gspot.heading-names`
- Normal development workflow. `unenforced`
- Branch and commit policy. `unenforced`
- Code and documentation standards. `unenforced`
- How to add or change generated artifacts. `unenforced`
- Review expectations. `unenforced`
- Testing and verification policy. `unenforced`
- Contribution licensing. `unenforced`
- Security reporting route. `unenforced`

Do not repeat product-user setup unless contributors actually use the same path. `unenforced`

### Troubleshooting

Write symptom-first headings:

```markdown
### Deployment remains in `Pending`
```

For each problem, include:

- Observable symptom. `unenforced`
- Exact message when relevant. `unenforced`
- Affected scope. `unenforced`
- Diagnostic command or UI check. `unenforced`
- Likely cause. `unenforced`
- Resolution. `unenforced`
- Cleanup or recovery. `unenforced`
- Escalation information. `unenforced`

Order causes from most common and least invasive to rare and destructive. `unenforced`

Do not start with a destructive reset when a focused diagnosis exists. `unenforced`

Do not present speculative causes as confirmed facts. `unenforced`

### Logs and errors

When showing a log or error:

- Reproduce public text exactly. `unenforced`
- Use inline code for a short message. `unenforced`
- Use a `text` block for multi-line output. `unenforced`
- Remove timestamps and IDs that add no diagnostic value. `unenforced`
- Replace sensitive values. `unenforced`
- Explain what part of the message matters. `unenforced`
- State the scope and likely cause. `unenforced`

Do not paste entire logs when a few relevant lines are enough. `unenforced`

### Audit event references

Audit events are historical records. Describe the completed event in past tense.
Use passive voice when the actor varies or is separately captured.

```text
The repository visibility was changed.
```

Do not repeat context already supplied by the event table or category. `unenforced`

## Document releases and lifecycle changes

Release documentation tells users what they need to know about a version. `unenforced`

### Feature notes

A feature note answers:

- Who is affected? `unenforced`
- What need can they address? `unenforced`
- What behavior is available? `unenforced`
- Where is the complete documentation? `unenforced`

Use present tense. `unenforced`

Do not use "now" unless timing contrast is essential. `unenforced`

### Bug-fix notes

A bug-fix note answers:

- Who was affected? `unenforced`
- What incorrect behavior could they observe? `enforced-by: prose/vale gspot.modals`
- Is any action required? `unenforced`

Describe the previous symptom in past tense. "Fixed a bug" is implied and does `unenforced`
not add useful information.

Use:

```text
Workflow jobs remained queued when a matching runner became available after the
job entered the queue.
```

### Change notes

A change note answers:

- What behavior differs? `unenforced`
- Who is affected? `unenforced`
- Why does the difference matter? `unenforced`
- What action is required? `unenforced`

Use present tense for behavior in the documented release. `unenforced`

### Security-fix notes

Follow the project's disclosure policy. `unenforced`

Include only authorized details:

- Severity. `unenforced`
- Affected versions. `unenforced`
- Impact. `unenforced`
- Mitigation or fixed version. `unenforced`
- Vulnerability identifier when public. `unenforced`
- Required action. `unenforced`

Do not publish exploit details before coordinated disclosure permits them. `unenforced`

### Known issues

A known-issue note includes:

- Affected audience and versions. `unenforced`
- Observable symptom. `unenforced`
- Triggering condition. `unenforced`
- Safe workaround. `unenforced`
- Data-loss or security risk. `unenforced`
- Tracking issue when public. `unenforced`

Do not write "This can be ignored" unless ignoring the issue is verified as `unenforced`
safe.

### Deprecation and closing-down notices

State:

- What is deprecated. `unenforced`
- Who is affected. `unenforced`
- Whether it still receives support. `unenforced`
- Recommended replacement. `unenforced`
- Migration path. `unenforced`
- Earliest removal version or date when formally committed. `enforced-by: prose/vale gspot.dates`

Put deprecation warnings in the reference page for the feature as well as `unenforced`
release notes.

### Retirement notices

State:

- What is no longer available. `unenforced`
- The first version without it. `unenforced`
- The supported replacement. `unenforced`
- Data export or migration requirements. `unenforced`
- What support remains, if any. `unenforced`

Use direct language. Do not hide retirement behind "changes to availability." `unenforced`

### Errata

When published documentation or release notes contained a material error:

- Identify the affected statement. `unenforced`
- Provide the corrected fact. `unenforced`
- Add the correction date in the release system's standard format. `enforced-by: prose/vale gspot.dates`
- Update the canonical documentation. `unenforced`

Do not silently preserve false history. `enforced-by: prose/vale gspot.present-state`

### Datestamps

Use ISO dates for update markers:

```text
[Updated: 2026-07-15]
```

Do not add datestamps to ordinary evergreen content. Version control already `enforced-by: prose/vale gspot.dates`
tracks routine edits.
