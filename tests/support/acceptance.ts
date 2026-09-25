import { run } from '#cli/platform/spawn.ts';
import { startRegistry } from '#tests/support/registry/lifecycle.ts';
import { realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TESTS = join(ROOT, 'tests');
const ACCEPTANCE = join(TESTS, 'acceptance/source');
const SETUP_MS = 60_000;
const TEST_MS = 30 * 60_000;

/** Select only source acceptance paths and Bun name filters. */
export function acceptanceArguments(args: readonly string[]): string[] {
    const paths: string[] = [];
    const flags: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]!;
        if (argument === '--test-name-pattern' || argument === '-t') {
            const pattern = args[++index];
            if (pattern === undefined || pattern === '') throw new Error(`${argument} requires a pattern.`);
            flags.push('--test-name-pattern', pattern);
            continue;
        }
        if (argument.startsWith('-')) throw new Error(`Unsupported acceptance option: ${argument}.`);
        const selected = realpathSync(resolve(process.cwd(), argument));
        const within = relative(ACCEPTANCE, selected);
        if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within))
            throw new Error('Select a source test under tests/acceptance/source.');
        paths.push(selected);
    }
    return ['--timeout', '60000', ...flags, ...(paths.length === 0 ? [ACCEPTANCE] : paths)];
}

/** Build and serve the local plugin while exercising source CLI consumers. */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log(
            'Usage: mise run test:acceptance -- [acceptance path ...] [--test-name-pattern <pattern>]\n\nPaths are relative to tests/. Only source acceptance is selected.',
        );
        return;
    }
    const selected = acceptanceArguments(args);
    const controller = new AbortController();
    const interrupt = () => {
        process.exitCode = 130;
        controller.abort();
    };
    const terminate = () => {
        process.exitCode = 143;
        controller.abort();
    };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const output = {
        cancelSignal: controller.signal,
        onStdout: (chunk: string) => {
            process.stdout.write(chunk);
        },
        onStderr: (chunk: string) => {
            process.stderr.write(chunk);
        },
    };
    try {
        const built = await run([process.execPath, 'packages/eslint-plugin/build.ts'], {
            cwd: ROOT,
            timeoutMs: SETUP_MS,
            ...output,
        });
        if (built.code !== 0 || controller.signal.aborted) {
            process.exitCode ||= built.code;
            return;
        }
        const registry = await startRegistry(0, SETUP_MS, controller.signal);
        let executionError: unknown;
        try {
            if (controller.signal.aborted) return;
            const published = await run(['npm', 'publish', '--ignore-scripts', '--registry', registry.url], {
                cwd: join(ROOT, 'packages/eslint-plugin'),
                env: { NPM_CONFIG_USERCONFIG: registry.npmrc },
                timeoutMs: SETUP_MS,
                ...output,
            });
            if (published.code !== 0 || controller.signal.aborted) {
                process.exitCode ||= published.code;
                return;
            }
            writeFileSync(
                registry.npmrc,
                `@gspot:registry=${registry.url}\n${registry.url.replace('http:', '')}/:_authToken=fake\n`,
                { mode: 0o600 },
            );
            const tested = await run([process.execPath, 'test', ...selected], {
                cwd: TESTS,
                env: {
                    NPM_CONFIG_USERCONFIG: registry.npmrc,
                    BUN_INSTALL_CACHE_DIR: join(registry.work, 'bun-cache'),
                },
                timeoutMs: TEST_MS,
                ...output,
            });
            process.exitCode ||= tested.code;
        } catch (error) {
            executionError = error;
            throw error;
        } finally {
            try {
                await registry.stop();
            } catch (cleanupError) {
                if (executionError !== undefined)
                    throw new AggregateError(
                        [executionError, cleanupError],
                        'Acceptance execution and cleanup failed.',
                    );
                throw cleanupError;
            }
        }
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', terminate);
    }
}

if (import.meta.main) await main();
