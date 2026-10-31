export const SEMGREP_IGNORE = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['sample.js'],
    reason: 'The sandbox owns its temporary files.',
};

export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
] as const;

export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';

export const COMMENTED_SETTINGS = `#:schema x

# Comment on configurations.
configurations = ["bash"]

[hooks]
# gspot checks the changed paths of a push.
enabled = true
`;

export const PUBLISHED_SCHEMA_CASES = [
    { name: 'escaped glob brackets', input: { test_files: [String.raw`src/\[draft\]/*.test.ts`] }, valid: true },
    { name: 'a path with an ASCII control character', input: { test_files: ['src/\u0001.test.ts'] }, valid: false },
    { name: 'a path with a C1 control character', input: { test_files: ['src/\u0085.test.ts'] }, valid: false },
    { name: 'a path with an invalid escape', input: { test_files: [String.raw`src/\a.test.ts`] }, valid: false },
    {
        name: 'GitHub CI with systems',
        input: { ci: { provider: 'github', operating_systems: ['linux'] } },
        valid: true,
    },
    { name: 'GitLab CI without systems', input: { ci: { provider: 'gitlab' } }, valid: true },
    {
        name: 'GitLab CI with systems',
        input: { ci: { provider: 'gitlab', operating_systems: ['linux'] } },
        valid: false,
    },
    {
        name: 'GitLab CI with an empty systems list',
        input: { ci: { provider: 'gitlab', operating_systems: [] } },
        valid: false,
    },
    {
        name: 'an empty command',
        input: { command_check: [{ id: 'project/lint', command: [], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty program',
        input: { command_check: [{ id: 'project/lint', command: [''], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty argument',
        input: { command_check: [{ id: 'project/lint', command: ['lint', ''], paths: ['src/**'], stage: 'commit' }] },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { override: [{ paths: ['src/**'] }] } },
        valid: false,
    },
    {
        name: 'an allowed package with a version range',
        input: {
            licenses: {
                allowed_package: [{ name: 'example', version: '^1.2.3', reason: 'Reviewed its MIT license.' }],
            },
        },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
    },
    {
        name: 'reasoned registry hosts',
        input: {
            dependencies: {
                allowed_registries: { value: ['registry.example.test'], reason: 'Reviewed the package registry.' },
            },
        },
        valid: true,
    },
    {
        name: 'invalid registry host',
        input: { dependencies: { allowed_registries: { value: [false], reason: 'Reviewed the package registry.' } } },
        valid: false,
    },
] as const;

export const POSTGRES_SCOPE_SETTINGS = {
    level: 'basic',
    rules: true,
    scopes: [{ path: 'api', configurations: ['supabase'] }, { path: 'authored' }],
    tables: 'postgres.client_schemas = ["client"]\n',
} as const;

export const OPENAPI_SCOPE_SETTINGS = {
    level: 'basic',
    rules: true,
    scopes: [{ path: 'api' }],
    tables: 'removed_configurations = { openapi = "This scope does not publish an OpenAPI document." }\n',
} as const;

export const SCOPE_LIMIT_VALUES = {
    '': [100, '5.0', ['Foundation']],
    api: [80, '6.0', ['Foundation', 'UIKit']],
    'api/v1': [60, '5.0', ['Foundation', 'UIKit', 'SwiftUI']],
    web: [100, '5.0', ['Foundation']],
} as const;

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

export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: [
        { path: 'app', configurations: [], removed_configurations: ['nextjs'] },
        { path: 'app/worker', configurations: ['nextjs'], removed_configurations: [] },
        { path: 'required', configurations: [], removed_configurations: ['javascript'] },
    ],
} as const;

export const PROJECT_SCOPE_CASES = [
    { scope: '', name: 'nextjs', selected: true },
    { scope: 'app', name: 'nextjs', selected: false },
    { scope: 'app/child', name: 'nextjs', selected: false },
    { scope: 'app/worker', name: 'nextjs', selected: true },
    { scope: 'sibling', name: 'nextjs', selected: true },
    { scope: 'required', name: 'javascript', selected: true },
] as const;

export const SITE_PACKAGE_MANAGER_CASES = [
    ['npm fallback', {}, 'npm'],
    ['declared Bun', { 'package.json': '{"packageManager":"bun@1.4.2"}' }, 'bun'],
] as const;
