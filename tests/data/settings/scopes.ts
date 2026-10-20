export const NESTED_SCOPE_SETTINGS = `configurations = ["bash", "swift", "structure"]
[rules]
enabled = false
[limits.bash]
file_lines = 100
[tools.swiftlint]
always_keep_imports = ["Foundation"]
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[[scope]]
path = "api"
configurations = ["bash"]
limits.bash.file_lines = 80
swift.xcode_scheme = "6.0"
tools.swiftlint.always_keep_imports = ["UIKit"]
[[scope]]
path = "api/v1"
configurations = ["bash"]
limits.bash.file_lines = 60
swift.xcode_scheme = "5.0"
tools.swiftlint.always_keep_imports = ["SwiftUI"]
[[scope]]
path = "web"
configurations = ["bash"]

[swift]
xcode_scheme = "5.0"
`;

export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;

export const LAYERED_SCOPE_SETTINGS = `level = "all"
configurations = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.file_lines = 30
tools.sqlfluff.dialect = "postgres"
`;
/** CSS and HTML naming fields accepted by the published settings schema. */
export const CSS_HTML_NAMING_SETTINGS = `configurations = ["css", "html"]
[naming.css]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
[naming.css.files]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
[naming.html.folders]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
`;
