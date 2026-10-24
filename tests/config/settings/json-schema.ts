export const PUBLISHED_SCHEMA_CASES = [
    {
        name: 'GitHub CI with systems',
        input: { ci: { provider: 'github', operating_systems: ['linux'] } },
        valid: true,
    },
    { name: 'GitLab CI without systems', input: { ci: { provider: 'gitlab' } }, valid: true },
    {
        name: 'GitLab CI with systems',
        input: { ci: { provider: 'gitlab', operating_systems: ['linux'] } },
        valid: false,
    },
    {
        name: 'GitLab CI with an empty systems list',
        input: { ci: { provider: 'gitlab', operating_systems: [] } },
        valid: false,
    },
    {
        name: 'an empty command',
        input: { command_check: [{ id: 'project/lint', command: [], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty program',
        input: { command_check: [{ id: 'project/lint', command: [''], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty argument',
        input: { command_check: [{ id: 'project/lint', command: ['lint', ''], paths: ['src/**'], stage: 'commit' }] },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { override: [{ paths: ['src/**'] }] } },
        valid: false,
    },
    {
        name: 'an allowed package with a version range',
        input: {
            licenses: {
                allowed_package: [{ name: 'example', version: '^1.2.3', reason: 'Reviewed its MIT license.' }],
            },
        },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
    },
    {
        name: 'reasoned registry hosts',
        input: {
            dependencies: {
                allowed_registries: { value: ['registry.example.test'], reason: 'Reviewed the package registry.' },
            },
        },
        valid: true,
    },
    {
        name: 'invalid registry host',
        input: { dependencies: { allowed_registries: { value: [false], reason: 'Reviewed the package registry.' } } },
        valid: false,
    },
] as const;
