import { Linter } from 'eslint';
import { join } from 'node:path';
import plugin from '#plugin/plugin.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { ENVIRONMENT_GLOBALS } from '#tests/config/plugin/environment.ts';

describe('the plugin', () => {
    test.each(['recommended', 'all'] as const)('%s applies its trivial-function rule', async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/orders/forward.js': '', 'src/orders/client.js': '' });
        const linter = new Linter({ configType: 'flat', cwd: sandbox.path });
        const config: object = { ...plugin.configs[level], files: ['**/*.js'] };
        const messages = linter.verify('function forward(a, b) { return build(a, b); }\nforward(1, 2);\n', [config], {
            filename: join(sandbox.path, 'src/orders/forward.js'),
        });
        const findings = messages.filter((entry) => entry.ruleId === 'gspot/no-trivial-functions');
        expect(
            findings.map((entry) => ({
                ruleId: entry.ruleId,
                messageId: entry.messageId,
                line: entry.line,
                column: entry.column,
            })),
        ).toStrictEqual(
            level === 'all' ? [{ ruleId: 'gspot/no-trivial-functions', messageId: 'trivial', line: 1, column: 1 }] : [],
        );
    });
});

test.each(['recommended', 'all'] as const)(
    '%s applies its alias level and enforces private client access',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'example.js': '', 'other.js': '' });
        const linter = new Linter({ configType: 'flat', cwd: sandbox.path });
        const config: object[] = [
            { ...plugin.configs[level], files: ['**/*.js'], languageOptions: { globals: ENVIRONMENT_GLOBALS } },
        ];
        const alias = linter.verify('const source = 1;\nexport const publicName = source;', config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(
            alias
                .filter(({ ruleId }) => ruleId === 'gspot/no-alias-exports')
                .map(({ line, column, messageId: diagnosticId }) => ({ line, column, messageId: diagnosticId })),
        ).toStrictEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
        const defect = linter.verify("'use client';\nexport const value = process.env.SECRET;", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(defect.filter(({ ruleId }) => ruleId === 'gspot/no-client-env')).toMatchObject([
            { line: 2, column: 22, messageId: 'private' },
        ]);
        const corrected = linter.verify("'use client';\nexport const value = 'public';", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(corrected).toStrictEqual([]);
    },
);

test.each(['recommended', 'all'] as const)('%s shares plugin identity with explicit rules', (level) => {
    const linter = new Linter({ configType: 'flat' });
    const config: object[] = [
        plugin.configs[level],
        { plugins: { gspot: plugin }, rules: { 'gspot/import-extensions': ['error', { style: 'js' }] } },
    ];
    const messages = linter.verify("export const value = 'public';", config);
    expect(messages).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)('%s requires explicit import extensions and instance ownership', (level) => {
    const linter = new Linter({ configType: 'flat' });
    const config: object[] = [plugin.configs[level]];
    const source = 'import { Client } from "./client"; export const client = new Client();';
    const ruleIds = new Set(['gspot/import-extensions', 'gspot/instances-in-registry']);
    const selected = linter.verify(source, config, { filename: 'client.js' });
    expect(selected.filter(({ ruleId }) => ruleIds.has(ruleId ?? ''))).toStrictEqual([]);
    const explicit = linter.verify(
        source,
        [
            ...config,
            {
                rules: {
                    'gspot/import-extensions': ['error', { style: 'js' }],
                    'gspot/instances-in-registry': 'error',
                },
            },
        ],
        { filename: 'client.js' },
    );
    expect(
        explicit
            .filter(({ ruleId }) => ruleIds.has(ruleId ?? ''))
            .map(({ ruleId, line, messageId: diagnosticId }) => ({ ruleId, line, messageId: diagnosticId })),
    ).toStrictEqual([
        { ruleId: 'gspot/import-extensions', line: 1, messageId: 'js' },
        { ruleId: 'gspot/instances-in-registry', line: 1, messageId: 'registry' },
    ]);
});

test('permitted index barrels remain valid when both reexport and file rules run', () => {
    const linter = new Linter({ configType: 'flat' });
    const config: object[] = [plugin.configs.all];
    const rules = new Set(['gspot/no-reexports', 'gspot/no-trivial-files']);
    const source = 'export * from "./owner";';
    const defaults = linter.verify(source, config, { filename: 'src/index.js' });
    expect(
        defaults
            .filter(({ ruleId }) => rules.has(ruleId ?? ''))
            .map(({ ruleId, messageId: diagnosticId }) => ({ ruleId, messageId: diagnosticId })),
    ).toStrictEqual([
        { ruleId: 'gspot/no-reexports', messageId: 'star' },
        { ruleId: 'gspot/no-trivial-files', messageId: 'trivial' },
    ]);
    const permitted = linter.verify(
        source,
        [
            ...config,
            {
                rules: {
                    'gspot/no-reexports': ['error', { allowIndex: true }],
                    'gspot/no-trivial-files': ['error', { allowIndex: true }],
                },
            },
        ],
        { filename: 'src/index.js' },
    );
    expect(permitted.filter(({ ruleId }) => rules.has(ruleId ?? ''))).toStrictEqual([]);
});
