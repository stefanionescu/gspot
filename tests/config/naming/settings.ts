export const UNUSED_NAME_CASES = [
    {
        name: 'allowances name code or files',
        files: { 'phantomName.js': '// commentName\nexport const keptName = true;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['*.js'],
                        allowed_names: ['keptName', 'phantomName', 'commentName'],
                        reason: 'The external API declares these exact names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files', 'variables'],
                        allowed_names: ['phantomName', 'keptName'],
                        reason: 'Exact API names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files'],
                        allowed_names: ['missingFile'],
                        reason: 'The external interface fixes this filename.',
                    },
                ],
            },
        },
        unusedNames: ['commentName', 'missingFile'],
    },
    {
        name: 'a sibling declaration cannot satisfy an authored source pattern',
        files: {
            'app/source.js': 'export const keptName = true;\n',
            'worker/source.js': 'export const siblingName = true;\n',
        },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['app/**'],
                        allowed_names: ['keptName', 'siblingName'],
                        reason: 'The app interface fixes these exact names.',
                    },
                ],
            },
            scope: [{ path: 'app' }, { path: 'worker' }],
        },
        unusedNames: ['siblingName'],
    },
] as const;

export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export const SCOPE_LIMITS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
] as const;

export const NAMING_LANGUAGES = ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'] as const;

/** Native case and length ownership leaves the other naming rules active. */
export const LINTER_CHECKED_CATEGORIES = [
    { language: 'swift', category: 'types', native: true },
    { language: 'swift', category: 'functions', native: false },
] as const;

// Native spellings exercise the public naming contracts independently of the shipped assets.
export const FRAMEWORK_NAMES = [
    {
        configuration: 'nextjs',
        names: ['getStaticProps', 'getServerSideProps', 'generateMetadata', 'generateStaticParams', 'generateViewport'],
        banned_words: [
            'get static props',
            'get server side props',
            'generate metadata',
            'generate static params',
            'generate viewport',
        ],
    },
    {
        configuration: 'react',
        names: ['useSyncExternalStore', 'getSnapshot', 'getServerSnapshot'],
        banned_words: ['use sync external store', 'get snapshot', 'get server snapshot'],
    },
] as const;

export const ALLOWED_NAME_SETTINGS = `configurations = ["naming", "bash"]
[[naming.override]]
allowed_names = ["remoteRecord"]
reason = "The external JavaScript interface fixes this name."
[[naming.override]]
paths = ["web/**"]
allowed_names = ["remoteRecord"]
reason = "The external JavaScript interface fixes this name."
[[naming.override]]
paths = ["worker/**"]
allowed_names = ["remote_record"]
reason = "The external Python interface fixes this name."
[[scope]]
path = "web"
configurations = ["javascript"]
[[scope]]
path = "worker"
configurations = ["python"]
`;

export const TEST_PATH_SETTINGS = `level = "all"
configurations = ["javascript", "swift", "naming"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"
test_files = ["apps/web/verification/**"]
[[scope]]
path = "apps/api"
`;

export const ORDINARY_WORDS = ['data', 'message', 'values', 'id'] as const;

export const NUMBERED_PREFIX_OVERRIDE =
    '[[naming.override]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    String.raw`categories = ["files"]
ignored_prefix = '^\d{2}-'
reason = "The project orders its tasks by this prefix."
`;

export const MISMATCHED_SETTINGS = ALLOWED_NAME_SETTINGS.replace('["remote_record"]', '["remoteRecord"]');

export const SWIFT_NAMING_LIMITS =
    `[naming.swift]
max_characters = 38
max_words = 4
[naming.swift.functions]
max_characters = 37
` +
    `[[scope]]
path = "app"
[scope.naming.swift]
max_characters = 36
max_words = 3
` +
    `[scope.naming.swift.functions]
max_characters = 35
[[scope]]
path = "sibling"
`;

export const UPPER_SNAKE_OVERRIDE = `[[naming.override]]
paths = ["source"]
cases = ["upper-snake"]
reason = "The authored interface selects this case."
`;

export const TERMS = [
    { term: 'common', parts: ['common'], source: 'test' },
    { term: 'edge case', parts: ['edge', 'case'], source: 'test' },
    { term: 'load-bearing', parts: ['load', 'bearing'], source: 'test' },
];
