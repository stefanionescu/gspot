// field comments
export const FIELD_COMMENT_CASES = [
    {
        name: 'first ignore',
        source: '# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\n',
        expected:
            '# Root owner\nlevel="all"\n\n[[ignore]]\ncheck = "docs/links"\npaths = ["docs/**"]\nreason = "Private documentation"\n',
    },
    {
        name: 'unowned prose before deleted key',
        source: 'level="all"\n\n# Free regional note\n\n# Second regional note\n\ntool_timeout_seconds=600 # Deleted inline\n\n# Hooks owner\n[hooks]\nenabled=true\n',
        target: 'level = "all"\n\n[hooks]\nenabled = true\n',
        expected:
            'level="all"\n\n# Free regional note\n\n# Second regional note\n\n\n# Hooks owner\n[hooks]\nenabled=true\n',
    },
    {
        name: 'maps dotted and blank lines',
        source: '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Old task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
        target: 'level="all"\nhooks.enabled=true\n[[scope]]\npath="z/app"\n[[scope]]\npath="a/app"\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task"\n',
        expected:
            '# schema note\n# Root\nlevel="all" # Level inline\n# Dotted hook\nhooks.enabled=true\n\n# Z scope\n[[scope]]\npath="z/app"\n\n# A check\n[[command_check]]\nid="a/task"\ncommand=["bun","task.ts"]\npaths=["src/**"]\nstage="manual"\nsummary="Changed task" # Summary inline\n\n# A scope\n[[scope]]\npath="a/app"\n',
    },
];

// inherited defaults
export const POSTGRES_ORIGIN = { kind: 'configuration', name: 'postgres' } as const;

// inherited lists
export const PURGECSS_SAFELIST_TABLES = `[site]
allowed_classes = []
[[scope]]
path = "app"
configurations = []
[[scope]]
path = "app/deep"
configurations = []
[[scope]]
path = "sibling"
removed_configurations = { site = "This scope does not use the inherited site checks." }
`;

// published schema
export const PUBLISHED_SCHEMA_CASES = [
    { name: 'escaped glob brackets', input: { test_files: [String.raw`src/\[draft\]/*.test.ts`] }, valid: true },
    { name: 'a path with an ASCII control character', input: { test_files: ['src/\u{1}.test.ts'] }, valid: false },
    { name: 'a path with a C1 control character', input: { test_files: ['src/\u{85}.test.ts'] }, valid: false },
    { name: 'a path with an invalid escape', input: { test_files: [String.raw`src/\a.test.ts`] }, valid: false },
    {
        name: 'GitHub CI with systems',
        input: { ci: { provider: 'github', operating_systems: ['linux'] } },
        valid: true,
    },
    { name: 'GitLab CI without systems', input: { ci: { provider: 'gitlab' } }, valid: true },
    { name: 'a shipped configuration name', input: { configurations: ['python'] }, valid: true },
    { name: 'an unknown configuration name', input: { configurations: ['cobol'] }, valid: false },
    {
        name: 'an unknown configuration name in a scope',
        input: { scope: [{ path: 'api', configurations: ['cobol'] }] },
        valid: false,
    },
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
            configurations: ['licenses'],
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

// scopes
export const NESTED_SCOPE_SETTINGS = `configurations = ["bash", "swift", "structure"]
[rule_files]
enabled = false
[limits.bash]
max_file_lines = 100
[swift]
allowed_unused_imports = ["Foundation"]
xcode_scheme = "5.0"
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[[scope]]
path = "api"
configurations = ["bash"]
limits.bash.max_file_lines = 80
swift.xcode_scheme = "6.0"
swift.allowed_unused_imports = ["UIKit"]
[[scope]]
path = "api/v1"
configurations = ["bash"]
limits.bash.max_file_lines = 60
swift.xcode_scheme = "5.0"
swift.allowed_unused_imports = ["SwiftUI"]
[[scope]]
path = "web"
configurations = ["bash"]
`;
export const OPENAPI_SCOPE_SETTINGS = {
    level: 'basic',
    rules: true,
    scopes: [{ path: 'api' }],
    tables: 'removed_configurations = { openapi = "This scope does not publish an OpenAPI document." }\n',
} as const;
export const POSTGRES_SCOPE_SETTINGS = {
    level: 'basic',
    rules: true,
    scopes: [{ path: 'api', configurations: ['supabase'] }, { path: 'authored' }],
    tables: 'postgres.client_schemas = ["client"]\n',
} as const;
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

// settings edits
export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';
export const SCOPE_SETTING_WRITES = [
    ['a dotted key', 'limits.max_file_lines = 100'],
    ['an inline table', 'limits = { max_file_lines = 100 }'],
] as const;
export const SEMGREP_IGNORE = {
    check: 'security/semgrep',
    rule: 'js/file-system-race',
    paths: ['sample.js'],
    reason: 'The sandbox owns its temporary files.',
};

// settings parse
export const CONFIGURATION_CONFLICTS = [
    {
        text: 'configurations = ["bash"]\nremoved_configurations = { bash = "External checks cover Bash." }\n',
        path: ['configurations'],
    },
    {
        text: '[[scope]]\npath = "app"\nconfigurations = ["bash"]\nremoved_configurations = { bash = "External checks cover Bash." }\n',
        path: ['scope', 0, 'configurations'],
    },
] as const;
export const UNKNOWN_TABLE_FIELDS = [
    {
        text: '[format]\nlevel = true\n',
        path: ['format', 'level'],
        setting: 'format.level',
    },
    {
        text: '[[scope]]\npath = "app"\n[scope.format]\nlevel = true\n',
        path: ['scope', 0, 'format', 'level'],
        setting: 'format.level',
    },
    {
        text: '[[tools.eslint.override]]\npaths = ["src/**"]\nlevel = true\n',
        path: ['tools', 'eslint', 'override', 0, 'level'],
        setting: 'tools.eslint.override.level',
    },
] as const;
