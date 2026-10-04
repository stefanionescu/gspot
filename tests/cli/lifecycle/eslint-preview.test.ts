import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ResolvedEslint } from '#tests/types/generation/configuration-files.ts';

test('apply preview compares authored bytes offline without executing edited ESLint configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
        'entry.js': 'export const value = 1;\n',
    });
    const initialized = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/eslint.config.mjs';
    const authored = 'throw new Error("The preview executed edited ESLint configuration.");\n';
    chmodSync(join(directory.path, path), 0o644);
    writeFileSync(join(directory.path, path), authored);
    const baseline = readFileSync(join(directory.path, '.gspot/state/ownership.json'));
    expect(existsSync(join(directory.path, '.gspot/node_modules'))).toBe(false);
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as ApplyPreviewJson).drift.find((entry) => entry.path === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(changed?.rules).toBeUndefined();
    expect(readFileSync(join(directory.path, path), 'utf8')).toBe(authored);
    expect(readFileSync(join(directory.path, '.gspot/state/ownership.json'))).toStrictEqual(baseline);
    expect(existsSync(join(directory.path, '.gspot/node_modules'))).toBe(false);
});

test('apply preview reports a scoped ESLint rule change and saves the baseline only after applying it', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' });
    const ignored =
        '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "The fixture checks a changed rule in the rendered configuration."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy + ignored,
        'entry.js': 'export const value = 1;\n',
    });
    const initialized = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/eslint.config.mjs';
    const original = readFileSync(join(directory.path, path), 'utf8');
    const baseline = readFileSync(join(directory.path, '.gspot/state/ownership.json'));
    linkInstalledModules(join(directory.path, '.gspot/node_modules'));
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, path) });
    const nativeBefore = (await eslint.calculateConfigForFile('entry.js')) as ResolvedEslint;
    expect(nativeBefore.rules['no-console']?.[0]).toBe(0);
    writeFileSync(join(directory.path, 'gspot.toml'), `${policy}${ignored}paths = ["tests/**"]\n`);
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as ApplyPreviewJson).drift.find((entry) => entry.path === path);
    expect(changed?.rules?.flatMap((group) => group.changed)).toContain('no-console');
    expect({
        output: readFileSync(join(directory.path, path), 'utf8'),
        baseline: readFileSync(join(directory.path, '.gspot/state/ownership.json')),
    }).toStrictEqual({ output: original, baseline });
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const corrected = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, path) });
    const nativeAfter = (await corrected.calculateConfigForFile('entry.js')) as ResolvedEslint;
    expect(nativeAfter.rules['no-console']?.[0]).toBe(2);
    const [allowed] = await corrected.lintText('console.log("message");\n', { filePath: 'tests/line\nbreak.js' });
    expect(allowed!.messages.filter((diagnostic) => diagnostic.ruleId === 'no-console')).toStrictEqual([]);
    const [defect] = await corrected.lintText('console.log("message");\n', { filePath: 'src/line\nbreak.js' });
    expect(defect!.messages).toStrictEqual(containingAll([containing({ ruleId: 'no-console' })]));
    const settled = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect((settled.json as ApplyPreviewJson).drift.find((entry) => entry.path === path)).toBeUndefined();
});
