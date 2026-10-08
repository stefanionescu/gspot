import executables from 'which';
import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { planRun } from '#cli/planning/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { nextjsTsc } from '#cli/checks/framework/public.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { stat, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { NextjsCommands } from '#tests/types/cli/checks/framework/nextjs.ts';

/**
 * Replace executable lookup and both process runners until disposal. Simulate generated files and diagnostics.
 * @param check the Next.js command whose diagnostic format to simulate
 * @returns captured commands and a disposer that restores the mocked boundaries
 */
function mockNextjsCommands(check: string): NextjsCommands {
    const failureOutput = {
        stdout: check === 'nextjs/tsc' ? 'src/page.ts(1,1): error TS2322: Type mismatch\n' : '',
        stderr: check === 'nextjs/build' ? 'Error: Page is invalid\n' : '',
    };
    const directories: string[] = [];
    const commands: string[][] = [];
    // What the mocked commands were asked and saw, asserted once the check has run.
    const routesSeen: string[] = [];
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const runBlocking = processes.runBlocking;
    const inspection = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] === 'git') return runBlocking(command, options);
        return {
            code: 0,
            missing: false,
            duration: 1,
            stdout: basename(command[0] ?? '') === 'next' ? 'Next.js v16.3.5' : 'Version 5.9.3',
            stderr: '',
        };
    });
    const run = spyOn(processes, 'run').mockImplementation(async (command, options) => {
        const cwd = options.cwd;
        directories.push(cwd);
        commands.push([...command]);
        const page = await readFile(join(cwd, 'src/page.ts'), 'utf8');
        const isBad = page.includes('bad');
        if (['typegen', 'build'].includes(command[1] ?? '')) {
            await writeFile(join(cwd, 'tsconfig.json'), '{}\n');
            await writeFile(join(cwd, 'next-env.d.ts'), '// Generated\n');
            await mkdir(join(cwd, '.next/types'), { recursive: true });
            await writeFile(join(cwd, '.next/types/routes.d.ts'), '// Generated routes\n');
        } else routesSeen.push(await readFile(join(cwd, '.next/types/routes.d.ts'), 'utf8'));
        const failed = isBad && command[1] !== 'typegen';
        return {
            code: failed ? 1 : 0,
            missing: false,
            duration: 1,
            ...(failed ? failureOutput : { stdout: '', stderr: '' }),
        };
    });
    return {
        directories,
        routesSeen,
        commands,
        [Symbol.dispose]() {
            inspection.mockRestore();
            locate.mockRestore();
            run.mockRestore();
        },
    };
}

for (const scope of ['', 'apps/web'])
    for (const check of ['nextjs/tsc', 'nextjs/build'])
        test(`Next.js output preservation in ${scope || 'root'}: ${check} reports its finding, passes after the fix, and preserves source output`, async () => {
            await using directory = await testdir();
            const session = await prepareNextjsBuild(directory.path, scope);
            const input = buildCheckInput(session, check, { scope });
            const planned = planRun(session, { stage: 'push', skips: [], only: [check] }).find(
                (entry) => entry.scope.scope.path === scope,
            )!;
            const untracked = join(directory.path, join(scope, '.next/local-cache.bin'));
            const config = join(directory.path, join(scope, 'tsconfig.json'));
            const original = await readFile(config);
            const { mode } = await stat(config);
            using read = mockNextjsCommands(check);
            const { directories, routesSeen, commands } = read;
            const execute = async () => {
                if (check === 'nextjs/build') return BUILT_IN_CHECKS['nextjs/build'].input(input);
                const result = await nextjsTsc(session, planned);
                return result.findings;
            };
            const found = await execute();
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({
                check,
                file: toPosix(join(scope, check === 'nextjs/tsc' ? 'src/page.ts' : 'package.json')),
                line: 1,
            });
            expect(found[0]!.message).toContain(check === 'nextjs/tsc' ? 'Type mismatch' : 'Page is invalid');
            await writeFile(join(directory.path, join(scope, 'src/page.ts')), 'corrected input\n');
            expect(await execute()).toStrictEqual([]);
            if (check === 'nextjs/build')
                expect(commands.map((command) => command.slice(1))).toContainEqual([
                    'build',
                    scope === '' ? '--webpack' : '--turbopack',
                ]);
            expect(directories).not.toContain(join(directory.path, scope));
            expect(routesSeen.every((text) => text === '// Generated routes\n')).toBe(true);
            expect(await Promise.all(directories.map((cwd) => pathExists(cwd)))).toStrictEqual(
                directories.map(() => false),
            );
            expect(await readFile(config)).toStrictEqual(original);
            const current = await stat(config);
            expect(current.mode).toBe(mode);
            expect(await readFile(untracked)).toStrictEqual(Buffer.from([0, 255, 1, 2]));
            expect(await readFile(join(directory.path, join(scope, 'next-env.d.ts')), 'utf8')).toBe(
                '// Authored type declaration\n',
            );
            expect(await readFile(join(directory.path, join(scope, '.next/types/routes.d.ts')), 'utf8')).toBe(
                '// Retained route types\n',
            );
            expect(await readFile(join(directory.path, 'unrelated/private.txt'), 'utf8')).toBe(
                'Preserve unrelated scope\n',
            );
        });

