/** Authored native source paths remain distinct from defaults, identities, and destinations. */
export const AUTHORED_PATH_CASES = [
    {
        name: 'primitive lists and nested record paths',
        files: { 'scripts/kept.sh': 'echo kept\n', 'src/kept.txt': 'kept\n' },
        policy: {
            configurations: ['bash'],
            bash: { safety_owners: ['scripts/kept.sh', 'scripts/gone.sh'] },
            architecture: {
                modules: [{ name: 'core', paths: ['src/**', 'gone/**'] }],
                roles: { config: 'core' },
            },
            reasons: {
                'bash.safety_owners': 'The authored scripts own separate safety contracts.',
                'architecture.modules': 'The source module owns these paths.',
                'architecture.roles.config': 'The module holds configuration data.',
            },
        },
        unmatched: ['scripts/gone.sh', 'gone/**'],
    },
    {
        name: 'authored scopes prefix once and inherited paths report once',
        files: { 'app/kept.sh': 'echo kept\n', 'app/deep/kept.sh': 'echo kept\n' },
        policy: {
            configurations: ['bash'],
            bash: { safety_owners: ['root-gone.sh'] },
            reasons: { 'bash.safety_owners': 'The root script owns this contract.' },
            scope: {
                app: {
                    configurations: ['bash'],
                    bash: { safety_owners: ['kept.sh', 'gone.sh'] },
                    reasons: { 'bash.safety_owners': 'The app scripts own these contracts.' },
                },
                'app/deep': {
                    configurations: ['bash'],
                    bash: { safety_owners: ['kept.sh', 'gone.sh'] },
                    reasons: { 'bash.safety_owners': 'The nested scripts own these contracts.' },
                },
            },
        },
        unmatched: ['root-gone.sh', 'app/gone.sh', 'app/deep/gone.sh'],
    },
    {
        name: 'authored scope keys audit absent folders without prefixing them twice',
        files: { 'app/deep/kept.sh': 'echo kept\n' },
        policy: {
            configurations: ['bash'],
            scope: { app: {}, 'app/deep': {}, absent: {}, 'absent/nested': {} },
        },
        unmatched: ['absent', 'absent/nested'],
    },
    {
        name: 'excluded sources and negative selectors use the readable inventory',
        files: { 'hidden/kept.txt': 'kept\n' },
        policy: {
            exclude: ['hidden/**', '!hidden/kept.txt', '!gone/**'],
            reasons: { exclude: 'The hidden files remain authored inputs for another pipeline.' },
        },
        unmatched: ['!gone/**'],
    },
    {
        name: 'future destinations and native URL patterns are not source selectors',
        files: { 'src/kept.txt': 'kept\n' },
        policy: {
            configurations: ['site', 'supabase', 'docs'],
            site: { build_folder: 'future/site', max_kilobytes: [{ paths: ['future/assets/**'], kb: 5 }] },
            supabase: { types_file: 'future/types.ts' },
            agent_rules: { folder: 'future/rules', instruction_files: ['future/AGENTS.md'] },
            links: { allowed_urls: ['https://example.com/**'] },
            reasons: {
                'links.allowed_urls': 'The network targets use a separate validation pipeline.',
                'site.max_kilobytes': 'Built asset weight has a native output-relative selector.',
            },
        },
        unmatched: [],
    },
    {
        name: 'empty disabling paths and unauthored defaults are not audited',
        files: {},
        policy: {
            configurations: ['site', 'supabase', 'openapi'],
            supabase: { types_file: '' },
            openapi: { document: '' },
        },
        unmatched: [],
    },
];
