import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { chmodSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { CLONE_RULE_FILES, RULE_PREVIEW_CASES } from '#tests/config/cli/lifecycle/rule-preview.ts';

test('a fresh clone without private ownership state keeps identical rule files clean and previews manual byte edits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'markdown', 'commits'], {
            level: 'all',
            tables: 'run_with = "mise"\n[agent_rules]\nenabled = false\n',
        }),
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'source.ts': 'export const example: number = 1;\n',
        'README.md': '# Example\n',
    });
    commitAll(sandbox.path);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const originals = CLONE_RULE_FILES.map((path) => readFileSync(join(sandbox.path, path), 'utf8'));
    const state = join(sandbox.path, '.gspot/state/ownership.json');
    unlinkSync(state);
    const clean = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(clean.exitCode, clean.text).toBe(0);
    expect((clean.json as ApplyPreviewJson).drift).toStrictEqual([
        { path: '.gspot/package-lock.json', kind: 'missing' },
        { path: '.gspot/uv.lock', kind: 'missing' },
    ]);
    expect(CLONE_RULE_FILES.map((path) => readFileSync(join(sandbox.path, path), 'utf8'))).toStrictEqual(originals);
    const path = '.gspot/config/eslint.config.mjs';
    const authored = 'throw new Error("The preview must not execute a configuration.");\n';
    chmodSync(join(sandbox.path, path), 0o644);
    writeFileSync(join(sandbox.path, path), authored);
    const edited = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(edited.exitCode, edited.text).toBe(0);
    const drift = (edited.json as ApplyPreviewJson).drift.filter((entry) => CLONE_RULE_FILES.includes(entry.path));
    expect(drift).toMatchObject([{ path, kind: 'changed' }]);
    expect(drift[0]?.rules).toBeUndefined();
    expect(drift[0]?.diff).toContain(authored.trim());
    expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(existsSync(state)).toBe(false);
});

test.each(RULE_PREVIEW_CASES)('apply compares rules with its last successful write: $name', async (entry) => {
    await using sandbox = await testdir();
    const tables = 'run_with = "mise"\n[agent_rules]\nenabled = false\n';
    const base = buildPolicy(entry.configurations, { level: entry.initialLevel, tables: tables + entry.initialTables });
    await createFileTree(sandbox.path, { 'gspot.toml': base, ...entry.source });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = join(sandbox.path, entry.file);
    const original = readFileSync(path, 'utf8');
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(entry.configurations, { level: entry.proposedLevel, tables }),
    );
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    expect(
        (preview.json as ApplyPreviewJson).drift.find(({ path: output }) => output === entry.file)?.rules,
    ).toStrictEqual(entry.changes);
    expect(readFileSync(path, 'utf8')).toBe(original);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as ApplyPreviewJson).drift.find(({ path: output }) => output === entry.file)).toBeUndefined();
    const repeated = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repeated.json).toMatchObject({ written: [], updated: [], removed: [] });
});

test('Vale previews its added style packages and native rule options at all', async () => {
    await using sandbox = await testdir();
    const tables = 'run_with = "mise"\n[agent_rules]\nenabled = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'recommended', tables }),
        'sample.md': '# Sample\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/vale.ini';
    const original = readFileSync(join(sandbox.path, path), 'utf8');
    const baseline = getOwnership(sandbox.path).rules?.[path];
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy(['prose'], { level: 'all', tables }));
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changes = (preview.json as ApplyPreviewJson).drift.find(({ path: output }) => output === path)!.rules!;
    expect(changes.map((group) => group.path)).toStrictEqual(['*.rules', '*.BasedOnStyles']);
    expect(changes.find((group) => group.path === '*.BasedOnStyles')).toStrictEqual({
        path: '*.BasedOnStyles',
        added: ['alex', 'Google', 'Harper', 'Microsoft', 'proselint', 'RedHat', 'Vale', 'write-good'],
        removed: [],
        changed: [],
    });
    const options = changes.find((group) => group.path === '*.rules')!;
    expect(options.added).toContain('Google.Passive');
    expect(options.added).toContain('Microsoft.Spelling');
    expect(options.removed).toContain('gspot.sentence-length');
    expect(options.changed).toStrictEqual([]);
    expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
    expect(getOwnership(sandbox.path).rules?.[path]).toStrictEqual(baseline);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    expect(getOwnership(sandbox.path).rules?.[path]).not.toStrictEqual(baseline);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as ApplyPreviewJson).drift.find(({ path: output }) => output === path)).toBeUndefined();
    const repeated = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repeated.json).toMatchObject({ written: [], updated: [], removed: [] });
});

test('manual JavaScript edits produce a byte diff without running the edited configuration or changing the rule baseline', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['commits'], {
            level: 'all',
            tables: 'run_with = "mise"\n[agent_rules]\nenabled = false\n',
        }),
        'sample.txt': 'Sample\n',
    });
    commitAll(sandbox.path);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const path = '.gspot/config/commitlint.config.cjs';
    const authored = 'throw new Error("The preview executed authored configuration.");\n';
    chmodSync(join(sandbox.path, path), 0o644);
    writeFileSync(join(sandbox.path, path), authored);
    const before = readFileSync(join(sandbox.path, '.gspot/state/ownership.json'));
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as ApplyPreviewJson).drift.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(changed?.rules).toBeUndefined();
    expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(readFileSync(join(sandbox.path, '.gspot/state/ownership.json'))).toStrictEqual(before);
});

test('a scoped rule preview changes only the matching project configuration', async () => {
    await using sandbox = await testdir();
    const tables = '[agent_rules]\nenabled = false\n[[scope]]\npath = "api"\nconfigurations = ["bash"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables }),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['bash'], {
            tables:
                tables +
                '[scope.tools.shellcheck.verbatim]\ndisable = "SC2086"\nreason = "The scoped launcher intentionally splits words."\n',
        }),
    );
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const shellcheck = (preview.json as ApplyPreviewJson).drift.filter(({ path }) => path.endsWith('shellcheckrc'));
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
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash'], { level: 'all', tables }));
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
    expect((settled.json as ApplyPreviewJson).drift.find((entry) => entry.path === path)).toBeUndefined();
});
