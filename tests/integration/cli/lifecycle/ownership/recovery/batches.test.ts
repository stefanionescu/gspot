import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cliSource } from '#tests/harness/cli/process.ts';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';

const implementation = cliSource('lifecycle/ownership/owner.ts');
const boundary = cliSource('platform/filesystem.ts');

// A child process runs one owner call and exits at middle.txt, either just before its file operation or just after.
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
const {openOwner}=await import(${JSON.stringify(implementation)});
const owner=openOwner(process.cwd());
${call}
owner.close();
`;
    const child = Bun.spawn([process.execPath, '-e', program], { cwd, stdout: 'pipe', stderr: 'pipe' });
    const streams = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(await child.exited, streams.join('\n')).toBe(73);
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
            String.raw`owner.applyPlans(${JSON.stringify(paths)}.map(path=>owner.proposeReplacement(path,{bytes:Buffer.from('installed '+path+'\n'),mode:0o444},'config',true)));`,
        );
        expect(readFileSync(join(directory.path, 'first.txt'), 'utf8')).toBe('installed first.txt\n');
        expect(readFileSync(join(directory.path, 'middle.txt'), 'utf8')).toBe(
            `${point === 'before' ? 'authored' : 'installed'} middle.txt\n`,
        );
        expect(readFileSync(join(directory.path, 'last.txt'), 'utf8')).toBe('authored last.txt\n');
        const owner = openOwner(directory.path);
        try {
            expect(owner.installedPaths().toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
                point === 'before' ? ['first.txt'] : ['first.txt', 'middle.txt'],
            );
            owner.applyPlans(
                paths.map((path) =>
                    owner.proposeReplacement(
                        path,
                        { bytes: Buffer.from(`installed ${path}\n`), mode: 0o444 },
                        'config',
                        true,
                    ),
                ),
            );
            for (const path of paths)
                expect(readFileSync(join(directory.path, path), 'utf8')).toBe(`installed ${path}\n`);
            expect(owner.installedPaths()).toHaveLength(paths.length);
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
        const initial = openOwner(directory.path);
        try {
            initial.applyPlans(
                paths.map((path) =>
                    initial.proposeReplacement(path, { bytes: Buffer.from(path), mode: 0o644 }, 'config'),
                ),
            );
        } finally {
            initial.close();
        }
        await interrupted(
            directory.path,
            'remove',
            point,
            `owner.applyPlans(${JSON.stringify(paths)}.map(path=>owner.proposeRestoration(path)));`,
        );
        const owner = openOwner(directory.path);
        try {
            expect(owner.read('first.txt')).toBeUndefined();
            expect(owner.installedPaths().toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
                point === 'before' ? ['last.txt', 'middle.txt'] : ['last.txt'],
            );
            expect(owner.read('last.txt')?.bytes.toString()).toBe('last.txt');
            owner.applyPlans(owner.installedPaths().map((path) => owner.proposeRestoration(path)));
            for (const path of paths) expect(owner.read(path)).toBeUndefined();
            expect(owner.installedPaths()).toStrictEqual([]);
        } finally {
            owner.close();
        }
    },
);
