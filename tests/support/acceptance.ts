import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { runSourceCommand } from '#tests/support/registry/plugin.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TESTS = join(ROOT, 'tests');
const ACCEPTANCE = join(TESTS, 'acceptance/source');
const TEST_MS = 90 * 60_000;
// The Bun options that split a run across CI jobs and balance it by the recorded duration of each file.
const SHARDING = /^--(?:shard=[1-9]\d*\/[1-9]\d*|timings=\S+|update-timings)$/u;

function sourceAcceptancePath(argument: string): string {
    if (argument.startsWith('-')) throw new Error(`Unsupported acceptance option: ${argument}.`);
    const selected = realpathSync(resolve(process.cwd(), argument));
    const within = relative(ACCEPTANCE, selected);
    if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within))
        throw new Error('Select a source test under tests/acceptance/source.');
    return selected;
}

/** Build and serve the local plugin while exercising source CLI consumers. */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log(
            'Usage: mise run test:acceptance -- [acceptance path ...] [--test-name-pattern <pattern>] [--shard=<k>/<n>] [--timings=<file>] [--update-timings]\n\nPaths are relative to tests/. Only source acceptance is selected.',
        );
        return;
    }
    const selected = acceptanceArguments(args);
    await runSourceCommand([process.execPath, 'test', ...selected], TESTS, TEST_MS);
}

if (import.meta.main) await main();

/** Select only source acceptance paths, Bun name filters, and the Bun options that shard a CI run. */
export function acceptanceArguments(args: readonly string[]): string[] {
    const sharding = args.filter((argument) => SHARDING.test(argument));
    const rest = args.filter((argument) => !SHARDING.test(argument));
    const paths: string[] = [];
    const flags: string[] = [];
    for (let index = 0; index < rest.length; index += 1) {
        const argument = rest[index]!;
        if (['--test-name-pattern', '-t'].includes(argument)) {
            const pattern = rest[++index];
            if (pattern === undefined || pattern === '') throw new Error(`${argument} requires a pattern.`);
            flags.push('--test-name-pattern', pattern);
            continue;
        }
        paths.push(sourceAcceptancePath(argument));
    }
    return ['--timeout', '60000', ...flags, ...sharding, ...(paths.length === 0 ? [ACCEPTANCE] : paths)];
}
