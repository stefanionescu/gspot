import * as os from 'node:os';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { applyFixers } from '#cli/execution/fixers.ts';
import { openSession } from '#cli/commands/session.ts';
import { waitForExit, waitForFile } from '#tests/harness/process.ts';
import { planFixer, buildFixerPolicy } from '#tests/harness/fixer.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { rmSync, mkdirSync, existsSync, readdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test.each([
    { preview: false, isolated: false },
    { preview: true, isolated: true },
])(
    'corrections reject a replaced external source before execution (preview $preview, isolated $isolated)',
    async ({ preview, isolated }) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
        await createFileTree(external.path, { 'source.txt': 'external original' });
        const session = await openSession(sandbox.path);
        const planned = planFixer(session, "await Bun.write('source.txt', 'changed')");
        planned.spec.run_in_copy = isolated;
        rmSync(join(sandbox.path, 'source.txt'));
        symlinkSync(join(external.path, 'source.txt'), join(sandbox.path, 'source.txt'));
        expect(await rejection(applyFixers(session, [planned], { isDryRun: preview }))).toContain(
            'Source link leaves the repository',
        );
        expect(readFileSync(join(external.path, 'source.txt'), 'utf8')).toBe('external original');
        rmSync(join(sandbox.path, 'source.txt'));
        writeFileSync(join(sandbox.path, 'source.txt'), 'original');
        const corrected = await applyFixers(session, [planned], { isDryRun: preview });
        expect(corrected.changed).toStrictEqual(['source.txt']);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'changed');
    },
);
test.each([false, true])(
    'isolated corrections publish selected bytes and remove their workspace (preview %s)',
    async (preview) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildFixerPolicy(),
            'source.txt': 'original',
            'unowned.json': '{}',
        });
        const session = await openSession(sandbox.path);
        const trace = join(sandbox.path, 'workspace-path');
        const planned = planFixer(
            session,
            `
            if (require('node:fs').existsSync('unowned.json')) throw new Error('Unowned configuration was copied.');
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write('source.txt', 'corrected');
            process.exitCode = 3;
        `,
        );
        planned.spec.run_in_copy = true;
        planned.spec.exit_codes = [3];
        const result = await applyFixers(session, [planned], { isDryRun: preview });
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
        'gspot.toml': buildFixerPolicy().replace('paths = ["source.txt"]', 'paths = ["*.txt"]'),
        'source.txt': 'original',
        'z-last.txt': 'last original',
    });
    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = planFixer(
        session,
        `
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write(${JSON.stringify(join(sandbox.path, 'z-last.txt'))}, 'new working content');
            await Bun.write('source.txt', 'isolated correction');
            await Bun.write('z-last.txt', 'last correction');
        `,
    );
    planned.spec.run_in_copy = true;
    expect(
        await rejection(applyFixers(session, [planned], { isDryRun: false }).then(({ results }) => results[0]!)),
    ).toContain('z-last.txt changed while its fix was running');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(readFileSync(join(sandbox.path, 'z-last.txt'), 'utf8')).toBe('new working content');
    expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
    const corrected = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.run_in_copy = true;
    expect(
        await applyFixers(session, [corrected], { isDryRun: false }).then(({ results }) => results[0]!),
    ).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        "await Bun.write('source.txt', 'partial'); process.stdout.write(process.cwd()); process.exitCode = 3",
    );
    const report = await applyFixers(session, [planned], { isDryRun: true });
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
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(
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
            await applyFixers(session, [planned], { isDryRun: true });
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

test.each([false, true])(
    'a canceled correction retains partial changes and reports the process failure (isolated %p)',
    async (isolated) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildFixerPolicy(),
            'source.txt': 'original',
        });
        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = planFixer(
            session,
            `await Bun.write('source.txt', 'partial'); await Bun.write(${JSON.stringify(ready + '.prepared')}, String(process.pid)); (await import('node:fs')).renameSync(${JSON.stringify(ready + '.prepared')}, ${JSON.stringify(ready)}); await Bun.sleep(10000);`,
        );
        planned.spec.run_in_copy = isolated;
        const execution = applyFixers({ ...session, cancelSignal: controller.signal }, [planned], {
            isDryRun: false,
        }).then(({ results }) => results[0]!);
        try {
            expect(await waitForFile(ready)).toBe(true);
            const pid = Number(readFileSync(ready, 'utf8'));
            expect(pid).toBeGreaterThan(0);
            controller.abort();
            const result = await execution;
            await waitForExit(pid);
            expect(result.status).toBe('failed');
            if (result.status !== 'failed') throw new Error('The correction did not report its process failure.');
            expect(result.note).toContain('was canceled');
            expect(result.changed).toStrictEqual(['source.txt']);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        const corrected = await applyFixers(
            session,
            [planFixer(session, "await Bun.write('source.txt', 'corrected')")],
            { isDryRun: false },
        ).then(({ results }) => results[0]!);
        expect(corrected.status).toBe('changed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);
