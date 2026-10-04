// Runs the package acceptance tests against a release published to a throwaway local registry.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { remainingTime } from '#automation/deadline.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import type { Registry } from '#automation/types/registry.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { workspaceRoot as root } from '#automation/workspace.ts';
import type { PublishedRelease } from '#automation/types/package.ts';
import { startRegistry, settleRegistry } from '#registry/lifecycle.ts';
import { PACKAGE_SUITE_TIMEOUT_MS } from '#automation/config/package.ts';
import { TERMINATED_EXIT, INTERRUPTED_EXIT, NATIVE_TEST_TIMEOUT_MS } from '#automation/config/plugin.ts';

/**
 * Builds the CLI and publishes both packages into the caller-owned registry.
 * @param registry the registry retained for the consumer suite.
 * @param signal cancels the build and the publication
 * @param deadline the complete package suite deadline
 * @returns the registry, the published version, and the tool npmrc
 */
async function publishRelease(registry: Registry, signal: AbortSignal, deadline: number): Promise<PublishedRelease> {
    registry.assertRunning();
    for (const [folder, build] of [
        ['packages/eslint-plugin', undefined],
        ['packages/cli', 'packages/cli/scripts/build.ts'],
    ] as const) {
        const remaining = remainingTime(deadline, `building or publishing ${folder}`);
        const options = {
            cwd: root,
            env: { NODE_PATH: undefined, NODE_OPTIONS: undefined },
            timeoutMs: Math.min(NATIVE_TEST_TIMEOUT_MS, remaining),
            cancelSignal: signal,
            onStderr: (chunk: string) => {
                process.stderr.write(chunk);
            },
        };
        if (build !== undefined) {
            const built = await run([process.execPath, build], options);
            if (built.code !== 0) throw new Error(`The build of ${folder} failed: ${built.stdout}${built.stderr}`);
        }
        const publicationBudget = remainingTime(deadline, `publishing ${folder}`);
        const published = await run(
            ['npm', 'publish', '--ignore-scripts', '--registry', registry.url, '--userconfig', registry.npmrc],
            { ...options, cwd: join(root, folder), timeoutMs: Math.min(NATIVE_TEST_TIMEOUT_MS, publicationBudget) },
        );
        if (published.code !== 0)
            throw new Error(`The publication of ${folder} failed: ${published.stdout}${published.stderr}`);
    }
    return { registry, version: packageManifest.version };
}

const controller = new AbortController();

const stop = (signal: NodeJS.Signals): void => {
    process.exitCode = signal === 'SIGINT' ? INTERRUPTED_EXIT : TERMINATED_EXIT;
    controller.abort();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
    const deadline = performance.now() + PACKAGE_SUITE_TIMEOUT_MS;
    const registry = await startRegistry({
        signal: controller.signal,
        startupMs: Math.min(NATIVE_TEST_TIMEOUT_MS, PACKAGE_SUITE_TIMEOUT_MS),
    });
    let executionError: unknown;
    try {
        const release = await publishRelease(registry, controller.signal, deadline);
        const args = process.argv.slice(ARGUMENT_START);
        const separator = args.indexOf('--');
        const flags = separator === -1 ? args : args.slice(0, separator);
        const paths = separator === -1 ? [] : args.slice(separator + 1);
        const remaining = remainingTime(deadline, 'running consumer tests');
        const executed = await run(
            [
                process.execPath,
                'test',
                '--timeout',
                String(NATIVE_TEST_TIMEOUT_MS),
                ...flags,
                ...(paths.length === 0 ? ['./packages'] : paths),
            ],
            {
                cwd: join(root, 'tests'),
                env: { GSPOT_PACKAGE_RELEASE: JSON.stringify(release) },
                cancelSignal: controller.signal,
                timeoutMs: remaining,
                onStdout: (chunk) => {
                    process.stdout.write(chunk);
                },
                onStderr: (chunk) => {
                    process.stderr.write(chunk);
                },
            },
        );
        process.exitCode ||= executed.code;
    } catch (error) {
        if (!controller.signal.aborted) executionError = error;
    }
    await settleRegistry(registry, executionError);
} finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
}
