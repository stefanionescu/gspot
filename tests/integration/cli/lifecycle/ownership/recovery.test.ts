import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { ownershipSchema } from '#cli/schemas/ownership.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { chmodSync, readFileSync, readlinkSync, statSync, symlinkSync, writeFileSync } from 'node:fs';

const implementation = fileURLToPath(
    new URL('../../../../../packages/cli/src/lifecycle/ownership.ts', import.meta.url),
);

const boundary = fileURLToPath(new URL('../../../../../packages/cli/src/filesystem/confined.ts', import.meta.url));

test.each(['success', 'error', 'interruption', 'edited', 'damaged backup'] as const)(
    'read-only replacement preserves recovery bytes through %s with Windows filesystem semantics',
    async (point) => {
        await using directory = await testdir();
        const original = Buffer.from([0, 255, 10, 13]);
        const destination = join(directory.path, 'config.txt');
        writeFileSync(destination, original, { mode: 0o444 });
        const program = String.raw`
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
        if (read(from).equals(Buffer.from('installed\n'))) {
            if (point === 'interruption' || point === 'damaged backup') process.exit(73);
            if (point === 'edited') { write(to, 'developer edit\n'); process.exit(73); }
            if (point === 'error' && !failed) { failed = true; throw new Error('Publication failed'); }
        }
    }
    rename(from, to);
} }));
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openLifecycleOwner} = await import(${JSON.stringify(implementation)});
const owner = openLifecycleOwner(process.cwd());
try {
    owner.replace('config.txt', {bytes: Buffer.from('installed\n'), mode: 0o444}, 'config', true);
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
            JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
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
            expect(readFileSync(join(directory.path, state.pending![0]!.beforeBackup!.backup))).toStrictEqual(original);
            return;
        }
        const owner = openLifecycleOwner(directory.path);
        try {
            if (point === 'success') expect(owner.restore('config.txt')).toBe('changed');
            expect(readFileSync(destination)).toStrictEqual(original);
            expect(statSync(destination).mode & 0o777).toBe(0o444);
            expect(owner.installedPaths()).toStrictEqual([]);
        } finally {
            owner.close();
        }
    },
);

test('an inconsistent interrupted journal cannot acquire ownership of current bytes', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'original\n' });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true);
    } finally {
        owner.close();
    }
    const record = join(directory.path, '.gspot/state/ownership.json');
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

test.each(['before', 'after'] as const)(
    'an interrupted batch recovers each published file and restores original bytes and permissions (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        await createFileTree(directory.path, Object.fromEntries(paths.map((path) => [path, `authored ${path}\n`])));
        for (const path of paths) chmodSync(join(directory.path, path), 0o640);
        const program = String.raw`
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
owner.applyProposals(${JSON.stringify(paths)}.map(path=>owner.proposeReplacement(path,{bytes:Buffer.from('installed '+path+'\n'),mode:0o444},'config',true)));
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
            expect(owner.installedPaths().sort()).toStrictEqual(
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
            expect(owner.installedPaths()).toStrictEqual([]);
        } finally {
            owner.close();
        }
    },
);

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
            expect(owner.installedPaths().sort()).toStrictEqual(
                point === 'before' ? ['last.txt', 'middle.txt'] : ['last.txt'],
            );
            expect(owner.read('last.txt')?.bytes.toString()).toBe('last.txt');
            owner.applyProposals(owner.installedPaths().map((path) => owner.proposeRestoration(path)));
            for (const path of paths) expect(owner.read(path)).toBeUndefined();
            expect(owner.installedPaths()).toStrictEqual([]);
        } finally {
            owner.close();
        }
    },
);

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
            if ((point === 'journal' && path === '.gspot/state/ownership.json') ||
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
        expect(JSON.parse(stdout)).toStrictEqual({ code: 'ENOSPC' });
        for (const name of ['first.bin', 'second.bin']) {
            expect(readFileSync(join(directory.path, name))).toStrictEqual(original);
            expect(statSync(join(directory.path, name)).mode & 0o777).toBe(originalMode);
        }
        expect(readOwnership(directory.path).files).toStrictEqual([]);
        const owner = openLifecycleOwner(directory.path);
        try {
            owner.applyProposals(
                ['first.bin', 'second.bin'].map((path) =>
                    owner.proposeReplacement(path, { bytes: Buffer.from('installed'), mode: 0o444 }, 'config', true),
                ),
            );
            owner.applyProposals(['first.bin', 'second.bin'].map((path) => owner.proposeRestoration(path)));
            for (const name of ['first.bin', 'second.bin']) {
                expect(readFileSync(join(directory.path, name))).toStrictEqual(original);
                expect(statSync(join(directory.path, name)).mode & 0o777).toBe(originalMode);
            }
        } finally {
            owner.close();
        }
    },
);
describe.skipIf(process.platform === 'win32')('lifecycle ownership', () => {
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
                expect(owner.paths()).toStrictEqual([]);
            } finally {
                owner.close();
            }
        },
    );

    test('unavailable recovery refuses takeover before modifying the original', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'config.txt': 'original\n',
            '.gspot/state/recovery': 'authored obstruction\n',
        });
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(() =>
                owner.replace('config.txt', { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config', true),
            ).toThrow();
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
            expect(readFileSync(join(directory.path, '.gspot/state/recovery'), 'utf8')).toBe('authored obstruction\n');
        } finally {
            owner.close();
        }
    });

    test.each(['before', 'after'] as const)(
        'an interrupted replacement %s publication recovers and releases its writer lock',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'original\n' });
            const script = String.raw`
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
            openLifecycleOwner(process.cwd()).replace('config.txt', {bytes: Buffer.from('installed\n'), mode: 420}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(73);
            const pending = ownershipSchema.parse(
                JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
            );
            expect(pending.pending?.[0]?.path).toBe('config.txt');
            const owner = openLifecycleOwner(directory.path);
            try {
                if (point === 'after') {
                    expect(owner.paths()).toStrictEqual(['config.txt']);
                    expect(owner.restore('config.txt')).toBe('changed');
                } else expect(owner.paths()).toStrictEqual([]);
                expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
                const recovered = ownershipSchema.parse(
                    JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
                );
                expect(recovered.pending).toBeUndefined();
            } finally {
                owner.close();
            }
        },
    );
});
