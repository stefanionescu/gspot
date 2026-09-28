# Level Policy Verification

The accepted assignments are recorded in [the inventory](inventory.csv) and
[the review](review.md). The repository retains `level = "all"` and reasoned
exceptions for declared external contracts.

[The cleanup record](../lint-cleanup.md) owns current verification results. It
supersedes the earlier 1,922-test snapshot and its unavailable-Docker limitation.
The current local platform is macOS ARM64 with pinned Bun 1.4.2. Native Linux and
Windows results require the exact candidate's CI jobs.

Generation selects guides and sections by effective level. Recommended retains
correctness, security, accessibility, type safety, routine formatting, and declared
contracts. All adds the accepted vocabulary, architecture, naming, documentation
coverage, API style, and complexity conventions. Tests exercise both levels and
explicit check overrides. The inventory assignments are unchanged.
