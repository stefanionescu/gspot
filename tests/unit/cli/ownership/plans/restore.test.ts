import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fileMode } from '#cli/system/safe-folder/reads.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { applyPlans, openWriter } from '#cli/ownership/writer.ts';
import { OWNERSHIP_REFUSAL, ADOPTED_FILE_CASES } from '#tests/config/generated-files.ts';
import { planBlock, planManagedKeys, planReplacement, planRestoration } from '#cli/ownership/plans.ts';
import { stat, chmod, lstat, unlink, readdir, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

{
    test('giving back a malformed file names it and keeps its bytes and records', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'AGENTS.md': 'Authored instructions.\n',
            'bunfig.toml': '[install]\nexact = true\n',
        });
        using log = openWriter(directory.path);
        applyPlans(log, [
            planBlock(log, 'AGENTS.md', 'instructions', 'markdown'),
            planManagedKeys(log, 'bunfig.toml', [{ path: ['install', 'minimumReleaseAge'], value: 604_800 }], true),
        ]);
        const records = structuredClone(log.state);
        const instructions = log.files
            .read('AGENTS.md')!
            .bytes.toString('utf8')
            .replace('<!-- <<< gspot managed <<< -->', '');
        const toml = '[install\n';
        await writeFile(join(directory.path, 'AGENTS.md'), instructions);
        await writeFile(join(directory.path, 'bunfig.toml'), toml);
        expect(() => planRestoration(log, 'AGENTS.md')).toThrow(
            'AGENTS.md has incomplete or repeated gspot block markers.',
        );
        expect(() => planRestoration(log, 'bunfig.toml')).toThrow(
            'bunfig.toml is not valid TOML. Fix the file, then run gspot apply.',
        );
        expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(instructions);
        expect(await readFile(join(directory.path, 'bunfig.toml'), 'utf8')).toBe(toml);
        expect(log.state).toStrictEqual(records);
    });
}
{
    const replacedFiles = async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
        {
            using log = openWriter(directory.path);
            applyPlans(log, [
                planReplacement(log, {
                    path: 'config.txt',
                    next: { bytes: Buffer.from('first'), mode: 0o444 },
                    kind: 'tool_file',
                    canReplace: true,
                }),
            ]);
            applyPlans(log, [
                planReplacement(log, {
                    path: 'config.txt',
                    next: { bytes: Buffer.from('second'), mode: 0o444 },
                    kind: 'tool_file',
                }),
            ]);
        }
        {
            using log = openWriter(directory.path);
            applyPlans(log, [planRestoration(log, 'config.txt')]);
            expect(log.files.read('config.txt')).toBeUndefined();
            expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
            const ownershipMetadata = await stat(join(directory.path, '.gspot/state/ownership.json'));
            expect(ownershipMetadata.mode & 0o777).toBe(fileMode({ mode: 0o600 }));
        }
    };

    const installedLinks = async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'vendor/tools/tool/bin.sh': '#!/bin/sh\nprintf installed',
            'vendor/tools/tool/original.sh': '#!/bin/sh\nprintf original',
            'vendor/tools/.bin/.keep': '',
        });
        const path = 'vendor/tools/.bin/tool';
        const absolute = join(directory.path, path);
        await chmod(join(directory.path, 'vendor/tools/tool/bin.sh'), 0o755);
        await chmod(join(directory.path, 'vendor/tools/tool/original.sh'), 0o755);
        await symlink('../tool/original.sh', absolute);
        const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
        {
            using log = openWriter(directory.path);
            expect(() => {
                applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file' })]);
            }).toThrow(`These files were not overwritten by gspot: ${path}${OWNERSHIP_REFUSAL}`);
            applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file', canReplace: true })]);
            applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file' })]);
            const executed = runCommandBlocking([absolute], { cwd: directory.path });
            expect(executed.code, executed.stderr).toBe(0);
            expect(executed.stdout).toBe('installed');
            // The ownership reader refuses a link instead of reading its target.
            expect(() => log.files.read(path)).toThrow(
                `${path} is not a regular file with one link. Use a regular file without extra hard links.`,
            );
        }
        {
            using log = openWriter(directory.path);
            applyPlans(log, [planRestoration(log, path)]);
            expect(await lstat(absolute).catch((error: unknown) => error)).toMatchObject({ code: 'ENOENT' });
            const originalMetadata = await stat(join(directory.path, 'vendor/tools/tool/original.sh'));
            expect(originalMetadata.mode & 0o777).toBe(fileMode({ mode: 0o755 }));
            applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file', canReplace: true })]);
            // Later user edits remain intact across replacement and giving the file back.
            await unlink(absolute);
            await symlink('../tool/original.sh', absolute);
            expect(() => {
                applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file' })]);
            }).toThrow(`These files were not overwritten by gspot: ${path}${OWNERSHIP_REFUSAL}`);
            expect(() => {
                applyPlans(log, [planRestoration(log, path)]);
            }).toThrow(`These files were not overwritten by gspot: ${path}${OWNERSHIP_REFUSAL}`);
            expect(await readlink(absolute)).toBe('../tool/original.sh');
        }
    };

    const regularReplacement = async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { target: 'authored target' });
        const log = openWriter(directory.path);
        const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
        try {
            applyPlans(log, [planReplacement(log, { path: 'tool', next, kind: 'tool_file' })]);
            await unlink(join(directory.path, 'tool'));
            await writeFile(join(directory.path, 'tool'), 'target', { mode: 0o777 });
            expect(() => {
                applyPlans(log, [planReplacement(log, { path: 'tool', next, kind: 'tool_file' })]);
            }).toThrow(`These files were not overwritten by gspot: tool${OWNERSHIP_REFUSAL}`);
            expect(() => {
                applyPlans(log, [planRestoration(log, 'tool')]);
            }).toThrow(`These files were not overwritten by gspot: tool${OWNERSHIP_REFUSAL}`);
            const restoredMetadata = await lstat(join(directory.path, 'tool'));
            expect(restoredMetadata.isFile()).toBe(true);
            expect(await readFile(join(directory.path, 'target'), 'utf8')).toBe('authored target');
        } finally {
            log[Symbol.dispose]();
        }
    };

    test(
        'giving back a twice replaced file deletes it, keeps files gspot does not own, and keeps the log private',
        replacedFiles,
    );

    // Windows cannot execute the POSIX program links used by this case.
    test.skipIf(isWindows)(
        'installed program links run, giving them back deletes them, and later edits stay',
        installedLinks,
    );

    // Windows does not preserve POSIX link modes during replacement.
    test.skipIf(isWindows)(
        'a regular file that holds a link target is kept after an installed link is replaced',
        regularReplacement,
    );

    test('giving back the last file of a folder removes the folders it leaves empty', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'guides/kept.md': 'authored\n' });
        {
            using log = openWriter(directory.path);

            applyPlans(log, [
                planReplacement(log, {
                    path: 'guides/agent/rules/WORKING.md',
                    next: { bytes: Buffer.from('guide\n'), mode: 0o644 },
                    kind: 'tool_file',
                    canReplace: true,
                }),
            ]);
            applyPlans(log, [planRestoration(log, 'guides/agent/rules/WORKING.md')]);
        }
        expect(await pathExists(join(directory.path, 'guides/agent'))).toBe(false);
        expect(await readdir(join(directory.path, 'guides'))).toStrictEqual(['kept.md']);
    });

    test.each([...ADOPTED_FILE_CASES])(
        'giving back an adopted file keeps only your bytes: $name',
        async ({ path, isChanged, isKept }) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { [path]: '{"v":1}\n' });
            {
                using log = openWriter(directory.path);

                const mode = log.files.read(path)!.mode;
                applyPlans(log, [
                    planReplacement(log, {
                        path,
                        next: { bytes: Buffer.from('{"v":1}\n'), mode },
                        kind: 'tool_file',
                    }),
                ]);
                if (isChanged)
                    applyPlans(log, [
                        planReplacement(log, {
                            path,
                            next: { bytes: Buffer.from('{"v":2}\n'), mode },
                            kind: 'tool_file',
                        }),
                    ]);
                applyPlans(log, [planRestoration(log, path)]);
            }
            expect(await pathExists(join(directory.path, path))).toBe(isKept);
        },
    );
}
