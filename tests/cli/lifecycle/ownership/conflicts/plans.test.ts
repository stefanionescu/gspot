import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { OWNERSHIP_REFUSAL } from '#tests/config/samples/ownership.ts';
import { identify, applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';

import {
    planBlock,
    planMerge,
    planRetirement,
    planReplacement,
    planRestoration,
} from '#cli/lifecycle/ownership/contracts.ts';

test('a prepared configuration does not write and cannot overwrite a subsequent edit', async () => {
    await using directory = await testdir();
    const original = 'extends = "./authored.json"\nstrict = true\n';
    await createFileTree(directory.path, { 'config.toml': original });
    {
        using log = openOwnership(directory.path);

        const plan = planMerge(log, 'config.toml', [{ path: ['extends'], value: './managed.json' }], true);
        expect(await readFile(join(directory.path, 'config.toml'), 'utf8')).toBe(original);
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        const edited = 'extends = "./authored.json"\nstrict = false\n';
        await writeFile(join(directory.path, 'config.toml'), edited);
        expect(() => applyPlans(log, [plan])).toThrow(
            'Lifecycle destination changed during the operation: config.toml',
        );
        expect(await readFile(join(directory.path, 'config.toml'), 'utf8')).toBe(edited);
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test('overlapping configuration fields are refused without changing authored bytes', async () => {
    await using directory = await testdir();
    const original = '[scripts]\ncheck = "authored"\n';
    await createFileTree(directory.path, { 'package.toml': original });
    {
        using log = openOwnership(directory.path);

        expect(() =>
            planMerge(
                log,
                'package.toml',
                [
                    { path: ['scripts'], value: {} },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                ],
                true,
            ),
        ).toThrow('fields overlap');
        expect(await readFile(join(directory.path, 'package.toml'), 'utf8')).toBe(original);
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test.each(['replacement', 'block'] as const)(
    '%s plans preserve intervening edits and do not claim the edited file',
    async (kind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored\n' });
        await chmod(join(directory.path, 'config.txt'), 0o640);
        {
            using log = openOwnership(directory.path);

            const plan =
                kind === 'replacement'
                    ? planReplacement(log, {
                          path: 'config.txt',
                          next: { bytes: Buffer.from('replacement\n'), mode: 0o444 },
                          kind: 'tool_file',
                          canReplace: true,
                      })
                    : planBlock(log, 'config.txt', 'managed content', 'hash');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('authored\n'),
                mode: getKeptMode(0o640),
            });
            await writeFile(join(directory.path, 'config.txt'), 'edited after plan\n');
            expect(() => applyPlans(log, [plan])).toThrow(
                'Lifecycle destination changed during the operation: config.txt',
            );
            expect(log.state.files).toStrictEqual([]);
            expect(log.state.pending?.map((entry) => entry.path)).toStrictEqual(['config.txt']);
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('edited after plan\n'),
                mode: getKeptMode(0o640),
            });
        }
    },
);

test('a batch journals published files and preserves a later edited destination', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
    {
        using log = openOwnership(directory.path);

        const plans = ['first.txt', 'last.txt'].map((path) =>
            planReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                kind: 'tool_file',
                canReplace: true,
            }),
        );
        await writeFile(join(directory.path, 'last.txt'), 'authored after plan');
        expect(() => applyPlans(log, plans)).toThrow('Lifecycle destination changed during the operation: last.txt');
        expect(await readFile(join(directory.path, 'first.txt'), 'utf8')).toBe('replacement');
        expect(await readFile(join(directory.path, 'last.txt'), 'utf8')).toBe('authored after plan');
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test('a preserved file refuses the whole batch and leaves every proposed destination unchanged', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'owned.txt': 'original', 'authored.txt': 'keep authored' });
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            planReplacement(log, {
                path: 'owned.txt',
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                kind: 'tool_file',
                canReplace: true,
            }),
        ]);
        const plans = ['owned.txt', 'authored.txt'].map((path) =>
            planReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                kind: 'tool_file',
            }),
        );
        expect(() => applyPlans(log, plans)).toThrow(`The file authored.txt ${OWNERSHIP_REFUSAL}`);
        expect(await readFile(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed');
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
        expect(() => applyPlans(log, [planRestoration(log, '.gspot/unowned')])).toThrow(
            `The file .gspot/unowned ${OWNERSHIP_REFUSAL}`,
        );
    }
});

