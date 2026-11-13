// copy dependencies
export const VALUE_ONE_LINE = 'export const value = 1;';

// file selection
export const PROJECT_PATH_IGNORES = [
    {
        name: 'a deleted ignored input',
        changed: ['api/ignored.ts'],
        present: false,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'a changed ignored input',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'an ignored and an owned input',
        changed: ['api/ignored.ts', 'api/kept.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: ['api/kept.ts'],
    },
    {
        name: 'a rule-specific ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: 'sample',
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
    {
        name: 'another check\u{2019}s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'json/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

// file triggers
export const LAST_FILE_CHANGES = [
    ['delete', 'staged'],
    ['rename', 'changed'],
];

// revision copies
export const GIT_HOOK_REPORT = {
    reports: [
        {
            kind: 'index',
            source: 'selected\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
        {
            kind: 'commit',
            source: 'committed\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
    ],
    headKept: true,
    indexKept: true,
    workingBytes: 'working\n',
} as const;
export const SELECTED_SOURCE = 'selected source';

// typescript scopes
export const TSC_PUSH_OPTIONS = { stage: 'push' as const, only: ['typescript/tsc'] };
export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;
export const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);
