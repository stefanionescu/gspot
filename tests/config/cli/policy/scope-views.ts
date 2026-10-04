export const POLICY = `configurations = ["bash", "structure"]
[agent_rules]
enabled = false
[limits.bash]
file_lines = 100
[bash]
boundary_roots = ["root"]
doc_style = "colon"
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[[scope]]
path = "api"
configurations = ["bash"]
[scope.limits.bash]
file_lines = 80
[scope.bash]
boundary_roots = ["api"]
doc_style = "dash"
[[scope]]
path = "api/v1"
configurations = ["bash"]
[scope.limits.bash]
file_lines = 60
[scope.bash]
boundary_roots = ["api/v1"]
doc_style = "colon"
[[scope]]
path = "web"
configurations = ["bash"]
`;
