export const PROJECT_OPTIONS = { stage: 'commit' as const, skips: [], only: ['sandbox/project'] };

export const NESTED_POLICY = `configurations = []
[scope."api"]
configurations = []
[scope."web"]
configurations = []
`;

/** A path ignore selects one check and preserves rule-specific findings for the others. */
export const PROJECT_PATH_IGNORES = [
    {
        name: 'a deleted ignored input',
        changed: ['api/ignored.ts'],
        present: false,
        check: 'sandbox/project',
        rule: undefined,
        files: [],
    },
    {
        name: 'a changed ignored input',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'sandbox/project',
        rule: undefined,
        files: [],
    },
    {
        name: 'an ignored and an owned input',
        changed: ['api/ignored.ts', 'api/kept.ts'],
        present: true,
        check: 'sandbox/project',
        rule: undefined,
        files: ['api/kept.ts'],
    },
    {
        name: 'a rule-specific ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'sandbox/project',
        rule: 'sample',
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
    {
        name: 'another check’s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'sandbox/files',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
];
