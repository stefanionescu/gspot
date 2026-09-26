import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { cliSource } from '#tests/support/cli/process.ts';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';

const implementation = cliSource('lifecycle/ownership.ts');
const boundary = cliSource('platform/filesystem.ts');

type Point = 'success' | 'error' | 'interruption' | 'edited' | 'damaged backup';

// Publishes a read-only file through a child whose rename fails at the chosen point, with Windows semantics.
async function publish(point: Point) {
    const directory = await testdir();
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
    return { directory, original, destination, backup: state.pending?.[0]?.beforeBackup?.backup };
}

type Published = Awaited<ReturnType<typeof publish>>;

// What recovery leaves behind: the file's bytes and mode, and what the owner still records as installed.
function recovered(owner: ReturnType<typeof openLifecycleOwner>, { destination }: Published) {
    return {
        bytes: readFileSync(destination),
        mode: statSync(destination).mode & 0o777,
        installed: owner.installedPaths(),
    };
}

test('a completed read-only replacement restores the original bytes on request with Windows semantics', async () => {
    const published = await publish('success');
    await using directory = published.directory;
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(owner.restore('config.txt')).toBe('changed');
        expect(recovered(owner, published)).toStrictEqual({ bytes: published.original, mode: 0o444, installed: [] });
    } finally {
        owner.close();
    }
});

test.each(['error', 'interruption'] as const)(
    'read-only replacement recovers the original bytes after %s with Windows semantics',
    async (point) => {
        const published = await publish(point);
        await using directory = published.directory;
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(recovered(owner, published)).toStrictEqual({
                bytes: published.original,
                mode: 0o444,
                installed: [],
            });
        } finally {
            owner.close();
        }
    },
);

test('a damaged backup refuses recovery until the backup is put back', async () => {
    const published = await publish('damaged backup');
    await using directory = published.directory;
    const backup = join(directory.path, published.backup!);
    writeFileSync(backup, 'damaged');
    expect(() => openLifecycleOwner(directory.path)).toThrow('backup is missing or changed');
    expect(() => readFileSync(published.destination)).toThrow();
    writeFileSync(backup, published.original);
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(recovered(owner, published)).toStrictEqual({ bytes: published.original, mode: 0o444, installed: [] });
    } finally {
        owner.close();
    }
});

test('a file edited during an interrupted replacement is kept, and recovery refuses to overwrite it', async () => {
    const published = await publish('edited');
    await using directory = published.directory;
    expect(() => openLifecycleOwner(directory.path)).toThrow('conflicts with edited');
    expect(readFileSync(published.destination, 'utf8')).toBe('developer edit\n');
    expect(readFileSync(join(directory.path, published.backup!))).toStrictEqual(published.original);
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
