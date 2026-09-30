import { Linter } from 'eslint';
import { join } from 'node:path';
import plugin from '#plugin/plugin.ts';
import { readFileSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import clientExample from '#tests/inputs/unit/plugin/client-environment.json';

describe('the plugin', () => {
    test('the public client example retains its captured diagnostic and clean correction', () => {
        const linter = new Linter({ configType: 'flat' });
        const config: object[] = [{ plugins: { gspot: plugin }, rules: { 'gspot/no-client-environment': 'error' } }];
        // The captured example is plain JSON, so the comparison is structural.
        const broken: unknown = linter.verify(clientExample.broken, config, { filename: 'search.js' });
        expect(broken).toStrictEqual(clientExample.findings);
        const corrected: unknown = linter.verify(clientExample.corrected, config, { filename: 'search.js' });
        expect(corrected).toStrictEqual(clientExample.clean);
        // The plugin README shows the same defect and correction.
        const readme = readFileSync(new URL('../../../packages/eslint-plugin/README.md', import.meta.url), 'utf8');
        expect(readme).toContain(clientExample.broken);
        expect(readme).toContain(clientExample.corrected);
    });

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
                .filter(({ ruleId }) => ruleId === 'gspot/no-exported-alias-constants')
                .map(({ line, column, messageId: diagnosticId }) => ({ line, column, messageId: diagnosticId })),
        ).toStrictEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
        const defect = linter.verify("'use client';\nexport const value = process.env.SECRET;", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(defect.filter(({ ruleId }) => ruleId === 'gspot/no-client-environment')).toMatchObject([
            { line: 2, column: 22, messageId: 'private' },
        ]);
        const corrected = linter.verify("'use client';\nexport const value = 'public';", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(corrected).toStrictEqual([]);
    },
);

test.each(
    Object.entries(plugin.rules).filter(([, rule]) => Array.isArray(rule.meta.schema) && rule.meta.schema.length > 0),
)('%s rejects unknown options before analyzing source', (name) => {
    const linter = new Linter({ configType: 'flat' });
    const config: object[] = [
        { plugins: { gspot: plugin }, rules: { [`gspot/${name}`]: ['error', { unexpected: true }] } },
    ];
    expect(() => linter.verify('const value = 1;', config, { filename: 'example.js' })).toThrow(/unexpected/u);
});
