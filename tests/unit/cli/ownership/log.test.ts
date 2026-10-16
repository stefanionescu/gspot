import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { CLI_SOURCE } from '#tests/setup/run-gspot.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { INTERRUPTION_EXIT_CODE } from '#tests/config/execution.ts';
import { planReplacement, planRestoration } from '#cli/ownership/plans.ts';
import { applyPlans, openWriter, readOwnershipLog } from '#cli/ownership/writer.ts';

/** An owned child stops here before recovery observes its interrupted operation. */

{
    test.each(['before', 'after'] as const)(
        'an interrupted batch keeps each written file, and the next batch finishes it (%s)',
        async (point) => {
            await using directory = await testdir();
            const paths = ['first.txt', 'middle.txt', 'last.txt'];
            await createFileTree(directory.path, Object.fromEntries(paths.map((path) => [path, `authored ${path}\n`])));
            const child = await interruptOwnershipWrite(
                directory.path,
                { operation: 'write', path: 'middle.txt', point },
                String.raw`applyPlans(log, ${JSON.stringify(paths)}.map(path=>planReplacement(log,{path, next: {bytes:Buffer.from('installed '+path+'\n'),mode:0o444}, kind: 'tool_file', canReplace: true})));`,
            );
            expect(child.code, child.stdout + child.stderr).toBe(INTERRUPTION_EXIT_CODE);
            expect(readOwnershipLog(directory.path).pending?.map(({ path }) => path)).toStrictEqual(paths);
            expect(await readFile(join(directory.path, 'first.txt'), 'utf8')).toBe('installed first.txt\n');
            expect(await readFile(join(directory.path, 'middle.txt'), 'utf8')).toBe(
                `${point === 'before' ? 'authored' : 'installed'} middle.txt\n`,
            );
            expect(await readFile(join(directory.path, 'last.txt'), 'utf8')).toBe('authored last.txt\n');
            {
                using log = openWriter(directory.path);

                expect(readOwnershipLog(directory.path).pending).toBeUndefined();
                expect(
                    log.state.files.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right)),
                ).toStrictEqual(point === 'before' ? ['first.txt'] : ['first.txt', 'middle.txt']);
                applyPlans(
                    log,
                    paths.map((path) =>
                        planReplacement(log, {
                            path,
                            next: { bytes: Buffer.from(`installed ${path}\n`), mode: 0o444 },
                            kind: 'tool_file',
                            canReplace: true,
                        }),
                    ),
                );
                for (const path of paths)
                    expect(await readFile(join(directory.path, path), 'utf8')).toBe(`installed ${path}\n`);
                expect(log.state.files.map((entry) => entry.path)).toHaveLength(paths.length);
            }
        },
    );

    test.each(['before', 'after'] as const)(
        'an interrupted removal batch keeps its deletions and the records it had not reached (%s)',
        async (point) => {
            await using directory = await testdir();
            const paths = ['first.txt', 'middle.txt', 'last.txt'];
            {
                using initial = openWriter(directory.path);

                applyPlans(
                    initial,
                    paths.map((path) =>
                        planReplacement(initial, {
                            path,
                            next: { bytes: Buffer.from(path), mode: 0o644 },
                            kind: 'tool_file',
                        }),
                    ),
                );
            }
            const child = await interruptOwnershipWrite(
                directory.path,
                { operation: 'remove', path: 'middle.txt', point },
                `applyPlans(log, ${JSON.stringify(paths)}.map(path=>planRestoration(log, path)));`,
            );
            expect(child.code, child.stdout + child.stderr).toBe(INTERRUPTION_EXIT_CODE);
            {
                using log = openWriter(directory.path);

                expect(log.files.read('first.txt')).toBeUndefined();
                expect(
                    log.state.files.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right)),
                ).toStrictEqual(point === 'before' ? ['last.txt', 'middle.txt'] : ['last.txt']);
                expect(log.files.read('last.txt')?.bytes.toString()).toBe('last.txt');
                applyPlans(
                    log,
                    log.state.files.map((entry) => entry.path).map((path) => planRestoration(log, path)),
                );
                for (const path of paths) expect(log.files.read(path)).toBeUndefined();
                expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            }
        },
    );
}
{
    const implementation = join(CLI_SOURCE, 'ownership/writer.ts');

    const boundary = join(CLI_SOURCE, 'system/safe-folder/open.ts');

    test('a file edited during an interrupted write is kept, and recovery refuses to overwrite it', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'original\n' });
        const stopped = await interruptOwnershipWrite(
            directory.path,
            { operation: 'write', path: 'config.txt', point: 'before' },
            String.raw`applyPlans(log, [planReplacement(log, {path: 'config.txt', next: {bytes: Buffer.from('installed\n'), mode: 0o644}, kind: 'tool_file', canReplace: true})]);`,
        );
        expect(stopped.code, stopped.stderr).toBe(INTERRUPTION_EXIT_CODE);
        await writeFile(join(directory.path, 'config.txt'), 'developer edit\n');
        expect(() => openWriter(directory.path)).toThrow(
            'A previous gspot run stopped while writing config.txt, and the file changed since then.',
        );
        expect(await readFile(join(directory.path, 'config.txt'), 'utf8')).toBe('developer edit\n');
    });

    test('a full disk while recording a batch keeps every file, and the same batch succeeds afterwards', async () => {
        await using directory = await testdir();
        const original = Buffer.from([0, 255, 10, 13, 42]);
        const replacement = Buffer.from([255, 0, 13, 10, 192]);
        const batch = { 'first.bin': replacement, 'second.bin': Buffer.from([254, 42, 0, 10]) };
        for (const name of ['first.bin', 'second.bin'])
            await writeFile(join(directory.path, name), original, { mode: 0o444 });
        const originalMetadata = await stat(join(directory.path, 'first.bin'));
        const originalMode = originalMetadata.mode & 0o777;
        const program = `
import { mock } from 'bun:test';
const boundary = await import(${JSON.stringify(boundary)});
const open = boundary.openSafeFolder;
mock.module(${JSON.stringify(boundary)}, () => ({
    ...boundary,
    openSafeFolder(root) {
        const files = open(root);
        return { ...files, write(path, next, expected) {
            if (path === '.gspot/state/ownership.json')
                throw Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
            files.write(path, next, expected);
        }};
    }
}));
const { openWriter } = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(join(CLI_SOURCE, 'ownership/plans.ts'))});
const {applyPlans}=await import(${JSON.stringify(join(CLI_SOURCE, 'ownership/writer.ts'))});
const log = openWriter(${JSON.stringify(directory.path)});
try {
    applyPlans(log, ['first.bin', 'second.bin'].map(path => planReplacement(log,{path, next: { bytes: Buffer.from(${JSON.stringify([...replacement])}), mode: 0o444 }, kind: 'tool_file', canReplace: true})));
} catch (error) {
    console.log(JSON.stringify({ code: error.code }));
} finally { log[Symbol.dispose](); }
`;
        const { stdout, stderr, code } = await runCommand([process.execPath, '-e', program], { cwd: directory.path });
        expect(code, stderr).toBe(0);
        expect(JSON.parse(stdout)).toStrictEqual({ code: 'ENOSPC' });
        for (const name of ['first.bin', 'second.bin']) {
            expect(await readFile(join(directory.path, name))).toStrictEqual(original);
            const restoredMetadata = await stat(join(directory.path, name));
            expect(restoredMetadata.mode & 0o777).toBe(originalMode);
        }
        expect(readOwnershipLog(directory.path).files).toStrictEqual([]);
        {
            using log = openWriter(directory.path);

            const plans = Object.entries(batch).map(([path, bytes]) =>
                planReplacement(log, {
                    path,
                    next: { bytes, mode: 0o444 },
                    kind: 'tool_file',
                    canReplace: true,
                }),
            );
            applyPlans(log, plans);
            for (const [path, bytes] of Object.entries(batch))
                expect(await readFile(join(directory.path, path))).toStrictEqual(bytes);
        }
    });
}

