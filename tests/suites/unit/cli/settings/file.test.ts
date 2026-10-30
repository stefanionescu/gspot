import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { COMMENTED_SETTINGS } from '#tests/config/settings/file.ts';
import { writeSettings, readSettingsFile } from '#cli/settings/file.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { stat, link, symlink, readFile, writeFile } from 'node:fs/promises';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';

test('an edit of a file with invalid UTF-8 is refused and the file is unchanged', async () => {
    await using sandbox = await testdir();
    const invalid = Buffer.concat([Buffer.from(COMMENTED_SETTINGS), Buffer.from([0xff])]);
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, invalid);
    expect(() => readSettingsEdit(sandbox.path)).toThrow('valid UTF-8');
    expect(() => readSettingsFile(sandbox.path)).toThrow('valid UTF-8');
    expect(await readFile(path)).toStrictEqual(invalid);
});

test('reading or editing a missing gspot.toml is refused and creates nothing', async () => {
    await using sandbox = await testdir();
    expect(() => readSettingsFile(sandbox.path)).toThrow('Run gspot init');
    expect(() => readSettingsEdit(sandbox.path)).toThrow('Run gspot init');
    const missing = await captureRejection(stat(join(sandbox.path, 'gspot.toml')));
    expect(missing).toMatchObject({ code: 'ENOENT' });
});

test('writing an unchanged file does not touch it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, COMMENTED_SETTINGS);
    const input = readSettingsEdit(sandbox.path);
    const before = await stat(path);
    const writer = openFiles(sandbox.path);
    writeSettings(writer, input.text, input.previous);
    expect(await stat(path)).toMatchObject({ ino: before.ino, mtimeMs: before.mtimeMs, mode: before.mode });
});

test.each(['symlink inside', 'symlink outside'])(
    'an edit of a gspot.toml that is a link is refused and the link target is unchanged: %s',
    async (kind) => {
        await using sandbox = await testdir({
            'project/source.toml': COMMENTED_SETTINGS,
            'outside.toml': COMMENTED_SETTINGS,
        });

        const root = join(sandbox.path, 'project');
        const target = join(sandbox.path, kind === 'symlink outside' ? 'outside.toml' : 'project/source.toml');
        await symlink(target, join(root, 'gspot.toml'));
        expect(() => readSettingsEdit(root)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: 'gspot.toml is not a regular file. Use a regular file.',
            }),
        );
        expect(await readFile(target, 'utf8')).toBe(COMMENTED_SETTINGS);
    },
);

test('editing settings through a hard link replaces only the selected path', async () => {
    await using sandbox = await testdir({ 'gspot.toml': COMMENTED_SETTINGS });
    const peer = join(sandbox.path, 'peer.toml');
    await link(join(sandbox.path, 'gspot.toml'), peer);
    const input = readSettingsEdit(sandbox.path);
    setKey(input.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, input);
    const writer = openFiles(sandbox.path);
    writeSettings(writer, result.text, input.previous);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(result.text);
    expect(await readFile(peer, 'utf8')).toBe(COMMENTED_SETTINGS);
    const [written, kept] = await Promise.all([stat(join(sandbox.path, 'gspot.toml')), stat(peer)]);
    expect(written.ino).not.toBe(kept.ino);
});
