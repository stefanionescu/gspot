export const APP_JEST = `level = "all"
configurations = ["javascript"]
[agent_rules]
enabled = false
[scope."app"]
configurations = ["jest"]
[scope."app".architecture.roles]
runtime = ["src/**"]
test_harness = "tests/fixtures"
`;
