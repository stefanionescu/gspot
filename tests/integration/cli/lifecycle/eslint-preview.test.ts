import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { eslintPreviewResponse } from '#cli/evaluation/protocol.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';

test('apply preview retains its text diff when ESLint dependencies are unavailable', async () => {
    await using directory = await testdir();
    const original = 'export default [];\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n',
        '.gspot/config/eslint.config.mjs': original,
    });
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.exitCode).toBe(0);
    expect(preview.text).toContain('Rule comparison failed:');
    expect(preview.text).toContain('--- a/.gspot/config/eslint.config.mjs');
    expect(readFileSync(join(directory.path, '.gspot/config/eslint.config.mjs'), 'utf8')).toBe(original);
});

test('apply preview names a generated ESLint rule change using installed dependencies', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n';
    const ignored =
        '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "The fixture checks a changed rule in the rendered configuration."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy + ignored,
        '.gspot/config/.keep': '',
    });
    symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(directory.path, '.gspot/node_modules'), 'dir');
    const renderSession1 = await openSession(directory.path);
    const original = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    writeFileSync(join(directory.path, original.path), original.content);
    const nativeBefore = await new ESLint({
        cwd: directory.path,
        overrideConfigFile: join(directory.path, original.path),
    }).calculateConfigForFile('entry.js');
    expect(nativeBefore.rules['no-console'][0]).toBe(0);
    writeFileSync(join(directory.path, 'gspot.toml'), `${policy}${ignored}paths = ["tests/**"]\n`);
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.text).toContain('rules: changed no-console');
    expect(preview.text).not.toContain('Rule comparison failed');
    expect(readFileSync(join(directory.path, original.path), 'utf8')).toBe(original.content);
    const renderSession2 = await openSession(directory.path);
    const corrected = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    }).files.find((file) => file.path === original.path)!;
    writeFileSync(join(directory.path, original.path), corrected.content);
    const nativeAfter = await new ESLint({
        cwd: directory.path,
        overrideConfigFile: join(directory.path, original.path),
    }).calculateConfigForFile('entry.js');
    expect(nativeAfter.rules['no-console'][0]).toBe(2);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, original.path) });
    const [allowed] = await eslint.lintText('console.log("message");\n', { filePath: 'tests/line\nbreak.js' });
    expect(allowed!.messages.filter((message) => message.ruleId === 'no-console')).toStrictEqual([]);
    const [defect] = await eslint.lintText('console.log("message");\n', { filePath: 'src/line\nbreak.js' });
    expect(defect!.messages).toStrictEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'no-console' })]));
    const [fixed] = await eslint.lintText('export const greeting = "message";\n', { filePath: 'src/line\nbreak.js' });
    expect(fixed!.messages.filter((message) => message.ruleId === 'no-console')).toStrictEqual([]);
    expect((await applyCommand({ cwd: directory.path, isDryRun: true })).text).not.toContain(
        'rules: changed no-console',
    );
});

test('isolated ESLint preview resolves imports and file scopes without replacing installed configuration', async () => {
    await using directory = await testdir();
    const installed = 'export default [];\n';
    await createFileTree(directory.path, {
        '.gspot/config/eslint.config.mjs': installed,
        '.gspot/config/rules.mjs': 'export default { "no-eval": "error" };\n',
    });
    const before = `import rules from './rules.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
console.log('Configuration log stays outside the structured result.');
export default [{ files: ['**/*.js'], ignores: ['tests/**'], rules: { ...rules, 'example/root': ['error', { root }] } }];`;
    const result = eslintPreviewResponse.parse(
        await evaluateConfiguration({
            tool: 'eslint',
            operation: 'preview-rules',
            root: directory.path,
            path: '.gspot/config/eslint.config.mjs',
            sources: [before, before.replace('...rules,', "...rules, 'no-eval': 'off',")],
        }),
    );
    expect(result[0]?.['no-eval']).toStrictEqual([{ files: ['**/*.js'], ignores: ['tests/**'], setting: 'error' }]);
    expect(result[1]?.['no-eval']).toStrictEqual([{ files: ['**/*.js'], ignores: ['tests/**'], setting: 'off' }]);
    expect(result[0]?.['example/root']).toStrictEqual([
        { files: ['**/*.js'], ignores: ['tests/**'], setting: ['error', { root: `${directory.path}/` }] },
    ]);
    expect(readFileSync(join(directory.path, '.gspot/config/eslint.config.mjs'), 'utf8')).toBe(installed);
});
