import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { identify, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { proposeBlock, proposeMerge, proposeRetirement, proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';

test('a prepared configuration does not write and cannot overwrite a subsequent edit', async () => {
    await using directory = await testdir();
    const original = 'extends = "./authored.json"\nstrict = true\n';
    await createFileTree(directory.path, { 'config.toml': original });
    {
        using log = openOwnership(directory.path);

        const plan = proposeMerge(log, 'config.toml', [{ path: ['extends'], value: './managed.json' }], true);
        expect(readFileSync(join(directory.path, 'config.toml'), 'utf8')).toBe(original);
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        const edited = 'extends = "./authored.json"\nstrict = false\n';
        writeFileSync(join(directory.path, 'config.toml'), edited);
        expect(() => applyPlan(log, plan)).toThrow('changed after its plan');
        expect(readFileSync(join(directory.path, 'config.toml'), 'utf8')).toBe(edited);
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
            proposeMerge(
                log,
                'package.toml',
                [
                    { path: ['scripts'], value: {} },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                ],
                true,
            ),
        ).toThrow('fields overlap');
        expect(readFileSync(join(directory.path, 'package.toml'), 'utf8')).toBe(original);
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test.each(['replacement', 'block'] as const)(
    '%s plans preserve intervening edits and do not claim the edited file',
    async (kind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored\n' });
        chmodSync(join(directory.path, 'config.txt'), 0o640);
        {
            using log = openOwnership(directory.path);

            const plan =
                kind === 'replacement'
                    ? proposeReplacement(log, {
                          path: 'config.txt',
                          next: { bytes: Buffer.from('replacement\n'), mode: 0o444 },
                          kind: 'config',
                          canReplace: true,
                      })
                    : proposeBlock(log, 'config.txt', 'managed content', 'hash');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('authored\n'),
                mode: getKeptMode(0o640),
            });
            writeFileSync(join(directory.path, 'config.txt'), 'edited after plan\n');
            expect(() => applyPlan(log, plan)).toThrow('File changed after its plan');
            expect(applyPlan(log, proposeRestoration(log, 'config.txt'))).toBe('preserved');
            expect(log.files.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('edited after plan\n'),
                mode: getKeptMode(0o640),
            });
        }
    },
);

test('a batch validates every plan before publishing any file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
    {
        using log = openOwnership(directory.path);

        const plans = ['first.txt', 'last.txt'].map((path) =>
            proposeReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                kind: 'config',
                canReplace: true,
            }),
        );
        writeFileSync(join(directory.path, 'last.txt'), 'authored after plan');
        expect(() => applyPlans(log, plans)).toThrow('File changed after its plan: last.txt');
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('original first');
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored after plan');
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
            proposeReplacement(log, {
                path: 'owned.txt',
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                kind: 'config',
                canReplace: true,
            }),
        );
        const plans = ['owned.txt', 'authored.txt'].map((path) =>
            proposeReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('replacement'), mode: 0o644 },
                kind: 'config',
            }),
        );
        expect(() => applyPlans(log, plans)).toThrow(
            'The file authored.txt was not overwritten by gspot. Move it aside, then retry the command.',
        );
        expect(readFileSync(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
    }
});

test('restoration plans refuse the whole batch after an edit', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'authored.txt': 'original\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            proposeReplacement(log, {
                path: 'authored.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o444 },
                kind: 'config',
                canReplace: true,
            }),
        );
        applyPlan(
            log,
            proposeReplacement(log, {
                path: 'generated.txt',
                next: { bytes: Buffer.from('generated\n'), mode: 0o644 },
                kind: 'config',
            }),
        );
        const plans = ['authored.txt', 'generated.txt'].map((path) => proposeRestoration(log, path));
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        writeFileSync(join(directory.path, 'generated.txt'), 'user edit\n');
        expect(() => applyPlans(log, plans)).toThrow('File changed after its plan: generated.txt');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        expect(readFileSync(join(directory.path, 'generated.txt'), 'utf8')).toBe('user edit\n');
        applyPlans(log, [proposeRestoration(log, 'authored.txt')]);
        expect(log.files.read('authored.txt')).toBeUndefined();
        expect(applyPlan(log, proposeRestoration(log, 'generated.txt'))).toBe('preserved');
    }
});

test('retirement plans refuse the whole batch when a later read is stale', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.json': '{}\n', 'second.json': '{}\n' });
    {
        using log = openOwnership(directory.path);

        const plans = ['first.json', 'second.json'].map((path) => proposeRetirement(log, path, log.files.read(path)!));
        writeFileSync(join(directory.path, 'second.json'), '{"edited":true}\n');
        expect(() => applyPlans(log, plans)).toThrow('File changed after its plan: second.json');
        expect(readFileSync(join(directory.path, 'first.json'), 'utf8')).toBe('{}\n');
        expect(readFileSync(join(directory.path, 'second.json'), 'utf8')).toBe('{"edited":true}\n');
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        applyPlans(
            log,
            ['first.json', 'second.json'].map((path) => proposeRetirement(log, path, log.files.read(path)!)),
        );
        expect(log.files.read('first.json')).toBeUndefined();
        expect(log.files.read('second.json')).toBeUndefined();
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test('reviewed matching bytes refresh ownership without rewriting the file', async () => {
    await using directory = await testdir();
    const path = 'config.txt';
    const next = { bytes: Buffer.from('installed\n'), mode: getKeptMode(0o644) };
    {
        using log = openOwnership(directory.path);
        applyPlan(log, proposeReplacement(log, { path, next, kind: 'config' }));
        writeFileSync(join(directory.path, path), 'reviewed\n');
        const reviewed = log.files.read(path)!;
        const request = { path, next: reviewed, kind: 'config' as const };
        expect(applyPlan(log, proposeReplacement(log, request))).toBe('preserved');
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(next));
        const plan = proposeReplacement(log, { ...request, expected: reviewed, canReplace: true });
        writeFileSync(join(directory.path, path), 'intervening edit\n');
        expect(() => applyPlan(log, plan)).toThrow('changed after its plan');
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(next));
        writeFileSync(join(directory.path, path), reviewed.bytes);
        expect(applyPlan(log, plan)).toBe('unchanged');
        expect(log.files.read(path)).toStrictEqual(reviewed);
        expect(log.entryFor(path)?.installed).toStrictEqual(identify(reviewed));
        expect(proposeReplacement(log, request).entry).toBeUndefined();
    }
    using reopened = openOwnership(directory.path);
    expect(reopened.entryFor(path)?.installed).toStrictEqual(identify(reopened.files.read(path)!));
});
