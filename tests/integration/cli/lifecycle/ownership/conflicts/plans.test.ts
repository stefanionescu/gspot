import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

test('a prepared configuration does not write and cannot overwrite a subsequent edit', async () => {
    await using directory = await testdir();
    const original = '{"extends":"./authored.json","strict":true}\n';
    await createFileTree(directory.path, { 'tsconfig.json': original });
    const owner = openOwner(directory.path);
    try {
        const plan = owner.proposeMerge(
            'tsconfig.json',
            'json',
            [{ path: ['extends'], value: './managed.json' }],
            true,
        );
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe(original);
        expect(owner.installedPaths()).toStrictEqual([]);
        const edited = '{"extends":"./authored.json","strict":false}\n';
        writeFileSync(join(directory.path, 'tsconfig.json'), edited);
        expect(() => owner.applyPlan(plan)).toThrow('changed after its plan');
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe(edited);
        expect(owner.installedPaths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});

test('overlapping configuration fields are refused without changing authored bytes', async () => {
    await using directory = await testdir();
    const original = '{"scripts":{"check":"authored"}}\n';
    await createFileTree(directory.path, { 'package.json': original });
    const owner = openOwner(directory.path);
    try {
        expect(() =>
            owner.proposeMerge(
                'package.json',
                'json',
                [
                    { path: ['scripts'], value: {} },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                ],
                true,
            ),
        ).toThrow('fields overlap');
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(original);
        expect(owner.installedPaths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});

test.each(['replacement', 'block'] as const)(
    '%s plans preserve intervening edits and do not claim the edited file',
    async (kind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored\n' });
        chmodSync(join(directory.path, 'config.txt'), 0o640);
        const owner = openOwner(directory.path);
        try {
            const plan =
                kind === 'replacement'
                    ? owner.proposeReplacement(
                          'config.txt',
                          { bytes: Buffer.from('replacement\n'), mode: 0o444 },
                          'config',
                          true,
                      )
                    : owner.proposeBlock('config.txt', 'managed content', 'hash');
            expect(owner.read('config.txt')).toStrictEqual({ bytes: Buffer.from('authored\n'), mode: keptMode(0o640) });
            writeFileSync(join(directory.path, 'config.txt'), 'edited after plan\n');
            expect(() => owner.applyPlan(plan)).toThrow('File changed after its plan');
            expect(owner.applyPlan(owner.proposeRestoration('config.txt'))).toBe('preserved');
            expect(owner.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('edited after plan\n'),
                mode: keptMode(0o640),
            });
        } finally {
            owner.close();
        }
    },
);

test('a batch validates every plan before publishing any file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
    const owner = openOwner(directory.path);
    try {
        const plans = ['first.txt', 'last.txt'].map((path) =>
            owner.proposeReplacement(path, { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config', true),
        );
        writeFileSync(join(directory.path, 'last.txt'), 'authored after plan');
        expect(() => owner.applyPlans(plans)).toThrow('File changed after its plan: last.txt');
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('original first');
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored after plan');
        expect(owner.installedPaths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});

test('a preserved file refuses the whole batch and leaves every proposed destination unchanged', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'owned.txt': 'original', 'authored.txt': 'keep authored' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('owned.txt', { bytes: Buffer.from('installed'), mode: 0o644 }, 'config', true);
        const plans = ['owned.txt', 'authored.txt'].map((path) =>
            owner.proposeReplacement(path, { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config'),
        );
        expect(() => owner.applyPlans(plans)).toThrow('Preserved edited or unowned authored.txt');
        expect(readFileSync(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
    } finally {
        owner.close();
    }
});

test('restoration plans refuse the whole batch after an edit', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'authored.txt': 'original\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('authored.txt', { bytes: Buffer.from('installed\n'), mode: 0o444 }, 'config', true);
        owner.replace('generated.txt', { bytes: Buffer.from('generated\n'), mode: 0o644 }, 'config');
        const plans = ['authored.txt', 'generated.txt'].map((path) => owner.proposeRestoration(path));
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        writeFileSync(join(directory.path, 'generated.txt'), 'user edit\n');
        expect(() => owner.applyPlans(plans)).toThrow('File changed after its plan: generated.txt');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        expect(readFileSync(join(directory.path, 'generated.txt'), 'utf8')).toBe('user edit\n');
        owner.applyPlans([owner.proposeRestoration('authored.txt')]);
        expect(owner.read('authored.txt')).toBeUndefined();
        expect(owner.applyPlan(owner.proposeRestoration('generated.txt'))).toBe('preserved');
    } finally {
        owner.close();
    }
});

test('retirement plans refuse the whole batch when a later read is stale', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.json': '{}\n', 'second.json': '{}\n' });
    const owner = openOwner(directory.path);
    try {
        const plans = ['first.json', 'second.json'].map((path) => owner.proposeRetirement(path, owner.read(path)!));
        writeFileSync(join(directory.path, 'second.json'), '{"edited":true}\n');
        expect(() => owner.applyPlans(plans)).toThrow('File changed after its plan: second.json');
        expect(readFileSync(join(directory.path, 'first.json'), 'utf8')).toBe('{}\n');
        expect(readFileSync(join(directory.path, 'second.json'), 'utf8')).toBe('{"edited":true}\n');
        expect(owner.paths()).toStrictEqual([]);
        owner.applyPlans(['first.json', 'second.json'].map((path) => owner.proposeRetirement(path, owner.read(path)!)));
        expect(owner.read('first.json')).toBeUndefined();
        expect(owner.read('second.json')).toBeUndefined();
        expect(owner.paths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});
