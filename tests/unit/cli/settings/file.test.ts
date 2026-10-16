import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { COMMENTED_SETTINGS } from '#tests/config/samples/settings.ts';
import { link, stat, symlink, readFile, writeFile } from 'node:fs/promises';
import { setKey, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { parseTomlText, writeSettings, readSettingsFile } from '#cli/settings/file.ts';

const written = COMMENTED_SETTINGS;

test('a TOML syntax error names the file, line and column', () => {
    expect(() => parseTomlText('"🚦前言"=2026-04-31\n', 'https://example.com/team.toml', 'template')).toThrow(
        'https://example.com/team.toml:1:8 is not valid TOML:',
    );
    expect(() => parseTomlText('level="all"\nlevel="all"\n', 'gspot.toml', 'settings')).toThrow(
        'gspot.toml:2:1 is not valid TOML:',
    );
});

test('an edit of a file with invalid UTF-8 is refused and the file is unchanged', async () => {
    await using sandbox = await testdir();
    const invalid = Buffer.concat([Buffer.from(written), Buffer.from([0xff])]);
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, invalid);
    expect(() => readSettingsEdit(sandbox.path)).toThrow('valid UTF-8');
    expect(() => readSettingsFile(sandbox.path)).toThrow('valid UTF-8');
    expect(await readFile(path)).toStrictEqual(invalid);
});

test('an edit planned from old bytes is refused, and a new plan is written', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, written);
    const input = readSettingsEdit(sandbox.path);
    const result = updateSettings(sandbox.path, input, (written) => {
        setKey(written, 'level', 'all');
    });
    await writeFile(path, `${written}# Concurrent edit.\n`);
    using log = openWriter(sandbox.path);
    expect(() => {
        writeSettings(log, result.text, input.original);
    }).toThrow();
    expect(await readFile(path, 'utf8')).toBe(`${written}# Concurrent edit.\n`);
    const fresh = readSettingsEdit(sandbox.path);
    const next = updateSettings(sandbox.path, fresh, (written) => {
        setKey(written, 'level', 'all');
    });
    writeSettings(log, next.text, fresh.original);
    expect(readSettings(sandbox.path, createReadCache(process.cwd())).settings.level).toBe('all');
});

test('reading or editing a missing gspot.toml is refused and creates nothing', async () => {
    await using sandbox = await testdir();
    expect(() => readSettings(sandbox.path, createReadCache(process.cwd()))).toThrow('Run `gspot init`');
    expect(() => readSettingsEdit(sandbox.path)).toThrow('Run `gspot init`');
    expect(await stat(join(sandbox.path, 'gspot.toml')).catch(() => undefined)).toBeUndefined();
});

test('writing an unchanged file does not touch it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, written);
    const input = readSettingsEdit(sandbox.path);
    const before = await stat(path);
    using log = openWriter(sandbox.path);
    writeSettings(log, input.text, input.original);
    expect(await stat(path)).toMatchObject({ ino: before.ino, mtimeMs: before.mtimeMs, mode: before.mode });
});

test.each(['symlink inside', 'symlink outside', 'hardlink'])(
    'an edit of a gspot.toml that is a link is refused and the link target is unchanged: %s',
    async (kind) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/source.toml': written, 'outside.toml': written });
        const root = join(sandbox.path, 'project');
        const target = join(sandbox.path, kind === 'symlink outside' ? 'outside.toml' : 'project/source.toml');
        await (kind === 'hardlink'
            ? link(target, join(root, 'gspot.toml'))
            : symlink(target, join(root, 'gspot.toml')));
        let evaluated = false;
        expect(() =>
            updateSettings(root, readSettingsEdit(root), () => {
                evaluated = true;
            }),
        ).toThrow('regular file with one link');
        expect(evaluated).toBe(false);
        expect(await readFile(target, 'utf8')).toBe(written);
    },
);
