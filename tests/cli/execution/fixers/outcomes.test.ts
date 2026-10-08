import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyFixers } from '#cli/execution/fixers.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { planFixer, buildFixerPolicy } from '#tests/harness/fixer.ts';

test.each([0, 3])('a declared fatal diagnostic overrides correction exit %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, `console.error('Fatal: cannot write'); process.exitCode = ${String(code)}`);
    planned.check.exit_codes = [3];
    planned.check.crash_pattern = '^Fatal:';
    const failed = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
        ({ results }) => results[0]!,
    );
    expect(failed).toMatchObject({
        status: 'failed',
        changed: [],
        note: textContaining('Fatal: cannot write'),
    });
    const corrected = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    corrected.check.crash_pattern = planned.check.crash_pattern;
    expect(
        await applyFixers(session, [corrected], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
            ({ results }) => results[0]!,
        ),
    ).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test.each([
    { code: 3, content: 'original', status: 'unchanged' },
    { code: 3, content: 'corrected', status: 'changed' },
    { code: 4, content: 'partial', status: 'failed' },
])('declared finding exit $code retains the $status correction outcome', async ({ code, content, status }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        `await Bun.write('source.txt', ${JSON.stringify(content)}); process.exitCode = ${String(code)}`,
    );
    planned.check.exit_codes = [3];
    const result = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
        ({ results }) => results[0]!,
    );
    expect(result.status).toBe(status);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(content);
    expect(result.changed).toStrictEqual(content === 'original' ? [] : ['source.txt']);
});
test.each([
    { script: 'process.exitCode = 0', status: 'unchanged', after: 'original' },
    { script: "await Bun.write('source.txt', 'corrected')", status: 'changed', after: 'corrected' },
    { script: 'process.exitCode = 3', status: 'failed', after: 'original' },
    {
        script: "await Bun.write('source.txt', 'partial'); process.exitCode = 3",
        status: 'failed',
        after: 'partial',
    },
])('classifies $status from execution and resulting bytes', async ({ script, status, after }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const result = await applyFixers(session, [planFixer(session, script)], {
        checks: BUILT_IN_CHECKS,
        isDryRun: false,
    }).then(({ results }) => results[0]!);
    expect(result.status).toBe(status);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
    expect(result.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
    expect(result.status === 'failed' && result.note.includes('exited 3')).toBe(status === 'failed');
});

test('compares bytes that decode to the same replacement character', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const planned = planFixer(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
    const result = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
        ({ results }) => results[0]!,
    );
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(await readFile(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('counts deletion of an empty file as a change', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': '' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "require('node:fs').unlinkSync('source.txt')");
    const result = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
        ({ results }) => results[0]!,
    );
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(await pathExists(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('distinguishes a skipped correction from an unavailable tool', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'wrong')");
    const skipped = await applyFixers(session, [{ ...planned, skip: { cause: 'flag', note: 'Not selected.' } }], {
        checks: BUILT_IN_CHECKS,
        isDryRun: false,
    }).then(({ results }) => results[0]!);
    const failed = await applyFixers(
        session,
        [{ ...planned, check: { ...planned.check, fix: [join(sandbox.path, 'absent-tool')] } }],
        { checks: BUILT_IN_CHECKS, isDryRun: false },
    ).then(({ results }) => results[0]!);
    expect(skipped.status).toBe('skipped');
    expect(failed).toMatchObject({
        status: 'failed',
        note: textContaining(`${join(sandbox.path, 'absent-tool')} is not installed.`),
    });
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('runs the correction executable when it differs from the check executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'corrected')");
    const result = await applyFixers(
        session,
        [{ ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, kind: 'binary' } }],
        { checks: BUILT_IN_CHECKS, isDryRun: false },
    ).then(({ results }) => results[0]!);
    expect(result.status).toBe('changed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('fails the run when a correction exits nonzero even though its check passes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, buildRunOptions({ fix: true, only: ['sandbox/fixer'] }));
    expect(outcome.report.checks[0]?.status).toBe('passed');
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.failed).toContain('sandbox/fixer');
    expect(outcome.fixes?.results[0]?.status).toBe('failed');
});

test('a failed version inspection blocks a check and its correction without changing source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildFixerPolicy(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        installers: {},
        kind: 'binary',
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.check.fix![0] = 'version-teller';
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const checked = await runCheckCommand(session, planned);
        expect(checked.status).toBe('error');
        expect(checked.note).toContain('exited 7');
        const fixed = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: false }).then(
            ({ results }) => results[0]!,
        );
        expect(fixed.status).toBe('failed');
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    } finally {
        which.mockRestore();
    }
});
