/** Each directory table refuses a forbidden path. */
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

/** Native expiry values contain valid calendar dates. */
export const UNTIL_DATE_CASES = [
    { name: 'ordinary date', literal: '2026-12-31', valid: true, date: '2026-12-31' },
    { name: 'quoted date', literal: '"2026-12-31"', valid: false },
    { name: 'local datetime', literal: '2026-12-31T00:00:00', valid: false },
    { name: 'offset datetime', literal: '2026-12-31T00:00:00Z', valid: false },
    { name: 'local time', literal: '00:00:00', valid: false },
] as const;

/** Inputs with refinements that the published schema must retain. */
export const PUBLISHED_SCHEMA_CASES = [
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
        name: 'a reviewed native formatter option',
        input: {
            tools: {
                prettier: { extra: { value: { printWidth: 96 }, reason: 'The formatter owns this project option.' } },
            },
        },
        valid: true,
    },
    {
        name: 'a forbidden native YAML extra table',
        input: {
            tools: { yamllint: { extra: { value: { enabled: false }, reason: 'Reviewed the native YAML option.' } } },
        },
        valid: false,
    },
] as const;

export const BASH_TEMPLATE_SETTINGS = 'configurations = ["bash"]\n';
