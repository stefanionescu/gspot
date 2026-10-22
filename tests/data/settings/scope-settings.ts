import { LocalDate } from '@decimalturn/toml-patch';

/** Settings with a Supabase scope and an authored scope. */
export const POSTGRES_SCOPE_SETTINGS = {
    level: 'recommended',
    rules: true,
    scopes: [{ path: 'api', configurations: ['supabase'] }, { path: 'authored' }],
    tables: 'postgres.client_schemas = ["client"]\n',
} as const;

/** Settings with an OpenAPI scope. */
export const OPENAPI_SCOPE_SETTINGS = {
    level: 'recommended',
    rules: true,
    scopes: [{ path: 'api' }],
    tables: 'removed_configurations = { value = ["openapi"], reason = "This scope does not publish an OpenAPI document." }\n',
} as const;

/** The limit, version, and frameworks of each scope. */
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
/** The nearest configuration choices apply to child folders, and siblings stay apart. */
export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: [
        { path: 'app', configurations: [], removed_configurations: ['nextjs'] },
        { path: 'app/worker', configurations: ['nextjs'], removed_configurations: [] },
        { path: 'required', configurations: [], removed_configurations: ['javascript'] },
    ],
} as const;
/** Inheritance from the root, removal, restoring in a deeper scope, separate siblings, and required dependencies. */
export const PROJECT_SCOPE_CASES = [
    ['', 'nextjs', true],
    ['app', 'nextjs', false],
    ['app/child', 'nextjs', false],
    ['app/worker', 'nextjs', true],
    ['sibling', 'nextjs', true],
    ['required', 'javascript', true],
] as const;
/** Package manager files, and the package manager that the default site build uses. */
export const SITE_PACKAGE_MANAGER_CASES = [
    ['npm fallback', {}, 'npm'],
    ['declared Bun', { 'package.json': '{"packageManager":"bun@1.4.2"}' }, 'bun'],
] as const;
export const SITE_BUILD_COMMANDS = [
    ['custom-builder', '', 'two words'],
    ['npm', 'run', 'build'],
] as const;

export const IGNORE_EXPIRY_ENTRIES = [
    { check: 'dependencies/osv-scanner', rule: 'permanent', reason: 'Reviewed upstream.' },
    {
        check: 'dependencies/osv-scanner',
        rule: 'past',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-19'),
    },
    {
        check: 'dependencies/osv-scanner',
        rule: 'today',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-20'),
    },
    {
        check: 'dependencies/osv-scanner',
        rule: 'future',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-21'),
    },
] as const;
