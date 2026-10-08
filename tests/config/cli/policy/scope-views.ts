export const POLICY = `configurations = ["bash", "swift", "structure"]
[agent_rules]
enabled = false
[limits.bash]
file_lines = 100
[swift]
xcode_scheme = "5.0"
[tools.swiftlint]
keep_imports = ["Foundation"]
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[scope."api"]
configurations = ["bash"]
[scope."api".limits.bash]
file_lines = 80
[scope."api".swift]
xcode_scheme = "6.0"
[scope."api".tools.swiftlint]
keep_imports = ["UIKit"]
[scope."api/v1"]
configurations = ["bash"]
[scope."api/v1".limits.bash]
file_lines = 60
[scope."api/v1".swift]
xcode_scheme = "5.0"
[scope."api/v1".tools.swiftlint]
keep_imports = ["SwiftUI"]
[scope."web"]
configurations = ["bash"]
`;
