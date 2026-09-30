import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { root } from '#tests/support/package/packages.ts';
import { publishRelease } from '#tests/support/package/published.ts';
import { startRegistry, settleRegistry } from '#tests/support/registry/lifecycle.ts';

const controller = new AbortController();
process.on('SIGINT', () => {
    process.exitCode = 130;
    controller.abort();
});
process.on('SIGTERM', () => {
    process.exitCode = 143;
    controller.abort();
});
try {
    const registry = await startRegistry(0, undefined, controller.signal);
    let executionError: unknown;
    try {
        const release = await publishRelease(registry, controller.signal);
        const args = process.argv.slice(2);
        const executed = await run(
            [process.execPath, 'test', '--timeout', '60000', ...(args.length === 0 ? ['./acceptance/package'] : args)],
            {
                cwd: join(root, 'tests'),
                env: { GSPOT_RELEASE_FIXTURE: JSON.stringify(release) },
                cancelSignal: controller.signal,
                timeoutMs: 30 * 60_000,
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
    process.removeListener('SIGINT', () => {
        process.exitCode = 130;
        controller.abort();
    });
    process.removeListener('SIGTERM', () => {
        process.exitCode = 143;
        controller.abort();
    });
}
