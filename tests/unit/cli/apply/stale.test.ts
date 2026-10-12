import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { readOwnershipLog } from '#cli/ownership/log.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { RULE_CHANGE_CASES } from '#tests/config/rule-capture.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { type DryRunJson } from '#cli/types/commands/save-settings.ts';
import { isStray, expectedPaths, findStaleFiles } from '#cli/apply/stale.ts';

test.each([...RULE_CHANGE_CASES])('apply compares lint rules with its last successful write: $name', async (entry) => {
    await using sandbox = await testdir();
    const tables = '';
    const base = settingsText(entry.configurations, { level: 'all', tables: tables + entry.initialTables });
    await createFileTree(sandbox.path, { 'gspot.toml': base, ...entry.source });
    commitAll(sandbox.path);
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = join(sandbox.path, entry.file);
    const original = await readFile(path, 'utf8');
    await writeFile(join(sandbox.path, 'gspot.toml'), settingsText(entry.configurations, { level: 'all', tables }));
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    expect((preview.json as DryRunJson).drift.find(({ path: output }) => output === entry.file)?.rules).toStrictEqual(
        entry.changes.map((change) => ({
            ...change,
            added: [...change.added],
            removed: [...change.removed],
            changed: [...change.changed],
        })),
    );
    expect(await readFile(path, 'utf8')).toBe(original);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as DryRunJson).drift.find(({ path: output }) => output === entry.file)).toBeUndefined();
    const repeated = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repeated.json).toMatchObject({ written: [], updated: [], removed: [] });
});

test('a hand edit of the ESLint config shows as a byte diff, without running it or changing the rule record', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            level: 'all',
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
    const changed = (preview.json as DryRunJson).drift.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(changed?.rules).toBeUndefined();
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await readFile(join(sandbox.path, '.gspot/state/ownership.json'))).toStrictEqual(before);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    await unlink(join(sandbox.path, '.gspot/state/ownership.json'));
    const unrecorded = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(unrecorded.exitCode, unrecorded.text).toBe(0);
    expect((unrecorded.json as DryRunJson).drift.find((entry) => entry.path === path)).toStrictEqual(changed);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('a failed write keeps the last rule record until the next apply succeeds', async () => {
    await using sandbox = await testdir();
    const tables = '';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['bash'], { level: 'recommended', tables }),
        'entry.sh': 'echo example\n',
    });
    const initialized = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(initialized.exitCode, initialized.text).toBe(0);
    const path = '.gspot/config/shellcheckrc';
    const baseline = readOwnershipLog(sandbox.path).lintRules?.[path];
    await writeFile(join(sandbox.path, 'gspot.toml'), settingsText(['bash'], { level: 'all', tables }));
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
    expect(readOwnershipLog(sandbox.path).lintRules?.[path]).toStrictEqual(baseline);
    const repaired = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(repaired.exitCode, repaired.text).toBe(0);
    expect(readOwnershipLog(sandbox.path).lintRules?.[path]).not.toStrictEqual(baseline);
    const settled = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect((settled.json as DryRunJson).drift.find((entry) => entry.path === path)).toBeUndefined();
});
{
    test('rule changes name additions, removals, and changed options across every declared path', async () => {
        await using sandbox = await testdir();
        const path = 'rules.json';
        await createFileTree(sandbox.path, {
            [path]: '{}',
            '.gspot/state/ownership.json': JSON.stringify({
                version: 1,
                files: [],
                lintRules: {
                    [path]: { rules: { first: true, second: 2 }, disabled: { old: true } },
                },
            }),
        });
        expect(
            findStaleFiles(
                { root: sandbox.path, npmClient: () => undefined },
                {
                    notes: [],
                    blocks: [],
                    fileEdits: [],
                    files: [
                        {
                            path,
                            content: '{}',
                            kind: 'tool_file',
                            capturedRules: {
                                rules: { second: 3, third: true },
                                enabled: { new: true },
                            },
                        },
                    ],
                },
            ),
        ).toStrictEqual([
            {
                path,
                kind: 'changed',
                rules: [
                    { path: 'rules', added: ['third'], removed: ['first'], changed: ['second'] },
                    { path: 'disabled', added: [], removed: ['old'], changed: [] },
                    { path: 'enabled', added: ['new'], removed: [], changed: [] },
                ],
            },
        ]);
    });

    test('rule values keep false, zero, null, nested options, and significant array order', async () => {
        await using sandbox = await testdir();
        const path = 'rules.json';
        await createFileTree(sandbox.path, {
            [path]: '{}',
            '.gspot/state/ownership.json': JSON.stringify({
                version: 1,
                files: [],
                lintRules: {
                    [path]: {
                        rules: {
                            disabled: 0,
                            flag: false,
                            nullable: null,
                            option: { first: true, second: [2, 'always'] },
                        },
                    },
                },
            }),
        });
        const generated: Generated = {
            notes: [],
            blocks: [],
            fileEdits: [],
            files: [
                {
                    path,
                    content: '{}',
                    kind: 'tool_file' as const,
                    capturedRules: {
                        rules: {
                            disabled: 0,
                            flag: true,
                            nullable: false,
                            option: { second: [2, 'never'], first: true },
                        },
                    },
                },
            ],
        };
        expect(findStaleFiles({ root: sandbox.path, npmClient: () => undefined }, generated)).toStrictEqual([
            {
                path,
                kind: 'changed',
                rules: [{ path: 'rules', added: [], removed: [], changed: ['flag', 'nullable', 'option'] }],
            },
        ]);
        generated.files[0]!.capturedRules!['rules'] = {
            disabled: 0,
            flag: false,
            nullable: null,
            option: { second: [2, 'always'], first: true },
        };
        expect(findStaleFiles({ root: sandbox.path, npmClient: () => undefined }, generated)).toStrictEqual([]);
    });

    test("turned-off rules have the same stray paths in a dry run and in apply's removal", async () => {
        await using sandbox = await testdir();
        const settings = settingsText([], { rules: true, tables: '[rules]\nenabled = true\n' });
        await createFileTree(sandbox.path, { 'gspot.toml': settings });
        expect(await applyCommand({ cwd: sandbox.path, isDryRun: false })).toHaveProperty('exitCode', 0);
        const owned = readOwnershipLog(sandbox.path).files.filter((entry) => entry.path.startsWith('.gspot/rules/'));
        expect(owned.length).toBeGreaterThan(0);
        await Bun.write(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
        const session = await openSession(sandbox.path);
        const generated = emitAll(session);
        const expected = expectedPaths(session, generated);
        const strays = findStaleFiles(session, generated).filter((entry) => entry.kind === 'stray');
        for (const entry of owned) {
            expect(isStray(entry, expected)).toBe(true);
            expect(strays).toContainEqual({ path: entry.path, kind: 'stray' });
            expect(await pathExists(join(sandbox.path, entry.path))).toBe(true);
        }
        const written = await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(written.exitCode).toBe(0);
        for (const entry of owned) expect(await pathExists(join(sandbox.path, entry.path))).toBe(false);
    });
}
