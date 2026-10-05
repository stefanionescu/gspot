// Timeout failures identify the step and preserve captured output before the runner's own deadline.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { spawnGspot, startGspot } from '#tests/harness/gspot.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { TEST_CLEANUP_MS } from '#tests/config/harness/command.ts';
import { openTestBudget, runTestCommand, runTestCommandBlocking } from '#tests/harness/command.ts';

import {
    FIRST_COMMAND,
    BUDGET_COMMAND,
    STEP_TIMEOUT_MS,
    WAITING_COMMAND,
    SUITE_BUDGET_CASES,
    SCENARIO_TIMEOUT_MS,
} from '#tests/config/cli/automation/command.ts';

test.each(
    SUITE_BUDGET_CASES.flatMap((entry) => [
        { ...entry, selection: 'file' },
        { ...entry, selection: 'folder' },
    ]),
)(
    '$suite selects its declared budget when Bun flags precede its $selection selection',
    async ({ suite, timeout, selection }) => {
        await using sandbox = await testdir();
        const path = `${suite}/budget.test.ts`;
        const command = join(root, 'tests/harness/command.ts');
        await createFileTree(sandbox.path, {
            [path]: BUDGET_COMMAND.replace('COMMAND_OWNER', JSON.stringify(command)),
        });
        const result = await runTestCommand(
            [
                process.execPath,
                'test',
                '--timeout',
                String(NATIVE_TEST_TIMEOUT_MS),
                selection === 'file' ? `./${path}` : `./${suite}`,
            ],
            { cwd: sandbox.path },
            `${suite} budget`,
        );
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain(
            JSON.stringify({ argv: [process.execPath, join(sandbox.path, path)], timeout }),
        );
    },
);

test('a subprocess timeout reports its command, working directory, step, and both streams', async () => {
    await using sandbox = await testdir();
    const error = await rejection(
        runTestCommand(
            [process.execPath, '-e', WAITING_COMMAND],
            { cwd: sandbox.path, timeoutMs: STEP_TIMEOUT_MS },
            'lint',
        ),
    );
    expect(error).toContain(`Command: ${process.execPath} -e`);
    expect(error).toContain(`Working directory: ${sandbox.path}`);
    expect(error).toContain('Step: lint');
    expect(error).toContain('step stdout\nstep stderr');
});

test('a later subprocess shares the remaining scenario budget instead of starting a new fifteen-minute limit', async () => {
    await using sandbox = await testdir();
    const budget = openTestBudget(SCENARIO_TIMEOUT_MS);
    try {
        const started = performance.now();
        const options = { cwd: sandbox.path, timeoutMs: NATIVE_TEST_TIMEOUT_MS };
        const first = await runTestCommand([process.execPath, '-e', FIRST_COMMAND], options, 'first');
        expect(first.code).toBe(0);
        expect(first.stdout).toBe('first step\n');
        const error = await rejection(runTestCommand([process.execPath, '-e', WAITING_COMMAND], options, 'second'));
        expect(error).toContain('Step: second');
        expect(error).toContain('step stdout\nstep stderr');
        expect(performance.now() - started).toBeLessThan(SCENARIO_TIMEOUT_MS);
    } finally {
        budget[Symbol.dispose]();
    }
});

test('an exhausted scenario starts no subprocess and names the refused step', async () => {
    await using sandbox = await testdir();
    const budget = openTestBudget(TEST_CLEANUP_MS);
    try {
        const error = await rejection(
            runTestCommand(
                [process.execPath, '-e', "await Bun.write('started', 'yes');"],
                { cwd: sandbox.path },
                'install',
            ),
        );
        expect(error).toContain('The test budget is exhausted.');
        expect(error).toContain('Step: install');
        expect(await Bun.file(join(sandbox.path, 'started')).exists()).toBe(false);
    } finally {
        budget[Symbol.dispose]();
    }
});

test('an exhausted scenario refuses both finite and live source CLI children', async () => {
    await using sandbox = await testdir();
    const budget = openTestBudget(TEST_CLEANUP_MS);
    try {
        const error = await rejection(spawnGspot(sandbox.path, ['--version']));
        expect(error).toContain('The test budget is exhausted.');
        expect(error).toContain(`Working directory: ${sandbox.path}`);
        expect(() => startGspot(sandbox.path, ['--version'], {}, { stdin: new Uint8Array([0xff]) })).toThrow(
            'The test budget is exhausted.',
        );
    } finally {
        budget[Symbol.dispose]();
    }
});

test('a synchronous subprocess timeout names the command, working directory, step, and captured output', async () => {
    await using sandbox = await testdir();
    let error: unknown;
    try {
        runTestCommandBlocking(
            [process.execPath, '-e', WAITING_COMMAND],
            { cwd: sandbox.path, timeoutMs: STEP_TIMEOUT_MS },
            'Git inspection',
        );
    } catch (error_) {
        error = error_;
    }
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error('The synchronous command must time out.');
    expect(error.message).toContain(`Command: ${process.execPath} -e`);
    expect(error.message).toContain(`Working directory: ${sandbox.path}`);
    expect(error.message).toContain('Step: Git inspection');
    expect(error.message).toContain('step stdout\nstep stderr');
});
