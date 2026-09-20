# Shared Rule Logic

K-87, K-235, and K-86 share this contract. It replaces the earlier universal-analysis design.
The goal is reliable enforcement with fewer independent implementations where semantics agree.
An analysis may name its language. Adding a language need not take only a table row. The cleanup status lives in
[22-remaining.md](../22-remaining.md#cleanup-acceptance-backlog).

## K-87: three copies of one idea

**What is wrong.** The trivial-function, call-through, and duplicate-function logic exists for
shell, for Python, and for Swift, each with `TRIVIAL_STATEMENTS = 2`, `TRIVIAL_LINES = 3`, and
`ONE_CALLER_COUNT = 2`. A small function with one caller is a finding in Bash, Python, and Swift,
and not in TypeScript. Two functions with one body are found in Bash, Swift, and TypeScript, and
not in Python. One owner of the environment is checked in Bash, Swift, and TypeScript, and not in
Python, although `PYTHON.md` states the rule.

The import layout, the import boundaries,
duplicate names in `__all__`, and export-only modules exist for TypeScript alone. The Swift doc
comment rule and the trivial function of PL/pgSQL were never written.

**Target.** Preserve each intended policy while removing proven duplication. Share parsing,
traversal, comparison, or reporting operations only where actual callers use the same contract.
Keep Bash, Python, Swift, SQL, and TypeScript semantics explicit. TypeScript keeps its editor
integration through ESLint (D-02). Language check identifiers retain their policy and baseline
scope (D-98).

Recommended and all follow the level owner; forwarding preferences belong at all.

**Implementation.** Inspect each existing rule and its consumers before deciding what moves.
Shared limits belong to preset policy. Domain checks own their semantics; shared readers own
reusable observations. Inline an abstraction with caller-specific flags before extracting its
proven common operations.

No generic analysis framework, mandatory language table, or mirrored
file layout is required. The unwritten enforcement recorded by K-248 remains work to complete.

**Deletion.** Delete duplicate code, options, constants, dispatch wrappers, cache reset hooks,
and tests only after their callers and surviving contracts move. Do not delete a rule because
another rule has a similar name. Trivial-function checks are not unconditionally removable:
prove that their intended defects remain covered, or retain the necessary focused check.

**Acceptance.** Run representative invalid and valid language cases through the actual owner.
Use generated config for tool replacements and assert the check, diagnostic, file, and location.
Exercise language-specific distinctions, exemptions, anonymous functions, and corrected input.
A table saying a language supports an idea is descriptive metadata, not evidence of enforcement.
