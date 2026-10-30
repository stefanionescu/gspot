import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { open, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { type SpawnResult, type AsyncSpawnOptions } from '#cli/types/system/system.ts';

import {
    UNRELATED_FILE,
    GENERATED_ROUTES,
    NEXT_CACHE_BYTES,
    AUTHORED_NEXT_ENV,
    ROUTE_TYPES_COMMENT,
} from '#tests/config/checks/framework/nextjs.ts';

async function prepareNextjsBuild(root: string, scopePath: string): Promise<Session> {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['nextjs'], {
            level: 'all',
            scopes: scopePath === '' ? [] : [{ path: scopePath }],
        }),
        [join(scopePath, 'package.json')]: JSON.stringify({
            private: true,
            dependencies: { next: '16.3.5' },
            scripts: {
                build: `NODE_ENV=production next build ${scopePath === '' ? '--webpack' : '--turbopack'} && echo done`,
            },
        }),
        [join(scopePath, 'tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
        [join(scopePath, 'next-env.d.ts')]: AUTHORED_NEXT_ENV,
        [join(scopePath, '.next/types/routes.d.ts')]: ROUTE_TYPES_COMMENT,
        [join(scopePath, 'src/app/page.ts')]: 'bad input\n',
        'node_modules/.bin/next': '',
        [UNRELATED_FILE.path]: UNRELATED_FILE.text,
    });
    await applyGeneratedFiles(root);
    commitAll(root);
    await writeFile(join(root, join(scopePath, '.next/local-cache.bin')), Buffer.from(NEXT_CACHE_BYTES));
    const session = await openSession(root);
    await chmod(join(root, join(scopePath, 'tsconfig.json')), 0o640);
    return session;
}

function fakeNextjsCommands(spawn: (command: readonly string[], options: AsyncSpawnOptions) => Promise<SpawnResult>) {
    using resources = new DisposableStack();

    const folders: string[] = [];
    const commands: string[][] = [];
    resources.use(fakeExecutableLookup(process.execPath));
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command) => {
            return buildProcessResult({
                stdout: basename(command[0] ?? '') === 'next' ? 'Next.js v16.3.5' : 'Version 0.0.0-test',
            });
        }),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (command, options) => {
            const cwd = options.cwd;
            folders.push(cwd);
            commands.push([...command]);
            return await spawn(command, options);
        }),
    );
    return Object.assign(resources.move(), { folders, commands });
}

test('nextjs/tsc in a child scope reports its finding, passes after the fix, and leaves tsconfig.json, .next, and next-env.d.ts unchanged', async () => {
    const scope = 'app';
    await using sandbox = await testdir();
    const session = buildCheckSession(await prepareNextjsBuild(sandbox.path, scope));

    const planned = planChecks(session, { stage: 'push', only: ['nextjs/tsc'] }).find(
        (check) => check.scope.path === scope,
    )!;
    const untracked = join(sandbox.path, join(scope, '.next/local-cache.bin'));
    const config = join(sandbox.path, join(scope, 'tsconfig.json'));
    await using originalFile = await open(config, 'r');
    const previous = await originalFile.readFile();
    const { mode } = await originalFile.stat();
    const routesSeen: string[] = [];
    using fakes = fakeNextjsCommands((command, options) => fakeNextjsBuild(command, options, routesSeen));
    const { folders } = fakes;
    const { findings: found } = await runCheckCode(session, planned, CHECK_CODE['nextjs/tsc']);
    expect(found.map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message }))).toStrictEqual([
        {
            check: 'nextjs/tsc',
            file: convertToPosixPath(join(scope, 'src/app/page.ts')),
            line: 1,
            rule: 'TS2322',
            message: 'Type mismatch',
        },
    ]);
    await writeFile(join(sandbox.path, join(scope, 'src/app/page.ts')), 'corrected input\n');
    expect(await runCheckCode(session, planned, CHECK_CODE['nextjs/tsc'])).toMatchObject({
        status: 'passed',
        findings: [],
    });
    expect(routesSeen).toStrictEqual([GENERATED_ROUTES, GENERATED_ROUTES]);
    expect(folders).not.toContain(join(sandbox.path, scope));
    expect(await Promise.all(folders.map((cwd) => isOnDisk(cwd)))).toStrictEqual(folders.map(() => false));
    await using currentFile = await open(config, 'r');
    expect(await currentFile.readFile()).toStrictEqual(previous);
    const afterStats = await currentFile.stat();
    expect(afterStats.mode).toBe(mode);
    expect(await readFile(untracked)).toStrictEqual(Buffer.from(NEXT_CACHE_BYTES));
    const contents = await readFile(join(sandbox.path, join(scope, 'next-env.d.ts')), 'utf8');
    expect(contents).toBe(AUTHORED_NEXT_ENV);
    const routeTypes = await readFile(join(sandbox.path, join(scope, '.next/types/routes.d.ts')), 'utf8');
    expect(routeTypes).toBe(ROUTE_TYPES_COMMENT);
    expect(await readFile(join(sandbox.path, UNRELATED_FILE.path), 'utf8')).toBe(UNRELATED_FILE.text);
});

test('nextjs/tsc removes its copy after a failed type generation and keeps a concurrent edit to tsconfig.json', async () => {
    const message = 'Generator failed';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '',
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
    const error = await captureRejection(runCheckCode(buildCheckSession(session), planned, CHECK_CODE['nextjs/tsc']));
    expect(error.message).toBe(`The next typegen command failed: Error: ${message}`);
    expect(scratch).not.toBe('');
    expect(await isOnDisk(scratch)).toBe(false);
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
    expect(await isOnDisk(join(sandbox.path, 'next-env.d.ts'))).toBe(false);
});

async function fakeNextjsBuild(
    command: readonly string[],
    options: AsyncSpawnOptions,
    routesSeen: string[],
): Promise<SpawnResult> {
    const cwd = options.cwd;
    const page = await readFile(join(cwd, 'src/app/page.ts'), 'utf8');
    const isBad = page.includes('bad');
    if (['typegen', 'build'].includes(command[1] ?? '')) {
        await writeFile(join(cwd, 'tsconfig.json'), '{}\n');
        await writeFile(join(cwd, 'next-env.d.ts'), '// Generated\n');
        await mkdir(join(cwd, '.next/types'), { recursive: true });
        await writeFile(join(cwd, '.next/types/routes.d.ts'), GENERATED_ROUTES);
    } else routesSeen.push(await readFile(join(cwd, '.next/types/routes.d.ts'), 'utf8'));
    const isFailed = isBad && command[1] !== 'typegen';
    return buildProcessResult({
        code: isFailed ? 1 : 0,
        stdout: isFailed ? 'src/app/page.ts(1,1): error TS2322: Type mismatch\n' : '',
    });
}
