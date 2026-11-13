import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';

// bash sandbox
export const BASH_SANDBOX = {
    executable: ['scripts/a.sh', 'scripts/b.sh', 'scripts/build.sh'],
    cleanSource: CLEAN_BASH_SCRIPT,
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;

// bun project
export const BUN_PROJECT_FILES = {
    'package.json': JSON.stringify({
        name: 'shop',
        private: true,
        dependencies: { zod: '^4.1.0', react: '19.1.0', 'react-dom': '19.0.0' },
        devDependencies: { typescript: '0.0.0-test' },
    }),
    'bun.lock': JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
            '': {
                name: 'shop',
                dependencies: { zod: '^4.0.0', react: '19.1.0', 'react-dom': '19.0.0', 'left-pad': '1.3.0' },
            },
        },
        packages: {
            zod: ['zod@4.0.5', '', {}, 'sha512-a'],
            react: ['react@19.1.0', '', {}, 'sha512-b'],
            'react-dom': ['react-dom@19.0.0', '', {}, 'sha512-c'],
            'left-pad': ['left-pad@1.3.0', '', {}, 'sha512-d'],
        },
    }),
} as const;

// gitattributes
export const LINGUIST_GENERATED_PATTERN = 'emitted/** linguist-generated\n';

// licenses
export const ALLOWED_PACKAGE_CASES = [
    {
        name: 'with a version range covers a package',
        record: 'name = "strict"\nversion = "^1.0.0"\n',
        lockedName: 'strict',
        ecosystem: 'npm',
        findings: [],
    },
    {
        name: 'with a name glob covers each platform build',
        record: 'name = "@img/sharp-*"\nversion = "*"\n',
        lockedName: '@img/sharp-linux',
        ecosystem: 'npm',
        findings: [],
    },
    {
        name: 'normalizes a Python name',
        record: 'name = "Licensed._Example"\nversion = "1.0.0"\n',
        lockedName: 'licensed-example',
        ecosystem: 'PyPI',
        findings: [],
    },
    {
        name: 'for another version covers nothing and is unused',
        record: 'name = "strict"\nversion = "2.0.0"\n',
        lockedName: 'strict',
        ecosystem: 'npm',
        findings: ['disallowed-license', 'unused-record'],
    },
] as const;
export const GPL_PACKAGE = {
    name: 'strict',
    version: '1.0.0',
    ecosystem: 'npm',
    licenses: ['GPL-3.0-only'],
} as const;
export const LICENSE_TABLES = '[licenses]\nallowed = ["MIT", "Apache-2.0"]\n';
export const MIT_PACKAGE = { name: 'ready', version: '1.0.0', ecosystem: 'npm', licenses: [] } as const;

// prose checks
export const SCHEDULE_RELEASE_MARKDOWN = '# Schedule\n\nRelease on 03/04/2026.\n';

// secrets
export const COMPONENT_ENVIRONMENT_FINDINGS = [
    { file: 'app.astro', line: 2, rule: 'missing-key' },
    { file: 'app.svelte', line: 1, rule: 'missing-key' },
    { file: 'app.vue', line: 1, rule: 'missing-key' },
    { file: 'legacy.cjs', line: 1, rule: 'missing-key' },
    { file: 'module.mts', line: 1, rule: 'missing-key' },
    { file: 'worker.ts', line: 1, rule: 'missing-key' },
] as const;
export const ENVIRONMENT_FUNCTION_EXAMPLE = `KNOWN=example
MISSING=example
CUSTOM=example
DOLLAR=example
PYTHON=example
OTHER=example
`;
export const ENVIRONMENT_FUNCTION_FINDINGS = [
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'MISSING' },
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'OTHER' },
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'PYTHON' },
    { file: 'source.ts', line: 1, rule: 'missing-key', key: 'MISSING' },
    { file: 'source.ts', line: 2, rule: 'missing-key', key: 'CUSTOM' },
    { file: 'source.ts', line: 3, rule: 'missing-key', key: 'DOLLAR' },
] as const;
export const ENVIRONMENT_SCOPE_RESULTS = [
    { scope: '', status: 'failed', findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }] },
    { scope: 'app', status: 'failed', findings: [{ file: 'app/source.ts', line: 1, rule: 'missing-key' }] },
    {
        scope: 'sibling',
        status: 'failed',
        findings: [{ file: 'sibling/source.ts', line: 1, rule: 'missing-key' }],
    },
] as const;
export const ENV_ACCESSOR_EXAMPLE = `KNOWN=example
VITE_API=example
SVELTE_API=example
VUE_API=example
DENO_API=example
MODULE_API=example
LEGACY_API=example
`;

