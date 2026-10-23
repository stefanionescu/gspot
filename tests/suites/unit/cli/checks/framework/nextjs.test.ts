import { join, basename } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import * as processes from '#cli/system/processes.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { open, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { type SpawnResult, type AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { TSC_PLAIN_OUTPUT, TSC_BUILD_COMMAND } from '#cli/config/checks/language/typescript/compiler.ts';

import {
    NEXT_LAUNCHER,
    UNRELATED_FILE,
    NEXT_CACHE_BYTES,
    AUTHORED_NEXT_ENV,
    TSC_FAILURE_OUTPUT,
    NEXT_VERSION_OUTPUT,
    RETAINED_ROUTE_TYPES,
    OUTPUT_PRESERVATION_CASES,
    TYPESCRIPT_VERSION_OUTPUT,
} from '#tests/config/checks/framework/nextjs.ts';

/**
 * Create a Next.js project with tracked source and untracked build output, for the checks that build in a copy.
 *
 * @param sandboxRoot folder for the project.
 * @param scope folder of the Next.js project.
 * @returns the session after apply and commit.
 */
async function prepareNextjsBuild(sandboxRoot: string, scope: string): Promise<Session> {
    await createFileTree(sandboxRoot, {
        'gspot.toml': buildSandboxSettings(['nextjs'], { level: 'all', scopes: scope === '' ? [] : [{ path: scope }] }),
        [join(scope, 'package.json')]: JSON.stringify({
            private: true,
            dependencies: { next: '16.3.5' },
            scripts: {
                build: `NODE_ENV=production next build ${scope === '' ? '--webpack' : '--turbopack'} && echo done`,
            },
        }),
        [join(scope, 'tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
        [join(scope, 'next-env.d.ts')]: AUTHORED_NEXT_ENV,
        [join(scope, '.next/types/routes.d.ts')]: RETAINED_ROUTE_TYPES,
        [join(scope, 'src/app/page.ts')]: 'bad input\n',
        'node_modules/.bin/next': NEXT_LAUNCHER,
        [UNRELATED_FILE.path]: UNRELATED_FILE.text,
    });
    await applyGeneratedFiles(sandboxRoot);
    commitAll(sandboxRoot);
    await writeFile(join(sandboxRoot, join(scope, '.next/local-cache.bin')), Buffer.from(NEXT_CACHE_BYTES));
    const session = await openSession(sandboxRoot);
    await chmod(join(sandboxRoot, join(scope, 'tsconfig.json')), 0o640);
    return session;
}

/**
 * Fake executable lookup and both process functions until disposal. The fakes return the output and files that Next.js writes.
 *
 * @param fakeRun the process behavior supplied by the caller.
 * @returns the recorded commands and a disposer that removes the fakes.
 */
function fakeNextjsCommands(fakeRun: (command: readonly string[], options: AsyncSpawnOptions) => Promise<SpawnResult>) {
    using resources = new DisposableStack();

    const folders: string[] = [];
    const commands: string[][] = [];
    resources.use(fakeExecutableLookup(process.execPath));
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
            if (command[0] === 'git') return runBlocking(command, options);
            return buildProcessResult({
                stdout: basename(command[0] ?? '') === 'next' ? NEXT_VERSION_OUTPUT : TYPESCRIPT_VERSION_OUTPUT,
            });
        }),
    );
    const nativeRun = processes.spawnProcess;
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (command, options) => {
            if (command[0] === 'git') return await nativeRun(command, options);
            const cwd = options.cwd;
            folders.push(cwd);
            commands.push([...command]);
            return await fakeRun(command, options);
        }),
    );
    const owned = resources.move();
    return {
        folders,
        commands,
        [Symbol.dispose]() {
            owned.dispose();
        },
    };
}

