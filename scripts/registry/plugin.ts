// Serve the built plugin for one source command and retain execution and cleanup failures.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { remainingTime } from '#automation/deadline.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { GSPOT_MISE_TOOL } from '#cli/config/tools/mise.ts';
import type { Registry } from '#automation/types/registry.ts';
import { startRegistry, settleRegistry } from '#registry/lifecycle.ts';
import { TERMINATED_EXIT, INTERRUPTED_EXIT, PLUGIN_PUBLISH_TIMEOUT_MS } from '#automation/config/plugin.ts';

function writeRegistryErrors(chunk: string): void {
    process.stderr.write(chunk);
}

async function runPublishedCommand(
    registry: Registry,
    command: string[],
    cwd: string,
    deadline: number,
    signal: AbortSignal,
): Promise<number> {
    const steps = [
        {
            command: ['npm', 'publish', '--ignore-scripts', '--registry', registry.url],
            cwd: join(workspaceRoot, 'packages/eslint-plugin'),
            env: { NPM_CONFIG_USERCONFIG: registry.npmrc },
            limit: PLUGIN_PUBLISH_TIMEOUT_MS,
            label: 'publish workspace plugin',
            onStdout: writeRegistryErrors,
        },
        {
            command,
            cwd,
            env: {
                NPM_CONFIG_USERCONFIG: registry.npmrc,
                BUN_INSTALL_CACHE_DIR: join(registry.work, 'bun-cache'),
                MISE_DISABLE_TOOLS: GSPOT_MISE_TOOL,
            },
            limit: deadline - performance.now(),
            label: 'source command',
            onStdout: (chunk: string) => {
                process.stdout.write(chunk);
            },
        },
    ];
    for (const step of steps) {
        signal.throwIfAborted();
        const context = `Command: ${step.command.join(' ')}\nWorking directory: ${step.cwd}\nStep: ${step.label}`;
        const remaining = remainingTime(deadline, `${step.label}.\n${context}`);
        const timeoutMs = Math.min(step.limit, remaining);
        const result = await run(step.command, {
            cwd: step.cwd,
            env: step.env,
            timeoutMs,
            cancelSignal: signal,
            onStdout: step.onStdout,
            onStderr: writeRegistryErrors,
        });
        if (result.isTimedOut === true)
            throw new Error(
                `Command timed out after ${String(timeoutMs)} ms.\n${context}\n${result.stdout}${result.stderr}`,
            );
        if (result.code !== 0 || result.isCanceled === true) return result.code;
    }
    return 0;
}

async function runPluginCommand(
    command: string[],
    cwd: string,
    deadline: number,
    signal: AbortSignal,
): Promise<number> {
    const registry = await startRegistry({
        startupMs: Math.min(PLUGIN_PUBLISH_TIMEOUT_MS, deadline - performance.now()),
        signal,
    });
    let executionError: unknown;
    let code = 0;
    try {
        code = await runPublishedCommand(registry, command, cwd, deadline, signal);
    } catch (error) {
        executionError = error;
    }
    await settleRegistry(registry, executionError);
    return code;
}

/**
 * Serve the built workspace plugin for a command, then remove the registry.
 * @param command the source command and its arguments
 * @param cwd the command's working directory
 * @param timeoutMs the complete startup, publication, and command budget
 * @returns the command's exit code or its cancellation status
 */
export async function runSourceCommand(command: string[], cwd: string, timeoutMs: number): Promise<number> {
    const controller = new AbortController();
    let canceled: number | undefined;

    const stopped = (signal: NodeJS.Signals): void => {
        canceled = signal === 'SIGINT' ? INTERRUPTED_EXIT : TERMINATED_EXIT;
        controller.abort();
    };
    process.on('SIGINT', stopped);
    process.on('SIGTERM', stopped);
    try {
        const code = await runPluginCommand(command, cwd, performance.now() + timeoutMs, controller.signal);
        return canceled ?? code;
    } catch (error) {
        const reason: unknown = controller.signal.reason;
        if (canceled !== undefined && (error === reason || (error instanceof Error && error.cause === reason)))
            return canceled;
        throw error;
    } finally {
        process.removeListener('SIGINT', stopped);
        process.removeListener('SIGTERM', stopped);
    }
}
