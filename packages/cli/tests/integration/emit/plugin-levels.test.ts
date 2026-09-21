import { join } from 'node:path';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';

const modules = join(import.meta.dir, '../../../../../node_modules');

test.each(['recommended', 'all'] as const)(
    'generated %s ESLint retains client defects and makes aliases opt-in',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\npresets = ["javascript"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'client.js': '',
            'other.js': '',
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const output = emitAll(await openSession(sandbox.path));
        const config = output.files.find((file) => file.path === '.gspot/eslint.config.mjs')!;
        mkdirSync(join(sandbox.path, '.gspot'));
        writeFileSync(join(sandbox.path, config.path), config.content);
        const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
        const finding = await eslint.lintText("'use client';\nexport const value = process.env.SECRET;\n", {
            filePath: 'client.js',
        });
        expect(
            finding.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/no-client-environment'),
        ).toMatchObject([{ line: 2, messageId: 'private' }]);
        const alias = await eslint.lintText('const source = 1;\nexport const publicName = source;\n', {
            filePath: 'client.js',
        });
        expect(
            alias
                .flatMap((file) => file.messages)
                .filter(({ ruleId }) => ruleId === 'gspot/no-exported-alias-constants')
                .map(({ line, column, messageId }) => ({ line, column, messageId })),
        ).toEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
        const corrected = await eslint.lintText("'use client';\nexport const value = 'public';\n", {
            filePath: 'client.js',
        });
        expect(
            corrected
                .flatMap((file) => file.messages)
                .filter(
                    ({ ruleId }) =>
                        ruleId === 'gspot/no-client-environment' || ruleId === 'gspot/no-exported-alias-constants',
                ),
        ).toEqual([]);
    },
);
