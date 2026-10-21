/** Source path patterns, which must match a file, and output paths, which need not. */
export const UNMATCHED_PATH_CASES = [
    {
        name: 'primitive lists and nested record paths',
        files: { 'scripts/kept.sh': 'echo kept\n', 'src/kept.txt': 'kept\n' },
        settings: {
            configurations: ['bash'],
            import_rule: [{ name: 'core', paths: ['src/**', 'gone/**'] }],
            structure: { environment_readers: ['scripts/kept.sh', 'scripts/gone.sh'] },
        },
        unmatched: ['gone/**', 'scripts/gone.sh'],
    },
    {
        name: 'inherited paths are audited once from the repository root',
        files: { 'app/kept.sh': 'echo kept\n', 'app/deep/kept.sh': 'echo kept\n' },
        settings: {
            configurations: ['bash'],
            structure: { environment_readers: ['root-gone.sh'] },
            scope: [
                { path: 'app', structure: { environment_readers: ['app/kept.sh', 'app/gone.sh'] } },
                {
                    path: 'app/deep',
                    structure: { environment_readers: ['app/deep/kept.sh', 'app/deep/gone.sh'] },
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
        unmatched: ['.reports/output.json', '.reports/unused.json', '.reports/command.json'],
    },
] as const;
