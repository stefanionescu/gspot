import { stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readSettingsFile, writeSettings } from '#cli/settings/file.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { COMMENTED_SETTINGS } from '#tests/config/settings/read.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('reading a file with invalid UTF-8 is refused', async () => {
    await using sandbox = await testdir();
    const invalid = Buffer.concat([Buffer.from(COMMENTED_SETTINGS), Buffer.from([0xff])]);
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
    await writeFile(path, COMMENTED_SETTINGS);
    const input = readSettingsFile(sandbox.path);
    const before = await stat(path);
    const writer = openFiles(sandbox.path);
    writeSettings(writer, input.text, input.previous);
    expect(await stat(path)).toMatchObject({ ino: before.ino, mtimeMs: before.mtimeMs, mode: before.mode });
});

test.each(['symlink inside', 'symlink outside'])('reading a gspot.toml that is a link is refused: %s', async (kind) => {
    await using sandbox = await testdir({
        'project/source.toml': COMMENTED_SETTINGS,
        'outside.toml': COMMENTED_SETTINGS,
    });

    const root = join(sandbox.path, 'project');
    const target = join(sandbox.path, kind === 'symlink outside' ? 'outside.toml' : 'project/source.toml');
    await symlink(target, join(root, 'gspot.toml'));
    expect(() => readSettingsFile(root)).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' }));
});
