// Child processes of the tests: waiting for one to leave, and the source paths a child imports beside its mocks.
import { getCliSourcePath } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { runTestCommand, remainingTestTime } from '#tests/harness/command.ts';
import { EXIT_POLL_MS, READY_POLL_MS, INTERRUPTION_EXIT_CODE } from '#tests/config/harness/process.ts';
import type { CapturedChild, CapturedProcess, OwnerInterruption } from '#tests/types/harness/process.ts';

/**
 * Wait within the remaining test time, then kill a child that remains alive.
 * @param pid the owned child process ID
 */
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + remainingTestTime();
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

/** Polls a child-written readiness marker until its bounded startup deadline. */
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + remainingTestTime();
    while (!(await pathExists(path)) && performance.now() < deadline) await Bun.sleep(READY_POLL_MS);
    return await pathExists(path);
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

/**
 * Interrupt a native ownership publication at its observed root file operation.
 * @param cwd the repository the child owns
 * @param interruption the actual method, file, and timing to intercept
 * @param call the ownership operation the child performs
 * @returns the child's captured process result
 */
export async function interruptOwner(cwd: string, interruption: OwnerInterruption, call: string): Promise<SpawnResult> {
    const { operation, path, point } = interruption;
    const boundary = getCliSourcePath('platform/root/public.ts');
    const program = `
import { mock } from 'bun:test';
const boundary = await import(${JSON.stringify(boundary)});
const open = boundary.openRoot;
mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openRoot(root) {
    const files = open(root);
    return { ...files, ${operation}(path, ...rest) {
        if (path === ${JSON.stringify(path)} && ${JSON.stringify(point)} === 'before') process.exit(${String(INTERRUPTION_EXIT_CODE)});
        files.${operation}(path, ...rest);
        if (path === ${JSON.stringify(path)} && ${JSON.stringify(point)} === 'after') process.exit(${String(INTERRUPTION_EXIT_CODE)});
    }};
}}));
const { openOwnership, applyPlans } = await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/public.ts'))});
const { planReplacement, planRestoration } = await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/contracts.ts'))});
using log = openOwnership(process.cwd());
${call}
`;
    return await runTestCommand([process.execPath, '-e', program], { cwd });
}
