import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    chmodSync,
    lchmodSync,
    lstatSync,
    readFileSync,
    readlinkSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { applyBlock } from '#cli/emit/managed-blocks.ts';
import { openLifecycleOwner, ownershipSchema, readOwnership } from '#cli/lifecycle/ownership.ts';
import { publishInstalledFiles } from '#cli/lifecycle/installed-files.ts';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

const implementation = fileURLToPath(new URL('../../../../packages/cli/src/lifecycle/ownership.ts', import.meta.url));
const boundary = fileURLToPath(new URL('../../../../packages/cli/src/lifecycle/confined.ts', import.meta.url));

test.each(['success', 'error', 'interruption', 'edited', 'damaged backup'] as const)(
    'read-only replacement preserves recovery bytes through %s with Windows filesystem semantics',
    async (point) => {
        await using directory = await testdir();
        const original = Buffer.from([0, 255, 10, 13]);
        const destination = join(directory.path, 'config.txt');
        writeFileSync(destination, original, { mode: 0o444 });
        const program = `
import { mock } from 'bun:test';
const fs = await import('node:fs');
const rename = fs.renameSync;
const read = fs.readFileSync;
const stat = fs.statSync;
const exists = fs.existsSync;
const write = fs.writeFileSync;
const point = ${JSON.stringify(point)};
let failed = false;
mock.module('node:fs', () => ({ ...fs, renameSync(from, to) {
    if (String(to).endsWith('config.txt')) {
        if (exists(to) && (stat(to).mode & 0o200) === 0)
            throw Object.assign(new Error('Read-only destination'), {code: 'EPERM'});
        if (read(from).equals(Buffer.from('installed\\n'))) {
            if (point === 'interruption' || point === 'damaged backup') process.exit(73);
            if (point === 'edited') { write(to, 'developer edit\\n'); process.exit(73); }
            if (point === 'error' && !failed) { failed = true; throw new Error('Publication failed'); }
        }
    }
    rename(from, to);
} }));
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openLifecycleOwner} = await import(${JSON.stringify(implementation)});
const owner = openLifecycleOwner(process.cwd());
try {
    owner.replace('config.txt', {bytes: Buffer.from('installed\\n'), mode: 0o444}, 'config', true);
    if (point !== 'success') throw new Error('Expected publication failure');
} catch (error) {
    if (point !== 'error' || error.message !== 'Publication failed') throw error;
} finally { owner.close(); }
`;
        const child = Bun.spawnSync([process.execPath, '-e', program], {
            cwd: directory.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(
            point === 'success' || point === 'error' ? 0 : 73,
        );
        const state = ownershipSchema.parse(
            JSON.parse(readFileSync(join(directory.path, '.gspot/ownership.json'), 'utf8')),
        );
        if (point === 'damaged backup') {
            const backup = state.pending![0]!.beforeBackup!.backup;
            writeFileSync(join(directory.path, backup), 'damaged');
            expect(() => openLifecycleOwner(directory.path)).toThrow('backup is missing or changed');
            expect(() => readFileSync(destination)).toThrow();
            writeFileSync(join(directory.path, backup), original);
        }
        if (point === 'edited') {
            expect(() => openLifecycleOwner(directory.path)).toThrow('conflicts with edited');
            expect(readFileSync(destination, 'utf8')).toBe('developer edit\n');
            expect(readFileSync(join(directory.path, state.pending![0]!.beforeBackup!.backup))).toEqual(original);
            return;
        }
        const owner = openLifecycleOwner(directory.path);
        try {
            if (point === 'success') expect(owner.restore('config.txt')).toBe('changed');
            expect(readFileSync(destination)).toEqual(original);
            expect(statSync(destination).mode & 0o777).toBe(0o444);
            expect(owner.installedPaths()).toEqual([]);
        } finally {
            owner.close();
        }
    },
);

test.each([false, true])(
    'TOML task ownership restores originals while retaining unrelated edits (%s)',
    async (edited) => {
        await using directory = await testdir();
        const original =
            '# Authored tasks\n[tasks]\nlint = "authored lint"\n[tasks.format]\n# Keep this description\ndescription = "Format the app"\nrun = ["authored format", "authored verify"]\n';
        await createFileTree(directory.path, { 'mise.toml': original });
        const owner = openLifecycleOwner(directory.path);
        try {
            const changes = [
                { path: ['tasks', 'lint'], value: 'gspot check' },
                { path: ['tasks', 'format', 'run'], value: 'gspot check --fix' },
            ];
            expect(owner.applyProposal(owner.proposeConfiguration('mise.toml', 'toml', changes, true))).toBe('changed');
            const installed = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
            expect(installed).toContain('# Authored tasks');
            expect(installed).toContain('# Keep this description');
            expect(parseToml(installed)).toMatchObject({
                tasks: { lint: 'gspot check', format: { description: 'Format the app', run: 'gspot check --fix' } },
            });
            expect(owner.applyProposal(owner.proposeConfiguration('mise.toml', 'toml', changes))).toBe('unchanged');
            if (edited)
                writeFileSync(join(directory.path, 'mise.toml'), installed + '\n[env]\nAPP_MODE = "authored"\n');
            expect(owner.restore('mise.toml')).toBe('changed');
            const restored = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
            expect(parseToml(restored)['tasks']).toEqual(parseToml(original)['tasks']);
            if (edited) expect(parseToml(restored)['env']).toEqual({ APP_MODE: 'authored' });
            else expect(restored).toBe(original);
        } finally {
            owner.close();
        }
    },
);

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
        expect(parseToml(installed)).toEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
        writeFileSync(join(directory.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
        expect(owner.restore('mise.toml')).toBe('preserved');
        expect(readFileSync(join(directory.path, 'mise.toml'), 'utf8')).toContain('authored check');
    } finally {
        owner.close();
    }
});

test('Windows permission projection supports repeated journal writes, idempotent replacement, and restoration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored bytes' });
    const program = `
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openLifecycleOwner} = await import(${JSON.stringify(implementation)});
let owner = openLifecycleOwner(process.cwd());
try {
    const first = owner.replace('config.txt', {bytes: Buffer.from('installed bytes'), mode: 0o755}, 'config', true);
    const repeated = owner.replace('config.txt', {bytes: Buffer.from('installed bytes'), mode: 0o755}, 'config');
    owner.close();
    owner = openLifecycleOwner(process.cwd());
    const restored = owner.restore('config.txt');
    console.log(JSON.stringify({first, repeated, restored, text: owner.read('config.txt').bytes.toString()}));
} finally {owner.close();}
`;
    const child = Bun.spawnSync([process.execPath, '-e', program], {
        cwd: directory.path,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    expect(JSON.parse(child.stdout.toString())).toEqual({
        first: 'changed',
        repeated: 'unchanged',
        restored: 'changed',
        text: 'authored bytes',
    });
    expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('authored bytes');
});