test('failed type generation cleans the isolated copy without restoring over source edits', async () => {
    const diagnostic = 'Generator failed';
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
    });
    const session = await openSession(directory.path);
    const planned = planRun(session, { stage: 'push', skips: [], only: ['nextjs/tsc'] })[0]!;
    let scratch = '';
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const runBlocking = processes.runBlocking;
    const inspection = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (basename(command[0] ?? '') !== 'next') return runBlocking(command, options);
        return { code: 0, missing: false, duration: 1, stdout: 'Next.js v16.3.5', stderr: '' };
    });
    const run = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
        scratch = options.cwd;
        await writeFile(join(scratch, 'tsconfig.json'), 'partial generator output\n');
        await writeFile(join(directory.path, 'tsconfig.json'), 'Concurrent developer edit\n');
        return {
            code: 1,
            missing: false,
            duration: 1,
            stdout: '',
            stderr: `Error: ${diagnostic}`,
        };
    });
    try {
        expect(await rejection(nextjsTsc(session, planned))).toContain(diagnostic);
        expect(scratch).not.toBe('');
        expect(await pathExists(scratch)).toBe(false);
        expect(await readFile(join(directory.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
        expect(await pathExists(join(directory.path, 'next-env.d.ts'))).toBe(false);
    } finally {
        inspection.mockRestore();
        locate.mockRestore();
        run.mockRestore();
    }
});

// Next.js projects for disposable build verification.

/**
 * Prepare tracked and untracked output for disposable Next.js build checks.
 * @param root the sandbox root
 * @param scope the selected project path
 * @returns the repository session with native generated configurations
 */
async function prepareNextjsBuild(root: string, scope: string): Promise<ToolSession> {
    const scopeTable = scope === '' ? '' : `[scope."${scope}"]\n`;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['nextjs'], { tables: scopeTable }),
        [join(scope, 'package.json')]: JSON.stringify({
            private: true,
            dependencies: { next: '16.3.5' },
            scripts: {
                build: `NODE_ENV=production next build ${scope === '' ? '--webpack' : '--turbopack'} && echo done`,
            },
        }),
        [join(scope, 'tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
        [join(scope, 'next-env.d.ts')]: '// Authored type declaration\n',
        [join(scope, '.next/types/routes.d.ts')]: '// Retained route types\n',
        [join(scope, 'src/page.ts')]: 'bad input\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
        'unrelated/private.txt': 'Preserve unrelated scope\n',
    });
    const applied = await runGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(root);
    await writeFile(join(root, join(scope, '.next/local-cache.bin')), Buffer.from([0, 255, 1, 2]));
    const session = await openSession(root);
    await chmod(join(root, join(scope, 'tsconfig.json')), 0o640);
    return session;
}
