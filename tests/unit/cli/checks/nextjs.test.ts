import executables from 'which';
import { join, basename } from 'node:path';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { type Session } from '#cli/types/planning.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { checkNextjsTsc } from '#cli/checks/framework/nextjs.ts';
import { open, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { type SpawnResult, type AsyncSpawnOptions } from '#cli/types/system/processes.ts';

import {
    NEXT_CACHE_BYTES,
    TSC_FAILURE_OUTPUT,
    NEXT_VERSION_OUTPUT,
    TYPESCRIPT_VERSION_OUTPUT,
} from '#tests/data/checks/nextjs.ts';

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
    const folders: string[] = [];
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
            return buildProcessResult({ code: failed ? 1 : 0, ...(failed ? failureOutput : {}) });
        }),
    );
    const owned = resources.move();
    return {
        directories: folders,
        routesSeen,
        commands,
        [Symbol.dispose]() {
            owned.dispose();
        },
    };
}

describe.each(['', 'app'])('%s', (scope) => {
    test(`Next.js output preservation in ${scope || 'root'}: nextjs/tsc reports its finding, passes after the fix, and preserves source output`, async () => {
        await using folder = await testdir();
        const session = await prepareNextjsBuild(folder.path, scope);

        const planned = planRun(session, { stage: 'push', only: ['nextjs/tsc'] }).find(
            (entry) => entry.scope.scope.path === scope,
        )!;
        const untracked = join(folder.path, join(scope, '.next/local-cache.bin'));
        const config = join(folder.path, join(scope, 'tsconfig.json'));
        await using originalFile = await open(config, 'r');
        const original = await originalFile.readFile();
        const { mode } = await originalFile.stat();
        using read = mockNextjsCommands();
        const { directories: folders, routesSeen } = read;
        const collectFindings = async () => {
            const result = await checkNextjsTsc(session, planned);
            return result.findings;
        };
        const found = await collectFindings();
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            check: 'nextjs/tsc',
            file: convertToPosixPath(join(scope, 'src/app/page.ts')),
            line: 1,
        });
        expect(found[0]!.message).toContain('Type mismatch');
        await writeFile(join(folder.path, join(scope, 'src/app/page.ts')), 'corrected input\n');
        expect(await collectFindings()).toStrictEqual([]);
        expect(routesSeen.every((text) => text === '// Generated routes\n')).toBe(true);
        expect(folders).not.toContain(join(folder.path, scope));
        expect(await Promise.all(folders.map((cwd) => isOnDisk(cwd)))).toStrictEqual(folders.map(() => false));
        await using currentFile = await open(config, 'r');
        expect(await currentFile.readFile()).toStrictEqual(original);
        const current = await currentFile.stat();
        expect(current.mode).toBe(mode);
        expect(await readFile(untracked)).toStrictEqual(Buffer.from(NEXT_CACHE_BYTES));
        expect(await readFile(join(folder.path, join(scope, 'next-env.d.ts')), 'utf8')).toBe(
            '// Authored type declaration\n',
        );
        expect(await readFile(join(folder.path, join(scope, '.next/types/routes.d.ts')), 'utf8')).toBe(
            '// Retained route types\n',
        );
        expect(await readFile(join(folder.path, 'unrelated/private.txt'), 'utf8')).toBe('Preserve unrelated scope\n');
    });
});

test("a failed type generation removes the scratch copy and keeps the developer's edit", async () => {
    using resources = new DisposableStack();

    const message = 'Generator failed';
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
    });
    const session = await openSession(folder.path);
    const planned = planRun(session, { stage: 'push', only: ['nextjs/tsc'] })[0]!;
    let scratch = '';
    resources.use(
        mockNextjsCommands(async (...[, options]) => {
            scratch = options.cwd;
            await writeFile(join(scratch, 'tsconfig.json'), 'partial generator output\n');
            await writeFile(join(folder.path, 'tsconfig.json'), 'Concurrent developer edit\n');
            return buildProcessResult({ code: 1, stderr: `Error: ${message}` });
        }),
    );
    expect(await captureRejection(checkNextjsTsc(session, planned))).toContain(message);
    expect(scratch).not.toBe('');
    expect(await isOnDisk(scratch)).toBe(false);
    expect(await readFile(join(folder.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
    expect(await isOnDisk(join(folder.path, 'next-env.d.ts'))).toBe(false);
});

// Next.js projects for disposable build verification.

/**
 * Prepare tracked and untracked output for disposable Next.js build checks.
 * @param sandboxRoot the directory that receives tracked source and retained build outputs.
 * @param scope the selected project path.
 * @returns the repository session with native generated configurations.
 */
async function prepareNextjsBuild(sandboxRoot: string, scope: string): Promise<Session> {
    const scopeTable = scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`;
    await createFileTree(sandboxRoot, {
        'gspot.toml': buildSettingsText(['nextjs'], { level: 'all', tables: scopeTable }),
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
    const applied = await runGspot(sandboxRoot, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(sandboxRoot);
    await writeFile(join(sandboxRoot, join(scope, '.next/local-cache.bin')), Buffer.from(NEXT_CACHE_BYTES));
    const session = await openSession(sandboxRoot);
    await chmod(join(sandboxRoot, join(scope, 'tsconfig.json')), 0o640);
    return session;
}

test.each(['', 'apps/web'])(`Next.js reference compilation keeps the type generation copy in %s`, async (scope) => {
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
        return buildProcessResult();
    });
    const { directories: folders, commands } = read;
    const result = await checkNextjsTsc(session, planned);
    expect(result).toMatchObject({ status: 'passed', findings: [] });
    expect(folders).toHaveLength(2);
    expect(new Set(folders).size).toBe(1);
    expect(commands[1]).toContain('-b');
    expect(await isOnDisk(folders[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
    expect(await readFile(join(sandbox.path, scope, 'next-env.d.ts'), 'utf8')).toBe('// Authored type declaration\n');
});