test('Python installation preserves runtime bytecode caches without publishing or pruning them', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    const cache = '.gspot/.venv/lib/__pycache__';
    await createFileTree(directory.path, { [`${cache}/unowned.pyc`]: 'runtime bytes' });
    await createFileTree(staged.path, {
        'lib/package.py': 'value = 2\n',
        'lib/package.pyc': 'packaged legacy bytecode',
        'lib/__pycache__/unowned.pyc': 'temporary generated bytecode',
        'lib/__pycache__/new.pyc': 'temporary new bytecode',
    });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replace(
            `${cache}/recorded.pyc`,
            { bytes: Buffer.from('previous generated cache'), mode: 0o644 },
            'dependency',
        );
        writeFileSync(join(directory.path, `${cache}/recorded.pyc`), 'runtime changed cache');
        publishInstalledFiles(owner, staged.path, 'python');
        expect(owner.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 2\n');
        expect(owner.read('.gspot/.venv/lib/package.pyc')?.bytes.toString()).toBe('packaged legacy bytecode');
        expect(owner.read(`${cache}/unowned.pyc`)?.bytes.toString()).toBe('runtime bytes');
        expect(owner.read(`${cache}/recorded.pyc`)?.bytes.toString()).toBe('runtime changed cache');
        expect(owner.read(`${cache}/new.pyc`)).toBeUndefined();
        publishInstalledFiles(owner, staged.path, 'python');
        expect(readOwnership(directory.path).installations).toBeUndefined();
    } finally {
        owner.close();
    }
});

