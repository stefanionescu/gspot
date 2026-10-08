import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { prepareTestCommand, runTestCommandBlocking } from '#tests/harness/command.ts';
import { mkdir, readdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';
import { copyIntoScratch, checkOutRevision, projectCopyInputs } from '#cli/execution/copy/public.ts';

test('dependency copies let concurrent native process output drain', async () => {
    await using repository = await testdir();
    await createFileTree(
        repository.path,
        Object.fromEntries(
            Array.from({ length: 2048 }, (_, index) => [`node_modules/example/file-${String(index)}.json`, '{}']),
        ),
    );
    const command = [
        process.execPath,
        '-e',
        'process.stdout.write("ready"); await Bun.stdin.text(); await Bun.write(Bun.stdout, Buffer.alloc(8 * 1024 * 1024, 97));',
    ];
    const prepared = prepareTestCommand(command, { cwd: repository.path }, 'concurrent dependency-copy output');
    await using producer = Bun.spawn(command, {
        cwd: repository.path,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
    });
    const reader = producer.stdout.getReader();
    const ready = await reader.read();
    expect(new TextDecoder().decode(ready.value)).toBe('ready');
    reader.releaseLock();
    const output = Array.fromAsync(producer.stdout).then((chunks) => Buffer.concat(chunks));
    const closed = producer.stdin.end();
    using copy = await copyIntoScratch(projectCopyInputs(repository.path, [], ['']));
    try {
        expect(await producer.exited).toBe(0);
        expect(Buffer.from(await output).equals(Buffer.alloc(8 * 1024 * 1024, 97))).toBe(true);
        expect(await readdir(join(copy.path, 'node_modules/example'))).toHaveLength(2048);
    } finally {
        producer.kill();
        await closed;
        await output;
        await producer.exited;
    }
});

test('preview copies workspace dependencies and preserves executable links without writing through either', async () => {
    await using repository = await testdir();
    await using external = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/bin/tool.js': 'console.log(require("../lib/value.cjs"));',
        'node_modules/tool/lib/value.cjs': 'module.exports = "tool works";',
    });
    await createFileTree(external.path, { 'value.js': 'external original' });
    await mkdir(join(repository.path, 'node_modules/.bin'));
    await symlink('../tool/bin/tool.js', join(repository.path, 'node_modules/.bin/tool'));
    await symlink('../packages/core', join(repository.path, 'node_modules/core'));
    await symlink(external.path, join(repository.path, 'node_modules/external'));
    const session = await openSession(repository.path);
    using copy = await copyIntoScratch(
        projectCopyInputs(
            session.root,
            ['packages/core/value.js'],
            session.repository.scopes.map((scope) => scope.path),
        ),
    );
    const scratch = copy.path;
    const result = runTestCommandBlocking(['node', 'node_modules/.bin/tool'], { cwd: scratch });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('tool works');
    await writeFile(join(scratch, 'node_modules/core/value.js'), 'preview edit');
    await writeFile(join(scratch, 'node_modules/external/value.js'), 'external preview edit');
    expect(await readFile(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe('export default "original";');
    expect(await readFile(join(external.path, 'value.js'), 'utf8')).toBe('external original');
});

test('a workspace member that is no scope brings its own dependency store into the copy', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'package.json': '{"private":true,"workspaces":["tests"]}',
        'tests/package.json': '{"name":"tests"}',
        'tests/app.js': 'import "vue";',
        'node_modules/.bun/vue@3/node_modules/vue/package.json': '{"name":"vue"}',
        '.gspot/package.json': '{"private":true}',
        '.gspot/node_modules/prettier/package.json': '{"name":"prettier"}',
    });
    await mkdir(join(repository.path, 'tests/node_modules'));
    await symlink('../../node_modules/.bun/vue@3/node_modules/vue', join(repository.path, 'tests/node_modules/vue'));
    const paths = ['package.json', 'tests/package.json', 'tests/app.js', '.gspot/package.json'];
    using copy = await copyIntoScratch(projectCopyInputs(repository.path, paths, ['']));
    const scratch = copy.path;
    expect(await readFile(join(scratch, 'tests/node_modules/vue/package.json'), 'utf8')).toBe('{"name":"vue"}');
    // The private tools of gspot run in place and stay out of the copy.
    expect(await pathExists(join(scratch, '.gspot/node_modules'))).toBe(false);
});

test('a link into another linked tree points at the copy of that tree, whatever order the folder lists them in', async () => {
    await using repository = await testdir();
    await using store = await testdir();
    await createFileTree(store.path, {
        'next@16/node_modules/next/package.json': '{"name":"next"}',
        'next@16/node_modules/helpers/package.json': '{"name":"helpers"}',
    });
    await createFileTree(repository.path, { 'package.json': '{"private":true}' });
    await mkdir(join(repository.path, 'node_modules'));
    await symlink(join(store.path, 'next@16/node_modules/next'), join(repository.path, 'node_modules/a-next'), 'dir');
    await symlink(store.path, join(repository.path, 'node_modules/z-store'), 'dir');
    using copy = await copyIntoScratch(projectCopyInputs(repository.path, ['package.json'], ['']));
    const scratch = copy.path;
    const copied = await realpath(join(scratch, 'node_modules/a-next'));
    expect(copied.startsWith(await realpath(join(scratch, 'node_modules/z-store')))).toBe(true);
    expect(await pathExists(join(copied, '../helpers/package.json'))).toBe(true);
});