test('reviewed matching bytes refresh ownership without rewriting the file', async () => {
    await using directory = await testdir();
    const path = 'config.txt';
    const next = { bytes: Buffer.from('installed\n'), mode: getKeptMode(0o644) };
    {
        using log = openOwnership(directory.path);
        applyPlans(log, [planReplacement(log, { path, next, kind: 'tool_file' })]);
        await writeFile(join(directory.path, path), 'reviewed\n');
        const reviewed = log.files.read(path)!;
        const request = { path, next: reviewed, kind: 'tool_file' as const };
        expect(() => applyPlans(log, [planReplacement(log, request)])).toThrow(
            `The file ${request.path} ${OWNERSHIP_REFUSAL}`,
        );
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(next));
        const plan = planReplacement(log, { ...request, expected: reviewed, canReplace: true });
        await writeFile(join(directory.path, path), 'intervening edit\n');
        expect(applyPlans(log, [plan])[0]).toBe('unchanged');
        expect(log.files.read(path)?.bytes.toString('utf8')).toBe('intervening edit\n');
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(reviewed));
        await writeFile(join(directory.path, path), reviewed.bytes);
        expect(applyPlans(log, [plan])[0]).toBe('unchanged');
        expect(log.files.read(path)).toStrictEqual(reviewed);
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(reviewed));
        expect(planReplacement(log, request).entry).toBeUndefined();
    }
    using reopened = openOwnership(directory.path);
    expect(reopened.entryFor(path)?.installed).toStrictEqual(identify(reopened.files.read(path)!));
});

describe('lifecycle ownership', () => {
    for (const { name, change } of [
        { name: 'bytes', change: (path: string) => writeFile(path, '{"semi":true}\n') },
        { name: 'mode', change: (path: string) => chmod(path, 0o600) },
        { name: 'removed', change: (path: string) => unlink(path) },
    ]) {
        test.skipIf(name === 'mode' && !isPosix)(
            `stale replace ${name} refuses replacement and retirement, then a fresh read succeeds`,
            async () => {
                await using directory = await testdir();
                const path = join(directory.path, 'authored.json');
                await writeFile(path, '{"semi":false}\n', { mode: 0o640 });
                {
                    using log = openOwnership(directory.path);

                    const read = log.files.read('authored.json')!;
                    await change(path);
                    const edited = log.files.read('authored.json');
                    expect(() => planRetirement(log, 'authored.json', read)).toThrow(
                        'authored.json changed after gspot read it. Run the command again.',
                    );
                    expect(() =>
                        applyPlans(log, [
                            planReplacement(log, {
                                path: 'authored.json',
                                next: { bytes: Buffer.from('{}\n'), mode: 0o444 },
                                kind: 'tool_file',
                                canReplace: true,
                                expected: read,
                            }),
                        ]),
                    ).toThrow('Lifecycle destination changed during the operation: authored.json');
                    expect(log.files.read('authored.json')).toStrictEqual(edited);
                    await writeFile(path, read.bytes);
                    await chmod(path, read.mode);
                }
                {
                    using log = openOwnership(directory.path);
                    const refreshed = log.files.read('authored.json')!;
                    expect(applyPlans(log, [planRetirement(log, 'authored.json', refreshed)])[0]).toBe('changed');
                    expect(log.files.read('authored.json')).toBeUndefined();
                }
            },
        );
    }
});