describe.skipIf(process.platform === 'win32')('lifecycle ownership and recovery', () => {
    test.each(['link', 'pruning'] as const)(
        'installation preserves every destination when %s conflicts, then installs corrected inputs',
        async (conflict) => {
            await using directory = await testdir();
            await using staged = await testdir();
            await createFileTree(staged.path, { 'package/bin/tool': 'new executable', '.bin/.keep': '' });
            symlinkSync('../package/bin/tool', join(staged.path, '.bin/tool'));
            const owner = openLifecycleOwner(directory.path);
            const target = '.gspot/node_modules/package/bin/tool';
            const obstructed = conflict === 'link' ? '.gspot/node_modules/.bin/tool' : '.gspot/node_modules/obsolete';
            try {
                owner.replace(target, { bytes: Buffer.from('installed executable'), mode: 0o644 }, 'dependency');
                owner.replace(obstructed, { bytes: Buffer.from('installed file'), mode: 0o644 }, 'dependency');
                writeFileSync(join(directory.path, obstructed), 'authored edit');
                expect(() => publishInstalledFiles(owner, staged.path, 'npm')).toThrow('Preserved edited or unowned');
                expect(owner.read(target)?.bytes.toString()).toBe('installed executable');
                expect(owner.read(obstructed)?.bytes.toString()).toBe('authored edit');
                writeFileSync(join(directory.path, obstructed), 'installed file');
                publishInstalledFiles(owner, staged.path, 'npm');
                expect(owner.read(target)?.bytes.toString()).toBe('new executable');
                expect(readFileSync(join(directory.path, '.gspot/node_modules/.bin/tool'), 'utf8')).toBe(
                    'new executable',
                );
                publishInstalledFiles(owner, staged.path, 'npm');
                if (conflict === 'pruning') expect(owner.read(obstructed)).toBeUndefined();
            } finally {
                owner.close();
            }
        },
    );

    test('two replacements restore the first original bytes and mode and preserve unowned files', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
        const original = Buffer.from([0, 255, 1, 10]);
        writeFileSync(join(directory.path, 'config.txt'), original, { mode: 0o640 });
        let owner = openLifecycleOwner(directory.path);
        try {
            expect(owner.replace('config.txt', { bytes: Buffer.from('first'), mode: 0o444 }, 'config', true)).toBe(
                'changed',
            );
            expect(owner.replace('config.txt', { bytes: Buffer.from('second'), mode: 0o444 }, 'config')).toBe(
                'changed',
            );
            owner.close();
            owner = openLifecycleOwner(directory.path);
            expect(owner.restore('config.txt')).toBe('changed');
            expect(owner.read('config.txt')).toEqual({ bytes: original, mode: 0o640 });
            expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
            expect(owner.paths()).toEqual([]);
            expect(statSync(join(directory.path, '.gspot/ownership.json')).mode & 0o777).toBe(0o600);
            expect(statSync(join(directory.path, '.gspot/recovery')).mode & 0o777).toBe(0o700);
        } finally {
            owner.close();
        }
    });

    test('installed executable links run, restore authored links and modes, and preserve later edits', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            '.gspot/node_modules/tool/bin.sh': '#!/bin/sh\nprintf installed',
            '.gspot/node_modules/tool/original.sh': '#!/bin/sh\nprintf original',
            '.gspot/node_modules/.bin/.keep': '',
        });
        const path = '.gspot/node_modules/.bin/tool';
        const absolute = join(directory.path, path);
        chmodSync(join(directory.path, '.gspot/node_modules/tool/bin.sh'), 0o755);
        chmodSync(join(directory.path, '.gspot/node_modules/tool/original.sh'), 0o755);
        symlinkSync('../tool/original.sh', absolute);
        if (process.platform === 'darwin') lchmodSync(absolute, 0o700);
        const originalMode = lstatSync(absolute).mode & 0o7777;
        const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
        let owner = openLifecycleOwner(directory.path);
        try {
            expect(owner.replace(path, next, 'config')).toBe('preserved');
            expect(owner.replace(path, next, 'config', true)).toBe('changed');
            expect(owner.replace(path, next, 'config')).toBe('unchanged');
            const executed = Bun.spawnSync([absolute], { stdout: 'pipe', stderr: 'pipe' });
            expect(executed.exitCode, executed.stderr.toString()).toBe(0);
            expect(executed.stdout.toString()).toBe('installed');
            expect(() => owner.read(path)).toThrow();
            owner.close();
            owner = openLifecycleOwner(directory.path);
            expect(owner.restore(path)).toBe('changed');
            expect(readlinkSync(absolute)).toBe('../tool/original.sh');
            expect(lstatSync(absolute).mode & 0o7777).toBe(originalMode);
            expect(statSync(join(directory.path, '.gspot/node_modules/tool/original.sh')).mode & 0o777).toBe(0o755);
            expect(owner.replace(path, next, 'config', true)).toBe('changed');
            unlinkSync(absolute);
            symlinkSync('../tool/original.sh', absolute);
            expect(owner.replace(path, next, 'config')).toBe('preserved');
            expect(owner.restore(path)).toBe('preserved');
            expect(readlinkSync(absolute)).toBe('../tool/original.sh');
        } finally {
            owner.close();
        }
    });

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
            expect(owner.paths()).toEqual([]);
            expect(readlinkSync(join(project, 'tool'))).toBe('../outside');
            expect(readFileSync(join(directory.path, 'outside'), 'utf8')).toBe('authored');
            expect(owner.replace('valid', { bytes: Buffer.from('corrected input'), mode: 0o644 }, 'config')).toBe(
                'changed',
            );
        } finally {
            owner.close();
        }
    });

    test('a regular file containing a link target is preserved after replacing an installed link', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { target: 'authored target' });
        const owner = openLifecycleOwner(directory.path);
        const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
        try {
            expect(owner.replace('tool', next, 'config')).toBe('changed');
            unlinkSync(join(directory.path, 'tool'));
            writeFileSync(join(directory.path, 'tool'), 'target', { mode: 0o777 });
            expect(owner.replace('tool', next, 'config')).toBe('preserved');
            expect(owner.restore('tool')).toBe('preserved');
            expect(lstatSync(join(directory.path, 'tool')).isFile()).toBe(true);
            expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('authored target');
        } finally {
            owner.close();
        }
    });

    test.each(['before', 'after'] as const)(
        'interrupted link publication %s rename recovers without losing the original',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { target: 'installed target', original: 'authored target' });
            symlinkSync('original', join(directory.path, 'tool'));
            const script = `
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openConfinedRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
                const files = open(root);
                return { ...files, write(path, value, expected) {
                    if (path === 'tool' && ${JSON.stringify(point)} === 'before') process.exit(73);
                    files.write(path, value, expected);
                    if (path === 'tool' && ${JSON.stringify(point)} === 'after') process.exit(73);
                }};
            }}));
            const { openLifecycleOwner } = await import(${JSON.stringify(implementation)});
            openLifecycleOwner(process.cwd()).replace('tool', {bytes: Buffer.from('target'), mode: 511, isLink: true}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stderr.toString()).toBe(73);
            const owner = openLifecycleOwner(directory.path);
            try {
                if (point === 'after') expect(owner.restore('tool')).toBe('changed');
                expect(readlinkSync(join(directory.path, 'tool'))).toBe('original');
                expect(readFileSync(join(directory.path, 'original'), 'utf8')).toBe('authored target');
                expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('installed target');
                expect(owner.paths()).toEqual([]);
            } finally {
                owner.close();
            }
        },
    );

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
                JSON.parse(readFileSync(join(directory.path, '.gspot/ownership.json'), 'utf8')),
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
                expect(owner.read('authored.json')).toEqual(edited);
                if (change === 'removed') writeFileSync(path, '{"semi":true}\n', { mode: 0o600 });
                const refreshed = owner.read('authored.json')!;
                expect(owner.applyProposal(owner.proposeRetirement('authored.json', refreshed))).toBe('changed');
                expect(owner.restore('authored.json')).toBe('changed');
                expect(owner.read('authored.json')).toEqual(refreshed);
            } finally {
                owner.close();
            }
        },
    );

    test('unavailable recovery refuses takeover before modifying the original', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'config.txt': 'original\n',
            '.gspot/recovery': 'authored obstruction\n',
        });
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(() =>
                owner.replace('config.txt', { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config', true),
            ).toThrow();
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
            expect(readFileSync(join(directory.path, '.gspot/recovery'), 'utf8')).toBe('authored obstruction\n');
        } finally {
            owner.close();
        }
    });

    test.each(['before', 'after'] as const)(
        'an interrupted replacement %s publication recovers and releases its writer lock',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'original\n' });
            const script = `
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openConfinedRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({
                ...boundary,
                openConfinedRoot(root) {
                    const files = open(root);
                    return { ...files, write(path, value, expected) {
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'before') process.exit(73);
                        files.write(path, value, expected);
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'after') process.exit(73);
                    } };
                },
            }));
            const { openLifecycleOwner } = await import(${JSON.stringify(implementation)});
            openLifecycleOwner(process.cwd()).replace('config.txt', {bytes: Buffer.from('installed\\n'), mode: 420}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(73);
            const pending = ownershipSchema.parse(
                JSON.parse(readFileSync(join(directory.path, '.gspot/ownership.json'), 'utf8')),
            );
            expect(pending.pending?.[0]?.path).toBe('config.txt');
            const owner = openLifecycleOwner(directory.path);
            try {
                if (point === 'after') {
                    expect(owner.paths()).toEqual(['config.txt']);
                    expect(owner.restore('config.txt')).toBe('changed');
                } else expect(owner.paths()).toEqual([]);
                expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
                const recovered = ownershipSchema.parse(
                    JSON.parse(readFileSync(join(directory.path, '.gspot/ownership.json'), 'utf8')),
                );
                expect(recovered.pending).toBeUndefined();
            } finally {
                owner.close();
            }
        },
    );
});

