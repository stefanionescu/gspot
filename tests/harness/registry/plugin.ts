import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { SETUP_MS } from '#tests/config/timeouts.ts';
import type { Registry } from '#tests/types/registry.ts';
import { startRegistry, settleRegistry } from '#tests/harness/registry/lifecycle.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const OUTPUT = {
    onStdout: (chunk: string) => {
        process.stdout.write(chunk);
    },
    onStderr: (chunk: string) => {
        process.stderr.write(chunk);
    },
};

async function executePublishedCommand(
    registry: Registry,
    command: string[],
    cwd: string,
    timeoutMs: number,
    signal: AbortSignal,
): Promise<void> {
    if (signal.aborted) return;
    const output = { ...OUTPUT, cancelSignal: signal };
    const published = await run(['npm', 'publish', '--ignore-scripts', '--registry', registry.url], {
        cwd: join(ROOT, 'packages/eslint-plugin'),
        env: { NPM_CONFIG_USERCONFIG: registry.npmrc },
        timeoutMs: SETUP_MS,
        ...output,
    });
    if (published.code !== 0 || published.isCanceled === true) {
        process.exitCode ||= published.code;
        return;
    }
    writeFileSync(registry.npmrc, `registry=${registry.url}\n${registry.url.replace('http:', '')}/:_authToken=fake\n`, {
        mode: 0o600,
    });
    const executed = await run(command, {
        cwd,
        env: {
            NPM_CONFIG_USERCONFIG: registry.npmrc,
            BUN_INSTALL_CACHE_DIR: join(registry.work, 'bun-cache'),
        },
        timeoutMs,
        ...output,
    });
    if (executed.isTimedOut === true) throw new Error(`Command exceeded the ${String(timeoutMs)} ms timeout.`);
    process.exitCode ||= executed.code;
}

async function preparePlugin(command: string[], cwd: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
    const built = await run([process.execPath, 'packages/eslint-plugin/build.ts'], {
        cwd: ROOT,
        timeoutMs: SETUP_MS,
        cancelSignal: signal,
        ...OUTPUT,
    });
    if (built.code !== 0 || built.isCanceled === true) {
        process.exitCode ||= built.code;
        return;
    }
    const registry = await startRegistry(0, SETUP_MS, signal);
    let executionError: unknown;
    try {
        await executePublishedCommand(registry, command, cwd, timeoutMs, signal);
    } catch (error) {
        executionError = error;
    }
    // Publication refusal and cancellation still release the registry and its temporary storage.
    await settleRegistry(registry, executionError);
}

/** Builds and serves the workspace plugin for a command, then removes the registry. */
export async function runSourceCommand(command: string[], cwd: string, timeoutMs: number): Promise<void> {
    const controller = new AbortController();
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: process.removeListener needs the same function object that process.on received.
    const stopped = (signal: NodeJS.Signals): void => {
        process.exitCode = signal === 'SIGINT' ? 130 : 143;
        controller.abort();
    };
    process.on('SIGINT', stopped);
    process.on('SIGTERM', stopped);
    try {
        await preparePlugin(command, cwd, timeoutMs, controller.signal);
    } finally {
        process.removeListener('SIGINT', stopped);
        process.removeListener('SIGTERM', stopped);
    }
}
