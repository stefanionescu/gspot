// Authored test globs extend defaults and scope exclusions while production imports stay checked.
export const TEST_BOUNDARY_POLICY = `tests = ["app/qa/**"]
[agent_rules]
enabled = false
[[architecture.modules]]
name = "app"
paths = ["app/**"]
[[architecture.modules]]
name = "storage"
paths = ["storage/**"]
[[architecture.imports_allowed]]
from = "app"
to = ["app"]
[[scope]]
path = "apps/api"
configurations = ["javascript"]
tests = ["app/verification/**"]
[[scope.architecture.modules]]
name = "app"
paths = ["app/**"]
[[scope.architecture.modules]]
name = "storage"
paths = ["storage/**"]
[[scope.architecture.imports_allowed]]
from = "app"
to = ["app"]
`;

export const BOUNDARY_CASES = [
    { path: 'app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'app/verification/check.js', importPath: '../../storage/value.js', count: 1 },
    { path: 'app/example.test.js', importPath: '../storage/value.js', count: 0 },
    { path: 'apps/api/app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/verification/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/example.spec.js', importPath: '../storage/value.js', count: 0 },
] as const;
