import type { RuntimeSchemaCase } from '#tests/types/cli/docs/schema.ts';

/** The public executable registration used by published-schema cases. */
export const SCHEMA_CHECK = { name: 'project/lint', command: ['lint'], paths: ['src/**'], stage: 'commit' };

/** Each published-schema input exercises one supported value or refusal. */
export const RUNTIME_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'native Stylelint zero-valued options at error severity',
        input: {
            configurations: ['css'],
            tools: { stylelint: { rules: { 'number-max-precision': [0, { severity: 'error' }] } } },
        },
        valid: true,
    },
    {
        name: 'authored Stylelint warning severity',
        input: {
            configurations: ['css'],
            tools: { stylelint: { rules: { 'color-hex-length': ['short', { severity: 'warning' }] } } },
        },
        valid: false,
        key: 'tools.stylelint.rules.color-hex-length',
    },
    {
        name: 'native Markdown options without coverage selection',
        input: {
            configurations: ['markdown'],
            tools: { markdownlint: { rules: { MD024: { siblings_only: false } } } },
        },
        valid: true,
    },
    {
        name: 'an authored Markdown rule activation',
        input: { configurations: ['markdown'], tools: { markdownlint: { rules: { MD041: true } } } },
        valid: false,
        key: 'tools.markdownlint.rules.MD041',
    },
    {
        name: 'an authored Markdown rule disabling',
        input: { configurations: ['markdown'], tools: { markdownlint: { rules: { MD045: false } } } },
        valid: false,
        key: 'tools.markdownlint.rules.MD045',
    },
    {
        name: 'an authored Markdown native default',
        input: { configurations: ['markdown'], tools: { markdownlint: { rules: { default: {} } } } },
        valid: false,
        key: 'tools.markdownlint.rules.default',
    },
    {
        name: 'native ESLint option arrays without severities',
        input: { configurations: ['javascript'], tools: { eslint: { rules: { eqeqeq: ['smart'] } } } },
        valid: true,
    },
    {
        name: 'a zero-valued native ESLint option',
        input: { configurations: ['javascript'], tools: { eslint: { rules: { 'max-params': [0] } } } },
        valid: true,
    },
    {
        name: 'an authored ESLint severity',
        input: { configurations: ['javascript'], tools: { eslint: { rules: { eqeqeq: 'error' } } } },
        valid: false,
        key: 'tools.eslint.rules.eqeqeq',
    },
    {
        name: 'a native ESLint severity inside an option array',
        input: { configurations: ['javascript'], tools: { eslint: { rules: { eqeqeq: ['error', 'smart'] } } } },
        valid: false,
        key: 'tools.eslint.rules.eqeqeq.0',
    },
    {
        name: 'custom Semgrep rule files',
        input: { configurations: ['security'], semgrep: { rule_files: ['security/own.yml'] } },
        valid: true,
    },
    {
        name: 'a scoped Vitest configuration file',
        input: { configurations: ['vitest'], scope: [{ path: 'app', vitest: { config_file: 'testing/config.mjs' } }] },
        valid: true,
    },
    {
        name: 'site kilobyte limits',
        input: { configurations: ['site'], limits: { site: { kilobytes: [{ paths: ['**/*.html'], kb: 10 }] } } },
        valid: true,
    },
    {
        name: 'obsolete Semgrep configs',
        input: { configurations: ['security'], tools: { semgrep: { configs: ['security/own.yml'] } } },
        valid: false,
        key: 'tools.semgrep.configs',
    },
    {
        name: 'obsolete Vitest config',
        input: { configurations: ['vitest'], tools: { vitest: { config: 'testing/config.mjs' } } },
        valid: false,
        key: 'tools.vitest.config',
    },
    {
        name: 'obsolete site sizes',
        input: { configurations: ['site'], site: { sizes: [{ paths: ['**/*.html'], kb: 10 }] } },
        valid: false,
        key: 'site.sizes',
    },
    { name: 'finding code 2', input: { check: [{ ...SCHEMA_CHECK, exit_codes: [2] }] }, valid: true },
    {
        name: 'finding code 0',
        input: { check: [{ ...SCHEMA_CHECK, exit_codes: [0] }] },
        valid: false,
        key: 'check.0.exit_codes.0',
    },
    {
        name: 'finding code 256',
        input: { check: [{ ...SCHEMA_CHECK, exit_codes: [256] }] },
        valid: false,
        key: 'check.0.exit_codes.0',
    },
    {
        name: 'a text finding code',
        input: { check: [{ ...SCHEMA_CHECK, exit_codes: ['2'] }] },
        valid: false,
        key: 'check.0.exit_codes.0',
    },
    {
        name: 'an empty command',
        input: { check: [{ ...SCHEMA_CHECK, command: [] }] },
        valid: false,
        key: 'check.0.command',
    },
    {
        name: 'an empty program',
        input: { check: [{ ...SCHEMA_CHECK, command: [''] }] },
        valid: false,
        key: 'check.0.command.0',
    },
    { name: 'an empty argument', input: { check: [{ ...SCHEMA_CHECK, command: ['tool', ''] }] }, valid: true },
    {
        name: 'a formatter override',
        input: { format: { overrides: [{ paths: ['src'], indent_width: 8, quotes: 'double' }] } },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { overrides: [{ paths: ['src'] }] } },
        valid: false,
        key: 'format.overrides.0',
    },
    {
        name: 'a pinned license exception',
        input: {
            licenses: {
                exceptions: [{ package: '@example/scoped@1.2.3-beta.1', license: 'MIT', reason: 'Verified.' }],
            },
        },
        valid: true,
    },
    {
        name: 'a license exception with a version range',
        input: {
            licenses: {
                exceptions: [{ package: 'example@^1.2.3', license: 'MIT', reason: 'Version range' }],
            },
        },
        valid: false,
        key: 'licenses.exceptions.0.package',
    },
    {
        name: 'a reasoned Squawk transaction value',
        input: { tools: { squawk: { assume_in_transaction: { value: false, reason: 'Runs outside transactions.' } } } },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
        key: 'tools.sqlfluff.dialect',
    },
    {
        name: 'a scoped SQLFluff dialect that injects a directive',
        input: { scope: [{ path: 'db', tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } }] },
        valid: false,
        key: 'scope.0.tools.sqlfluff.dialect',
    },
    {
        name: 'a SQLFluff dialect label',
        input: { tools: { sqlfluff: { dialect: 'sqlite' } } },
        valid: true,
    },
    {
        name: 'a scoped SQLFluff dialect label',
        input: { scope: [{ path: 'db', tools: { sqlfluff: { dialect: 'sqlite' } } }] },
        valid: true,
    },
    {
        name: 'a snapshot layout',
        input: { tools: { xctest: { reference_layout: '__Snapshots__/{file}/{test}.*' } } },
        valid: true,
    },
    {
        name: 'a snapshot layout outside the scope',
        input: { tools: { xctest: { reference_layout: '../{file}/{test}.*' } } },
        valid: false,
        key: 'tools.xctest.reference_layout',
    },
];

/** Every scope and locale-value branch has an independently named case. */
export const LOCALE_SCHEMA_CASES = [
    { name: 'root with an invalid list', scoped: false, locales: [], valid: false },
    { name: 'scope with an invalid list', scoped: true, locales: [], valid: false },
    { name: 'root with locale settings', scoped: false, locales: { directory: 'messages', base: 'en' }, valid: true },
    { name: 'scope with locale settings', scoped: true, locales: { directory: 'messages', base: 'en' }, valid: true },
];
