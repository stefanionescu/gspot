/** Root-relative source selectors and output destinations have distinct roles. */
export const UNUSED_PATH_CASES = [
    {
        name: 'primitive lists and nested record paths',
        files: { 'scripts/kept.sh': 'echo kept\n', 'src/kept.txt': 'kept\n' },
        settings: {
            configurations: ['bash'],
            architecture: {
                module: [{ name: 'core', paths: ['src/**', 'gone/**'] }],
                roles: { environment_readers: ['scripts/kept.sh', 'scripts/gone.sh'] },
            },
        },
        unmatched: ['gone/**', 'scripts/gone.sh'],
    },
    {
        name: 'inherited paths are audited once from the repository root',
        files: { 'app/kept.sh': 'echo kept\n', 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            architecture: { roles: { environment_readers: ['root-gone.sh'] } },
            scope: [
                { path: 'app', architecture: { roles: { environment_readers: ['app/kept.sh', 'app/gone.sh'] } } },
                {
                    path: 'app/deep',
                    architecture: { roles: { environment_readers: ['app/deep/kept.sh', 'app/deep/gone.sh'] } },
                },
            ],
        },
        unmatched: ['root-gone.sh', 'app/gone.sh', 'app/deep/gone.sh'],
    },
    {
        name: 'scope paths audit absent folders',
        files: { 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            scope: [{ path: 'app' }, { path: 'app/deep' }, { path: 'absent' }, { path: 'absent/nested' }],
        },
        unmatched: ['absent', 'absent/nested'],
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
        unmatched: [],
    },
] as const;

export const UNMATCHED_PATTERN_SETTINGS = {
    level: 'all',
    configurations: ['docs', 'structure', 'nextjs'],
    command_check: [{ name: 'reports/collect', command: ['echo'], stage: 'commit', paths: ['.reports/command.json'] }],
    ignore: [
        {
            check: 'docs/lychee',
            paths: ['.reports/output.json', '.reports/unused.json'],
            reason: 'An obsolete source exclusion.',
        },
    ],
} as const;

export const UNMATCHED_PATTERN_CASES = [
    {
        check: 'gspot/unmatched-patterns',
        files: {},
        settings: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["nowhere/**"]
reason = "A pattern that matches no file here."
`,
        expected: {
            file: 'gspot.toml',
            rule: 'unused-record',
            line: 1,
        },
        corrected: {
            files: {},
            settings: '',
        },
    },
] as const;
