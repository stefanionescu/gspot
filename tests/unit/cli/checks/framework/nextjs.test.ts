import executables from 'which';
import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { planRun } from '#cli/planning/checks.ts';
import * as nextjs from '#tests/config/nextjs.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import type { Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { processResult } from '#tests/setup/processes.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { nextjsTsc, nextConfig } from '#cli/checks/framework/nextjs.ts';
import { open, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';

import {
    NEXT_CACHE_BYTES,
    NEXT_CONFIG_CASES,
    TSC_FAILURE_OUTPUT,
    NEXT_VERSION_OUTPUT,
    TYPESCRIPT_VERSION_OUTPUT,
} from '#tests/config/nextjs.ts';

for (const entry of nextjs.NEXT_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(nextjs.NEXT_REPOSITORY);
        await runCheckSample(sandbox, entry, nextjs.NEXT_REPOSITORY);
    });
}

/**
 * Replace executable lookup and both process runners until disposal. Simulate generated files and diagnostics.
 * @param runCallback the native command result for tests with a different process outcome.
 * @returns captured commands and a disposer that restores the mocked boundaries.
 */
function mockNextjsCommands(
    runCallback?: (command: readonly string[], options: AsyncSpawnOptions) => Promise<SpawnResult>,
) {
    using resources = new DisposableStack();

    const failureOutput = {
        stdout: TSC_FAILURE_OUTPUT,
        stderr: '',
    };
    const directories: string[] = [];
    const commands: string[][] = [];
    // Record command arguments and source files for assertions after the check.
    const routesSeen: string[] = [];
    resources.use(
        spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
            options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync),
    );
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
            if (command[0] === 'git') return runBlocking(command, options);
            return processResult({
                stdout: basename(command[0] ?? '') === 'next' ? NEXT_VERSION_OUTPUT : TYPESCRIPT_VERSION_OUTPUT,
            });
        }),
    );
    const nativeRun = processes.run;
    resources.use(
        spyOn(processes, 'run').mockImplementation(async (command, options, output) => {
            if (command[0] === 'git') return await nativeRun(command, options, output);
            const cwd = options.cwd;
            directories.push(cwd);
            commands.push([...command]);
            if (runCallback !== undefined) return await runCallback(command, options);
            const page = await readFile(join(cwd, 'src/app/page.ts'), 'utf8');
            const isBad = page.includes('bad');
            if (['typegen', 'build'].includes(command[1] ?? '')) {
                await writeFile(join(cwd, 'tsconfig.json'), '{}\n');
                await writeFile(join(cwd, 'next-env.d.ts'), '// Generated\n');
                await mkdir(join(cwd, '.next/types'), { recursive: true });
                await writeFile(join(cwd, '.next/types/routes.d.ts'), '// Generated routes\n');
            } else routesSeen.push(await readFile(join(cwd, '.next/types/routes.d.ts'), 'utf8'));
            const failed = isBad && command[1] !== 'typegen';
            return processResult({ code: failed ? 1 : 0, ...(failed ? failureOutput : {}) });
        }),
    );
    const owned = resources.move();
    return {
        directories,
        routesSeen,
        commands,
        [Symbol.dispose]() {
            owned.dispose();
        },
    };
}

