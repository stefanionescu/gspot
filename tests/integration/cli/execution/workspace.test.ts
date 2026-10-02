import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';

import {
    rmSync,
    mkdirSync,
    existsSync,
    readdirSync,
    symlinkSync,
    readFileSync,
    readlinkSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';

test('dependency copies let concurrent native process output drain', async () => {
    await using repository = await testdir();
    await createFileTree(
        repository.path,
        Object.fromEntries(
            Array.from({ length: 2048 }, (_, index) => [`node_modules/example/file-${String(index)}.json`, '{}']),
        ),
    );
    const producer = Bun.spawn(
        [
            process.execPath,
            '-e',
            'process.stdout.write("ready"); await Bun.stdin.text(); await Bun.write(Bun.stdout, Buffer.alloc(8 * 1024 * 1024, 97));',
        ],
        { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
    );
    const reader = producer.stdout.getReader();
    const ready = await reader.read();
    expect(new TextDecoder().decode(ready.value)).toBe('ready');
    reader.releaseLock();
    let drained = false;
    const output = Array.fromAsync(producer.stdout).then((chunks) => {
        drained = true;
        return Buffer.concat(chunks);
    });
    const closed = producer.stdin.end();
    const scratch = await scratchCopy(repository.path, [], ['']);
    try {
        expect(drained).toBe(true);
        expect(await producer.exited).toBe(0);
        expect(Buffer.from(await output).equals(Buffer.alloc(8 * 1024 * 1024, 97))).toBe(true);
        expect(readdirSync(join(scratch, 'node_modules/example'))).toHaveLength(2048);
    } finally {
        producer.kill();
        await closed;
        await output;
        await producer.exited;
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('preview copies workspace dependencies and preserves executable links without writing through either', async () => {
    await using repository = await testdir();
    await using external = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': policyOf([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/bin/tool.js': 'console.log(require("../lib/value.cjs"));',
        'node_modules/tool/lib/value.cjs': 'module.exports = "tool works";',
    });
    await createFileTree(external.path, { 'value.js': 'external original' });
    mkdirSync(join(repository.path, 'node_modules/.bin'));
    symlinkSync('../tool/bin/tool.js', join(repository.path, 'node_modules/.bin/tool'));
    symlinkSync('../packages/core', join(repository.path, 'node_modules/core'));
    symlinkSync(external.path, join(repository.path, 'node_modules/external'));
    const session = await openSession(repository.path);
    const scratch = await scratchCopy(
        session.root,
        ['packages/core/value.js'],
        session.repository.scopes.map((scope) => scope.path),
    );
    try {
        const result = Bun.spawnSync(['node', 'node_modules/.bin/tool'], {
            cwd: scratch,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(result.stdout.toString().trim()).toBe('tool works');
        writeFileSync(join(scratch, 'node_modules/core/value.js'), 'preview edit');
        writeFileSync(join(scratch, 'node_modules/external/value.js'), 'external preview edit');
        expect(readFileSync(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe(
            'export default "original";',
        );
        expect(readFileSync(join(external.path, 'value.js'), 'utf8')).toBe('external original');
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
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
    mkdirSync(join(repository.path, 'tests/node_modules'));
    symlinkSync('../../node_modules/.bun/vue@3/node_modules/vue', join(repository.path, 'tests/node_modules/vue'));
    const paths = ['package.json', 'tests/package.json', 'tests/app.js', '.gspot/package.json'];
    const scratch = await scratchCopy(repository.path, paths, ['']);
    try {
        expect(readFileSync(join(scratch, 'tests/node_modules/vue/package.json'), 'utf8')).toBe('{"name":"vue"}');
        // The private tools of gspot run in place and stay out of the copy.
        expect(existsSync(join(scratch, '.gspot/node_modules'))).toBe(false);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('a link into another linked tree points at the copy of that tree, whatever order the folder lists them in', async () => {
    await using repository = await testdir();
    await using store = await testdir();
    await createFileTree(store.path, {
        'next@16/node_modules/next/package.json': '{"name":"next"}',
        'next@16/node_modules/helpers/package.json': '{"name":"helpers"}',
    });
    await createFileTree(repository.path, { 'package.json': '{"private":true}' });
    mkdirSync(join(repository.path, 'node_modules'));
    symlinkSync(join(store.path, 'next@16/node_modules/next'), join(repository.path, 'node_modules/beta'), 'dir');
    symlinkSync(store.path, join(repository.path, 'node_modules/alpha'), 'dir');
    const scratch = await scratchCopy(repository.path, ['package.json'], ['']);
    try {
        const copied = realpathSync(join(scratch, 'node_modules/beta'));
        expect(copied.startsWith(realpathSync(join(scratch, 'node_modules/alpha')))).toBe(true);
        expect(existsSync(join(copied, '../helpers/package.json'))).toBe(true);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('a link that points at nothing is copied as it is', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'package.json': '{"private":true}',
        'node_modules/.bin/tool': '#!/bin/sh\n',
    });
    symlinkSync('../missing/bin/gspot', join(repository.path, 'node_modules/.bin/gspot'));
    const scratch = await scratchCopy(repository.path, ['package.json'], ['']);
    try {
        // Windows stores a link target with backslashes, so the comparison reads it with forward slashes.
        expect(toPosix(readlinkSync(join(scratch, 'node_modules/.bin/gspot')))).toBe('../missing/bin/gspot');
        expect(readFileSync(join(scratch, 'node_modules/.bin/tool'), 'utf8')).toBe('#!/bin/sh\n');
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});
