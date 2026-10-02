import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { ACCEPTANCE_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { runSourceCommand } from '#tests/harness/registry/plugin.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TESTS = join(ROOT, 'tests');
const ACCEPTANCE = join(TESTS, 'acceptance');
// The Bun option that splits a run across CI jobs, by file count.
const SHARDING = /^--shard=[1-9]\d*\/[1-9]\d*$/u;
// Acceptance files that fail on Windows today, with the cause. A full Windows run leaves them out until the stage that
// moves acceptance cases to faster tiers fixes them; every other system runs them.
const WINDOWS_PENDING = new Map<string, string>([
    ['cli/cancellation.test.ts', 'a signal exits 130 where 2 is expected'],
    ['cli/ci.test.ts', 'the planted job runs /bin/bash, which Windows lacks'],
    ['cli/commits.test.ts', 'commitlint runs time out on the Windows runner'],
    ['cli/configuration-arrival.test.ts', 'gspot add times out on the Windows runner'],
    ['cli/example.test.ts', 'the sandbox install fails on Windows'],
    ['cli/format-overrides.test.ts', 'times out on the Windows runner'],
    ['cli/commit-hook.test.ts', 'checkout writes CRLF, which ShellCheck reports'],
    ['cli/ignored-execution.test.ts', 'findings carry backslash paths'],
    ['cli/clone.test.ts', 'checkout line endings change the adopted bytes'],
    ['cli/profile.test.ts', 'checkout line endings change the exported bytes'],
    ['cli/scopes.test.ts', 'times out on the Windows runner'],
    ['cli/selectors.test.ts', 'the index snapshot reads checkout line endings'],
    ['kits/framework/astro.test.ts', 'astro check times out on the Windows runner'],
    ['kits/language/bash/checks.test.ts', 'the strict-mode cases need a POSIX Bash'],
    ['kits/language/bash/lifecycle.test.ts', 'the sandbox reads checkout line endings'],
    ['kits/language/bash/syntax.test.ts', 'Git root discovery fails in the Windows sandbox'],
    ['kits/framework/component-files/accessibility.test.ts', 'times out on the Windows runner'],
    [
        'kits/framework/component-files/formatting.test.ts',
        'the sandbox install runs past five minutes on the Windows runner',
    ],
    [
        'kits/framework/component-files/styles.test.ts',
        'the sandbox install runs past five minutes on the Windows runner',
    ],
    ['kits/framework/component-files/testing.test.ts', 'the sandbox install fails on Windows'],
    ['kits/framework/component-files/types.test.ts', 'the sandbox install fails on Windows'],
    ['kits/framework/components.test.ts', 'findings carry backslash paths'],
    ['kits/general/dependencies.test.ts', 'bun refuses the planted lockfile on Windows'],
    ['kits/tool/docker.test.ts', 'bun refuses the planted lockfile on Windows'],
    ['kits/framework/express.test.ts', 'the sandbox install fails on Windows'],
    ['kits/general/files.test.ts', 'Taplo reports checkout line endings'],
    ['kits/tool/jest.test.ts', 'the sandbox install fails on Windows'],
    ['kits/library/libraries.test.ts', 'the sandbox install fails on Windows'],
    ['kits/general/licenses.test.ts', 'the license tool falls below its version floor on Windows'],
    ['kits/framework/nestjs.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/framework/nextjs/checks.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/framework/nextjs/delegation.test.ts', 'the sandbox install fails on Windows'],
    ['kits/framework/nextjs/selection.test.ts', 'times out on the Windows runner'],
    ['kits/tool/nginx.test.ts', 'the Windows runner has no nginx container'],
    ['kits/platform/supabase.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/tool/pytest.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/language/python/docstrings.test.ts', 'the sandbox install runs past five minutes on the Windows runner'],
    ['kits/language/python/tools.test.ts', 'the sandbox install fails on Windows'],
    ['kits/framework/react.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/general/secrets/pushed.test.ts', 'the history scan reads checkout line endings'],
    ['kits/general/security.test.ts', 'Semgrep times out on the Windows runner'],
    ['kits/general/static-site.test.ts', 'the setup hook times out on the Windows runner'],
    ['kits/language/typescript/eslint.test.ts', 'times out on the Windows runner'],
    ['kits/language/typescript/javascript.test.ts', 'the sandbox install fails on Windows'],
    ['kits/language/typescript/planted-checks.test.ts', 'times out on the Windows runner'],
    ['kits/language/typescript/projects.test.ts', 'the sandbox install fails on Windows'],
    ['kits/framework/vite.test.ts', 'times out on the Windows runner'],
    ['kits/tool/vitest.test.ts', 'the sandbox install fails on Windows'],
    ['kits/tool/xctest.test.ts', 'the setup hook times out on the Windows runner'],
]);

function sourceAcceptancePath(argument: string): string {
    if (argument.startsWith('-')) throw new Error(`Unsupported acceptance option: ${argument}.`);
    const selected = realpathSync(resolve(process.cwd(), argument));
    const within = relative(ACCEPTANCE, selected);
    if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within))
        throw new Error('Select a test under tests/acceptance.');
    return selected;
}

// Every source acceptance file, without the files still pending on Windows when this is Windows.
function defaultPaths(): string[] {
    if (process.platform !== 'win32') return [ACCEPTANCE];
    const files = [...new Bun.Glob('**/*.test.ts').scanSync({ cwd: ACCEPTANCE })].map((file) =>
        file.replaceAll('\\', '/'),
    );
    return files
        .filter((file) => !WINDOWS_PENDING.has(file))
        .toSorted((a, b) => a.localeCompare(b))
        .map((file) => join(ACCEPTANCE, file));
}

// Select only source acceptance paths, Bun name filters, and the Bun option that shards a CI run.
function acceptanceArguments(args: readonly string[]): string[] {
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
    return ['--timeout', '60000', ...flags, ...sharding, ...(paths.length === 0 ? defaultPaths() : paths)];
}

/** Build and serve the local plugin while exercising source CLI consumers. */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log(
            'Usage: mise run test:acceptance -- [acceptance path ...] [--test-name-pattern <pattern>] [--shard=<k>/<n>]\n\nPaths are relative to tests/. Only source acceptance is selected.',
        );
        return;
    }
    const selected = acceptanceArguments(args);
    await runSourceCommand([process.execPath, 'test', ...selected], TESTS, ACCEPTANCE_TIMEOUT_MS);
}

if (import.meta.main) await main();
