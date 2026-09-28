import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { runSourceCommand } from '#tests/support/registry/plugin.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TESTS = join(ROOT, 'tests');
const ACCEPTANCE = join(TESTS, 'acceptance/source');
const TEST_MS = 90 * 60_000;

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
            'Usage: mise run test:acceptance -- [acceptance path ...] [--test-name-pattern <pattern>]\n\nPaths are relative to tests/. Only source acceptance is selected.',
        );
        return;
    }
    const selected = acceptanceArguments(args);
    await runSourceCommand([process.execPath, 'test', ...selected], TESTS, TEST_MS);
}

if (import.meta.main) await main();

/** Select only source acceptance paths and Bun name filters. */
export function acceptanceArguments(args: readonly string[]): string[] {
    const paths: string[] = [];
    const flags: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]!;
        if (['--test-name-pattern', '-t'].includes(argument)) {
            const pattern = args[++index];
            if (pattern === undefined || pattern === '') throw new Error(`${argument} requires a pattern.`);
            flags.push('--test-name-pattern', pattern);
            continue;
        }
        paths.push(sourceAcceptancePath(argument));
    }
    return ['--timeout', '60000', ...flags, ...(paths.length === 0 ? [ACCEPTANCE] : paths)];
}