// unmatched paths
export const UNMATCHED_PATH_CASES = [
    {
        name: 'primitive lists and nested record paths',
        files: { 'scripts/kept.sh': 'echo kept\n', 'src/kept.txt': 'kept\n' },
        settings: {
            configurations: ['bash'],
            import_rule: [{ name: 'core', paths: ['src/**', 'gone/**'] }],
            structure: {
                environment_readers: ['scripts/kept.sh', 'scripts/gone.sh'],
            },
        },
        unmatched: [
            ['gone/**', '[[import_rule]]'],
            ['scripts/gone.sh', 'structure.environment_readers'],
        ],
    },
    {
        name: 'inherited paths are audited once from the repository root',
        files: { 'app/kept.sh': 'echo kept\n', 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            structure: {
                environment_readers: ['root-gone.sh'],
            },
            scope: [
                {
                    path: 'app',
                    structure: {
                        environment_readers: ['kept.sh', 'gone.sh'],
                    },
                },
                {
                    path: 'app/deep',
                    structure: {
                        environment_readers: ['kept.sh', 'gone.sh'],
                    },
                },
            ],
        },
        unmatched: [
            ['root-gone.sh', 'structure.environment_readers'],
            ['app/gone.sh', 'scope.0.structure.environment_readers'],
            ['app/deep/gone.sh', 'scope.1.structure.environment_readers'],
        ],
    },
    {
        name: 'scope paths audit absent folders',
        files: { 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            scope: [{ path: 'app' }, { path: 'app/deep' }, { path: 'absent' }, { path: 'absent/nested' }],
        },
        unmatched: [
            ['absent', 'scope.2.path'],
            ['absent/nested', 'scope.3.path'],
        ],
    },
    {
        name: 'future destinations and URL patterns are not source selectors',
        files: { 'src/kept.txt': 'kept\n' },
        settings: {
            configurations: ['site', 'supabase', 'docs'],
            site: { build_folder: 'future/site' },
            supabase: { types_file: 'future/types.ts' },
            docs: {
                allowed_urls: {
                    value: ['https://example.com/**'],
                    reason: 'A separate network pipeline validates these targets.',
                },
            },
        },
        unmatched: [],
    },
    {
        name: 'a document that names a path does not make it tracked',
        files: { 'docs/guide.md': 'The runner writes `.reports/output.json`.\n' },
        settings: {
            configurations: ['docs', 'structure', 'nextjs'],
            command_check: [
                { id: 'reports/collect', command: ['echo'], stage: 'commit', paths: ['.reports/command.json'] },
            ],
            ignore: [
                {
                    check: 'docs/lychee',
                    paths: ['.reports/output.json', '.reports/unused.json'],
                    reason: 'An obsolete source exclusion.',
                },
            ],
        },
        unmatched: [
            ['.reports/command.json', '[[command_check]]'],
            ['.reports/output.json', '[[ignore]]'],
            ['.reports/unused.json', '[[ignore]]'],
        ],
    },
] as const;

// weakenings check
export const IMPORT_RULE_TABLES = `[[import_rule]]
name = "core"
paths = ["src/core/**"]

[[import_rule]]
name = "store"
paths = ["src/store/**"]
can_import = []

[[import_rule]]
name = "app"
paths = ["src/app/**"]
can_import = ["core"]
`;
