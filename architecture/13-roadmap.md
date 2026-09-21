# Build Order

The phase-by-phase implementation plan is superseded by
[the remaining-work order](22-remaining.md#the-order). Its phase labels, file inventories,
fixed counts, and coverage quotas are not acceptance criteria. Historical platform and
repair evidence is retained once in [repository accounting](23-repository-audit.md#completion-and-windows-evidence).

## The v1 cut

Preserve the CLI, independently usable ESLint plugin, supported presets, and their public
contracts. Lifecycle safety, confinement, recovery, cancellation, and installed execution
remain prerequisites. Complete documentation and package verification alongside the behavior
they describe. Do not infer completion from the existence of a file, manifest entry, or test.

Build the host artifact and plugin during affected implementation work. Reserve seven-target
builds and complete acceptance for the frozen candidate under
[the implementation gate](22-remaining.md#implementation-gate-before-touching-the-app).
The active CI bypass keeps unavailable native-platform evidence deferred. Yap adoption,
publication, and deployment require their separate authorization and acceptance gates.
