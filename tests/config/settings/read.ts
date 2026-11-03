export const CONFLICTING_DEFAULT_ERRORS = [
    {
        path: ['configurations'],
        message:
            'The configurations sql and alternate-sql set sql.dialect to different values. Set it yourself in gspot.toml to decide.',
    },
] as const;

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

export const POSTGRES_ORIGIN = 'configuration postgres';

export const INVALID_LICENSES = ['MTI', 'MIT OR Apache-2.0'];

export const VALID_LICENSES = ['MIT', 'GPL-2.0-only WITH Classpath-exception-2.0'];

export const INVALID_MARKDOWNLINT_NAMES = [
    { name: 'no-hard-tabs', value: { spaces_per_tab: 4 } },
    { name: 'default', value: false },
    { name: 'whitespace', value: {} },
];

export const RULE_OPTION_REASON_TABLES = [
    { name: 'root', tables: '[tools.eslint.rules]\nno-console = [{ allow = ["warn"], reason = true }]\n' },
    {
        name: 'override',
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules.no-console = [{ allow = ["warn"], reason = true }]\n',
    },
    {
        name: 'plugin',
        tables: '[[tools.eslint.plugins]]\nname = "local"\npath = "local.mjs"\nrules.custom = [{ reason = true }]\n',
    },
];

export const DUPLICATED_REASON_ERRORS = [
    {
        key: 'limits.max_file_lines',
        text: '[limits]\nmax_file_lines = { value = 400, reason = "x" }\n',
        message:
            'gspot.toml:3: limits.max_file_lines.reason: limits.max_file_lines needs a reason of two or more words that says why: "x" is refused.',
    },
    {
        key: 'docs.allowed_urls',
        text: '[docs]\nallowed_urls = { value = ["https://example.com/docs"], reason = "x" }\n',
        message:
            'gspot.toml:3: docs.allowed_urls.reason: docs.allowed_urls needs a reason of two or more words that says why: "x" is refused.',
    },
];

export const KEY_PATH_CASES = [
    {
        name: 'a package tag used as a license version',
        configurations: ['licenses'],
        options: {
            tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "latest"\nreason = "Reviewed its MIT license."\n',
        },
        where: [
            'gspot.toml:4: licenses.allowed_package.0.version: The value "latest" is not valid for licenses.allowed_package.0.version. Name an exact version, a semver range such as ^1.2.0, or * for every version.',
        ],
        correction: ['"latest"', '"^1.2.3"'],
    },
    {
        name: 'an invalid naming override regular expression',
        configurations: ['naming'],
        options: {
            tables: '[[naming.override]]\npaths = ["src/**"]\nignored_names_pattern = "("\nreason = "The library exports these reviewed names."\n',
        },
        where: [
            'gspot.toml:4: naming.override.0.ignored_names_pattern: The value "(" is not valid for naming.override.0.ignored_names_pattern. Use a valid Unicode regular expression.',
        ],
        correction: ['"("', '"^_"'],
    },
    {
        name: 'empty override paths',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = []\nrules = {eqeqeq = ["always"]}\n' },
        correction: ['paths = []', 'paths = ["src"]'],
        where: [
            'gspot.toml:3: tools.eslint.override.0.paths: The value [] is not valid for tools.eslint.override.0.paths. Use a valid list value: ',
        ],
    },
    {
        name: 'numeric rule options',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = ["src"]\nrules = {eqeqeq = 0}\n' },
        correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'],
        where: [
            'gspot.toml:4: tools.eslint.override.0.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To ignore eqeqeq, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
        ],
    },
] as const;

export const UNKNOWN_KEY_CASES = [
    {
        name: 'a misspelled key names the closest key',
        text: `[dependencies]
bun_scanners = "@socketsecurity/bun-security-scanner"
`,
        message: 'gspot.toml:2: dependencies.bun_scanners: There is no setting called dependencies.bun_scanners.',
        correction: ['bun_scanners', 'bun_scanner'] as const,
    },
] as const;

export const RULE_FILE_SETTINGS = {
    configurations: ['javascript', 'security'],
    tools: { eslint: { plugins: [{ name: 'root', path: 'missing-root.mjs', rules: {} }] } },
    security: { rule_files: ['missing-root.yml', 'present.yml'] },
    scope: [
        {
            path: 'app',
            tools: { eslint: { plugins: [{ name: 'local', path: 'missing-scope.mjs', rules: {} }] } },
            security: { rule_files: ['missing-scope.yml', 'present.yml'] },
        },
    ],
} as const;

export const RULE_FILE_ERRORS = [
    'gspot.toml:4: tools.eslint.plugins.0.path: missing-root.mjs names no file. Point path at a file, relative to its table.',
    'gspot.toml:7: security.rule_files.0: missing-root.yml names no file. Point rule_files at a file, relative to its table.',
    'gspot.toml:11: scope.0.tools.eslint.plugins.0.path: missing-scope.mjs names no file. Point path at a file, relative to its table.',
    'gspot.toml:12: scope.0.security.rule_files.0: missing-scope.yml names no file. Point rule_files at a file, relative to its table.',
] as const;

export const EMPTY_REASONS = [
    { reason: '', refused: 'an empty reason' },
    { reason: 'because', refused: '"because"' },
] as const;

export const INVALID_TOOL_ENUMS = [
    {
        configuration: 'docker',
        tables: '[docker]\nseverity = ["SEVERE"]\n',
        message:
            'gspot.toml:3: docker.severity.0: The value "SEVERE" is not valid for docker.severity.0. Use UNKNOWN, LOW, MEDIUM, HIGH, or CRITICAL.',
    },
] as const;

export const SCOPE_CONFIGURATION_SETTINGS = [
    {
        name: 'a sibling configuration does not expose its settings to another scope',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n[scope.sql]\ndialect = "sqlite"\n',
        messages: [
            'gspot.toml:8: scope.1.sql.dialect: There is no setting called sql.dialect. No setting exists under that table. Run gspot list settings to see every one.',
        ],
    },
    {
        name: 'a selected scope exposes its own configuration settings',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[scope.sql]\ndialect = "sqlite"\n[[scope]]\npath = "web"\n',
        messages: [],
    },
    {
        name: 'root settings remain available to a scope that selects their configuration',
        text: 'configurations = ["bash"]\n[sql]\ndialect = "sqlite"\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n',
        messages: [],
    },
] as const;

export const UNKNOWN_TABLE_FIELDS = [
    {
        text: '[format]\nlevel = true\n',
        path: ['format', 'level'],
        message: 'There is no setting called format.level.',
    },
    {
        text: '[[scope]]\npath = "app"\n[scope.format]\nlevel = true\n',
        path: ['scope', 0, 'format', 'level'],
        message: 'There is no setting called format.level.',
    },
    {
        text: '[[tools.eslint.override]]\npaths = ["src/**"]\nlevel = true\n',
        path: ['tools', 'eslint', 'override', 0, 'level'],
        message: 'There is no setting called tools.eslint.override.level.',
    },
] as const;

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

export const REVIEWED_REASON = 'Reviewed in tests.';

export const COMMENTED_SETTINGS = `#:schema x

# Comment on configurations.
configurations = ["bash"]

[hooks]
# gspot checks the changed paths of a push.
enabled = true
`;

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