for (const scope of ['', 'app'])
    for (const check of ['nextjs/tsc'])
        test(`Next.js output preservation in ${scope || 'root'}: ${check} reports its finding, passes after the fix, and preserves source output`, async () => {
            await using directory = await testdir();
            const session = await prepareNextjsBuild(directory.path, scope);

            const planned = planRun(session, { stage: 'push', only: [check] }).find(
                (entry) => entry.scope.scope.path === scope,
            )!;
            const untracked = join(directory.path, join(scope, '.next/local-cache.bin'));
            const config = join(directory.path, join(scope, 'tsconfig.json'));
            await using originalFile = await open(config, 'r');
            const original = await originalFile.readFile();
            const { mode } = await originalFile.stat();
            using read = mockNextjsCommands();
            const { directories, routesSeen } = read;
            const execute = async () => {
                const result = await nextjsTsc(session, planned);
                return result.findings;
            };
            const found = await execute();
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({
                check,
                file: convertToPosixPath(join(scope, 'src/app/page.ts')),
                line: 1,
            });
            expect(found[0]!.message).toContain('Type mismatch');
            await writeFile(join(directory.path, join(scope, 'src/app/page.ts')), 'corrected input\n');
            expect(await execute()).toStrictEqual([]);
            expect(routesSeen.every((text) => text === '// Generated routes\n')).toBe(true);
            expect(directories).not.toContain(join(directory.path, scope));
            expect(await Promise.all(directories.map((cwd) => pathExists(cwd)))).toStrictEqual(
                directories.map(() => false),
            );
            await using currentFile = await open(config, 'r');
            expect(await currentFile.readFile()).toStrictEqual(original);
            const current = await currentFile.stat();
            expect(current.mode).toBe(mode);
            expect(await readFile(untracked)).toStrictEqual(Buffer.from(NEXT_CACHE_BYTES));
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

test("a failed type generation removes the scratch copy and keeps the developer's edit", async () => {
    using resources = new DisposableStack();

    const diagnostic = 'Generator failed';
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
    });
    const session = await openSession(directory.path);
    const planned = planRun(session, { stage: 'push', only: ['nextjs/tsc'] })[0]!;
    let scratch = '';
    resources.use(
        mockNextjsCommands(async (...[, options]) => {
            scratch = options.cwd;
            await writeFile(join(scratch, 'tsconfig.json'), 'partial generator output\n');
            await writeFile(join(directory.path, 'tsconfig.json'), 'Concurrent developer edit\n');
            return processResult({ code: 1, stderr: `Error: ${diagnostic}` });
        }),
    );
    expect(await rejection(nextjsTsc(session, planned))).toContain(diagnostic);
    expect(scratch).not.toBe('');
    expect(await pathExists(scratch)).toBe(false);
    expect(await readFile(join(directory.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
    expect(await pathExists(join(directory.path, 'next-env.d.ts'))).toBe(false);
});

// Next.js projects for disposable build verification.

/**
 * Prepare tracked and untracked output for disposable Next.js build checks.
 * @param root the sandbox root.
 * @param scope the selected project path.
 * @returns the repository session with native generated configurations.
 */
async function prepareNextjsBuild(root: string, scope: string): Promise<Session> {
    const scopeTable = scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`;
    await createFileTree(root, {
        'gspot.toml': settingsText(['nextjs'], { level: 'all', tables: scopeTable }),
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
        [join(scope, 'src/app/page.ts')]: 'bad input\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
        'unrelated/private.txt': 'Preserve unrelated scope\n',
    });
    const applied = await runGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(root);
    await writeFile(join(root, join(scope, '.next/local-cache.bin')), Buffer.from(NEXT_CACHE_BYTES));
    const session = await openSession(root);
    await chmod(join(root, join(scope, 'tsconfig.json')), 0o640);
    return session;
}

for (const scope of ['', 'apps/web'])
    test(`Next.js reference compilation keeps the type generation copy in ${scope || 'root'}`, async () => {
        await using sandbox = await testdir();
        await prepareNextjsBuild(sandbox.path, scope);
        const authored = '{"files":[],"references":[{"path":"./src"}]}';
        await writeFile(join(sandbox.path, scope, 'tsconfig.json'), authored);
        await writeFile(
            join(sandbox.path, scope, 'src/tsconfig.json'),
            '{"compilerOptions":{"composite":true,"noEmit":true},"files":["app/page.ts"]}',
        );
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'push', only: ['nextjs/tsc'] }).find(
            (entry) => entry.scope.scope.path === scope,
        )!;
        using read = mockNextjsCommands(async (command, options) => {
            if (command[1] === 'typegen')
                await writeFile(join(options.cwd, 'next-env.d.ts'), '// Generated in this copy\n');
            else expect(await readFile(join(options.cwd, 'next-env.d.ts'), 'utf8')).toBe('// Generated in this copy\n');
            return processResult();
        });
        const { directories, commands } = read;
        const result = await nextjsTsc(session, planned);
        expect(result).toMatchObject({ status: 'passed', findings: [] });
        expect(directories).toHaveLength(2);
        expect(new Set(directories).size).toBe(1);
        expect(commands[1]).toContain('-b');
        expect(await pathExists(directories[0]!)).toBe(false);
        expect(await readFile(join(sandbox.path, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
        expect(await readFile(join(sandbox.path, scope, 'next-env.d.ts'), 'utf8')).toBe(
            '// Authored type declaration\n',
        );
    });

test.each([...NEXT_CONFIG_CASES])('next.config secrets and turned-off checks: $name', async ({ source, expected }) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['nextjs']),
        'next.config.ts': source,
    });
    expect(nextConfig(buildCheckInput(await openSession(sandbox.path), 'nextjs/next-config'))).toStrictEqual([
        ...expected,
    ]);
});
