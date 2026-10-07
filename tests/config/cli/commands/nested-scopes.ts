export const NESTED_SCOPES_POLICY = `level = "all"
configurations = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[agent_rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
[scope.limits]
file_lines = 200
[scope.format]
indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
[scope.limits]
function_lines = 30
[scope.tools.sqlfluff]
dialect = "postgres"
`;