/**
 * Interrupt a native ownership publication at its observed root file operation.
 * @param cwd the repository the child owns.
 * @param interruption the actual method, file, and timing to intercept.
 * @param interruption.operation the file operation.
 * @param interruption.path the relative file path.
 * @param interruption.point whether to interrupt before or after the operation.
 * @param call the ownership operation the child performs.
 * @returns the child's captured process result.
 */
async function interruptOwnershipWrite(
    cwd: string,
    interruption: { operation: 'write' | 'remove'; path: string; point: 'before' | 'after' },
    call: string,
): Promise<SpawnResult> {
    const { operation, path, point } = interruption;
    const boundary = join(CLI_SOURCE, 'system/safe-folder/open.ts');
    const program = `
import { mock } from 'bun:test';
const boundary = await import(${JSON.stringify(boundary)});
const open = boundary.openSafeFolder;
mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openSafeFolder(root) {
    const files = open(root);
    return { ...files, ${operation}(path, ...rest) {
        if (path === ${JSON.stringify(path)} && ${JSON.stringify(point)} === 'before') process.exit(${String(INTERRUPTION_EXIT_CODE)});
        files.${operation}(path, ...rest);
        if (path === ${JSON.stringify(path)} && ${JSON.stringify(point)} === 'after') process.exit(${String(INTERRUPTION_EXIT_CODE)});
    }};
}}));
const { openWriter, applyPlans } = await import(${JSON.stringify(join(CLI_SOURCE, 'ownership/writer.ts'))});
const { planReplacement, planRestoration } = await import(${JSON.stringify(join(CLI_SOURCE, 'ownership/plans.ts'))});
using log = openWriter(process.cwd());
${call}
`;
    return await runCommand([process.execPath, '-e', program], { cwd });
}
