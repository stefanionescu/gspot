import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { OWNERSHIP_REFUSAL } from '#tests/data/ownership.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { planBlock, planManagedKeys, planReplacement } from '#cli/ownership/plans.ts';

test('a planned key edit writes nothing and refuses a later edit', async () => {
    await using folder = await testdir();
    const original = 'extends = "./authored.json"\nstrict = true\n';
    await createFileTree(folder.path, { 'config.toml': original });
    {
        using log = openWriter(folder.path);

        const plan = planManagedKeys(log, 'config.toml', [{ path: ['extends'], value: './managed.json' }]);
        expect(await readFile(join(folder.path, 'config.toml'), 'utf8')).toBe(original);
        const edited = 'extends = "./authored.json"\nstrict = false\n';
        await writeFile(join(folder.path, 'config.toml'), edited);
        expect(() => {
            writePlans(log, [plan]);
        }).toThrow('Destination changed during the operation: config.toml');
        expect(await readFile(join(folder.path, 'config.toml'), 'utf8')).toBe(edited);
    }
});

test.each(['replacement', 'block'] as const)(
    '%s plans refuse a file edited after planning and do not record it',
    async (kind) => {
        await using folder = await testdir();
        await createFileTree(folder.path, { 'config.txt': 'authored\n' });
        await chmod(join(folder.path, 'config.txt'), 0o640);
        {
            using log = openWriter(folder.path);

            const plan =
                kind === 'replacement'
                    ? planReplacement(log, {
                          path: 'config.txt',
                          next: { bytes: Buffer.from('replacement\n'), mode: 0o444 },
                          canReplace: true,
                      })
                    : planBlock(log, 'config.txt', 'managed content', 'hash');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('authored\n'),
                mode: normalizeFileMode({ mode: 0o640 }),
            });
            await writeFile(join(folder.path, 'config.txt'), 'edited after plan\n');
            expect(() => {
                writePlans(log, [plan]);
            }).toThrow('Destination changed during the operation: config.txt');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('edited after plan\n'),
                mode: normalizeFileMode({ mode: 0o640 }),
            });
        }
    },
);

test('a batch writes the files before an edited one and refuses the edited one', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
    {
        using log = openWriter(folder.path);

        const plans = ['first.txt', 'last.txt'].map((path) =>
            planReplacement(log, {
                path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                canReplace: true,
            }),
        );
        await writeFile(join(folder.path, 'last.txt'), 'authored after plan');
        expect(() => {
            writePlans(log, plans);
        }).toThrow('Destination changed during the operation: last.txt');
        expect(await readFile(join(folder.path, 'first.txt'), 'utf8')).toBe('replacement');
        expect(await readFile(join(folder.path, 'last.txt'), 'utf8')).toBe('authored after plan');
    }
});

test('a file gspot does not own refuses the whole batch and leaves every file as it was', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, { '.gspot/owned.txt': 'original', 'authored.txt': 'keep authored' });
    {
        using log = openWriter(folder.path);

        writePlans(log, [
            planReplacement(log, {
                path: '.gspot/owned.txt',
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                canReplace: true,
            }),
        ]);
        const plans = ['.gspot/owned.txt', 'authored.txt'].map((path) =>
            planReplacement(log, {
                path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
            }),
        );
        expect(() => {
            writePlans(log, plans);
        }).toThrow(`These files were not overwritten by gspot: authored.txt${OWNERSHIP_REFUSAL}`);
        expect(await readFile(join(folder.path, '.gspot/owned.txt'), 'utf8')).toBe('installed');
        expect(await readFile(join(folder.path, 'authored.txt'), 'utf8')).toBe('keep authored');
    }
});

// Windows does not preserve the POSIX permission-bit edit in the mode row.
test.each(
    [
        { name: 'bytes', change: (path: string) => writeFile(path, '{"semi":true}\n') },
        { name: 'mode', change: (path: string) => chmod(path, 0o600) },
        { name: 'removed', change: (path: string) => unlink(path) },
    ].filter(({ name }) => name !== 'mode' || !isWindows),
)('stale replace $name refuses replacement and retirement, then a fresh read succeeds', async ({ change }) => {
    await using folder = await testdir();
    const path = join(folder.path, 'authored.json');
    await writeFile(path, '{"semi":false}\n', { mode: 0o640 });
    {
        using log = openWriter(folder.path);

        const read = log.files.read('authored.json')!;
        await change(path);
        const edited = log.files.read('authored.json');
        expect(() => {
            writePlans(log, [{ path: 'authored.json', before: read, status: 'changed' }]);
        }).toThrow('authored.json changed before removal. Run the command again.');
        expect(() => {
            writePlans(log, [
                planReplacement(log, {
                    path: 'authored.json',
                    next: { bytes: Buffer.from('{}\n'), mode: 0o444 },
                    canReplace: true,
                    expected: read,
                }),
            ]);
        }).toThrow('Destination changed during the operation: authored.json');
        expect(log.files.read('authored.json')).toStrictEqual(edited);
        await writeFile(path, read.bytes);
        await chmod(path, read.mode);
    }
    {
        using log = openWriter(folder.path);
        const refreshed = log.files.read('authored.json')!;
        writePlans(log, [{ path: 'authored.json', before: refreshed, status: 'changed' }]);
        expect(log.files.read('authored.json')).toBeUndefined();
    }
});
