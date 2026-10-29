import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { openWriter } from '#cli/repository/writer.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { COMMENTED_SETTINGS } from '#tests/config/settings/file.ts';
import { writeSettings, readSettingsFile } from '#cli/settings/file.ts';
import { stat, link, symlink, readFile, writeFile } from 'node:fs/promises';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';

test('a TOML syntax error names the file, line and column', () => {
    expect(() => parseTomlFile('gspot.toml', '"🚦前言"=2026-04-31\n')).toThrow('gspot.toml:1:8 is not valid TOML:');
    expect(() => parseTomlFile('gspot.toml', 'level="all"\nlevel="all"\n')).toThrow(
        'gspot.toml:2:1 is not valid TOML:',
    );
});

test('an edit of a file with invalid UTF-8 is refused and the file is unchanged', async () => {
    await using sandbox = await testdir();
    const invalid = Buffer.concat([Buffer.from(COMMENTED_SETTINGS), Buffer.from([0xff])]);
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, invalid);
    expect(() => readSettingsEdit(sandbox.path)).toThrow('valid UTF-8');
    expect(() => readSettingsFile(sandbox.path)).toThrow('valid UTF-8');
    expect(await readFile(path)).toStrictEqual(invalid);
});

test('an edit planned from old bytes is refused, and a new plan is written', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, COMMENTED_SETTINGS);
    const input = readSettingsEdit(sandbox.path);
    setKey(input.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, input);
    await writeFile(path, `${COMMENTED_SETTINGS}# Concurrent edit.\n`);
    using writer = openWriter(sandbox.path);
    expect(() => {
        writeSettings(writer, result.text, input.previous);
    }).toThrow(new GspotError('filesystem', 'gspot.toml changed while gspot wrote it. Run the command again.'));
    expect(await readFile(path, 'utf8')).toBe(`${COMMENTED_SETTINGS}# Concurrent edit.\n`);
    const fresh = readSettingsEdit(sandbox.path);
    setKey(fresh.table, 'level', 'all');
    const next = buildEditedSettings(sandbox.path, fresh);
    writeSettings(writer, next.text, fresh.previous);
    const settings = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path).level;
    expect(settings).toBe('all');
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
    using writer = openWriter(sandbox.path);
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
            new GspotError('filesystem', 'gspot.toml is not a regular file. Use a regular file.'),
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
    using writer = openWriter(sandbox.path);
    writeSettings(writer, result.text, input.previous);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(result.text);
    expect(await readFile(peer, 'utf8')).toBe(COMMENTED_SETTINGS);
    const [written, kept] = await Promise.all([stat(join(sandbox.path, 'gspot.toml')), stat(peer)]);
    expect(written.ino).not.toBe(kept.ino);
});
