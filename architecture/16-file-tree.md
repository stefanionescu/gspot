# Implementation Boundaries

[22-remaining.md](22-remaining.md) owns implementation order and unfinished acceptance.
These boundaries constrain dependencies; they do not prescribe a directory tree or require
cosmetic moves, empty folders, forwarding modules, or one source and test file per check.

- Commands translate arguments and present results. Application behavior remains callable
  without a terminal. The runner computes findings and statuses once; output renders them.
- Generators propose output. Lifecycle owns application, collisions, recorded ownership,
  recovery, and removal. A generated header or directory name never authorizes deletion.
  [Configuration](03-configuration.md) owns the exact generated-path contracts.
- Presets own shipped policy, pins, templates, styles, and vocabulary. CLI code owns loading,
  validation, parsing, and execution. Authored rule guides remain separate from executable policy.
- Domain checks share parsers and preparation where useful. Structure, naming, and prose
  retain their language semantics. Basic infrastructure must not load a check catalog.
- Shared types describe actual shared contracts. Derive parsed-input types from schemas;
  keep local types and algorithm constants with their consumers.
- The ESLint plugin owns standalone editor enforcement and public exports. A CLI replacement
  must preserve that behavior before shared internals can replace custom rules.
- Packaging uses one version and target definition. The launcher selects an installed platform
  artifact; installed-consumer acceptance exercises package identity and execution together.
- Documentation builds generate references from validated definitions. Replace or prune only
  owned pages; preserve authored content and prior output on failure.

[Repository testing](12-repository-layout.md#tests) defines behavioral evidence. Package tests
exercise their owners; command and release acceptance exercise public and installed journeys.
Keep test data beside its consumer. Share harness code only for real setup, execution, or cleanup.
Move surviving regressions with their behavior and delete tests of removed details.

Change an owner with its callers, assets, and build inputs in the same batch. Preserve canonical
check names, public exports, and enforcement across supported languages and frameworks.
