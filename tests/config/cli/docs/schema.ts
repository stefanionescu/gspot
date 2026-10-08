import type { RuntimeSchemaCase } from '#tests/types/cli/docs/schema.ts';

/** The public executable registration used by published-schema cases. */
export const SCHEMA_CHECK = { command: ['lint'], paths: ['src/**'], stage: 'commit' };

/** Each published-schema input exercises one supported value or refusal. */
export const RUNTIME_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'a numeric reason in the root namespace',
        input: {
            configurations: ['site'],
            site: { build_command: ['npm', 'run', 'build'] },
            reasons: { 'site.build_command': 42 },
        },
        valid: false,
        diagnostic: 'gspot.toml: reasons.site.build_command: Invalid input: expected string, received number',
    },
    {
        name: 'a scoped list with a boolean reason',
        input: {
            configurations: ['site'],
            scope: { app: { site: { sitemap_exclude: ['404.html'] }, reasons: { 'site.sitemap_exclude': false } } },
        },
        valid: false,
        diagnostic:
            'gspot.toml: scope.app.reasons.site.sitemap_exclude: Invalid input: expected string, received boolean',
    },
    {
        name: 'a namespace value with a substantive reason',
        input: {
            configurations: ['site'],
            site: { build_command: ['npm', 'run', 'build'] },
            reasons: { 'site.build_command': 'The project owns its build command.' },
        },
        valid: true,
    },
    {
        name: 'a namespace value with no required reason',
        input: { configurations: ['site'], site: { build_command: ['npm', 'run', 'build'] } },
        valid: true,
    },
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
        diagnostic: 'gspot.toml: tools.stylelint.rules.color-hex-length:',
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
        diagnostic: 'gspot.toml: tools.markdownlint.rules.MD041:',
    },
    {
        name: 'an authored Markdown rule disabling',
        input: { configurations: ['markdown'], tools: { markdownlint: { rules: { MD045: false } } } },
        valid: false,
        diagnostic: 'gspot.toml: tools.markdownlint.rules.MD045:',
    },
    {
        name: 'an authored Markdown native default',
        input: { configurations: ['markdown'], tools: { markdownlint: { rules: { default: {} } } } },
        valid: false,
        diagnostic: 'gspot.toml: tools.markdownlint.rules.default:',
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
        diagnostic: 'gspot.toml: tools.eslint.rules.eqeqeq:',
    },
    {
        name: 'a native ESLint severity inside an option array',
        input: { configurations: ['javascript'], tools: { eslint: { rules: { eqeqeq: ['error', 'smart'] } } } },
        valid: false,
        diagnostic: 'gspot.toml: tools.eslint.rules.eqeqeq.0:',
    },
    {
        name: 'removed scoped Vitest configuration file',
        input: { configurations: ['vitest'], scope: { app: { vitest: { config_file: 'testing/config.mjs' } } } },
        valid: false,
        diagnostic: '`vitest` is not a setting gspot knows under [scope.app]',
    },
    {
        name: 'site kilobyte limits',
        input: { configurations: ['site'], site: { max_kilobytes: [{ paths: ['**/*.html'], kb: 10 }] } },
        valid: true,
    },
    {
        name: 'obsolete Semgrep configs',
        input: { configurations: ['security'], tools: { semgrep: { configs: ['security/own.yml'] } } },
        valid: false,
        diagnostic: '`configs` is not a setting gspot knows under [tools.semgrep]',
    },
    {
        name: 'obsolete Vitest config',
        input: { configurations: ['vitest'], tools: { vitest: { config: 'testing/config.mjs' } } },
        valid: false,
        diagnostic: '`vitest` is not a setting gspot knows under [tools]',
    },
    {
        name: 'obsolete site sizes',
        input: { configurations: ['site'], site: { sizes: [{ paths: ['**/*.html'], kb: 10 }] } },
        valid: false,
        diagnostic: '`sizes` is not a setting gspot knows under [site]',
    },
    { name: 'finding code 2', input: { check: { 'project/lint': { ...SCHEMA_CHECK, exit_codes: [2] } } }, valid: true },
    {
        name: 'finding code 0',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, exit_codes: [0] } } },
        valid: false,
        diagnostic: 'gspot.toml: check.project/lint.exit_codes.0:',
    },
    {
        name: 'finding code 256',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, exit_codes: [256] } } },
        valid: false,
        diagnostic: 'gspot.toml: check.project/lint.exit_codes.0:',
    },
    {
        name: 'a text finding code',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, exit_codes: ['2'] } } },
        valid: false,
        diagnostic: 'gspot.toml: check.project/lint.exit_codes.0:',
    },
    {
        name: 'an empty command',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, command: [] } } },
        valid: false,
        diagnostic: 'gspot.toml: check.project/lint.command:',
    },
    {
        name: 'an empty program',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, command: [''] } } },
        valid: false,
        diagnostic: 'gspot.toml: check.project/lint.command.0:',
    },
    {
        name: 'an empty argument',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, command: ['tool', ''] } } },
        valid: true,
    },
    {
        name: 'a formatter override',
        input: { format: { overrides: [{ paths: ['src'], indent_width: 8, quotes: 'double' }] } },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { overrides: [{ paths: ['src'] }] } },
        valid: false,
        diagnostic: 'gspot.toml: format.overrides.0:',
    },
    {
        name: 'a pinned license exception',
        input: {
            licenses: {
                exceptions: {
                    '@example/scoped@1.2.3-beta.1': {
                        license: 'MIT',
                        reason: 'The installed package license was verified.',
                    },
                },
            },
        },
        valid: true,
    },
    {
        name: 'a license exception with a version range',
        input: {
            licenses: {
                exceptions: { 'example@^1.2.3': { license: 'MIT', reason: 'Version range' } },
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: licenses.exceptions.example@^1.2.3:',
    },
    {
        name: 'a reasoned Squawk transaction value',
        input: {
            tools: { squawk: { assume_in_transaction: false } },
            reasons: { 'tools.squawk.assume_in_transaction': 'Runs outside transactions.' },
        },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
        diagnostic: 'gspot.toml: tools.sqlfluff.dialect:',
    },
    {
        name: 'a scoped SQLFluff dialect that injects a directive',
        input: { scope: { db: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } } } },
        valid: false,
        diagnostic: 'gspot.toml: scope.db.tools.sqlfluff.dialect:',
    },
    {
        name: 'a SQLFluff dialect label',
        input: { tools: { sqlfluff: { dialect: 'sqlite' } } },
        valid: true,
    },
    {
        name: 'a scoped SQLFluff dialect label',
        input: { scope: { db: { tools: { sqlfluff: { dialect: 'sqlite' } } } } },
        valid: true,
    },
    {
        name: 'the removed XCTest snapshot layout',
        input: { configurations: ['xctest'], tools: { xctest: { reference_layout: '__Snapshots__/{file}/{test}.*' } } },
        valid: false,
        diagnostic: '`xctest` is not a setting gspot knows under [tools]',
    },
];

