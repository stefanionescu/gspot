/** Sibling Python projects with different enabled tools. */
export const NESTED_PYTHON_POLICY = `configurations = []
[[ignore]]
check = "python/basedpyright"
paths = ["linted/**"]
reason = "This project uses Ruff without a type checker."
[[scope]]
path = "linted"
configurations = ["python"]
[[scope]]
path = "typed"
configurations = ["python"]
[agent_rules]
enabled = false
`;

/** SwiftFormat remains active after both other external Swift checks are ignored. */
export const SWIFT_FORMAT_POLICY = `configurations = ["swift"]
run_with = "mise"
[[ignore]]
check = "swift/swiftlint"
reason = "SwiftFormat owns this fixture's formatting."
[[ignore]]
check = "swift/swiftlint-analyze"
reason = "This fixture has no analyzer build log."
[[ignore]]
check = "swift/periphery"
reason = "This fixture has no Xcode project."
[agent_rules]
enabled = false
`;

/** Only the native EditorConfig check consumes formatting configuration. */
export const EDITORCONFIG_POLICY = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This fixture uses EditorConfig without Prettier."
[agent_rules]
enabled = false
`;
