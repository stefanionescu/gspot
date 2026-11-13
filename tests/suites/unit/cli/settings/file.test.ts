import { stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readSettingsFile, writeSettings } from '#cli/settings/file.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('reading a file with invalid UTF-8 is refused', async () => {
    await using sandbox = await testdir();
    const invalid = Buffer.concat([Buffer.from('configurations = ["bash"]\n'), Buffer.from([0xff])]);
    await writeFile(join(sandbox.path, 'gspot.toml'), invalid);
    expect(() => readSettingsFile(sandbox.path)).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'settings' }),
    );
});

test('reading a missing gspot.toml is refused', async () => {
    await using sandbox = await testdir();
    expect(() => readSettingsFile(sandbox.path)).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'settings' }),
    );
});

test('writing an unchanged file does not touch it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, 'configurations = ["bash"]\n');
    const input = readSettingsFile(sandbox.path);
    const before = await stat(path);
    const writer = openFiles(sandbox.path);
    writeSettings(writer, input.text, input.previous);
    expect(await stat(path)).toMatchObject({ ino: before.ino, mtimeMs: before.mtimeMs, mode: before.mode });
});

test('reading a gspot.toml that links out of the repository is refused', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside.toml': 'configurations = ["bash"]\n' });

    const root = join(sandbox.path, 'project');
    await symlink(join(sandbox.path, 'outside.toml'), join(root, 'gspot.toml'));
    expect(() => readSettingsFile(root)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: 'gspot.toml is not a regular file. Use a regular file.',
        }),
    );
});
