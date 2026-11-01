import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

test('remove without --reason exits 2 and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash'], { rules: true }) });
    await assertRefusalWithoutWrites(sandbox.path, ['remove', 'bash'], {
        error: 'arguments',
        message:
            "Required option '--reason <text>' not specified. Run gspot remove --help to see its arguments and options.",
    });
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

test('remove records no removal of a configuration that detection does not select', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--reason', 'The scripts moved elsewhere.']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['configurations']).toStrictEqual([]);
    expect(written['removed_configurations']).toBeUndefined();
});
