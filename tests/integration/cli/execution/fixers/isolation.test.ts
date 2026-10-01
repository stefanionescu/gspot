import * as os from 'node:os';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { runFixer, applyFixers } from '#cli/execution/fixers.ts';
import { rejection, textContaining } from '#tests/support/expectations.ts';
import { CORRECTION_POLICY, plannedCorrection } from '#tests/support/cli/correction.ts';

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

test.each([false, true].flatMap((preview) => [false, true].map((isolated) => ({ preview, isolated }))))(
    'corrections reject a replaced external source before execution (preview $preview, isolated $isolated)',
    async ({ preview, isolated }) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
        await createFileTree(external.path, { 'source.txt': 'external original' });
        const session = await openSession(sandbox.path);
        const planned = plannedCorrection(session, "await Bun.write('source.txt', 'changed')");
        planned.spec.isolated_files = isolated;
        rmSync(join(sandbox.path, 'source.txt'));
        symlinkSync(join(external.path, 'source.txt'), join(sandbox.path, 'source.txt'));
        expect(await rejection(applyFixers(session, [planned], preview))).toContain(
            'Source link leaves the repository',
        );
        expect(readFileSync(join(external.path, 'source.txt'), 'utf8')).toBe('external original');
        rmSync(join(sandbox.path, 'source.txt'));
        writeFileSync(join(sandbox.path, 'source.txt'), 'original');
        const corrected = await applyFixers(session, [planned], preview);
        expect(corrected.changed).toStrictEqual(['source.txt']);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'changed');
    },
);
test.each([false, true])(
    'isolated corrections publish selected bytes and remove their workspace (preview %s)',
    async (preview) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': CORRECTION_POLICY,
            'source.txt': 'original',
            'unowned.json': '{}',
        });
        const session = await openSession(sandbox.path);
        const trace = join(sandbox.path, 'workspace-path');
        const planned = plannedCorrection(
            session,
            `
            if (require('node:fs').existsSync('unowned.json')) throw new Error('Unowned configuration was copied.');
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write('source.txt', 'corrected');
            process.exitCode = 3;
        `,
        );
        planned.spec.isolated_files = true;
        planned.spec.fix_findings_exit_codes = [3];
        const result = await applyFixers(session, [planned], preview);
        expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'corrected');
        expect(readFileSync(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
        expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
        // A preview shows the correction as a diff instead of writing it.
        const expectedDiff = textContaining('+corrected');
        expect(result.diffs).toStrictEqual(preview ? [expectedDiff] : []);
    },
);

test('isolated correction refuses to overwrite source changed during execution and cleans up', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': CORRECTION_POLICY.replace('paths = ["source.txt"]', 'paths = ["*.txt"]'),
        'source.txt': 'original',
        'z-last.txt': 'last original',
    });
    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = plannedCorrection(
        session,
        `
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write(${JSON.stringify(join(sandbox.path, 'z-last.txt'))}, 'new working content');
            await Bun.write('source.txt', 'isolated correction');
            await Bun.write('z-last.txt', 'last correction');
        `,
    );
    planned.spec.isolated_files = true;
    expect(await rejection(runFixer(session, planned, sandbox.path))).toContain(
        'z-last.txt changed while its correction was running',
    );
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(readFileSync(join(sandbox.path, 'z-last.txt'), 'utf8')).toBe('new working content');
    expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
    const corrected = plannedCorrection(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.isolated_files = true;
    expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(
        session,
        "await Bun.write('source.txt', 'partial'); process.stdout.write(process.cwd()); process.exitCode = 3",
    );
    const report = await applyFixers(session, [planned], true);
    const result = report.results[0];
    expect(result?.status).toBe('failed');
    if (result?.status !== 'failed') throw new Error('The correction did not report its failure.');
    const scratch = result.note.slice(result.note.indexOf(': ') + 2);
    expect(scratch).toContain('gspot-fix-');
    expect(existsSync(scratch)).toBe(false);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(report.changed).toStrictEqual(['source.txt']);
    expect(report.diffs.join('\n')).toContain('+partial');
});

test.each(['copy', 'read'])('cleans the scratch directory after a failed %s', async (operation) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(
        session,
        "const fs = require('node:fs'); fs.unlinkSync('source.txt'); fs.mkdirSync('source.txt');",
    );
    if (operation === 'copy') {
        rmSync(join(sandbox.path, 'source.txt'));
        mkdirSync(join(sandbox.path, 'source.txt'));
    }
    const temporary = join(sandbox.path, 'scratch');
    mkdirSync(temporary);
    const temporaryDirectory = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    try {
        let failure: unknown;
        try {
            await applyFixers(session, [planned], true);
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(readdirSync(temporary)).toStrictEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
    // A failed read leaves the source untouched; a failed copy had already replaced it with a directory.
    expect(operation !== 'read' || readFileSync(join(sandbox.path, 'source.txt'), 'utf8') === 'original').toBe(true);
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
