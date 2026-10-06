export const APP_JEST = `level = "all"
configurations = ["javascript"]
[agent_rules]
enabled = false
[architecture.roles]
runtime = ["src/**"]
test_support = "tests/fixtures"
[[scope]]
path = "app"
configurations = ["jest"]
[scope.tools.jest]
globals_module = "bun:test"
`;
