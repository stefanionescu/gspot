import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { RULE_PREVIEW_CASES } from '#tests/config/cli/lifecycle/rule-preview.ts';

test.each(RULE_PREVIEW_CASES)('apply compares rules with its last successful write: $name', async (entry) => {
    await using sandbox = await testdir();
    const tables = 'runner = "mise"\n[agent_rules]\nenabled = false\n';
    const base = buildPolicy(entry.configurations, { level: entry.initialLevel, tables: tables + entry.initialTables });
    await createFileTree(sandbox.path, { 'gspot.toml': base, ...entry.source });
    commitAll(sandbox.path);
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = join(sandbox.path, entry.file);
    const original = await readFile(path, 'utf8');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(entry.configurations, { level: entry.proposedLevel, tables }),
    );
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    expect(
        (preview.json as ApplyPlanJson).drift.find(({ path: output }) => output === entry.file)?.rules,
    ).toStrictEqual(entry.changes);
    expect(await readFile(path, 'utf8')).toBe(original);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as ApplyPlanJson).drift.find(({ path: output }) => output === entry.file)).toBeUndefined();
    const repeated = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repeated.json).toMatchObject({ written: [], updated: [], removed: [] });
});

test('Vale previews its added style packages and native rule options at all', async () => {
    await using sandbox = await testdir();
    const tables = 'runner = "mise"\n[agent_rules]\nenabled = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'recommended', tables }),
        'sample.md': '# Sample\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/vale.ini';
    const original = await readFile(join(sandbox.path, path), 'utf8');
    const baseline = getOwnership(sandbox.path).rules?.[path];
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['prose'], { level: 'all', tables }));
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changes = (preview.json as ApplyPlanJson).drift.find(({ path: output }) => output === path)!.rules!;
    expect(changes.map((group) => group.path)).toStrictEqual(['*.rules', '*.BasedOnStyles']);
    expect(changes.find((group) => group.path === '*.BasedOnStyles')?.added).toContain('Google');
    const options = changes.find((group) => group.path === '*.rules')!;
    expect(options.added).toContain('Google.Passive');
    expect(options.added).toContain('Microsoft.Spelling');
    expect(options.removed).toContain('gspot.sentence-length');
    expect(options.changed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
    expect(getOwnership(sandbox.path).rules?.[path]).toStrictEqual(baseline);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    expect(getOwnership(sandbox.path).rules?.[path]).not.toStrictEqual(baseline);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as ApplyPlanJson).drift.find(({ path: output }) => output === path)).toBeUndefined();
    const repeated = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repeated.json).toMatchObject({ written: [], updated: [], removed: [] });
});

test('manual JavaScript edits produce a byte diff without running the edited configuration or changing the rule baseline', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            level: 'all',
            tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n',
        }),
        'entry.js': 'export const value = 1;\n',
    });
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const path = '.gspot/config/eslint.config.mjs';
    const authored = 'throw new Error("The preview executed authored configuration.");\n';
    await chmod(join(sandbox.path, path), 0o644);
    await writeFile(join(sandbox.path, path), authored);
    const before = await readFile(join(sandbox.path, '.gspot/state/ownership.json'));
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as ApplyPlanJson).drift.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(changed?.rules).toBeUndefined();
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await readFile(join(sandbox.path, '.gspot/state/ownership.json'))).toStrictEqual(before);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
});

test('a scoped rule preview changes only the matching project configuration', async () => {
    await using sandbox = await testdir();
    const tables = '[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = ["bash"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables }),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['bash'], {
            tables:
                tables +
                '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["api/**"]\nreason = "The scoped launcher intentionally splits words."\n',
        }),
    );
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const shellcheck = (preview.json as ApplyPlanJson).drift.filter(({ path }) => path.endsWith('shellcheckrc'));
    expect(shellcheck.map(({ path, rules }) => ({ path, rules }))).toStrictEqual([
        {
            path: '.gspot/config/api/shellcheckrc',
            rules: [{ path: 'disable', added: ['SC2086'], removed: [], changed: [] }],
        },
    ]);
});

test('a failed managed write retains the last successful rule baseline until the next apply succeeds', async () => {
    await using sandbox = await testdir();
    const tables = '[agent_rules]\nenabled = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'recommended', tables }),
        'entry.sh': 'echo example\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/shellcheckrc';
    const baseline = getOwnership(sandbox.path).rules?.[path];
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash'], { level: 'all', tables }));
    const rename = filesystem.renameSync;
    {
        using _failure = spyOn(filesystem, 'renameSync').mockImplementation((from, to) => {
            if (String(to) === join(sandbox.path, path)) throw new Error('ShellCheck configuration write denied');
            rename(from, to);
        });
        expect(await rejection(applyCommand({ cwd: sandbox.path, isDryRun: false }))).toContain(
            'ShellCheck configuration write denied',
        );
    }
    expect(getOwnership(sandbox.path).rules?.[path]).toStrictEqual(baseline);
    const repaired = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repaired.exitCode, repaired.text).toBe(0);
    expect(getOwnership(sandbox.path).rules?.[path]).not.toStrictEqual(baseline);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as ApplyPlanJson).drift.find((entry) => entry.path === path)).toBeUndefined();
});
