import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { planFixer, buildRunOptions, buildFixerSettings } from '#tests/setup/cli/runs.ts';
import { FIXER_RESULTS, FAILING_VERSION_TOOL } from '#tests/data/commands/check/fixes/results.ts';

test.each([0, 3])('a declared crash pattern fails a fix that exits %s', async (code) => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, `console.error('Fatal: cannot write'); process.exitCode = ${String(code)}`);
    planned.check.exit_codes = [3];
    planned.tool!.crash_pattern = '^Fatal:';
    const {
        results: [failed],
    } = await runFixers(session, [planned], { isDryRun: false });
    expect(failed).toMatchObject({
        status: 'failed',
        changed: [],
        note: 'Fatal: cannot write',
    });
    const corrected = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    corrected.tool!.crash_pattern = planned.tool!.crash_pattern;
    const {
        results: [correctedResult],
    } = await runFixers(session, [corrected], { isDryRun: false });
    expect(correctedResult).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test.each([...FIXER_RESULTS])(
    '$name classifies $status from the exit code and the resulting bytes',
    async ({ script, exit_codes: exitCodes, status, after, note }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

        const session = await openSession(sandbox.path);
        const planned = planFixer(session, script);
        if (exitCodes !== undefined) planned.check.exit_codes = [...exitCodes];
        const {
            results: [result],
        } = await runFixers(session, [planned], { isDryRun: false });
        expect({ status: result!.status, note: 'note' in result! ? result.note : undefined }).toStrictEqual({
            status,
            note,
        });
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
        expect(result!.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
    },
);

test('a fixer that swaps one invalid UTF-8 byte for another reports the file as changed', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const planned = planFixer(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
    const {
        results: [result],
    } = await runFixers(session, [planned], { isDryRun: false });
    expect(result!.status).toBe('changed');
    expect(result!.changed).toStrictEqual(['source.txt']);
    expect(await readFile(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('a fixer that deletes an empty file reports it as changed', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': '' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "require('node:fs').unlinkSync('source.txt')");
    const {
        results: [result],
    } = await runFixers(session, [planned], { isDryRun: false });
    expect(result!.status).toBe('changed');
    expect(result!.changed).toStrictEqual(['source.txt']);
    expect(await isOnDisk(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('a skipped fixer reports skipped, and a fixer whose program is missing fails', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'wrong')");
    const skipped = await runFixers(session, [{ ...planned, skip: { cause: 'level', note: 'Not selected.' } }], {
        isDryRun: false,
    }).then(({ results }) => results[0]!);
    const failed = await runFixers(
        session,
        [{ ...planned, check: { ...planned.check, fix: [join(sandbox.path, 'absent-tool')] } }],
        { isDryRun: false },
    ).then(({ results }) => results[0]!);
    expect(skipped.status).toBe('skipped');
    expect(failed).toMatchObject({
        status: 'failed',
        note: `${join(sandbox.path, 'absent-tool')} is not installed. Install ${join(sandbox.path, 'absent-tool')}.`,
    });
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('a fixer runs its own program when the check program is missing', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    const result = await runFixers(
        session,
        [{ ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, kind: 'program' } }],
        { isDryRun: false },
    ).then(({ results }) => results[0]!);
    expect(result.status).toBe('changed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a fix that exits nonzero fails the run even when its check passes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ fix: true, only: ['sandbox/fixer'] }));
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(result.report.exitCode).toBe(2);
    expect(result.report.failed).toStrictEqual(['sandbox/fixer']);
    expect(result.fixes?.results[0]?.status).toBe('failed');
});

test('a failed version check blocks a check and its fix without changing source bytes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = FAILING_VERSION_TOOL;
    planned.check.fix![0] = 'version-teller';
    using _which = fakeExecutableLookup(process.execPath);

    const checked = await runCheckCommand(session, planned);
    expect(checked.status).toBe('error');
    expect(checked.note).toBe('version-teller version inspection exited 7: 3.8.1');
    const fixed = await runFixers(session, [planned], {
        isDryRun: false,
    }).then(({ results }) => results[0]!);
    expect(fixed.status).toBe('failed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});
