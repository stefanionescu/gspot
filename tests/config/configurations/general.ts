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

// prose checks
export const SCHEDULE_RELEASE_MARKDOWN = '# Schedule\n\nRelease on 03/04/2026.\n';

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
