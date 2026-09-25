import { evaluateEslint } from '#cli/evaluation/eslint.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { expect, test } from 'bun:test';
import { ESLint } from 'eslint';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test('legacy ESLint adoption preserves inherited overrides and ignores for future files', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        'shared.json': JSON.stringify({ rules: { eqeqeq: ['error', 'always'] } }),
        '.eslintrc.json': JSON.stringify({
            root: true,
            extends: './shared.json',
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
            ignorePatterns: ['ignored/**', '!ignored/kept.js'],
            overrides: [{ files: ['src/**/*.js'], excludedFiles: ['src/vendor/**'], rules: { 'no-alert': 'error' } }],
        }),
        'src/current.js': 'alert(1);',
    });
    symlinkSync(INSTALLED_MODULES, join(directory.path, 'node_modules'));
    const carried = await evaluateEslint({
        root: directory.path,
        paths: ['src/current.js'],
        flat: false,
        from: '.eslintrc.json',
    });
    expect(carried.adopted.some((entry) => entry.legacyCriteria?.patterns[0]?.includes?.includes('src/**/*.js'))).toBe(
        true,
    );
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
    );
    const renderSession5 = await openSession(directory.path);
    const generated = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const findings = await eslint.lintText('alert(1); if (1 == "1") alert(2);', { filePath: 'src/future.js' });
    expect(findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(2);
    expect(findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'eqeqeq')).toHaveLength(1);
    const corrected = await eslint.lintText('export const value = 1;', { filePath: 'src/future.js' });
    expect(
        corrected
            .flatMap((entry) => entry.messages)
            .filter((entry) => ['no-alert', 'eqeqeq'].includes(entry.ruleId ?? '')),
    ).toHaveLength(0);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/future.js'))).toBe(true);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/kept.js'))).toBe(false);
    expect(await eslint.isPathIgnored(join(directory.path, '.hidden.js'))).toBe(true);
    expect(existsSync(join(directory.path, '.eslintrc.json'))).toBe(true);
});

test('legacy ESLint adoption preserves inherited plugin environments and extension processors', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        'node_modules/eslint-plugin-fixture/package.json': '{"name":"eslint-plugin-fixture","main":"index.cjs"}',
        'node_modules/eslint-plugin-fixture/index.cjs':
            'module.exports = { environments: { fixture: { globals: { allowed: false } } }, processors: { ".txt": { preprocess(text) { return [text]; }, postprocess(messages) { return messages.flat(); } } }, rules: { forbidden: { meta: {schema: []}, create(context) { return { Identifier(node) { if (node.name === "bad") context.report({node,message:"fixture finding"}); } }; } } } };',
        'shared.json': JSON.stringify({ plugins: ['fixture'], rules: { 'fixture/forbidden': 'error' } }),
        '.eslintrc.json': JSON.stringify({
            root: true,
            extends: './shared.json',
            env: { 'fixture/fixture': true },
            parserOptions: { ecmaVersion: 2022 },
        }),
        'source.js': 'allowed;',
    });
    symlinkSync(join(INSTALLED_MODULES, 'eslint'), join(directory.path, 'node_modules/eslint'));
    const carried = await evaluateEslint({
        root: directory.path,
        paths: ['source.js'],
        flat: false,
        from: '.eslintrc.json',
    });
    expect(
        carried.adopted.some(
            (entry) =>
                entry.languageOptions?.['globals'] &&
                (entry.languageOptions['globals'] as Record<string, unknown>)['allowed'] === false,
        ),
    ).toBe(true);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
    );
    const renderSession6 = await openSession(directory.path);
    const generated = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
        version: renderSession6.version,
        packageManager: renderSession6.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    symlinkSync(INSTALLED_MODULES, join(directory.path, '.gspot/node_modules'));
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const findings = await eslint.lintText('bad;', { filePath: 'future.txt' });
    expect(
        findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'fixture/forbidden'),
    ).toHaveLength(1);
    const corrected = await eslint.lintText('allowed;', { filePath: 'future.txt' });
    expect(
        corrected.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'fixture/forbidden'),
    ).toHaveLength(0);
});
