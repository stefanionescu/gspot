// Authored test globs extend defaults and scope exclusions while production imports stay checked.
export const TEST_BOUNDARY_POLICY = `test_files = ["app/qa/**"]
[[architecture.modules]]
name = "app"
paths = ["app/**"]
may_import = ["app"]
[[architecture.modules]]
name = "storage"
paths = ["storage/**"]
[scope."apps/api"]
configurations = ["javascript"]
test_files = ["app/verification/**", "app/qa/**"]
[[scope."apps/api".architecture.modules]]
name = "app"
paths = ["app/**"]
may_import = ["app"]
[[scope."apps/api".architecture.modules]]
name = "storage"
paths = ["storage/**"]
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
