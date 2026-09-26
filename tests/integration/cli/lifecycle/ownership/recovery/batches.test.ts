import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { cliSource } from '#tests/support/cli/sources.ts';
import { chmodSync, readFileSync, statSync } from 'node:fs';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';

const implementation = cliSource('lifecycle/ownership.ts');
const boundary = cliSource('platform/filesystem.ts');

test.each(['before', 'after'] as const)(
    'an interrupted batch recovers each published file and restores original bytes and permissions (%s)',
    async (point) => {
        await using directory = await testdir();
        const paths = ['first.txt', 'middle.txt', 'last.txt'];
        await createFileTree(directory.path, Object.fromEntries(paths.map((path) => [path, `authored ${path}\n`])));
        for (const path of paths) chmodSync(join(directory.path, path), 0o640);
        const program = String.raw`
import { mock } from 'bun:test';
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
            expect(owner.installedPaths().toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
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
import { mock } from 'bun:test';
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
            expect(owner.installedPaths().toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
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
