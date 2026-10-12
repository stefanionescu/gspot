import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { runGspot, buildRunOptions } from '#tests/setup/run-gspot.ts';
import { SETTINGS_FORMAT_CASES, UNREPRESENTABLE_SETTINGS } from '#tests/config/settings/formatting.ts';

test.each([...SETTINGS_FORMAT_CASES])(
    'the settings-format command corrects $name without installation',
    async ({ source, expected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': source, 'notes.txt': 'Authored source.\n' });
        const path = join(sandbox.path, 'gspot.toml');
        await chmod(path, 0o640);
        using files = openSafeFolder(sandbox.path);
        const { mode } = files.read('gspot.toml')!;
        const before = await readTree(sandbox.path);
        const command = ['check', '--only', 'gspot/settings-format'];
        const checked = await runGspot(sandbox.path, command);
        expect(checked.code, checked.stderr + checked.stdout).toBe(1);
        expect(checked.stdout).toContain(
            'gspot.toml is not in standard order. Run gspot check --fix --only gspot/settings-format.',
        );
        const preview = await runGspot(sandbox.path, [...command, '--fix', '--dry-run']);
        expect(preview.code, preview.stderr + preview.stdout).toBe(1);
        expect(preview.stdout).toContain('a/gspot.toml');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const corrected = await runGspot(sandbox.path, [...command, '--fix']);
        expect(corrected.code, corrected.stderr + corrected.stdout).toBe(0);
        const written = files.read('gspot.toml')!;
        expect(written.bytes.toString('utf8')).toBe(expected);
        expect(written.mode).toBe(mode);
        expect(files.read('notes.txt')!.bytes.toString('utf8')).toBe('Authored source.\n');
        expect(await pathExists(join(sandbox.path, '.gspot/config'))).toBe(false);
        expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const unchanged = await runGspot(sandbox.path, [...command, '--fix']);
        expect(unchanged.code, unchanged.stderr + unchanged.stdout).toBe(0);
        expect(files.read('gspot.toml')!.bytes.toString('utf8')).toBe(expected);
        expect(emitSettings(expected, parseTomlText(expected, 'gspot.toml', 'settings'))).toBe(expected);
    },
);

test('canceling a native settings-format correction keeps authored bytes', async () => {
    await using sandbox = await testdir();
    const source = SETTINGS_FORMAT_CASES[0].source;
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const session = await openSession(sandbox.path);
    const controller = new AbortController();
    controller.abort();
    const result = await executeRun(session, {
        ...buildRunOptions({ only: ['gspot/settings-format'], fix: true }),
        cancelSignal: controller.signal,
    });
    expect(result.fixes?.results).toContainEqual({
        check: 'gspot/settings-format',
        status: 'failed',
        changed: [],
        note: 'The fix was canceled.',
    });
    using files = openSafeFolder(sandbox.path);
    expect(files.read('gspot.toml')!.bytes.toString('utf8')).toBe(source);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('the settings-format command refuses an unrepresentable field comment before any settings write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': UNREPRESENTABLE_SETTINGS });
    using files = openSafeFolder(sandbox.path);
    const { mode } = files.read('gspot.toml')!;
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/settings-format', '--fix']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('tools.prettier.extra.value.mixed.0.first cannot be represented in TOML 1.0');
    const unchanged = files.read('gspot.toml')!;
    expect(unchanged.bytes.toString('utf8')).toBe(UNREPRESENTABLE_SETTINGS);
    expect(unchanged.mode).toBe(mode);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});
