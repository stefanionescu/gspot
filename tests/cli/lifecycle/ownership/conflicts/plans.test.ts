import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { identify, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { planBlock, planMerge, planRetirement, planReplacement } from '#cli/lifecycle/ownership/plans.ts';

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
        expect(() => applyPlan(log, plan)).toThrow('Lifecycle destination changed during the operation: config.toml');
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
                          kind: 'config',
                          canReplace: true,
                      })
                    : planBlock(log, 'config.txt', 'managed content', 'hash');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('authored\n'),
                mode: getKeptMode(0o640),
            });
            await writeFile(join(directory.path, 'config.txt'), 'edited after plan\n');
            expect(() => applyPlan(log, plan)).toThrow(
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
                kind: 'config',
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

        applyPlan(
            log,
            planReplacement(log, {
                path: 'owned.txt',
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                kind: 'config',
                canReplace: true,
            }),
        );
        const plans = ['owned.txt', 'authored.txt'].map((path) =>
            planReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                kind: 'config',
            }),
        );
        expect(() => applyPlans(log, plans)).toThrow(
            'The file authored.txt was not overwritten by gspot. Move it aside, then retry the command.',
        );
        expect(await readFile(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed');
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
    }
});

test('restoration journals completed removals and preserves a later edit', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'authored.txt': 'original\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            planReplacement(log, {
                path: 'authored.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o444 },
                kind: 'config',
                canReplace: true,
            }),
        );
        applyPlan(
            log,
            planReplacement(log, {
                path: 'generated.txt',
                next: { bytes: Buffer.from('generated\n'), mode: 0o644 },
                kind: 'config',
            }),
        );
        const plans = ['authored.txt', 'generated.txt'].map((path) => planRestoration(log, path));
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        await writeFile(join(directory.path, 'generated.txt'), 'user edit\n');
        expect(() => applyPlans(log, plans)).toThrow('Lifecycle destination changed during removal: generated.txt');
        expect(log.files.read('authored.txt')).toBeUndefined();
        expect(await readFile(join(directory.path, 'generated.txt'), 'utf8')).toBe('user edit\n');
        expect(log.state.pending?.map((entry) => entry.path)).toStrictEqual(['authored.txt', 'generated.txt']);
    }
});

test('retirement journals completed removals and preserves a later stale read', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.json': '{}\n', 'second.json': '{}\n' });
    {
        using log = openOwnership(directory.path);

        const plans = ['first.json', 'second.json'].map((path) => planRetirement(log, path, log.files.read(path)!));
        await writeFile(join(directory.path, 'second.json'), '{"edited":true}\n');
        expect(() => applyPlans(log, plans)).toThrow('Lifecycle destination changed during removal: second.json');
        expect(log.files.read('first.json')).toBeUndefined();
        expect(await readFile(join(directory.path, 'second.json'), 'utf8')).toBe('{"edited":true}\n');
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        expect(log.state.pending?.map((entry) => entry.path)).toStrictEqual(['first.json', 'second.json']);
    }
});

test('reviewed matching bytes refresh ownership without rewriting the file', async () => {
    await using directory = await testdir();
    const path = 'config.txt';
    const next = { bytes: Buffer.from('installed\n'), mode: getKeptMode(0o644) };
    {
        using log = openOwnership(directory.path);
        applyPlan(log, planReplacement(log, { path, next, kind: 'config' }));
        await writeFile(join(directory.path, path), 'reviewed\n');
        const reviewed = log.files.read(path)!;
        const request = { path, next: reviewed, kind: 'config' as const };
        expect(applyPlan(log, planReplacement(log, request))).toBe('preserved');
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(next));
        const plan = planReplacement(log, { ...request, expected: reviewed, canReplace: true });
        await writeFile(join(directory.path, path), 'intervening edit\n');
        expect(applyPlan(log, plan)).toBe('unchanged');
        expect(log.files.read(path)?.bytes.toString('utf8')).toBe('intervening edit\n');
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(reviewed));
        await writeFile(join(directory.path, path), reviewed.bytes);
        expect(applyPlan(log, plan)).toBe('unchanged');
        expect(log.files.read(path)).toStrictEqual(reviewed);
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(reviewed));
        expect(planReplacement(log, request).entry).toBeUndefined();
    }
    using reopened = openOwnership(directory.path);
    expect(reopened.entryFor(path)?.installed).toStrictEqual(identify(reopened.files.read(path)!));
});
