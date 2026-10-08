import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import type { ComputedEslint } from '#tests/types/generation/configuration-files.ts';

test('apply preview reports a scoped ESLint rule change and saves the baseline only after applying it', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' });
    const ignored =
        '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "The sandbox checks a changed rule in the emitted configuration."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy + ignored,
        'entry.js': 'export const value = 1;\n',
    });
    const initialized = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/eslint.config.mjs';
    const original = await readFile(join(directory.path, path), 'utf8');
    const baseline = await readFile(join(directory.path, '.gspot/state/ownership.json'));
    await linkInstalledModules(join(directory.path, '.gspot/node_modules'));
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, path) });
    const nativeBefore = (await eslint.calculateConfigForFile('entry.js')) as ComputedEslint;
    expect(nativeBefore.rules['no-console']?.[0]).toBe(0);
    await writeFile(join(directory.path, 'gspot.toml'), `${policy}${ignored}paths = ["tests/**"]\n`);
    const preview = await applyCommand({ cwd: directory.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as ApplyPlanJson).drift.find((entry) => entry.path === path);
    expect(changed?.rules?.flatMap((group) => group.changed)).toContain('no-console');
    expect({
        output: await readFile(join(directory.path, path), 'utf8'),
        baseline: await readFile(join(directory.path, '.gspot/state/ownership.json')),
    }).toStrictEqual({ output: original, baseline });
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const corrected = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, path) });
    const nativeAfter = (await corrected.calculateConfigForFile('entry.js')) as ComputedEslint;
    expect(nativeAfter.rules['no-console']?.[0]).toBe(2);
});
