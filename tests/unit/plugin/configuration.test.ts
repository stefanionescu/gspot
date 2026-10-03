import { Linter } from 'eslint';
import { join } from 'node:path';
import plugin from '#plugin/plugin.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';

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
    '%s keeps exported aliases opt-in and private client access enforced',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'example.js': '', 'other.js': '' });
        const linter = new Linter({ configType: 'flat', cwd: sandbox.path });
        const config: object[] = [{ ...plugin.configs[level], files: ['**/*.js'] }];
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
