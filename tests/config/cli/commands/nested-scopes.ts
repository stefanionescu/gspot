export const NESTED_SCOPES_POLICY = `level = "all"
configurations = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[agent_rules]
enabled = false
[scope."api"]
configurations = ["bash"]
[scope."api".limits]
file_lines = 200
[scope."api".format]
indent_width = 2
[scope."api/worker"]
configurations = ["sql"]
[scope."api/worker".limits]
function_lines = 30
[scope."api/worker".tools.sqlfluff]
dialect = "postgres"
`;
