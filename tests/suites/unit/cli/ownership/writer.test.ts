import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { captureThrow } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { planSettingsWrite } from '#cli/ownership/file-settings.ts';
import { planBlock, planReplacement } from '#cli/ownership/plans.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';

test('one batch writes the planned binary bytes and removes a stray file', async () => {
    await using sandbox = await testdir();
    using writer = openWriter(sandbox.path);
    const first = Buffer.from([0, 255, 10]);
    const second = Buffer.from([255, 0, 13]);
    writePlans(writer, [
        planReplacement(writer, { path: '.gspot/first.bin', next: { bytes: first, mode: 0o644 } }),
        planReplacement(writer, { path: '.gspot/second.bin', next: { bytes: second, mode: 0o644 } }),
    ]);
    expect(await readFile(join(sandbox.path, '.gspot/first.bin'))).toStrictEqual(first);
    expect(await readFile(join(sandbox.path, '.gspot/second.bin'))).toStrictEqual(second);
    writePlans(writer, [
        { path: '.gspot/first.bin', before: writer.files.read('.gspot/first.bin'), status: 'changed' },
    ]);
    expect(writer.files.readStats('.gspot/first.bin')).toBeUndefined();
    expect(await readFile(join(sandbox.path, '.gspot/second.bin'))).toStrictEqual(second);
});
test.each(['replacement', 'block', 'keys'] as const)(
    '%s plans refuse a file edited after planning and leave the edit in place',
    async (kind) => {
        await using sandbox = await testdir({ 'config.toml': 'strict = true\n' });

        await chmod(join(sandbox.path, 'config.toml'), 0o640);
        using writer = openWriter(sandbox.path);

        const plans = {
            replacement: () =>
                planReplacement(writer, {
                    path: 'config.toml',
                    next: { bytes: Buffer.from('strict = false\n'), mode: 0o444 },
                    expected: writer.files.read('config.toml'),
                }),
            block: () => planBlock(writer, 'config.toml', 'managed content', 'hash'),
            keys: () => planSettingsWrite(writer, 'config.toml', [{ key: ['extends'], value: './managed.json' }]),
        };
        const plan = plans[kind]();
        expect(writer.files.read('config.toml')).toStrictEqual({
            bytes: Buffer.from('strict = true\n'),
            mode: normalizeFileMode({ mode: 0o640 }),
        });
        await writeFile(join(sandbox.path, 'config.toml'), 'edited = true\n');
        expect(
            captureThrow(() => {
                writePlans(writer, [plan]);
            }),
        ).toBe('config.toml changed while gspot wrote it. Run the command again.');
        expect(writer.files.read('config.toml')).toStrictEqual({
            bytes: Buffer.from('edited = true\n'),
            mode: normalizeFileMode({ mode: 0o640 }),
        });
    },
);
test('a batch writes the files before an edited one and refuses the edited one', async () => {
    await using sandbox = await testdir({ 'first.txt': 'original first', 'last.txt': 'original last' });

    using writer = openWriter(sandbox.path);

    const plans = ['first.txt', 'last.txt'].map((path) =>
        planReplacement(writer, {
            path,
            next: { bytes: Buffer.from('replacement'), mode: 0o644 },
            expected: writer.files.read(path),
        }),
    );
    await writeFile(join(sandbox.path, 'last.txt'), 'authored after plan');
    expect(
        captureThrow(() => {
            writePlans(writer, plans);
        }),
    ).toBe('last.txt changed while gspot wrote it. Run the command again.');
    expect(await readFile(join(sandbox.path, 'first.txt'), 'utf8')).toBe('replacement');
    expect(await readFile(join(sandbox.path, 'last.txt'), 'utf8')).toBe('authored after plan');
});
test('a file gspot does not own refuses the whole batch and leaves every file as it was', async () => {
    await using sandbox = await testdir({ '.gspot/owned.txt': 'original', 'authored.txt': 'keep authored' });

    using writer = openWriter(sandbox.path);

    writePlans(writer, [
        planReplacement(writer, {
            path: '.gspot/owned.txt',
            next: { bytes: Buffer.from('installed'), mode: 0o644 },
            expected: writer.files.read('.gspot/owned.txt'),
        }),
    ]);
    const plans = ['.gspot/owned.txt', 'authored.txt'].map((path) =>
        planReplacement(writer, {
            path,
            next: { bytes: Buffer.from('replacement'), mode: 0o644 },
        }),
    );
    expect(
        captureThrow(() => {
            writePlans(writer, plans);
        }),
    ).toBe('gspot did not overwrite these files: authored.txt. Move them aside, then run the command again.');
    expect(await readFile(join(sandbox.path, '.gspot/owned.txt'), 'utf8')).toBe('installed');
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('keep authored');
});
// Windows does not preserve the POSIX permission-bit edit in the mode row.
test.each(
    [
        { name: 'bytes', change: (path: string) => writeFile(path, '{"semi":true}\n') },
        { name: 'mode', change: (path: string) => chmod(path, 0o600) },
        { name: 'removed', change: (path: string) => unlink(path) },
    ].filter(({ name }) => name !== 'mode' || !isWindows),
)(
    'a file whose $name changed after it was read refuses removal and replacement, and a fresh read removes it',
    async ({ change }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, 'authored.json');
        await writeFile(path, '{"semi":false}\n', { mode: 0o640 });
        const firstWriter = openWriter(sandbox.path);

        const read = firstWriter.files.read('authored.json')!;
        await change(path);
        const edited = firstWriter.files.read('authored.json');
        expect(
            captureThrow(() => {
                writePlans(firstWriter, [{ path: 'authored.json', before: read, status: 'changed' }]);
            }),
        ).toBe('authored.json changed before removal. Run the command again.');
        expect(
            captureThrow(() => {
                writePlans(firstWriter, [
                    planReplacement(firstWriter, {
                        path: 'authored.json',
                        next: { bytes: Buffer.from('{}\n'), mode: 0o444 },
                        expected: read,
                    }),
                ]);
            }),
        ).toBe('authored.json changed while gspot wrote it. Run the command again.');
        expect(firstWriter.files.read('authored.json')).toStrictEqual(edited);
        await writeFile(path, read.bytes);
        await chmod(path, read.mode);
        firstWriter[Symbol.dispose]();
        using writer = openWriter(sandbox.path);
        const refreshed = writer.files.read('authored.json')!;
        writePlans(writer, [{ path: 'authored.json', before: refreshed, status: 'changed' }]);
        expect(writer.files.read('authored.json')).toBeUndefined();
    },
);
