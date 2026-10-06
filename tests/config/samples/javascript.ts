// A JavaScript policy with ESLint rules and overrides at the root, in a nested scope, and in a scope inside it.
/** Rule settings and overrides that the generated configuration and an exported template both read. */
export const ESLINT_OVERRIDE_POLICY = `configurations = ["javascript"]
[agent_rules]
enabled = false
[tools.eslint.rules]
eqeqeq = ["smart"]
[[tools.eslint.overrides]]
paths = ["tests"]
rules = {eqeqeq = ["always"]}
[[tools.eslint.overrides]]
paths = ["tests/exempt.js"]
rules = {eqeqeq = ["smart"]}
[[scope]]
path = "apps/web"
[scope.tools.eslint.rules]
eqeqeq = ["always"]
[[scope.tools.eslint.overrides]]
paths = ["**/*", "!apps/web/exempt.js"]
rules = {eqeqeq = ["smart"]}
[[scope]]
path = "apps/web/admin"
[[scope.tools.eslint.overrides]]
paths = ["**/*"]
rules = {eqeqeq = ["always"]}
`;
