// Publishes a read-only file through a child whose rename fails at the chosen point, with Windows semantics.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { getCliSourcePath } from '#tests/harness/process.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { planReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { ownershipSchema } from '#cli/lifecycle/ownership/schema.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { PublicationProject } from '#tests/types/cli/lifecycle/ownership.ts';
import { runTestCommand, runTestCommandBlocking } from '#tests/harness/command.ts';

const implementation = getCliSourcePath('lifecycle/ownership/log.ts');
const boundary = getCliSourcePath('platform/root/open.ts');

async function publish(point: 'error' | 'restoration error' | 'interruption' | 'edited'): Promise<PublicationProject> {
    const directory = await testdir();
    const original = Buffer.from([0, 255, 10, 13]);
    const destination = join(directory.path, 'config.txt');
    await writeFile(destination, original, { mode: 0o444 });
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
        if (point === 'restoration error' && failed) throw new Error('Restoration failed');
        if (exists(to) && (stat(to).mode & 0o200) === 0)
            throw Object.assign(new Error('Read-only destination'), {code: 'EPERM'});
        if (read(from).equals(Buffer.from('installed\n'))) {
            if (point === 'interruption') process.exit(73);
            if (point === 'edited') { write(to, 'developer edit\n'); process.exit(73); }
            if ((point === 'error' || point === 'restoration error') && !failed) { failed = true; throw new Error('Publication failed'); }
        }
    }
    rename(from, to);
} }));
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openOwnership} = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/plans.ts'))});
const {applyPlan,applyPlans}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/commit.ts'))});
const log = openOwnership(process.cwd());
try {
    applyPlan(log, planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed\n'), mode: 0o444}, kind: 'tool_file', canReplace: true}));
    throw new Error('Expected publication failure');
} catch (error) {
    if (point === 'restoration error') {
        if (!(error instanceof AggregateError) || error.errors.map(entry => entry.message).join(',') !== 'Publication failed,Restoration failed') throw error;
    } else if (point !== 'error' || error.message !== 'Publication failed') throw error;
} finally { log[Symbol.dispose](); }
`;
    const child = runTestCommandBlocking([process.execPath, '-e', program], { cwd: directory.path });
    expect(child.code, child.stdout + child.stderr).toBe(['error', 'restoration error'].includes(point) ? 0 : 73);
    return { directory, original, destination };
}

test('a failed read-only replacement keeps the original bytes and mode with Windows semantics', async () => {
    const published = await publish('error');
    await using directory = published.directory;
    {
        using log = openOwnership(directory.path);

        expect(await readFile(published.destination)).toStrictEqual(published.original);
        const publishedMetadata = await stat(published.destination);
        expect(publishedMetadata.mode & 0o777).toBe(getKeptMode(0o444));
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test.each(['interruption', 'restoration error'] as const)(
    'after %s, a read-only replacement removed on Windows counts as not written, and the next write publishes it',
    async (point) => {
        const published = await publish(point);
        await using directory = published.directory;
        {
            using log = openOwnership(directory.path);

            expect(log.files.read('config.txt')).toBeUndefined();
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            expect(
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('installed\n'), mode: 0o444 },
                        kind: 'tool_file',
                    }),
                ),
            ).toBe('changed');
        }
    },
);

test('a file edited during an interrupted replacement is kept, and recovery refuses to overwrite it', async () => {
    const published = await publish('edited');
    await using directory = published.directory;
    expect(() => openOwnership(directory.path)).toThrow(
        'A previous gspot run stopped while writing config.txt, and the file changed since then.',
    );
    expect(await readFile(published.destination, 'utf8')).toBe('developer edit\n');
});

test('an inconsistent interrupted log cannot acquire ownership of current bytes', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'original\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            planReplacement(log, {
                path: 'config.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'tool_file',
                canReplace: true,
            }),
        );
    }
    const record = join(directory.path, '.gspot/state/ownership.json');
    const state = ownershipSchema.parse(JSON.parse(await readFile(record, 'utf8')));
    const entry = state.files[0]!;
    state.pending = [
        {
            path: entry.path,
            after: entry.installed!,
            entry: { ...entry, installed: { hash: 'f'.repeat(64) } },
        },
    ];
    const inconsistent = JSON.stringify(state);
    await writeFile(record, inconsistent);
    expect(() => openOwnership(directory.path)).toThrow('different installed identity');
    expect(await readFile(join(directory.path, 'config.txt'), 'utf8')).toBe('installed\n');
    expect(await readFile(record, 'utf8')).toBe(inconsistent);
});

test('a full disk while logging a batch keeps every file and permits a corrected batch', async () => {
    await using directory = await testdir();
    const original = Buffer.from([0, 255, 10, 13, 42]);
    for (const name of ['first.bin', 'second.bin'])
        await writeFile(join(directory.path, name), original, { mode: 0o444 });
    const originalMetadata = await stat(join(directory.path, 'first.bin'));
    const originalMode = originalMetadata.mode & 0o777;
    const program = `
import { mock } from 'bun:test';
const boundary = await import(${JSON.stringify(boundary)});
const open = boundary.openRoot;
mock.module(${JSON.stringify(boundary)}, () => ({
    ...boundary,
    openRoot(root) {
        const files = open(root);
        return { ...files, write(path, next, expected) {
            if (path === '.gspot/state/ownership.json')
                throw Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
            files.write(path, next, expected);
        }};
    }
}));
const { openOwnership } = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/plans.ts'))});
const {applyPlan,applyPlans}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/commit.ts'))});
const log = openOwnership(${JSON.stringify(directory.path)});
try {
    applyPlans(log, ['first.bin', 'second.bin'].map(path => planReplacement(log,{path: path, next: { bytes: Buffer.from('installed'), mode: 0o444 }, kind: 'tool_file', canReplace: true})));
} catch (error) {
    console.log(JSON.stringify({ code: error.code }));
} finally { log[Symbol.dispose](); }
`;
    const { stdout, stderr, code } = await runTestCommand([process.execPath, '-e', program], { cwd: directory.path });
    expect(code, stderr).toBe(0);
    expect(JSON.parse(stdout)).toStrictEqual({ code: 'ENOSPC' });
    for (const name of ['first.bin', 'second.bin']) {
        expect(await readFile(join(directory.path, name))).toStrictEqual(original);
        const restoredMetadata = await stat(join(directory.path, name));
        expect(restoredMetadata.mode & 0o777).toBe(originalMode);
    }
    expect(getOwnership(directory.path).files).toStrictEqual([]);
    {
        using log = openOwnership(directory.path);

        const plans = ['first.bin', 'second.bin'].map((path) =>
            planReplacement(log, {
                path: path,
                next: { bytes: Buffer.from('installed'), mode: 0o444 },
                kind: 'tool_file',
                canReplace: true,
            }),
        );
        expect(applyPlans(log, plans)).toStrictEqual(['changed', 'changed']);
        expect(await readFile(join(directory.path, 'first.bin'), 'utf8')).toBe('installed');
    }
});
