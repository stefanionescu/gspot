import { ESLint } from 'eslint';
import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { runConfiguration } from '#cli/lifecycle/preview/eslint/client.ts';
import { eslintPreviewResponse } from '#cli/lifecycle/preview/eslint/protocol.ts';
import type { ResolvedRules } from '#tests/types/integration/cli/lifecycle/lifecycle.ts';

test('apply preview retains its text diff when ESLint dependencies are unavailable', async () => {
    await using directory = await testdir();
    const original = 'export default [];\n';
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['javascript'], '[guides]\ninstall = false\n'),
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
    const policy = policyOf(['javascript'], '[guides]\ninstall = false\n', 'all');
    const ignored =
        '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "The fixture checks a changed rule in the rendered configuration."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy + ignored,
        '.gspot/config/.keep': '',
    });
    linkInstalledModules(join(directory.path, '.gspot/node_modules'));
    const originalSession = await openSession(directory.path);
    const original = emitAll(originalSession.policyFiles.policy, originalSession.repository, originalSession.scopes, {
        version: originalSession.version,
        packageClient: originalSession.packageClient,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    writeFileSync(join(directory.path, original.path), original.content);
    const nativeBefore = (await new ESLint({
        cwd: directory.path,
        overrideConfigFile: join(directory.path, original.path),
    }).calculateConfigForFile('entry.js')) as ResolvedRules;
    expect(nativeBefore.rules['no-console']?.[0]).toBe(0);
    writeFileSync(join(directory.path, 'gspot.toml'), `${policy}${ignored}paths = ["tests/**"]\n`);
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.text).toContain('rules: changed no-console');
    expect(preview.text).not.toContain('Rule comparison failed');
    expect(readFileSync(join(directory.path, original.path), 'utf8')).toBe(original.content);
    const correctedSession = await openSession(directory.path);
    const corrected = emitAll(
        correctedSession.policyFiles.policy,
        correctedSession.repository,
        correctedSession.scopes,
        {
            version: correctedSession.version,
            packageClient: correctedSession.packageClient,
        },
    ).files.find((file) => file.path === original.path)!;
    writeFileSync(join(directory.path, original.path), corrected.content);
    const nativeAfter = (await new ESLint({
        cwd: directory.path,
        overrideConfigFile: join(directory.path, original.path),
    }).calculateConfigForFile('entry.js')) as ResolvedRules;
    expect(nativeAfter.rules['no-console']?.[0]).toBe(2);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, original.path) });
    const [allowed] = await eslint.lintText('console.log("message");\n', { filePath: 'tests/line\nbreak.js' });
    expect(allowed!.messages.filter((diagnostic) => diagnostic.ruleId === 'no-console')).toStrictEqual([]);
    const [defect] = await eslint.lintText('console.log("message");\n', { filePath: 'src/line\nbreak.js' });
    expect(defect!.messages).toStrictEqual(containingAll([containing({ ruleId: 'no-console' })]));
    const [fixed] = await eslint.lintText('export const greeting = "message";\n', { filePath: 'src/line\nbreak.js' });
    expect(fixed!.messages.filter((diagnostic) => diagnostic.ruleId === 'no-console')).toStrictEqual([]);
    const applied = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(applied.text).not.toContain('rules: changed no-console');
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
        await runConfiguration({
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
        { files: ['**/*.js'], ignores: ['tests/**'], setting: ['error', { root: `${directory.path}${sep}` }] },
    ]);
    expect(readFileSync(join(directory.path, '.gspot/config/eslint.config.mjs'), 'utf8')).toBe(installed);
});
