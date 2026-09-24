import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { publishInstalledFiles } from '#cli/tools/installed-files.ts';

import {
    chmodSync,
    lstatSync,
    readFileSync,
    readlinkSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const implementation = fileURLToPath(
    new URL('../../../../../packages/cli/src/lifecycle/ownership.ts', import.meta.url),
);

const boundary = fileURLToPath(new URL('../../../../../packages/cli/src/platform/filesystem.ts', import.meta.url));

test('TOML task ownership refuses malformed and edited fields and creates new tables', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'broken.toml': '[tasks\n' });
    const owner = openLifecycleOwner(directory.path);
    try {
        const changes = [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
        expect(() => owner.proposeConfiguration('broken.toml', 'toml', changes, true)).toThrow();
        expect(readFileSync(join(directory.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
        owner.applyProposal(owner.proposeConfiguration('mise.toml', 'toml', changes));
        const installed = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
        expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
        writeFileSync(join(directory.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
        expect(owner.restore('mise.toml')).toBe('preserved');
        expect(readFileSync(join(directory.path, 'mise.toml'), 'utf8')).toContain('authored check');
    } finally {
        owner.close();
    }
});

test('edited and repeated managed blocks are preserved without overwriting their contents', async () => {
    await using directory = await testdir();
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replaceBlock('AGENTS.md', 'installed instructions', 'markdown');
        const edited = owner
            .read('AGENTS.md')!
            .bytes.toString('utf8')
            .replace('installed instructions', 'authored instructions');
        writeFileSync(join(directory.path, 'AGENTS.md'), edited);
        expect(owner.replaceBlock('AGENTS.md', 'replacement', 'markdown')).toBe('preserved');
        expect(owner.restore('AGENTS.md')).toBe('preserved');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited);
        writeFileSync(join(directory.path, 'AGENTS.md'), edited + edited);
        expect(() => owner.replaceBlock('AGENTS.md', 'replacement', 'markdown')).toThrow('incomplete or repeated');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited + edited);
    } finally {
        owner.close();
    }
});

test('shared JSON preserves changed managed keys and rejects malformed input', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'tsconfig.json': '{"extends":"./original.json"}\n' });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposal(
            owner.proposeConfiguration('tsconfig.json', 'json', [{ path: ['extends'], value: './managed.json' }], true),
        );
        const authored = '{"extends":"./authored.json"}\n';
        writeFileSync(join(directory.path, 'tsconfig.json'), authored);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('tsconfig.json', 'json', [{ path: ['extends'], value: './next.json' }]),
            ),
        ).toBe('preserved');
        expect(owner.restore('tsconfig.json')).toBe('preserved');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(authored);
        writeFileSync(join(directory.path, 'invalid.json'), '{ unfinished');
        expect(() =>
            owner.applyProposal(
                owner.proposeConfiguration('invalid.json', 'json', [{ path: ['value'], value: true }], true),
            ),
        ).toThrow('valid JSON object');
        expect(owner.read('invalid.json')!.bytes.toString('utf8')).toBe('{ unfinished');
    } finally {
        owner.close();
    }
});

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

test('installation refuses a linked output root before publication and accepts a real directory', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'package/file.js': 'external bytes' });
    symlinkSync(outside.path, join(installation.path, 'node_modules'), 'dir');
    const owner = openLifecycleOwner(repository.path);
    try {
        expect(() => {
            publishInstalledFiles(owner, join(installation.path, 'node_modules'), 'npm');
        }).toThrow('Unsafe lifecycle destination');
        expect(owner.read('.gspot/node_modules/package/file.js')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'package/file.js'), 'utf8')).toBe('external bytes');
        unlinkSync(join(installation.path, 'node_modules'));
        await createFileTree(installation.path, { 'node_modules/package/file.js': 'installed bytes' });
        publishInstalledFiles(owner, join(installation.path, 'node_modules'), 'npm');
        expect(owner.read('.gspot/node_modules/package/file.js')?.bytes.toString()).toBe('installed bytes');
    } finally {
        owner.close();
    }
});
describe.skipIf(process.platform === 'win32')('lifecycle ownership', () => {
    test('an exactly reproduced escaping link is refused before ownership or recovery changes', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
        const project = join(directory.path, 'project');
        symlinkSync('../outside', join(project, 'tool'));
        const owner = openLifecycleOwner(project);
        try {
            expect(() =>
                owner.replace(
                    'tool',
                    {
                        bytes: Buffer.from('../outside'),
                        mode: lstatSync(join(project, 'tool')).mode & 0o7777,
                        isLink: true,
                    },
                    'config',
                ),
            ).toThrow();
            expect(owner.paths()).toStrictEqual([]);
            expect(readlinkSync(join(project, 'tool'))).toBe('../outside');
            expect(readFileSync(join(directory.path, 'outside'), 'utf8')).toBe('authored');
            expect(owner.replace('valid', { bytes: Buffer.from('corrected input'), mode: 0o644 }, 'config')).toBe(
                'changed',
            );
        } finally {
            owner.close();
        }
    });

    test('later edits survive both apply and uninstall, with the original recovery bytes retained', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored original\n' });
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(
                owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true),
            ).toBe('changed');
            writeFileSync(join(directory.path, 'config.txt'), 'authored later\n');
            expect(owner.replace('config.txt', { bytes: Buffer.from('upgrade\n'), mode: 0o644 }, 'config')).toBe(
                'preserved',
            );
            expect(owner.restore('config.txt')).toBe('preserved');
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('authored later\n');
            const state = ownershipSchema.parse(
                JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
            );
            expect(readFileSync(join(directory.path, state.files[0]!.original!.backup), 'utf8')).toBe(
                'authored original\n',
            );
            expect(owner.restore('.gspot/unowned')).toBe('preserved');
        } finally {
            owner.close();
        }
    });

    test.each(['bytes', 'mode', 'removed'])(
        'stale takeover %s refuses replacement and retirement, then a fresh observation succeeds',
        async (change) => {
            await using directory = await testdir();
            const path = join(directory.path, 'authored.json');
            writeFileSync(path, '{"semi":false}\n', { mode: 0o640 });
            const owner = openLifecycleOwner(directory.path);
            try {
                const observed = owner.read('authored.json')!;
                if (change === 'bytes') writeFileSync(path, '{"semi":true}\n');
                if (change === 'mode') chmodSync(path, 0o600);
                if (change === 'removed') unlinkSync(path);
                const edited = owner.read('authored.json');
                expect(() =>
                    owner.replace(
                        'authored.json',
                        { bytes: Buffer.from('{}\n'), mode: 0o444 },
                        'config',
                        true,
                        observed,
                    ),
                ).toThrow('changed after takeover was planned');
                expect(() => owner.proposeRetirement('authored.json', observed)).toThrow(
                    'changed after takeover was planned',
                );
                expect(owner.read('authored.json')).toStrictEqual(edited);
                if (change === 'removed') writeFileSync(path, '{"semi":true}\n', { mode: 0o600 });
                const refreshed = owner.read('authored.json')!;
                expect(owner.applyProposal(owner.proposeRetirement('authored.json', refreshed))).toBe('changed');
                expect(owner.restore('authored.json')).toBe('changed');
                expect(owner.read('authored.json')).toStrictEqual(refreshed);
            } finally {
                owner.close();
            }
        },
    );
});
