import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { expect, test } from 'bun:test';
import { ESLint } from 'eslint';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test('cascading legacy ESLint preserves root resets and directory-relative overrides', async () => {
    await using directory = await testdir();
    const configs = {
        '.eslintrc.json': JSON.stringify({
            root: true,
            parserOptions: { ecmaVersion: 2022 },
            rules: { 'no-alert': 'error' },
        }),
        'nested/.eslintrc.json': JSON.stringify({
            overrides: [{ files: ['./*.js'], rules: { 'no-debugger': 'warn' } }],
        }),
        'isolated/.eslintrc.json': JSON.stringify({
            root: true,
            parserOptions: { ecmaVersion: 2022 },
            rules: { 'no-alert': 'off' },
        }),
    };
    await createFileTree(directory.path, { 'package.json': '{"type":"module"}', ...configs });
    symlinkSync(INSTALLED_MODULES, join(directory.path, 'node_modules'));
    const carried = await collectCarried(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({ tool: 'eslint', carries: 'eslint-config' as const, path })),
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['javascript']),
        [],
    );
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['javascript'],
            tools: { eslint: { adopted: carried.tools.get('eslint')?.settings['adopted'] } },
        }),
    );
    const renderSession7 = await openSession(directory.path);
    const generated = emitAll(renderSession7.policyFiles.policy, renderSession7.repository, renderSession7.scopes, {
        version: renderSession7.version,
        packageManager: renderSession7.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const nested = await eslint.lintText('alert(1); debugger;', { filePath: 'nested/future.js' });
    expect(nested.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(1);
    expect(nested.flatMap((entry) => entry.messages).find((entry) => entry.ruleId === 'no-debugger')?.severity).toBe(1);
    const deep = await eslint.lintText('debugger;', { filePath: 'nested/deep/future.js' });
    expect(deep.flatMap((entry) => entry.messages).find((entry) => entry.ruleId === 'no-debugger')?.severity).toBe(2);
    const isolated = await eslint.lintText('alert(1);', { filePath: 'isolated/future.js' });
    expect(isolated.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(0);
});
