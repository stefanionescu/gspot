import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { type DryRunJson } from '#cli/types/commands/save-settings.ts';

test('a hand edit of the ESLint config shows as a byte diff without running it', async () => {
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
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as DryRunJson).drift.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const unrecorded = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(unrecorded.exitCode, unrecorded.text).toBe(0);
    expect((unrecorded.json as DryRunJson).drift.find((entry) => entry.path === path)).toStrictEqual(changed);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});
{
    test("turned-off rules have the same stray paths in a dry run and in apply's removal", async () => {
        await using sandbox = await testdir();
        const settings = settingsText([], { rules: true, tables: '[rules]\nenabled = true\n' });
        await createFileTree(sandbox.path, { 'gspot.toml': settings });
        expect(await applyCommand({ cwd: sandbox.path, isDryRun: false })).toHaveProperty('exitCode', 0);
        const initial = await openSession(sandbox.path);
        const owned = initial.repository.files.filter((entry) => entry.path.startsWith('.gspot/rules/'));
        expect(owned.length).toBeGreaterThan(0);
        await Bun.write(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
        const session = await openSession(sandbox.path);
        const generated = generate(session);
        const strays = findStaleFiles(session, generated).filter((entry) => entry.kind === 'stray');
        for (const entry of owned) {
            expect(strays).toContainEqual({ path: entry.path, kind: 'stray' });
            expect(await pathExists(join(sandbox.path, entry.path))).toBe(true);
        }
        const written = await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(written.exitCode).toBe(0);
        for (const entry of owned) expect(await pathExists(join(sandbox.path, entry.path))).toBe(false);
    });
}

test('a clone with changed settings and matching generated files needs no ownership log', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    gitOutput(source, ['init', '-q']);
    expect(await applyCommand({ cwd: source, isDryRun: false })).toHaveProperty('exitCode', 0);
    commitAll(source);
    await writeFile(join(source, 'gspot.toml'), settingsText(['bash'], { level: 'all' }));
    expect(await applyCommand({ cwd: source, isDryRun: false })).toHaveProperty('exitCode', 0);
    commitAll(source);
    gitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await pathExists(join(checkout, '.gspot/state/ownership.json'))).toBe(false);
    const session = await openSession(checkout);
    const generated = generate(session);
    expect(findStaleFiles(session, generated).filter((entry) => entry.kind === 'changed')).toStrictEqual([]);
});
