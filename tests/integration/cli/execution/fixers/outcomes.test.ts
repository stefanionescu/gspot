import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runFixer } from '#cli/execution/fixers.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CORRECTION_POLICY, plannedCorrection } from '#tests/harness/cli/correction.ts';

test.each([0, 3])('a declared fatal diagnostic overrides correction exit %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(
        session,
        `console.error('Fatal: cannot write'); process.exitCode = ${String(code)}`,
    );
    planned.spec.exit_codes = [3];
    planned.spec.crash_pattern = '^Fatal:';
    const failed = await runFixer(session, planned, sandbox.path);
    expect(failed).toMatchObject({
        status: 'failed',
        changed: [],
        note: textContaining('Fatal: cannot write'),
    });
    const corrected = plannedCorrection(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.crash_pattern = planned.spec.crash_pattern;
    expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
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
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(
        session,
        `await Bun.write('source.txt', ${JSON.stringify(content)}); process.exitCode = ${String(code)}`,
    );
    planned.spec.exit_codes = [3];
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe(status);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(content);
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
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const result = await runFixer(session, plannedCorrection(session, script), sandbox.path);
    expect(result.status).toBe(status);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
    expect(result.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
    expect(result.status === 'failed' && result.note.includes('exited 3')).toBe(status === 'failed');
});

test('compares bytes that decode to the same replacement character', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    writeFileSync(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const planned = plannedCorrection(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(readFileSync(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('counts deletion of an empty file as a change', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': '' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(session, "require('node:fs').unlinkSync('source.txt')");
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(existsSync(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('distinguishes a skipped correction from an unavailable tool', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(session, "await Bun.write('source.txt', 'wrong')");
    const skipped = await runFixer(
        session,
        { ...planned, skip: { source: 'flag', note: 'Not selected.' } },
        sandbox.path,
    );
    const failed = await runFixer(
        session,
        { ...planned, spec: { ...planned.spec, fix: [join(sandbox.path, 'absent-tool')] } },
        sandbox.path,
    );
    expect(skipped.status).toBe('skipped');
    expect(failed.status).toBe('failed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('runs the correction executable when it differs from the check executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(session, "await Bun.write('source.txt', 'corrected')");
    const result = await runFixer(
        session,
        { ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {} } },
        sandbox.path,
    );
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('fails the run when a correction exits nonzero even though its check passes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, runOptions({ fix: true }));
    expect(outcome.report.checks[0]?.status).toBe('ok');
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.failed).toContain('sandbox/correction');
    expect(outcome.fixes?.results[0]?.status).toBe('failed');
});
