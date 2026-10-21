import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { FIXER_RESULTS } from '#tests/data/runs/fixes.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { planFixer, buildRunOptions, buildFixerSettings } from '#tests/setup/builders.ts';

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
        note: matchSubstring('Fatal: cannot write'),
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
    async ({ script, exit_codes: exitCodes, status, after, ...row }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

        const session = await openSession(sandbox.path);
        const planned = planFixer(session, script);
        if (exitCodes !== undefined) planned.check.exit_codes = [...exitCodes];
        const {
            results: [result],
        } = await runFixers(session, [planned], { isDryRun: false });
        expect(result).toMatchObject({ status });
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
        expect(result!.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
        if ('note' in row) expect(result).toMatchObject({ note: matchSubstring(row['note']) });
    },
);

test('compares bytes that decode to the same replacement character', async () => {
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

test('counts deletion of an empty file as a change', async () => {
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

test('distinguishes a skipped fix from a missing tool', async () => {
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
        note: matchSubstring(`${join(sandbox.path, 'absent-tool')} is not installed.`),
    });
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('runs the fixer program when it differs from the check program', async () => {
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
    expect(result.report.failed).toContain('sandbox/fixer');
    expect(result.fixes?.results[0]?.status).toBe('failed');
});

test('a failed version check blocks a check and its fix without changing source bytes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        installers: {},
        kind: 'program',
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.check.fix![0] = 'version-teller';
    using _which = useExecutable(process.execPath);

    const checked = await runCheckCommand(session, planned);
    expect(checked.status).toBe('error');
    expect(checked.note).toContain('exited 7');
    const fixed = await runFixers(session, [planned], {
        isDryRun: false,
    }).then(({ results }) => results[0]!);
    expect(fixed.status).toBe('failed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});
