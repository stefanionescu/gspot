import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { fileMode } from '#cli/system/safe-folder/reads.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { writePlans, openWriter } from '#cli/ownership/writer.ts';
import { OWNERSHIP_REFUSAL } from '#tests/config/generated-files.ts';
import { chmod, lstat, unlink, symlink, readFile, readlink, writeFile } from 'node:fs/promises';
import { planBlock, planDeletion, planManagedKeys, planReplacement } from '#cli/ownership/plans.ts';

{
    test('a link that points outside the repository is refused, even when it is unchanged', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
        const project = join(directory.path, 'project');
        await symlink('../outside', join(project, 'tool'));
        const target = await readlink(join(project, 'tool'));
        {
            using log = openWriter(project);

            const attributes = await lstat(join(project, 'tool'));
            const mode = attributes.mode & 0o7777;
            expect(() => {
                writePlans(log, [
                    planReplacement(log, {
                        path: 'tool',
                        next: {
                            bytes: Buffer.from(target),
                            mode,
                            isLink: true,
                        },
                    }),
                ]);
            }).toThrow(
                `${JSON.stringify(target)} is not a safe repository-relative path. Choose a path inside the repository.`,
            );
            expect(await readlink(join(project, 'tool'))).toBe(target);
            expect(await readFile(join(directory.path, 'outside'), 'utf8')).toBe('authored');
        }
    });
}
{
    test('a planned key edit writes nothing and refuses a later edit', async () => {
        await using directory = await testdir();
        const original = 'extends = "./authored.json"\nstrict = true\n';
        await createFileTree(directory.path, { 'config.toml': original });
        {
            using log = openWriter(directory.path);

            const plan = planManagedKeys(log, 'config.toml', [{ path: ['extends'], value: './managed.json' }]);
            expect(await readFile(join(directory.path, 'config.toml'), 'utf8')).toBe(original);
            const edited = 'extends = "./authored.json"\nstrict = false\n';
            await writeFile(join(directory.path, 'config.toml'), edited);
            expect(() => {
                writePlans(log, [plan]);
            }).toThrow('Destination changed during the operation: config.toml');
            expect(await readFile(join(directory.path, 'config.toml'), 'utf8')).toBe(edited);
        }
    });

    test.each(['replacement', 'block'] as const)(
        '%s plans refuse a file edited after planning and do not record it',
        async (kind) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'authored\n' });
            await chmod(join(directory.path, 'config.txt'), 0o640);
            {
                using log = openWriter(directory.path);

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
                    mode: fileMode({ mode: 0o640 }),
                });
                await writeFile(join(directory.path, 'config.txt'), 'edited after plan\n');
                expect(() => {
                    writePlans(log, [plan]);
                }).toThrow('Destination changed during the operation: config.txt');
                expect(log.files.read('config.txt')).toStrictEqual({
                    bytes: Buffer.from('edited after plan\n'),
                    mode: fileMode({ mode: 0o640 }),
                });
            }
        },
    );

    test('a batch writes the files before an edited one and refuses the edited one', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
        {
            using log = openWriter(directory.path);

            const plans = ['first.txt', 'last.txt'].map((path) =>
                planReplacement(log, {
                    path,
                    next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                    canReplace: true,
                }),
            );
            await writeFile(join(directory.path, 'last.txt'), 'authored after plan');
            expect(() => {
                writePlans(log, plans);
            }).toThrow('Destination changed during the operation: last.txt');
            expect(await readFile(join(directory.path, 'first.txt'), 'utf8')).toBe('replacement');
            expect(await readFile(join(directory.path, 'last.txt'), 'utf8')).toBe('authored after plan');
        }
    });

    test('a file gspot does not own refuses the whole batch and leaves every file as it was', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/owned.txt': 'original', 'authored.txt': 'keep authored' });
        {
            using log = openWriter(directory.path);

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
            expect(await readFile(join(directory.path, '.gspot/owned.txt'), 'utf8')).toBe('installed');
            expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
        }
    });

    for (const { name, change } of [
        { name: 'bytes', change: (path: string) => writeFile(path, '{"semi":true}\n') },
        { name: 'mode', change: (path: string) => chmod(path, 0o600) },
        { name: 'removed', change: (path: string) => unlink(path) },
    ]) {
        // Windows does not preserve the POSIX permission-bit edit in the mode row.
        test.skipIf(name === 'mode' && isWindows)(
            `stale replace ${name} refuses replacement and retirement, then a fresh read succeeds`,
            async () => {
                await using directory = await testdir();
                const path = join(directory.path, 'authored.json');
                await writeFile(path, '{"semi":false}\n', { mode: 0o640 });
                {
                    using log = openWriter(directory.path);

                    const read = log.files.read('authored.json')!;
                    await change(path);
                    const edited = log.files.read('authored.json');
                    expect(() => {
                        writePlans(log, [planDeletion('authored.json', read)]);
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
                    using log = openWriter(directory.path);
                    const refreshed = log.files.read('authored.json')!;
                    writePlans(log, [planDeletion('authored.json', refreshed)]);
                    expect(log.files.read('authored.json')).toBeUndefined();
                }
            },
        );
    }
}
