import * as os from 'node:os';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { COPY_FAILURES } from '#tests/data/runs/copies.ts';
import { waitForExit, waitForFile } from '#tests/setup/processes.ts';
import { rm, stat, mkdir, readdir, readFile } from 'node:fs/promises';
import { planFixer, buildFixerSettings } from '#tests/setup/builders.ts';
import { matchSubstring, captureRejection } from '#tests/setup/matchers.ts';

test("a fixer's {root} environment paths point into the scratch copy during a dry run", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildFixerSettings(),
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });

    const trace = join(sandbox.path, 'execution-root');
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        `await Bun.write('café settings.txt', 'scratch corrected'); await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text()); await Bun.write(${JSON.stringify(trace)}, process.cwd())`,
    );
    planned.check.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixers(session, [planned], {
        isDryRun: true,
    });
    expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
    expect(result.diffs).toStrictEqual([matchSubstring('+scratch corrected')]);
    const executionRoot = await readFile(trace, 'utf8');
    expect(executionRoot).not.toBe(sandbox.path);
    expect(await isOnDisk(executionRoot)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(await readFile(join(sandbox.path, 'café settings.txt'), 'utf8')).toBe('corrected');
});

test.each([false, true])(
    'a fix in a scratch copy writes only the selected file back and removes the copy (dry run %s)',
    async (preview) => {
        await using sandbox = await testdir({
            'gspot.toml': buildFixerSettings(),
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
        planned.check.run_in_copy = true;
        planned.check.exit_codes = [3];
        const result = await runFixers(session, [planned], {
            isDryRun: preview,
        });
        expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'corrected');
        expect(await readFile(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
        expect(await isOnDisk(await readFile(trace, 'utf8'))).toBe(false);
        // A preview shows the correction as a diff instead of writing it.
        const expectedDiff = matchSubstring('+corrected');
        expect(result.diffs).toStrictEqual(preview ? [expectedDiff] : []);
    },
);

test('a fix in a scratch copy refuses to overwrite a file changed while it ran, and removes the copy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildFixerSettings(['*.txt']),
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
    planned.check.run_in_copy = true;
    expect(
        await captureRejection(runFixers(session, [planned], { isDryRun: false }).then(({ results }) => results[0]!)),
    ).toContain('Destination changed during the operation: z-last.txt');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('isolated correction');
    expect(await readFile(join(sandbox.path, 'z-last.txt'), 'utf8')).toBe('new working content');
    expect(await isOnDisk(await readFile(trace, 'utf8'))).toBe(false);
    const corrected = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    corrected.check.run_in_copy = true;
    expect(
        await runFixers(session, [corrected], {
            isDryRun: false,
        }).then(({ results }) => results[0]!),
    ).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test('a failed fix removes its scratch folder and keeps the source bytes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        "await Bun.write('source.txt', 'partial'); process.stdout.write(process.cwd()); process.exitCode = 3",
    );
    const temporary = join(sandbox.path, 'scratch');
    await mkdir(temporary);
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    const report = await runFixers(session, [planned], {
        isDryRun: true,
    });
    expect(report.results).toMatchObject([{ status: 'failed' }]);
    expect(await readdir(temporary)).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(report.changed).toStrictEqual(['source.txt']);
    expect(report.diffs.join('\n')).toContain('+partial');
});

test.each([...COPY_FAILURES])('cleans the scratch folder after a failed $operation', async ({ operation, message }) => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        "const fs = require('node:fs'); fs.unlinkSync('source.txt'); fs.mkdirSync('source.txt');",
    );
    if (operation === 'copy') {
        await rm(join(sandbox.path, 'source.txt'));
        await mkdir(join(sandbox.path, 'source.txt'));
    }
    const temporary = join(sandbox.path, 'scratch');
    await mkdir(temporary);
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    expect(await captureRejection(runFixers(session, [planned], { isDryRun: true }))).toContain(message);
    expect(await readdir(temporary)).toStrictEqual([]);
    // The copy row replaces the source with a folder before the run.
    if (operation === 'copy') {
        const attributes = await stat(join(sandbox.path, 'source.txt'));
        expect(attributes.isDirectory()).toBe(true);
    } else expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test.each([false, true])(
    'a canceled fix keeps its partial changes and reports the process failure (scratch copy %p)',
    async (isolated) => {
        await using sandbox = await testdir({
            'gspot.toml': buildFixerSettings(),
            'source.txt': 'original',
        });

        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = planFixer(
            session,
            `await Bun.write('source.txt', 'partial'); await Bun.write(${JSON.stringify(ready + '.prepared')}, String(process.pid)); (await import('node:fs')).renameSync(${JSON.stringify(ready + '.prepared')}, ${JSON.stringify(ready)}); await Bun.sleep(10000);`,
        );
        planned.check.run_in_copy = isolated;
        session.cancelSignal = controller.signal;
        const execution = runFixers(session, [planned], {
            isDryRun: false,
        }).then(({ results }) => results[0]!);
        try {
            expect(await waitForFile(ready)).toBe(true);
            const pid = Number(await readFile(ready, 'utf8'));
            controller.abort();
            const result = await execution;
            await waitForExit(pid);
            expect(result).toMatchObject({
                status: 'failed',
                note: matchSubstring('was canceled'),
                changed: ['source.txt'],
            });
            expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        delete session.cancelSignal;
        const corrected = await runFixers(session, [planFixer(session, "await Bun.write('source.txt', 'corrected')")], {
            isDryRun: false,
        }).then(({ results }) => results[0]!);
        expect(corrected.status).toBe('changed');
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);
