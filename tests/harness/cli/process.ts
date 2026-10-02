// Child processes of the tests: waiting for one to leave, and the source paths a child imports beside its mocks.
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

/** Read a child PID disappearing, with bounded cleanup if supervision fails. */
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid read child PID: ${String(pid)}.`);
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await Bun.sleep(10);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/**
 * The absolute path of a module under packages/cli/src.
 * @param path the module path below packages/cli/src
 * @returns the absolute path
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four test files locate a CLI source file through it, seven times.
export function cliSource(path: string): string {
    return fileURLToPath(new URL(`../../../packages/cli/src/${path}`, import.meta.url));
}

/** Polls a child-written readiness marker until its bounded startup deadline. */
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + 10_000;
    while (!existsSync(path) && performance.now() < deadline) await Bun.sleep(5);
    return existsSync(path);
}

/**
 * Polls a JSON marker a child writes until it parses: the child may still be writing it when it appears.
 * @param path the marker
 * @returns the parsed marker
 */
export async function waitForJson(path: string): Promise<unknown> {
    const deadline = performance.now() + 10_000;
    for (;;) {
        try {
            return JSON.parse(readFileSync(path, 'utf8')) as unknown;
        } catch (error) {
            if (performance.now() >= deadline) throw error;
        }
        await Bun.sleep(5);
    }
}

/** Drains a child's output and guarantees termination when a scenario leaves its scope. */
export function captureChild(
    child: Pick<
        Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
        'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
    >,
): { output: Promise<string>; errors: Promise<string>; [Symbol.asyncDispose](): Promise<void> } {
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
