// Child processes of the tests: waiting for one to leave, and the source paths a child imports beside its mocks.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { workspaceRoot as root } from '#automation/workspace.ts';
import type { CapturedChild, CapturedProcess } from '#tests/types/harness/process.ts';
import { EXIT_POLL_MS, READY_POLL_MS, EXIT_TIMEOUT_MS, READY_TIMEOUT_MS } from '#tests/config/harness/process.ts';

/**
 * Wait up to three seconds for a child to exit, then kill it and throw if it remains alive.
 * @param pid the owned child process ID
 */
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + EXIT_TIMEOUT_MS;
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await Bun.sleep(EXIT_POLL_MS);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/**
 * The absolute path of a module under packages/cli/src.
 * @param path the module path below packages/cli/src
 * @returns the absolute path
 */

export function getCliSourcePath(path: string): string {
    return join(root, 'packages/cli/src', path);
}

/** Polls a child-written readiness marker until its bounded startup deadline. */
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + READY_TIMEOUT_MS;
    while (!existsSync(path) && performance.now() < deadline) await Bun.sleep(READY_POLL_MS);
    return existsSync(path);
}

/** Drains a child's output and guarantees termination when a scenario leaves its scope. */
export function captureChild(child: CapturedProcess): CapturedChild {
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    return {
        output,
        errors,
        async [Symbol.asyncDispose]() {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        },
    };
}
