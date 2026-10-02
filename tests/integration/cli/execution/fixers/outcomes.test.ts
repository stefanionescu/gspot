import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runFixer } from '#cli/execution/fixers.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runGspot, runOptions } from '#tests/harness/cli/command.ts';
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
        { ...planned, skip: { cause: 'flag', note: 'Not selected.' } },
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
    expect(outcome.report.checks[0]?.status).toBe('passed');
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.failed).toContain('sandbox/correction');
    expect(outcome.fixes?.results[0]?.status).toBe('failed');
});

test('a fixer that fails midway leaves the later fixers to run in order and keep their edits', async () => {
    const entries = ['first', 'second', 'third'].map((name, index) => {
        const script = String.raw`const fs = require('node:fs'); fs.appendFileSync('order.log', '${name}\n'); fs.writeFileSync('${name}.txt', 'fixed\n'); process.exitCode = ${index === 0 ? '3' : '0'};`;
        return `[[check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify([process.execPath, '-e', script])}\npaths = ["${name}.txt"]\nstage = "commit"\n`;
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `kits = []\n${entries.join('')}`,
        'first.txt': 'original\n',
        'second.txt': 'original\n',
        'third.txt': 'original\n',
    });
    const fixed = await runGspot(sandbox.path, ['check', '--fix', '--json']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect((JSON.parse(fixed.stdout) as RunReport).failed).toStrictEqual(['sandbox/first']);
    // A second pass reruns the fixers whose files the first pass changed; the failed fixer does not run again.
    expect(readFileSync(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\nsecond\nthird\n');
    for (const name of ['first', 'second', 'third'])
        expect(readFileSync(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
});
