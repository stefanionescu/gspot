export const CONFLICTING_CONFIG_FILE_CASES = [
    ['basic', []],
    [
        'all',
        [
            {
                file: '.commitlintrc.json',
                rule: 'conflicting-config-file',
                message:
                    'gspot writes the settings for commitlint, so .commitlintrc.json no longer applies. Delete it, and move any rule you need into gspot.toml.',
            },
        ],
    ],
] as const;

export const GENERATED_BASH_FILES = {
    'gspot.toml': 'configurations = ["bash"]\n[rules]\nenabled = false\n',
    'run.sh': '#!/usr/bin/env bash\necho ok\n',
};

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
        messages: [
            'gone/** under [[import_rule]] matches no tracked file or folder.',
            'scripts/gone.sh under structure.environment_readers matches no tracked file or folder.',
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
                        environment_readers: ['app/kept.sh', 'app/gone.sh'],
                    },
                },
                {
                    path: 'app/deep',
                    structure: {
                        environment_readers: ['app/deep/kept.sh', 'app/deep/gone.sh'],
                    },
                },
            ],
        },
        messages: [
            'root-gone.sh under structure.environment_readers matches no tracked file or folder.',
            'app/gone.sh under scope.0.structure.environment_readers matches no tracked file or folder.',
            'app/deep/gone.sh under scope.1.structure.environment_readers matches no tracked file or folder.',
        ],
    },
    {
        name: 'scope paths audit absent folders',
        files: { 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            scope: [{ path: 'app' }, { path: 'app/deep' }, { path: 'absent' }, { path: 'absent/nested' }],
        },
        messages: [
            'absent under scope.2.path matches no tracked file or folder.',
            'absent/nested under scope.3.path matches no tracked file or folder.',
        ],
    },
    {
        name: 'future destinations and URL patterns are not source selectors',
        files: { 'src/kept.txt': 'kept\n' },
        settings: {
            configurations: ['site', 'supabase', 'docs'],
            site: { build_folder: 'future/site', size_limit: [{ paths: ['future/assets/**'], kilobytes: 5 }] },
            supabase: { types_file: 'future/types.ts' },
            docs: {
                allowed_urls: {
                    value: ['https://example.com/**'],
                    reason: 'A separate network pipeline validates these targets.',
                },
            },
        },
        messages: [],
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
        messages: [
            '.reports/output.json under [[ignore]] matches no tracked file or folder.',
            '.reports/unused.json under [[ignore]] matches no tracked file or folder.',
            '.reports/command.json under [[command_check]] matches no tracked file or folder.',
        ],
    },
] as const;