test('a dependency link that points at nothing refuses the copy', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'package.json': '{"private":true}',
        'node_modules/.bin/tool': '#!/bin/sh\n',
    });
    await symlink('../missing/bin/gspot', join(repository.path, 'node_modules/.bin/gspot'));
    await rejects(copyIntoScratch(projectCopyInputs(repository.path, ['package.json'], [''])), { code: 'ENOENT' });
    expect(await readFile(join(repository.path, 'node_modules/.bin/tool'), 'utf8')).toBe('#!/bin/sh\n');
});

test('a source snapshot retains selected binary/config inputs and excludes sibling files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'unrelated/private.txt': 'Sibling input\n',
    });
    using copy = await copyIntoScratch(
        projectCopyInputs(
            sandbox.path,
            ['apps/web/value.test.js', 'apps/web/fixture.bin', 'apps/web/jest.config.json'],
            ['apps/web'],
        ),
    );
    const scratch = copy.path;
    expect(await pathExists(join(scratch, 'apps/web/fixture.bin'))).toBe(true);
    expect(await pathExists(join(scratch, 'apps/web/jest.config.json'))).toBe(true);
    expect(await pathExists(join(scratch, 'unrelated/private.txt'))).toBe(false);
    expect(await pathExists(join(scratch, 'README.md'))).toBe(false);
});

test.each([false, true])(
    'check-input copies retain selected dependencies and optional extra file %s',
    async (extra) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': buildPolicy(['javascript']),
            'selected.js': 'export const selected = 1;',
            'unselected.js': 'export const unselected = 2;',
            'document.json': '{"value":3}',
            'node_modules/tool/value.js': 'export const dependency = 4;',
        });
        const session = await openSession(repository.path);
        const input = buildCheckInput(session, 'javascript/tsc', { paths: ['selected.js'] });
        using copy = await copyIntoScratch(input, extra ? ['document.json'] : undefined);
        expect(await readFile(join(copy.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
        expect(await readFile(join(copy.path, 'node_modules/tool/value.js'), 'utf8')).toBe(
            'export const dependency = 4;',
        );
        expect(await pathExists(join(copy.path, 'unselected.js'))).toBe(false);
        expect(await pathExists(join(copy.path, 'document.json'))).toBe(extra);
        if (extra) expect(await readFile(join(copy.path, 'document.json'), 'utf8')).toBe('{"value":3}');
        await writeFile(join(copy.path, 'selected.js'), 'changed in private copy');
        expect(await readFile(join(repository.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
    },
);

test.each([false, true])(
    'workspace dependency copies preserve named transitive sources and isolate revision=%s',
    async (revision) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[scope."apps/web"]\nconfigurations = ["javascript"]\n',
            }),
            'package.json':
                '{"private":true,"workspaces":["apps/*","packages/*"],"dependencies":{"unused":"workspace:*"}}',
            'bun.lock': '{}',
            '.gitignore': 'node_modules/\ndist/\n',
            'apps/web/package.json': '{"name":"web","dependencies":{"core":"workspace:*"}}',
            'apps/web/main.js': 'import {value} from "core"; console.log(value);',
            'packages/core/package.json':
                '{"name":"core","type":"module","main":"value.js","dependencies":{"utility":"workspace:*"}}',
            'packages/core/value.js': 'import {suffix} from "utility"; export const value = "staged" + suffix;',
            'packages/utility/package.json':
                '{"name":"utility","type":"module","main":"value.js","dependencies":{"core":"workspace:*"}}',
            'packages/utility/value.js': 'export const suffix = " dependency";',
            'packages/unused/package.json': '{"name":"unused","type":"module"}',
            'packages/unused/private.txt': 'Unselected workspace bytes',
        });
        await mkdir(join(repository.path, 'node_modules'));
        for (const name of ['core', 'utility', 'unused'])
            await symlink(`../packages/${name}`, join(repository.path, 'node_modules', name));
        if (revision) {
            gitOutput(repository.path, ['init']);
            gitOutput(repository.path, ['add', '.']);
            await writeFile(join(repository.path, 'packages/core/value.js'), 'export const value = "unstaged";');
            await writeFile(join(repository.path, 'packages/core/untracked.js'), 'private working bytes');
        }
        const inspect = async (root: string) => {
            const session = await openSession(root);
            const input = buildCheckInput(session, 'javascript/eslint', {
                scope: 'apps/web',
                paths: ['apps/web/main.js'],
            });
            const dependencyPaths = input.dependencyFiles();
            expect(new Set(dependencyPaths).size).toBe(dependencyPaths.length);
            expect(dependencyPaths).toContain('packages/core/value.js');
            expect(dependencyPaths).toContain('packages/utility/value.js');
            expect(dependencyPaths).not.toContain('packages/unused/private.txt');
            expect(input.files.map((file) => file.path)).toStrictEqual(['apps/web/main.js']);
            using copy = await copyIntoScratch(input);
            const output = runTestCommandBlocking([process.execPath, 'apps/web/main.js'], { cwd: copy.path });
            expect(output.code, output.stderr).toBe(0);
            expect(output.stdout.trim()).toBe('staged dependency');
            expect(await pathExists(join(copy.path, 'packages/unused/private.txt'))).toBe(false);
            expect(await pathExists(join(copy.path, 'packages/core/untracked.js'))).toBe(false);
            await writeFile(join(copy.path, 'packages/core/value.js'), 'private copy change');
        };
        await (revision ? checkOutRevision(repository.path, { kind: 'index' }, inspect) : inspect(repository.path));
        expect(await readFile(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe(
            revision
                ? 'export const value = "unstaged";'
                : 'import {suffix} from "utility"; export const value = "staged" + suffix;',
        );
    },
);