/** Both translation settings validate independently at the root and in a scope. */
export const LOCALE_SCHEMA_CASES = [
    {
        name: 'root refuses the removed locales table',
        scoped: false,
        settings: { locales: { directory: 'messages', base: 'en' } },
        key: 'locales',
        valid: false,
    },
    {
        name: 'scope refuses the removed locales table',
        scoped: true,
        settings: { locales: { directory: 'messages', base: 'en' } },
        key: 'locales',
        valid: false,
    },
    {
        name: 'root with an invalid message folder',
        scoped: false,
        settings: { messages_folder: [] },
        key: 'messages_folder',
        valid: false,
    },
    {
        name: 'scope with an invalid message folder',
        scoped: true,
        settings: { messages_folder: [] },
        key: 'messages_folder',
        valid: false,
    },
    {
        name: 'root with an invalid base locale',
        scoped: false,
        settings: { base_locale: [] },
        key: 'base_locale',
        valid: false,
    },
    {
        name: 'scope with an invalid base locale',
        scoped: true,
        settings: { base_locale: [] },
        key: 'base_locale',
        valid: false,
    },
    {
        name: 'root with translation settings',
        scoped: false,
        settings: { messages_folder: 'messages', base_locale: 'en' },
        key: 'messages_folder',
        valid: true,
    },
    {
        name: 'scope with translation settings',
        scoped: true,
        settings: { messages_folder: 'messages', base_locale: 'en' },
        key: 'messages_folder',
        valid: true,
    },
];
