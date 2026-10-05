// A child process runs one log call and exits at middle.txt, either just before its file operation or just after.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runTestCommand } from '#tests/harness/command.ts';
import { getCliSourcePath } from '#tests/harness/process.ts';
import { applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';

const implementation = getCliSourcePath('lifecycle/ownership/log.ts');
const boundary = getCliSourcePath('platform/root/open.ts');

async function interrupted(
    cwd: string,
    operation: 'write' | 'remove',
    point: 'before' | 'after',
    call: string,
): Promise<void> {
    const program = `
import { mock } from 'bun:test';
const boundary=await import(${JSON.stringify(boundary)});
const open=boundary.openRoot;
mock.module(${JSON.stringify(boundary)},()=>({...boundary,openRoot(root){
const files=open(root);
return {...files,${operation}(path,...rest){
if(path==='middle.txt' && ${JSON.stringify(point)}==='before') process.exit(73);
files.${operation}(path,...rest);
if(path==='middle.txt' && ${JSON.stringify(point)}==='after') process.exit(73);
}};
}}));
const {openOwnership}=await import(${JSON.stringify(implementation)});
const {proposeReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/plans.ts'))});
const {applyPlans}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/commit.ts'))});
const {proposeRestoration}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/restoration.ts'))});
const log=openOwnership(process.cwd());
${call}
log[Symbol.dispose]();
`;
    const child = await runTestCommand([process.execPath, '-e', program], { cwd });
    expect(child.code, child.stdout + child.stderr).toBe(73);
}

test.each(['before', 'after'] as const)(
    'an interrupted batch keeps each published file, and the next batch finishes it (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        await createFileTree(directory.path, Object.fromEntries(paths.map((path) => [path, `authored ${path}\n`])));
        await interrupted(
            directory.path,
            'write',
            point,
            String.raw`applyPlans(log, ${JSON.stringify(paths)}.map(path=>proposeReplacement(log,{path: path, next: {bytes:Buffer.from('installed '+path+'\n'),mode:0o444}, kind: 'config', canReplace: true})));`,
        );
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('installed first.txt\n');
        expect(readFileSync(join(directory.path, 'middle.txt'), 'utf8')).toBe(
            `${point === 'before' ? 'authored' : 'installed'} middle.txt\n`,
        );
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored last.txt\n');
        {
            using log = openOwnership(directory.path);

            expect(
                log.state.files.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right)),
            ).toStrictEqual(point === 'before' ? ['first.txt'] : ['first.txt', 'middle.txt']);
            applyPlans(
                log,
                paths.map((path) =>
                    proposeReplacement(log, {
                        path: path,
                        next: { bytes: Buffer.from(`installed ${path}\n`), mode: 0o444 },
                        kind: 'config',
                        canReplace: true,
                    }),
                ),
            );
            for (const path of paths)
                expect(readFileSync(join(directory.path, path), 'utf8')).toBe(`installed ${path}\n`);
            expect(log.state.files.map((entry) => entry.path)).toHaveLength(paths.length);
        }
    },
);

test.each(['before', 'after'] as const)(
    'interrupted batch removal recovers published deletions and retains unprocessed ownership (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        {
            using initial = openOwnership(directory.path);

            applyPlans(
                initial,
                paths.map((path) =>
                    proposeReplacement(initial, {
                        path: path,
                        next: { bytes: Buffer.from(path), mode: 0o644 },
                        kind: 'config',
                    }),
                ),
            );
        }
        await interrupted(
            directory.path,
            'remove',
            point,
            `applyPlans(log, ${JSON.stringify(paths)}.map(path=>proposeRestoration(log, path)));`,
        );
        {
            using log = openOwnership(directory.path);

            expect(log.files.read('first.txt')).toBeUndefined();
            expect(
                log.state.files.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right)),
            ).toStrictEqual(point === 'before' ? ['last.txt', 'middle.txt'] : ['last.txt']);
            expect(log.files.read('last.txt')?.bytes.toString()).toBe('last.txt');
            applyPlans(
                log,
                log.state.files.map((entry) => entry.path).map((path) => proposeRestoration(log, path)),
            );
            for (const path of paths) expect(log.files.read(path)).toBeUndefined();
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        }
    },
);
