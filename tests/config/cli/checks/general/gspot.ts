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

export const NATIVE_EXCEPTION_CASES = [
    {
        name: 'allowances name code or files',
        files: { 'phantomName.js': '// commentName\nexport const keptName = true;\n' },
        policy: {
            configurations: ['javascript'],
            naming: {
                overrides: [
                    {
                        paths: ['*.js'],
                        allowed: ['keptName', 'phantomName', 'commentName'],
                        reason: 'The external API declares these exact names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files', 'variables'],
                        allowed: ['phantomName', 'keptName'],
                        reason: 'Exact API names.',
                    },
                ],
            },
        },
        unusedNames: ['phantomName', 'commentName'],
        unusedIgnores: [],
    },
    {
        name: 'a sibling declaration cannot satisfy an authored source pattern',
        files: {
            'app/source.js': 'export const keptName = true;\n',
            'worker/source.js': 'export const siblingName = true;\n',
        },
        policy: {
            configurations: ['javascript'],
            naming: {
                overrides: [
                    {
                        paths: ['app/**'],
                        allowed: ['keptName', 'siblingName'],
                        reason: 'The app interface fixes these exact names.',
                    },
                ],
            },
            scope: { app: {}, worker: {} },
        },
        unusedNames: ['siblingName'],
        unusedIgnores: [],
    },
    {
        name: 'child Python declarations satisfy normalized inherited paths',
        files: { 'app/deep/source.py': 'kept_value = True\n', 'worker/source.py': 'sibling_value = True\n' },
        policy: {
            configurations: ['python'],
            scope: {
                app: {
                    naming: {
                        overrides: [
                            {
                                paths: ['**/*.py'],
                                allowed: ['kept_value', 'sibling_value'],
                                reason: 'The app interface fixes these exact names.',
                            },
                        ],
                    },
                },
                'app/deep': {},
                worker: {},
            },
        },
        unusedNames: ['sibling_value'],
        unusedIgnores: [],
    },
    {
        name: 'duplicate and shadowed path ignores each match the raw native finding',
        files: {
            'helpers/first.js': 'export const active = true;\n',
            'helpers/second.js': 'export const enabled = true;\n',
        },
        policy: {
            configurations: ['javascript'],
            ignore: [
                {
                    check: 'structure/folder-names',
                    paths: ['helpers/**'],
                    reason: 'The external project fixes this folder name.',
                },
                {
                    check: 'structure/folder-names',
                    paths: ['helpers/first.js'],
                    reason: 'The external project fixes this source folder.',
                },
                {
                    check: 'structure/folder-names',
                    rule: 'container-name',
                    reason: 'The external project fixes this required folder.',
                },
            ],
        },
        unusedNames: [],
        unusedIgnores: [],
    },
    {
        name: 'only the wrong rule is unused beside the native folder exception',
        files: { 'app/helpers/first.js': 'export const active = true;\n' },
        policy: {
            configurations: ['javascript'],
            scope: { app: {} },
            ignore: [
                {
                    check: 'structure/folder-names',
                    paths: ['app/helpers/**'],
                    reason: 'The external project fixes this folder name.',
                },
                {
                    check: 'structure/folder-names',
                    rule: 'other-rule',
                    reason: 'An obsolete exception no longer matches this check.',
                },
            ],
        },
        unusedNames: [],
        unusedIgnores: ['structure/folder-names'],
    },
    {
        name: 'an enabled whole-check ignore is unused when no native finding exists',
        files: { 'source.js': 'export const active = true;\n' },
        policy: {
            configurations: ['javascript'],
            ignore: [
                { check: 'structure/folder-names', reason: 'An obsolete exception no longer matches this check.' },
            ],
        },
        unusedNames: [],
        unusedIgnores: ['structure/folder-names'],
    },
    {
        name: 'a recommended-level dormant check cannot establish an unused exception',
        files: { 'source.js': 'export const active = true;\n' },
        policy: {
            level: 'recommended',
            configurations: ['javascript'],
            ignore: [{ check: 'structure/folder-names', reason: 'The all-level exception belongs to this project.' }],
        },
        unusedNames: [],
        unusedIgnores: [],
    },
];