test('managed block updates and removal preserve authored bytes and subsequent surrounding edits', async () => {
    await using directory = await testdir();
    const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(directory.path, { 'AGENTS.md': original });
    let owner = openLifecycleOwner(directory.path);
    try {
        expect(owner.replaceBlock('AGENTS.md', 'first instructions', 'markdown')).toBe('changed');
        const installed = owner.read('AGENTS.md')!.bytes.toString('utf8');
        expect(installed.startsWith(original)).toBe(true);
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        writeFileSync(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
        expect(owner.replaceBlock('AGENTS.md', 'updated instructions', 'markdown')).toBe('changed');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
            prefix + applyBlock(original, 'updated instructions', 'markdown') + suffix,
        );
        owner.close();
        owner = openLifecycleOwner(directory.path);
        expect(owner.restore('AGENTS.md')).toBe('changed');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
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

test('removing a block restores an originally empty file instead of deleting it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'AGENTS.md': '' });
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(owner.replaceBlock('AGENTS.md', 'instructions', 'markdown')).toBe('changed');
        expect(owner.restore('AGENTS.md')).toBe('changed');
        expect(owner.read('AGENTS.md')?.bytes).toEqual(Buffer.alloc(0));
    } finally {
        owner.close();
    }
});

test('shared JSON updates preserve comments and later authored settings through uninstall', async () => {
    await using directory = await testdir();
    const original =
        '{\n  // Keep this comment.\n  "extends": "./authored.json",\n  "compilerOptions": { "strict": false }\n}\n';
    await createFileTree(directory.path, { 'tsconfig.json': original });
    let owner = openLifecycleOwner(directory.path);
    try {
        expect(
            owner.applyProposal(
                owner.proposeConfiguration(
                    'tsconfig.json',
                    'json',
                    [{ path: ['extends'], value: './.gspot/first.json' }],
                    true,
                ),
            ),
        ).toBe('changed');
        const installed = owner.read('tsconfig.json')!.bytes.toString('utf8');
        const edited = installed.replace('"strict": false', '"strict": true');
        writeFileSync(join(directory.path, 'tsconfig.json'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('tsconfig.json', 'json', [
                    { path: ['extends'], value: './.gspot/second.json' },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(
            edited.replace('./.gspot/first.json', './.gspot/second.json'),
        );
        owner.close();
        owner = openLifecycleOwner(directory.path);
        expect(owner.restore('tsconfig.json')).toBe('changed');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(
            original.replace('"strict": false', '"strict": true'),
        );
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

test('leaving JSON keys restores their original values and preserves authored changes', async () => {
    await using directory = await testdir();
    const original = '{"scripts":{"prepare":"build-app","check":"gspot check"},"optional":null,"private":true}\n';
    await createFileTree(directory.path, { 'package.json': original });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposal(
            owner.proposeConfiguration(
                'package.json',
                'json',
                [
                    { path: ['scripts', 'prepare'], value: 'gspot apply' },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                    { path: ['optional'], value: true },
                ],
                true,
            ),
        );
        const edited = owner.read('package.json')!.bytes.toString('utf8').replace('"private":true', '"private":false');
        writeFileSync(join(directory.path, 'package.json'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('package.json', 'json', [
                    { path: ['scripts', 'check'], value: 'gspot check' },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('package.json')!.bytes.toString('utf8')).toBe(
            original.replace('"private":true', '"private":false'),
        );
        expect(owner.restore('package.json')).toBe('changed');
        expect(owner.read('package.json')!.bytes.toString('utf8')).toBe(
            original.replace('"private":true', '"private":false'),
        );
    } finally {
        owner.close();
    }
});

test('Lefthook YAML ownership preserves authored commands and comments through updates and removal', async () => {
    await using directory = await testdir();
    const original = '# Keep this hook.\npre-commit:\n  commands:\n    authored:\n      run: echo original\n';
    await createFileTree(directory.path, { 'lefthook.yml': original });
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(
            owner.applyProposal(
                owner.proposeConfiguration(
                    'lefthook.yml',
                    'yaml',
                    [{ path: ['pre-commit', 'commands', 'gspot'], value: { run: 'gspot check --staged' } }],
                    true,
                ),
            ),
        ).toBe('changed');
        const edited = owner
            .read('lefthook.yml')!
            .bytes.toString('utf8')
            .replace('echo original', 'echo authored-later');
        writeFileSync(join(directory.path, 'lefthook.yml'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('lefthook.yml', 'yaml', [
                    { path: ['pre-commit', 'commands', 'gspot'], value: { run: 'gspot check --staged --no-cache' } },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('lefthook.yml')!.bytes.toString('utf8')).toContain('echo authored-later');
        expect(owner.restore('lefthook.yml')).toBe('changed');
        expect(owner.read('lefthook.yml')!.bytes.toString('utf8')).toBe(
            original.replace('echo original', 'echo authored-later'),
        );
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
        expect(owner.installedPaths()).toEqual([]);
        const edited = '{"extends":"./authored.json","strict":false}\n';
        writeFileSync(join(directory.path, 'tsconfig.json'), edited);
        expect(() => owner.applyProposal(proposal)).toThrow('changed after its proposal');
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe(edited);
        expect(owner.installedPaths()).toEqual([]);
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
        expect(owner.installedPaths()).toEqual([]);
    } finally {
        owner.close();
    }
});

test('an inconsistent interrupted journal cannot acquire ownership of current bytes', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'original\n' });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true);
    } finally {
        owner.close();
    }
    const record = join(directory.path, '.gspot/ownership.json');
    const state = ownershipSchema.parse(JSON.parse(readFileSync(record, 'utf8')));
    const entry = state.files[0]!;
    state.pending = [
        {
            path: entry.path,
            after: entry.installed!,
            entry: { ...entry, installed: { hash: 'f'.repeat(64), mode: 0o644 } },
        },
    ];
    const inconsistent = JSON.stringify(state);
    writeFileSync(record, inconsistent);
    expect(() => openLifecycleOwner(directory.path)).toThrow('different installed identity');
    expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('installed\n');
    expect(readFileSync(record, 'utf8')).toBe(inconsistent);
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
            expect(owner.read('config.txt')).toEqual({ bytes: Buffer.from('authored\n'), mode: 0o640 });
            writeFileSync(join(directory.path, 'config.txt'), 'edited after proposal\n');
            expect(() => owner.applyProposal(proposal)).toThrow('File changed after its proposal');
            expect(owner.restore('config.txt')).toBe('preserved');
            expect(owner.read('config.txt')).toEqual({ bytes: Buffer.from('edited after proposal\n'), mode: 0o640 });
        } finally {
            owner.close();
        }
    },
);

test.each(['before', 'after'] as const)(
    'an interrupted batch recovers each published file and restores original bytes and permissions (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        await createFileTree(directory.path, Object.fromEntries(paths.map((path) => [path, `authored ${path}\n`])));
        for (const path of paths) chmodSync(join(directory.path, path), 0o640);
        const program = `
import {mock} from 'bun:test';
const boundary=await import(${JSON.stringify(boundary)});
const open=boundary.openConfinedRoot;
mock.module(${JSON.stringify(boundary)},()=>({...boundary,openConfinedRoot(root){
const files=open(root);
return {...files,write(path,value,expected){
if(path==='middle.txt' && ${JSON.stringify(point)}==='before') process.exit(73);
files.write(path,value,expected);
if(path==='middle.txt' && ${JSON.stringify(point)}==='after') process.exit(73);
}};
}}));
const {openLifecycleOwner}=await import(${JSON.stringify(implementation)});
const owner=openLifecycleOwner(process.cwd());
owner.applyProposals(${JSON.stringify(paths)}.map(path=>owner.proposeReplacement(path,{bytes:Buffer.from('installed '+path+'\\n'),mode:0o444},'config',true)));
owner.close();
`;
        const child = Bun.spawn([process.execPath, '-e', program], {
            cwd: directory.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const streams = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
        expect(await child.exited, (await streams).join('\n')).toBe(73);
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('installed first.txt\n');
        expect(readFileSync(join(directory.path, 'middle.txt'), 'utf8')).toBe(
            `${point === 'before' ? 'authored' : 'installed'} middle.txt\n`,
        );
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored last.txt\n');
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(owner.installedPaths().sort()).toEqual(
                point === 'before' ? ['first.txt'] : ['first.txt', 'middle.txt'],
            );
            owner.applyProposals(
                paths.map((path) =>
                    owner.proposeReplacement(
                        path,
                        { bytes: Buffer.from(`installed ${path}\n`), mode: 0o444 },
                        'config',
                        true,
                    ),
                ),
            );
            for (const path of paths) {
                expect(owner.restore(path)).toBe('changed');
                expect(readFileSync(join(directory.path, path), 'utf8')).toBe(`authored ${path}\n`);
                expect(statSync(join(directory.path, path)).mode & 0o777).toBe(0o640);
            }
            expect(owner.installedPaths()).toEqual([]);
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
        expect(owner.installedPaths()).toEqual([]);
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

test('adopting identical authored configuration retains original recovery bytes and permissions', async () => {
    await using directory = await testdir();
    const content = '{\n    "scripts": {"check": "gspot check"},\n    "authored": true\n}\n';
    await createFileTree(directory.path, { 'package.json': content });
    chmodSync(join(directory.path, 'package.json'), 0o640);
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposals([
            owner.proposeConfiguration(
                'package.json',
                'json',
                [{ path: ['scripts', 'check'], value: 'gspot check' }],
                true,
            ),
        ]);
        const state = ownershipSchema.parse(
            JSON.parse(readFileSync(join(directory.path, '.gspot/ownership.json'), 'utf8')),
        );
        const original = state.files[0]!.original;
        expect(original).toBeDefined();
        expect(readFileSync(join(directory.path, original!.backup), 'utf8')).toBe(content);
        expect(owner.restore('package.json')).toBe('changed');
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(content);
        expect(statSync(join(directory.path, 'package.json')).mode & 0o777).toBe(0o640);
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

test.each(['before', 'after'] as const)(
    'interrupted batch removal recovers published deletions and retains unprocessed ownership (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        const initial = openLifecycleOwner(directory.path);
        try {
            initial.applyProposals(
                paths.map((path) =>
                    initial.proposeReplacement(path, { bytes: Buffer.from(path), mode: 0o644 }, 'config'),
                ),
            );
        } finally {
            initial.close();
        }
        const program = `
import {mock} from 'bun:test';
const boundary=await import(${JSON.stringify(boundary)});
const open=boundary.openConfinedRoot;
mock.module(${JSON.stringify(boundary)},()=>({...boundary,openConfinedRoot(root){
const files=open(root);
return {...files,remove(path,expected){
if(path==='middle.txt' && ${JSON.stringify(point)}==='before') process.exit(73);
files.remove(path,expected);
if(path==='middle.txt' && ${JSON.stringify(point)}==='after') process.exit(73);
}};
}}));
const {openLifecycleOwner}=await import(${JSON.stringify(implementation)});
const owner=openLifecycleOwner(process.cwd());
owner.applyProposals(${JSON.stringify(paths)}.map(path=>owner.proposeRestoration(path)));
owner.close();
`;
        const child = Bun.spawn([process.execPath, '-e', program], {
            cwd: directory.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const streams = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
        expect(await child.exited, (await streams).join('\n')).toBe(73);
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(owner.read('first.txt')).toBeUndefined();
            expect(owner.installedPaths().sort()).toEqual(
                point === 'before' ? ['last.txt', 'middle.txt'] : ['last.txt'],
            );
            expect(owner.read('last.txt')?.bytes.toString()).toBe('last.txt');
            owner.applyProposals(owner.installedPaths().map((path) => owner.proposeRestoration(path)));
            for (const path of paths) expect(owner.read(path)).toBeUndefined();
            expect(owner.installedPaths()).toEqual([]);
        } finally {
            owner.close();
        }
    },
);

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
        expect(owner.paths()).toEqual([]);
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

test('identical unrecorded blocks and configuration fields survive adoption, later edits, and restoration', async () => {
    await using directory = await testdir();
    const instructions = applyBlock('Authored instructions.\n', 'existing instructions', 'markdown');
    const configuration = '{"scripts":{"check":"gspot check"},"authored":true}\n';
    await createFileTree(directory.path, { 'AGENTS.md': instructions, 'package.json': configuration });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposals([
            owner.proposeBlock('AGENTS.md', 'existing instructions', 'markdown'),
            owner.proposeConfiguration('package.json', 'json', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
        ]);
        writeFileSync(join(directory.path, 'AGENTS.md'), instructions + 'Later authored instructions.\n');
        writeFileSync(join(directory.path, 'package.json'), configuration.replace('true', 'false'));
        owner.applyProposals(['AGENTS.md', 'package.json'].map((path) => owner.proposeRestoration(path)));
        expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(
            instructions + 'Later authored instructions.\n',
        );
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(configuration.replace('true', 'false'));
        expect(owner.paths()).toEqual([]);
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
        expect(() => publishInstalledFiles(owner, join(installation.path, 'node_modules'), 'npm')).toThrow(
            'Unsafe lifecycle destination',
        );
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

test.each(['first backup', 'second backup', 'journal'])(
    'a full disk during %s preserves every original and permits a corrected batch',
    async (point) => {
        await using directory = await testdir();
        const original = Buffer.from([0, 255, 10, 13, 42]);
        for (const name of ['first.bin', 'second.bin'])
            writeFileSync(join(directory.path, name), original, { mode: 0o444 });
        const originalMode = statSync(join(directory.path, 'first.bin')).mode & 0o777;
        const program = `
import { mock } from 'bun:test';
const boundary = await import(${JSON.stringify(boundary)});
const open = boundary.openConfinedRoot;
let backups = 0;
mock.module(${JSON.stringify(boundary)}, () => ({
    ...boundary,
    openConfinedRoot(root) {
        const files = open(root);
        return { ...files, write(path, next, expected) {
            if (path.endsWith('.original')) backups++;
            const point = ${JSON.stringify(point)};
            if ((point === 'journal' && path === '.gspot/ownership.json') ||
                (path.endsWith('.original') && backups === (point === 'first backup' ? 1 : point === 'second backup' ? 2 : 0)))
                throw Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
            files.write(path, next, expected);
        }};
    }
}));
const { openLifecycleOwner } = await import(${JSON.stringify(implementation)});
const owner = openLifecycleOwner(${JSON.stringify(directory.path)});
try {
    owner.applyProposals(['first.bin', 'second.bin'].map(path => owner.proposeReplacement(path, { bytes: Buffer.from('installed'), mode: 0o444 }, 'config', true)));
} catch (error) {
    console.log(JSON.stringify({ code: error.code }));
} finally { owner.close(); }
`;
        const child = Bun.spawn([process.execPath, '-e', program], { stdout: 'pipe', stderr: 'pipe' });
        const [stdout, stderr, code] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ]);
        expect(code, stderr).toBe(0);
        expect(JSON.parse(stdout)).toEqual({ code: 'ENOSPC' });
        for (const name of ['first.bin', 'second.bin']) {
            expect(readFileSync(join(directory.path, name))).toEqual(original);
            expect(statSync(join(directory.path, name)).mode & 0o777).toBe(originalMode);
        }
        expect(readOwnership(directory.path).files).toEqual([]);
        const owner = openLifecycleOwner(directory.path);
        try {
            owner.applyProposals(
                ['first.bin', 'second.bin'].map((path) =>
                    owner.proposeReplacement(path, { bytes: Buffer.from('installed'), mode: 0o444 }, 'config', true),
                ),
            );
            owner.applyProposals(['first.bin', 'second.bin'].map((path) => owner.proposeRestoration(path)));
            for (const name of ['first.bin', 'second.bin']) {
                expect(readFileSync(join(directory.path, name))).toEqual(original);
                expect(statSync(join(directory.path, name)).mode & 0o777).toBe(originalMode);
            }
        } finally {
            owner.close();
        }
    },
);

test.each([
    ['json', '{"authored":true,"kept":{}}\n', (text: string): unknown => JSON.parse(text)],
    ['yaml', 'authored: true\nkept: {}\n', (text: string): unknown => parseYaml(text)],
    ['toml', 'authored = true\n[kept]\n', (text: string): unknown => parseToml(text)],
] as const)(
    'shared %s configuration removes created empty parents and preserves authored empty parents',
    async (format, source, parse) => {
        await using directory = await testdir();
        const path = `config.${format}`;
        await createFileTree(directory.path, { [path]: source });
        const owner = openLifecycleOwner(directory.path);
        const fields = [
            { path: ['created', 'nested', 'first'], value: 1 },
            { path: ['created', 'nested', 'second'], value: 2 },
            { path: ['kept', 'owned'], value: true },
        ];
        try {
            owner.applyProposal(owner.proposeConfiguration(path, format, fields, true));
            owner.applyProposal(owner.proposeConfiguration(path, format, [fields[1]!]));
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toEqual({
                authored: true,
                kept: {},
                created: { nested: { second: 2 } },
            });
            owner.applyProposal(owner.proposeConfiguration(path, format, []));
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toEqual({ authored: true, kept: {} });
            owner.applyProposal(owner.proposeConfiguration(path, format, fields, true));
            writeFileSync(
                join(directory.path, path),
                owner.read(path)!.bytes.toString('utf8').replace('true', 'false'),
            );
            expect(owner.restore(path)).toBe('changed');
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toEqual({ authored: false, kept: {} });
        } finally {
            owner.close();
        }
    },
);
