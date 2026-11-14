import { stat } from 'node:fs/promises';
import { hasErrorCode } from '#cli/system/errors.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import type { ChildCapture, ProcessCapture } from '#tests/types/setup.ts';
import type { SpawnResult, CancelableSpawnOptions } from '#cli/types/system.ts';

import {
    CHILD_WAIT_MILLISECONDS,
    TEST_TIMEOUT_MILLISECONDS,
    POLL_INTERVAL_MILLISECONDS,
} from '#tests/config/setup/programs.ts';

function readCommandResult(result: SpawnResult, limited: ReturnType<typeof limitCommand>): SpawnResult {
    if (result.end !== 'timed-out') return result;
    const message = `The test command timed out after ${String(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND)} ms.\n${limited.context}\n${result.stdout}${result.stderr}`;
    throw new Error(message);
}

function buildSpawnOptions(options: CancelableSpawnOptions & { timeoutSeconds: number }) {
    return {
        cwd: options.cwd,
        env: buildSpawnEnvironment(options.env),
        ...(options.stdin !== undefined && { stdin: Buffer.from(options.stdin) }),
        timeout: Math.ceil(options.timeoutSeconds * MILLISECONDS_PER_SECOND),
        killSignal: 'SIGKILL' as const,
    };
}

export function limitCommand(
    command: readonly string[],
    options: CancelableSpawnOptions,
): { options: CancelableSpawnOptions & { timeoutSeconds: number }; context: string } {
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}`;
    const timeoutSeconds = Math.min(
        options.timeoutSeconds ?? Infinity,
        TEST_TIMEOUT_MILLISECONDS / MILLISECONDS_PER_SECOND,
    );
    return { options: { ...options, timeoutSeconds }, context };
}

export async function runCommand(command: readonly string[], options: CancelableSpawnOptions): Promise<SpawnResult> {
    const limited = limitCommand(command, options);
    const result = await runProcess(command, limited.options);
    return readCommandResult(result, limited);
}

export function runBlockingCommand(command: readonly string[], options: CancelableSpawnOptions): SpawnResult {
    const limited = limitCommand(command, options);
    const child = Bun.spawnSync([...command], buildSpawnOptions(limited.options));
    const result = buildProcessResult({
        code: child.exitCode,
        stdout: child.stdout.toString(),
        stderr: child.stderr.toString(),
        end: child.exitedDueToTimeout === true ? 'timed-out' : 'exited',
    });
    return readCommandResult(result, limited);
}

/**
Wait within the command timeout, then kill a child that remains alive. A negative pid names a process group, as in
process.kill, and the wait lasts until no process of the group runs. macOS refuses to signal a group whose leader
exited, so that refusal counts as an exit.
*/
export async function waitForExit(pid: number): Promise<void> {
    if (pid === 0 || !Number.isSafeInteger(pid)) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + CHILD_WAIT_MILLISECONDS - MILLISECONDS_PER_SECOND;
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if (hasErrorCode(error, 'ESRCH')) return;
            if (pid < 0 && hasErrorCode(error, 'EPERM')) return;
            throw error;
        }
        await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/**
Wait until a child writes its ready file, or the command timeout elapses. A child creates the file before it writes the
content, so the file counts as ready once it holds bytes.
*/
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + CHILD_WAIT_MILLISECONDS - MILLISECONDS_PER_SECOND;
    while (performance.now() < deadline) {
        try {
            const file = await stat(path);
            if (file.size > 0) return true;
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
        }
        await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    }
    return false;
}

export function spawnCommand(
    command: readonly string[],
    options: CancelableSpawnOptions,
): ChildCapture & { child: ProcessCapture & Pick<Bun.Subprocess, 'pid'> } {
    const limited = limitCommand(command, options);
    const child = Bun.spawn([...command], { ...buildSpawnOptions(limited.options), stdout: 'pipe', stderr: 'pipe' });
    return { child, ...captureChild(child) };
}

export function buildProcessResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
    return {
        code: 0,
        stdout: '',
        stderr: '',
        end: 'exited',
        duration: 1,
        ...overrides,
    };
}

export function captureChild(child: ProcessCapture): ChildCapture {
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    return {
        stdout: output,
        stderr: errors,
        async [Symbol.asyncDispose]() {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        },
    };
}
