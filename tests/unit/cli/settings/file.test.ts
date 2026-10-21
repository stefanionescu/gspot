import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { COMMENTED_SETTINGS } from '#tests/data/settings/edits.ts';
import { link, stat, symlink, readFile, writeFile } from 'node:fs/promises';
import { setKey, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { parseTomlText, writeSettings, readSettingsFile } from '#cli/settings/file.ts';

test('a TOML syntax error names the file, line and column', () => {
    expect(() => parseTomlText('"🚦前言"=2026-04-31\n', 'gspot.toml')).toThrow('gspot.toml:1:8 is not valid TOML:');
    expect(() => parseTomlText('level="all"\nlevel="all"\n', 'gspot.toml')).toThrow(
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
    const result = updateSettings(sandbox.path, input);
    await writeFile(path, `${COMMENTED_SETTINGS}# Concurrent edit.\n`);
    using log = openWriter(sandbox.path);
    expect(() => {
        writeSettings(log, result.text, input.original);
    }).toThrow();
    expect(await readFile(path, 'utf8')).toBe(`${COMMENTED_SETTINGS}# Concurrent edit.\n`);
    const fresh = readSettingsEdit(sandbox.path);
    setKey(fresh.table, 'level', 'all');
    const next = updateSettings(sandbox.path, fresh);
    writeSettings(log, next.text, fresh.original);
    expect(readSettings(sandbox.path).settings.level).toBe('all');
});

test('reading or editing a missing gspot.toml is refused and creates nothing', async () => {
    await using sandbox = await testdir();
    expect(() => readSettings(sandbox.path)).toThrow('Run `gspot init`');
    expect(() => readSettingsEdit(sandbox.path)).toThrow('Run `gspot init`');
    expect(await stat(join(sandbox.path, 'gspot.toml')).catch(() => undefined)).toBeUndefined();
});

test('writing an unchanged file does not touch it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, COMMENTED_SETTINGS);
    const input = readSettingsEdit(sandbox.path);
    const before = await stat(path);
    using log = openWriter(sandbox.path);
    writeSettings(log, input.text, input.original);
    expect(await stat(path)).toMatchObject({ ino: before.ino, mtimeMs: before.mtimeMs, mode: before.mode });
});

test.each(['symlink inside', 'symlink outside', 'hardlink'])(
    'an edit of a gspot.toml that is a link is refused and the link target is unchanged: %s',
    async (kind) => {
        await using sandbox = await testdir({
            'project/source.toml': COMMENTED_SETTINGS,
            'outside.toml': COMMENTED_SETTINGS,
        });

        const root = join(sandbox.path, 'project');
        const target = join(sandbox.path, kind === 'symlink outside' ? 'outside.toml' : 'project/source.toml');
        await (kind === 'hardlink'
            ? link(target, join(root, 'gspot.toml'))
            : symlink(target, join(root, 'gspot.toml')));
        expect(() => readSettingsEdit(root)).toThrow('regular file with one link');
        expect(await readFile(target, 'utf8')).toBe(COMMENTED_SETTINGS);
    },
);
