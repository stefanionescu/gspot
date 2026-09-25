import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { expect, test } from 'bun:test';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('a prepared configuration does not write and cannot overwrite a subsequent edit', async () => {
    await using directory = await testdir();
    const original = '{"extends":"./authored.json","strict":true}\n';
    await createFileTree(directory.path, { 'tsconfig.json': original });
    const owner = openLifecycleOwner(directory.path);
    try {
        const proposal = owner.proposeConfiguration(
            'tsconfig.json',
            'json',
            [{ path: ['extends'], value: './managed.json' }],
            true,
        );
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe(original);
        expect(owner.installedPaths()).toStrictEqual([]);
        const edited = '{"extends":"./authored.json","strict":false}\n';
        writeFileSync(join(directory.path, 'tsconfig.json'), edited);
        expect(() => owner.applyProposal(proposal)).toThrow('changed after its proposal');
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
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(() =>
            owner.proposeConfiguration(
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
    '%s proposals preserve intervening edits and do not claim the edited file',
    async (kind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored\n' });
        chmodSync(join(directory.path, 'config.txt'), 0o640);
        const owner = openLifecycleOwner(directory.path);
        try {
            const proposal =
                kind === 'replacement'
                    ? owner.proposeReplacement(
                          'config.txt',
                          { bytes: Buffer.from('replacement\n'), mode: 0o444 },
                          'config',
                          true,
                      )
                    : owner.proposeBlock('config.txt', 'managed content', 'hash');
            expect(owner.read('config.txt')).toStrictEqual({ bytes: Buffer.from('authored\n'), mode: 0o640 });
            writeFileSync(join(directory.path, 'config.txt'), 'edited after proposal\n');
            expect(() => owner.applyProposal(proposal)).toThrow('File changed after its proposal');
            expect(owner.restore('config.txt')).toBe('preserved');
            expect(owner.read('config.txt')).toStrictEqual({
                bytes: Buffer.from('edited after proposal\n'),
                mode: 0o640,
            });
        } finally {
            owner.close();
        }
    },
);

test('a batch validates every proposal before publishing any file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.txt': 'original first', 'last.txt': 'original last' });
    const owner = openLifecycleOwner(directory.path);
    try {
        const proposals = ['first.txt', 'last.txt'].map((path) =>
            owner.proposeReplacement(path, { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config', true),
        );
        writeFileSync(join(directory.path, 'last.txt'), 'authored after proposal');
        expect(() => owner.applyProposals(proposals)).toThrow('File changed after its proposal: last.txt');
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('original first');
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored after proposal');
        expect(owner.installedPaths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});

test('a preserved file refuses the whole batch and leaves every proposed destination unchanged', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'owned.txt': 'original', 'authored.txt': 'keep authored' });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replace('owned.txt', { bytes: Buffer.from('installed'), mode: 0o644 }, 'config', true);
        const proposals = ['owned.txt', 'authored.txt'].map((path) =>
            owner.proposeReplacement(path, { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config'),
        );
        expect(() => owner.applyProposals(proposals)).toThrow('Preserved edited or unowned authored.txt');
        expect(readFileSync(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep authored');
        expect(owner.restore('owned.txt')).toBe('changed');
        expect(readFileSync(join(directory.path, 'owned.txt'), 'utf8')).toBe('original');
    } finally {
        owner.close();
    }
});

test('restoration proposals preserve reviewed bytes and refuse the whole batch after an edit', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'authored.txt': 'original\n' });
    chmodSync(join(directory.path, 'authored.txt'), 0o640);
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replace('authored.txt', { bytes: Buffer.from('installed\n'), mode: 0o444 }, 'config', true);
        owner.replace('generated.txt', { bytes: Buffer.from('generated\n'), mode: 0o644 }, 'config');
        const proposals = ['authored.txt', 'generated.txt'].map((path) => owner.proposeRestoration(path));
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        writeFileSync(join(directory.path, 'generated.txt'), 'user edit\n');
        expect(() => owner.applyProposals(proposals)).toThrow('File changed after its proposal: generated.txt');
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('installed\n');
        expect(readFileSync(join(directory.path, 'generated.txt'), 'utf8')).toBe('user edit\n');
        owner.applyProposals([owner.proposeRestoration('authored.txt')]);
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('original\n');
        expect(statSync(join(directory.path, 'authored.txt')).mode & 0o777).toBe(0o640);
        expect(owner.restore('generated.txt')).toBe('preserved');
    } finally {
        owner.close();
    }
});

test('takeover removal proposals retain every original when a later observation is stale', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'first.json': '{}\n', 'second.json': '{}\n' });
    const owner = openLifecycleOwner(directory.path);
    try {
        const proposals = ['first.json', 'second.json'].map((path) => owner.proposeRetirement(path, owner.read(path)!));
        writeFileSync(join(directory.path, 'second.json'), '{"edited":true}\n');
        expect(() => owner.applyProposals(proposals)).toThrow('File changed after its proposal: second.json');
        expect(readFileSync(join(directory.path, 'first.json'), 'utf8')).toBe('{}\n');
        expect(readFileSync(join(directory.path, 'second.json'), 'utf8')).toBe('{"edited":true}\n');
        expect(owner.paths()).toStrictEqual([]);
        owner.applyProposals(
            ['first.json', 'second.json'].map((path) => owner.proposeRetirement(path, owner.read(path)!)),
        );
        expect(owner.read('first.json')).toBeUndefined();
        expect(owner.read('second.json')).toBeUndefined();
        owner.applyProposals(owner.paths().map((path) => owner.proposeRestoration(path)));
        expect(readFileSync(join(directory.path, 'first.json'), 'utf8')).toBe('{}\n');
        expect(readFileSync(join(directory.path, 'second.json'), 'utf8')).toBe('{"edited":true}\n');
    } finally {
        owner.close();
    }
});
