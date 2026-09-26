import { Linter } from 'eslint';
import { join } from 'node:path';
import { renameSync } from 'node:fs';
import plugin from '#plugin/plugin.ts';
import parser from '@typescript-eslint/parser';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import clientExample from '../../../docs/src/components/home/client-environment.json';

describe('the plugin', () => {
    test('the public client example retains its captured diagnostic and clean correction', () => {
        const linter = new Linter({ configType: 'flat' });
        const config: object[] = [{ plugins: { gspot: plugin }, rules: { 'gspot/no-client-environment': 'error' } }];
        // The captured example is plain JSON, so the comparison is structural.
        const broken: unknown = linter.verify(clientExample.broken, config, { filename: 'search.js' });
        expect(broken).toStrictEqual(clientExample.findings);
        const corrected: unknown = linter.verify(clientExample.corrected, config, { filename: 'search.js' });
        expect(corrected).toStrictEqual(clientExample.clean);
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
        ).toStrictEqual([{ ruleId: 'gspot/no-trivial-functions', messageId: 'trivial', line: 1, column: 1 }]);
    });
});

test.each(['recommended', 'all'] as const)(
    '%s applies folder and interface policies only after opting in',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'feature/only.ts': '',
            'cards/asset-card.ts': '',
            'cards/asset-list.ts': '',
        });
        const linter = new Linter({ configType: 'flat', cwd: sandbox.path });
        const config: object[] = [{ ...plugin.configs[level], files: ['**/*.ts'], languageOptions: { parser } }];
        const filename = join(sandbox.path, 'feature/only.ts');
        const findings = linter.verify('interface Order { total: number }', config, { filename });
        // The layout rules belong to the all level alone; the types file is placed where it is allowed at both.
        const shape = (list: typeof findings) =>
            list.map(({ ruleId, messageId, line, column }) => ({ ruleId, messageId, line, column }));
        expect(shape(findings).filter((entry) => entry.ruleId !== 'gspot/no-trivial-files')).toStrictEqual(
            level === 'recommended'
                ? []
                : [{ ruleId: 'gspot/no-single-file-folders', messageId: 'lone', line: 1, column: 1 }],
        );
        const card = join(sandbox.path, 'cards/asset-card.ts');
        const collisions = linter.verify('export const value = 1;', config, { filename: card });
        expect(shape(collisions).filter((entry) => entry.ruleId !== 'gspot/no-trivial-files')).toStrictEqual(
            level === 'recommended'
                ? []
                : [{ ruleId: 'gspot/no-prefix-collisions', messageId: 'collision', line: 1, column: 1 }],
        );
        await Bun.write(join(sandbox.path, 'feature/second.ts'), '');
        renameSync(join(sandbox.path, 'cards/asset-list.ts'), join(sandbox.path, 'cards/other.ts'));
        expect(linter.verify("'use server';\nexport const value = 1;", config, { filename })).toStrictEqual([]);
        expect(linter.verify("'use server';\nexport const value = 1;", config, { filename: card })).toStrictEqual([]);
    },
);

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
                .map(({ line, column, messageId }) => ({ line, column, messageId })),
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
