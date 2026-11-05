import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('remove without --reason exits 2 and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash'], { rules: true }) });
    const refusal = await assertRefusalWithoutWrites(sandbox.path, ['remove', 'bash'], 'arguments');
    expect(refusal.message).toContain('--reason');
});

test('remove keeps the reason of each removed configuration, and add takes a name out and keeps the others', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'python']),
        'source.sh': 'echo example\n',
        'main.py': 'PORT = 8080\n',
    });
    const reason = 'The project uses another language.';
    const first = await runGspot(sandbox.path, ['remove', 'bash', '--reason', 'Bash runs in another project.']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const removed = await runGspot(sandbox.path, ['remove', 'python', '--reason', reason]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout.split('\n', 1)[0]).toBe('Removed python.');
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).toHaveProperty('removed_configurations', {
        bash: 'Bash runs in another project.',
        python: reason,
    });
    const added = await runGspot(sandbox.path, ['add', 'bash']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const removedSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(removedSettings).toHaveProperty('removed_configurations', { python: reason });
    const restored = await runGspot(sandbox.path, ['add', 'python']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const restoredSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(restoredSettings).not.toHaveProperty('removed_configurations');
});

test('remove stores the reason of a configuration that detection does not select, and leaves no empty list', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--reason', 'The scripts moved elsewhere.']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['configurations']).toBeUndefined();
    expect(written['removed_configurations']).toStrictEqual({ bash: 'The scripts moved elsewhere.' });
});

test('remove names no check as turned off by a setting, because the configuration goes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }),
    });
    const result = await runGspot(sandbox.path, ['remove', 'licenses', '--reason', 'the team checks these by hand']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toContain('This turns off');
});
