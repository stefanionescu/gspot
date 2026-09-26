# Level Policy Review

The accepted [inventory](inventory.csv) records assignments from repository snapshot
`bef8a1a8`. The [native supplement](native.csv) records additional pinned upstream
diagnostics. Both inventories retain upstream identifiers and source attribution.

Recommended covers correctness, security, accessibility, type safety, dependency
health, routine formatting, and explicitly declared project contracts. All adds
stable conventions about vocabulary, architecture, naming, documentation, API style,
and complexity. Neither level enables experimental or preview rules.

Execution cost, network access, platform support, and execution stages are separate
from levels. Integrations determine tool installation, including dependencies needed
by disabled rules.

## Inventory Coverage

The accepted inventory assigns all 210 manifest checks and 25 public custom ESLint
rules. It also records 113 distinct tools and libraries. Of the manifest checks,
144 belong to recommended and 66 belong only to all.

Rule-level rows expand ESLint presets and selectors, Ruff families, SwiftLint,
SwiftFormat, SQLFluff, Stylelint, HTML Validate, Semgrep, Vale, and banned terms.
Mixed-check explanations in the CSV form part of the accepted assignments.
The native supplement expands additional pinned suites before their defaults are
split between levels.

Entries marked "mentioned but disabled" remain disabled. Preview and removed rules
in the snapshot remain excluded from generated configurations. Ruff stability uses
the pinned 0.16.8 metadata. Formatter conflicts remain disabled at both levels.

The inventory describes membership, not compatibility among every combination of
integrations. External advisory packs can change their signatures independently
of Gspot's selectable checks.

## Implementation Constraints

- Keep formatting and ordinary framework correctness in recommended.
- Put vocabulary restrictions, mandatory layouts, and complexity ceilings in all.
- Keep client/server security and conflicting barrel export checks in recommended.
- Separate SQL syntax and formatting from comment bans and function-size limits.
- Validate existing documentation at recommended; require coverage only at all.
- Separate unsafe operations from blanket API prohibitions.
- Enforce declared coverage, size, license, and import policies at either level.
- Preserve explicit values, scopes, ignores, reasons, and individual check opt-ins.
- Reject experimental activation before writing generated output.