test.each([...OUTPUT_PRESERVATION_CASES])(
    'nextjs/tsc in the $name scope reports its finding, passes after the fix, and leaves tsconfig.json, .next, and next-env.d.ts unchanged',
    async ({ scope }) => {
        await using sandbox = await testdir();
        const session = await prepareNextjsBuild(sandbox.path, scope);

        const planned = planChecks(session, { stage: 'push', only: ['nextjs/tsc'] }).find(
            (entry) => entry.scope.folder.path === scope,
        )!;
        const untracked = join(sandbox.path, join(scope, '.next/local-cache.bin'));
        const config = join(sandbox.path, join(scope, 'tsconfig.json'));
        await using originalFile = await open(config, 'r');
        const original = await originalFile.readFile();
        const { mode } = await originalFile.stat();
        const routesSeen: string[] = [];
        async function fakeNextjsBuild(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
            const cwd = options.cwd;
            const page = await readFile(join(cwd, 'src/app/page.ts'), 'utf8');
            const isBad = page.includes('bad');
            if (['typegen', 'build'].includes(command[1] ?? '')) {
                await writeFile(join(cwd, 'tsconfig.json'), '{}\n');
                await writeFile(join(cwd, 'next-env.d.ts'), '// Generated\n');
                await mkdir(join(cwd, '.next/types'), { recursive: true });
                await writeFile(join(cwd, '.next/types/routes.d.ts'), '// Generated routes\n');
            } else routesSeen.push(await readFile(join(cwd, '.next/types/routes.d.ts'), 'utf8'));
            const failed = isBad && command[1] !== 'typegen';
            return buildProcessResult({ code: failed ? 1 : 0, stdout: failed ? TSC_FAILURE_OUTPUT : '' });
        }
        using read = fakeNextjsCommands(fakeNextjsBuild);
        const { folders } = read;
        const { findings: found } = await runCheckCode(session, planned, findCheckCode(planned.check));
        expect(
            found.map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
        ).toStrictEqual([
            {
                check: 'nextjs/tsc',
                file: convertToPosixPath(join(scope, 'src/app/page.ts')),
                line: 1,
                rule: 'TS2322',
                message: 'Type mismatch',
            },
        ]);
        await writeFile(join(sandbox.path, join(scope, 'src/app/page.ts')), 'corrected input\n');
        expect(await runCheckCode(session, planned, findCheckCode(planned.check))).toMatchObject({ findings: [] });
        expect(routesSeen).toStrictEqual(['// Generated routes\n', '// Generated routes\n']);
        expect(folders).not.toContain(join(sandbox.path, scope));
        expect(await Promise.all(folders.map((cwd) => isOnDisk(cwd)))).toStrictEqual(folders.map(() => false));
        await using currentFile = await open(config, 'r');
        expect(await currentFile.readFile()).toStrictEqual(original);
        const current = await currentFile.stat();
        expect(current.mode).toBe(mode);
        expect(await readFile(untracked)).toStrictEqual(Buffer.from(NEXT_CACHE_BYTES));
        expect(await readFile(join(sandbox.path, join(scope, 'next-env.d.ts')), 'utf8')).toBe(AUTHORED_NEXT_ENV);
        expect(await readFile(join(sandbox.path, join(scope, '.next/types/routes.d.ts')), 'utf8')).toBe(
            RETAINED_ROUTE_TYPES,
        );
        expect(await readFile(join(sandbox.path, UNRELATED_FILE.path), 'utf8')).toBe(UNRELATED_FILE.text);
    },
);

test('nextjs/tsc removes its copy after a failed type generation and keeps a concurrent edit to tsconfig.json', async () => {
    const message = 'Generator failed';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': NEXT_LAUNCHER,
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['nextjs/tsc'] })[0]!;
    let scratch = '';
    using _fakes = fakeNextjsCommands(async (...[, options]) => {
        scratch = options.cwd;
        await writeFile(join(scratch, 'tsconfig.json'), 'partial generator output\n');
        await writeFile(join(sandbox.path, 'tsconfig.json'), 'Concurrent developer edit\n');
        return buildProcessResult({ code: 1, stderr: `Error: ${message}` });
    });
    expect(await captureRejection(runCheckCode(session, planned, findCheckCode(planned.check)))).toBe(
        `The next typegen command failed: Error: ${message}`,
    );
    expect(scratch).not.toBe('');
    expect(await isOnDisk(scratch)).toBe(false);
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
    expect(await isOnDisk(join(sandbox.path, 'next-env.d.ts'))).toBe(false);
});

test.each(['', 'apps/web'])(
    'nextjs/tsc builds a project with references in the copy where next typegen ran, in scope %j',
    async (scope) => {
        await using sandbox = await testdir();
        await prepareNextjsBuild(sandbox.path, scope);
        const authored = '{"files":[],"references":[{"path":"./src"}]}';
        await writeFile(join(sandbox.path, scope, 'tsconfig.json'), authored);
        await writeFile(
            join(sandbox.path, scope, 'src/tsconfig.json'),
            '{"compilerOptions":{"composite":true,"noEmit":true},"files":["app/page.ts"]}',
        );
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'push', only: ['nextjs/tsc'] }).find(
            (entry) => entry.scope.folder.path === scope,
        )!;
        using read = fakeNextjsCommands(async (command, options) => {
            if (command[1] === 'typegen')
                await writeFile(join(options.cwd, 'next-env.d.ts'), '// Generated in this copy\n');
            else expect(await readFile(join(options.cwd, 'next-env.d.ts'), 'utf8')).toBe('// Generated in this copy\n');
            return buildProcessResult();
        });
        const { folders, commands } = read;
        const result = await runCheckCode(session, planned, findCheckCode(planned.check));
        expect(result).toMatchObject({ status: 'passed', findings: [] });
        const copy = folders[0]!;
        expect(folders).toStrictEqual([copy, copy]);
        expect(commands[1]?.slice(1)).toStrictEqual([
            ...TSC_BUILD_COMMAND.slice(1),
            join(copy, 'tsconfig.json'),
            ...TSC_PLAIN_OUTPUT,
        ]);
        expect(await isOnDisk(copy)).toBe(false);
        expect(await readFile(join(sandbox.path, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
        expect(await readFile(join(sandbox.path, scope, 'next-env.d.ts'), 'utf8')).toBe(AUTHORED_NEXT_ENV);
    },
);
