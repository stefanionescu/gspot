import type { RuntimeSchemaCase } from '#tests/types/cli/docs/schema.ts';

/** Native tools keep the same allowed options in root and child tables. */
export const TOOL_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'custom Semgrep rule files',
        input: { configurations: ['security'], tools: { semgrep: { rule_files: ['security/own.yml'] } } },
        valid: true,
    },

    {
        name: 'reasoned knip dependency maps',
        input: {
            configurations: ['javascript'],
            tools: {
                knip: {
                    ignore_dependencies: {
                        worker: 'A spawned worker uses this dependency.',
                        scoped: { workspace: 'apps/api', reason: 'Only the API worker uses this dependency.' },
                    },
                },
            },
        },
        valid: true,
    },
    {
        name: 'a malformed knip workspace',
        input: {
            configurations: ['javascript'],
            tools: {
                knip: { ignore_dependencies: { worker: { workspace: 1, reason: 'The worker uses this dependency.' } } },
            },
        },
        valid: false,
        diagnostic: 'tools.knip.ignore_dependencies.worker:',
    },
    {
        name: 'reasoned native selector maps',
        input: {
            configurations: ['site'],
            tools: { purgecss: { safelist: { banner: 'The browser adds this class dynamically.' } } },
        },
        valid: true,
    },
    {
        name: 'a non-string native selector reason',
        input: { configurations: ['site'], tools: { purgecss: { safelist: { banner: false } } } },
        valid: false,
        diagnostic: 'tools.purgecss.safelist.banner:',
    },
    {
        name: 'a native JSON schema catalog map',
        input: {
            configurations: ['files'],
            tools: { v8r: { schemas: { 'fixtures/*.json': 'https://example.com/schema.json' } } },
        },
        valid: true,
    },
    {
        name: 'a non-string native schema URL',
        input: { configurations: ['files'], tools: { v8r: { schemas: { 'fixtures/*.json': false } } } },
        valid: false,
        diagnostic: 'tools.v8r.schemas.fixtures/*.json:',
    },
    {
        name: 'one shared native URL allowance',
        input: {
            configurations: ['site'],
            links: { allowed_urls: ['https://example.com/private'] },
            reasons: { 'links.allowed_urls': 'This private endpoint refuses anonymous crawlers.' },
        },
        valid: true,
    },
    {
        name: 'a malformed shared native URL allowance',
        input: { configurations: ['site'], links: { allowed_urls: [false] } },
        valid: false,
        diagnostic: 'links.allowed_urls.0:',
    },

    {
        name: 'a reviewed native formatter option',
        input: {
            tools: { prettier: { verbatim: { printWidth: 96 } } },
            reasons: { 'tools.prettier.verbatim': 'The native formatter owns this project option.' },
        },
        valid: true,
    },
    {
        name: 'a reviewed nested native ESLint option',
        input: {
            configurations: ['javascript'],
            tools: { eslint: { verbatim: { settings: { project: { enabled: false, limit: 0 } } } } },
            reasons: { 'tools.eslint.verbatim': 'The native plugin owns these project options.' },
        },
        valid: true,
    },
    {
        name: 'an unknown tool',
        input: {
            tools: { imaginary: { verbatim: { enabled: true } } },
            reasons: { 'tools.imaginary.verbatim': 'The fixture supplies a substantive option explanation.' },
        },
        valid: false,
        diagnostic: '`imaginary` is not a setting gspot knows under [tools]',
    },
    {
        name: 'an unknown formatter key',
        input: { tools: { prettier: { imaginary: true } } },
        valid: false,
        diagnostic: '`imaginary` is not a setting gspot knows under [tools.prettier]',
    },
    {
        name: 'a forbidden native link-checker verbatim table',
        input: {
            tools: { lychee: { verbatim: { timeout: 3 } } },
            reasons: { 'tools.lychee.verbatim': 'The fixture supplies a substantive option explanation.' },
        },
        valid: false,
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.lychee]',
    },
    {
        name: 'a forbidden native YAML verbatim table',
        input: {
            tools: { yamllint: { verbatim: { enabled: false } } },
            reasons: { 'tools.yamllint.verbatim': 'The fixture supplies a substantive option explanation.' },
        },
        valid: false,
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.yamllint]',
    },
    {
        name: 'an invalid native SQL dialect',
        input: { tools: { sqlfluff: { dialect: false } } },
        valid: false,
        diagnostic: 'tools.sqlfluff.dialect:',
    },
];

/** The same authored tool table is tested at both policy locations. */
export const TOOL_SCHEMA_SCOPES = ['', 'app'];

/** Only these native writers consume a reviewed verbatim table. */
export const VERBATIM_TOOL_NAMES = ['eslint', 'prettier', 'editorconfig', 'typos', 'shellcheck', 'knip', 'taplo'];

/** These tools must refuse verbatim even when a reason is supplied. */
export const NO_VERBATIM_TOOL_NAMES = [
    'ruff',
    'basedpyright',
    'stylelint',
    'squawk',
    'jest',
    'commitlint',
    'yamllint',
    'lychee',
    'markdownlint',
];
