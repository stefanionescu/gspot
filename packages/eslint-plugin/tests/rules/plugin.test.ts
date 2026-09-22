import { Linter } from 'eslint';
import { join } from 'node:path';
import { renameSync } from 'node:fs';
import plugin from '#plugin/plugin.ts';
import parser from '@typescript-eslint/parser';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';

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
        ).toEqual([{ ruleId: 'gspot/no-trivial-functions', messageId: 'trivial', line: 1, column: 1 }]);
    });

    test('recommended reports private environment access in a client module', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/orders/forward.js': '', 'src/orders/client.js': '' });
        const linter = new Linter({ configType: 'flat', cwd: sandbox.path });
        const config: object = { ...plugin.configs.recommended, files: ['**/*.js'] };
        const messages = linter.verify("'use client';\nconst key = process.env.SECRET;\n", [config], {
            filename: join(sandbox.path, 'src/orders/client.js'),
        });
        expect(
            messages
                .filter((entry) => entry.ruleId === 'gspot/no-client-environment')
                .map((entry) => ({
                    ruleId: entry.ruleId,
                    messageId: entry.messageId,
                    line: entry.line,
                    column: entry.column,
                })),
        ).toEqual([{ ruleId: 'gspot/no-client-environment', messageId: 'private', line: 2, column: 13 }]);
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
        if (level === 'recommended') expect(findings).toEqual([]);
        else {
            expect(findings.find((finding) => finding.ruleId === 'gspot/no-single-file-folders')).toMatchObject({
                messageId: 'lone',
                line: 1,
                column: 1,
            });
            expect(findings.find((finding) => finding.ruleId === 'gspot/types-placement')).toBeUndefined();
        }
        const card = join(sandbox.path, 'cards/asset-card.ts');
        const collisions = linter.verify('export const value = 1;', config, { filename: card });
        if (level === 'recommended') expect(collisions).toEqual([]);
        else {
            expect(collisions.find((finding) => finding.ruleId === 'gspot/no-prefix-collisions')).toMatchObject({
                messageId: 'collision',
                line: 1,
                column: 1,
            });
        }
        await Bun.write(join(sandbox.path, 'feature/second.ts'), '');
        renameSync(join(sandbox.path, 'cards/asset-list.ts'), join(sandbox.path, 'cards/other.ts'));
        expect(linter.verify("'use server';\nexport const value = 1;", config, { filename })).toEqual([]);
        expect(linter.verify("'use server';\nexport const value = 1;", config, { filename: card })).toEqual([]);
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
        ).toEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
        const defect = linter.verify("'use client';\nexport const value = process.env.SECRET;", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(defect.filter(({ ruleId }) => ruleId === 'gspot/no-client-environment')).toMatchObject([
            { line: 2, messageId: 'private' },
        ]);
        const corrected = linter.verify("'use client';\nexport const value = 'public';", config, {
            filename: join(sandbox.path, 'example.js'),
        });
        expect(corrected).toEqual([]);
    },
);
