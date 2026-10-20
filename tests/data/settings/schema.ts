/** Each folder setting refuses these unsafe paths. */
export const UNSAFE_FOLDERS = [
    '../outside',
    '/outside',
    'C:outside',
    String.raw`..\outside`,
    String.raw`\\host\share`,
    'bad\0path',
    'api\n/../../outside',
    '',
] as const;

/** Expiry values, and whether each one holds a valid TOML date. */
export const UNTIL_DATE_CASES = [
    { name: 'ordinary date', literal: '2026-12-31', valid: true, date: '2026-12-31' },
    { name: 'quoted date', literal: '"2026-12-31"', valid: false },
    { name: 'local datetime', literal: '2026-12-31T00:00:00', valid: false },
    { name: 'offset datetime', literal: '2026-12-31T00:00:00Z', valid: false },
    { name: 'local time', literal: '00:00:00', valid: false },
] as const;

/** Inputs with refinements that the published schema must keep. */
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
        input: { command_check: [{ name: 'project/lint', command: [], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty program',
        input: { command_check: [{ name: 'project/lint', command: [''], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty argument',
        input: { command_check: [{ name: 'project/lint', command: ['lint', ''], paths: ['src/**'], stage: 'commit' }] },
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
        name: 'an allowed package with a tag for a version',
        input: {
            licenses: {
                allowed_package: [{ name: 'example', version: 'latest', reason: 'Reviewed its MIT license.' }],
            },
        },
        valid: false,
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
    {
        name: 'a reviewed formatter option',
        input: {
            tools: {
                prettier: { extra: { value: { printWidth: 96 }, reason: 'The formatter owns this project option.' } },
            },
        },
        valid: true,
    },
    {
        name: 'a forbidden YAML extra table',
        input: {
            tools: { yamllint: { extra: { value: { enabled: false }, reason: 'Reviewed the native YAML option.' } } },
        },
        valid: false,
    },
] as const;

export const BASH_TEMPLATE_SETTINGS = 'configurations = ["bash"]\n';

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
