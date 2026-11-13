import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CancelableSpawnOptions, SpawnResult } from '#cli/types/system.ts';
import { AUTHORED_NEXT_ENV, GENERATED_ROUTES, ROUTE_TYPES_COMMENT } from '#tests/config/configurations/framework.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function prepareNextjsBuild(root: string, scopePath: string): Promise<void> {
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
    });
    await applyGeneratedFiles(root);
    commitAll(root);
}

function fakeNextjsCommands(
    spawn: (command: readonly string[], options: CancelableSpawnOptions) => Promise<SpawnResult>,
) {
    using resources = new DisposableStack();

    const folders: string[] = [];
    const commands: string[][] = [];
    resources.use(fakeExecutableLookup(process.execPath));
    resources.use(
        fakeCommands().mockImplementation(async (command, options) => {
            if (command[1] === 'bin-paths') return buildProcessResult();
            if (command.at(-1) === '--version')
                return buildProcessResult({
                    stdout: basename(command[0] ?? '') === 'next' ? 'Next.js v16.3.5' : 'Version 0.0.0-test',
                });
            const cwd = options.cwd;
            folders.push(cwd);
            commands.push([...command]);
            return await spawn(command, options);
        }),
    );
    return Object.assign(resources.move(), { folders, commands });
}

async function fakeNextjsBuild(
    command: readonly string[],
    options: CancelableSpawnOptions,
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

test('nextjs/tsc in a child scope reports its finding, passes after the fix, and leaves tsconfig.json and the generated types unchanged', async () => {
    const scope = 'app';
    await using sandbox = await createGitSandbox({});
    await prepareNextjsBuild(sandbox.path, scope);
    const routesSeen: string[] = [];
    using fakes = fakeNextjsCommands((command, options) => fakeNextjsBuild(command, options, routesSeen));
    const { folders } = fakes;
    const found = await runSandboxCheck(sandbox.path, 'nextjs/tsc', { scope });
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
    expect(await runSandboxCheck(sandbox.path, 'nextjs/tsc', { scope })).toStrictEqual([]);
    expect(routesSeen).toStrictEqual([GENERATED_ROUTES, GENERATED_ROUTES]);
    expect(folders.map((cwd) => existsSync(cwd))).toStrictEqual(folders.map(() => false));
    expect({
        tsconfig: await readFile(join(sandbox.path, scope, 'tsconfig.json'), 'utf8'),
        nextEnv: await readFile(join(sandbox.path, scope, 'next-env.d.ts'), 'utf8'),
        routes: await readFile(join(sandbox.path, scope, '.next/types/routes.d.ts'), 'utf8'),
    }).toStrictEqual({
        tsconfig: '{"compilerOptions":{"strict":true}}\n',
        nextEnv: AUTHORED_NEXT_ENV,
        routes: ROUTE_TYPES_COMMENT,
    });
});

test('nextjs/tsc removes its copy after a failed type generation and keeps a concurrent edit to tsconfig.json', async () => {
    const message = 'Generator failed';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '',
    });
    let scratch = '';
    using _fakes = fakeNextjsCommands(async (...[, options]) => {
        scratch = options.cwd;
        await writeFile(join(scratch, 'tsconfig.json'), 'partial generator output\n');
        await writeFile(join(sandbox.path, 'tsconfig.json'), 'Concurrent developer edit\n');
        return buildProcessResult({ code: 1, stderr: `Error: ${message}` });
    });
    const error = await captureRejection(runSandboxCheck(sandbox.path, 'nextjs/tsc'));
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
    expect(error.message).toContain(message);
    expect(scratch).not.toBe('');
    expect(existsSync(scratch)).toBe(false);
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
});

test('the Next.js metadata, middleware, and request files may export a default', async () => {
    const files = [
        'app/manifest.ts',
        'app/sitemap.ts',
        'app/robots.ts',
        'app/icon.tsx',
        'app/apple-icon.tsx',
        'app/opengraph-image.tsx',
        'app/twitter-image.tsx',
        'middleware.ts',
        'proxy.ts',
        'i18n/request.ts',
    ];
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nextjs', 'translations'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"preserve"},"include":["**/*.ts","**/*.tsx"]}\n',
        'lib/reader.ts': 'export default function read(): number {\n    return 1;\n}\n',
        ...Object.fromEntries(
            files.map((path) => [path, 'export default function read(): number {\n    return 1;\n}\n']),
        ),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, [...files, 'lib/reader.ts'], ['import-x/no-default-export']),
    ).toStrictEqual([{ file: 'lib/reader.ts', rule: 'import-x/no-default-export', line: 1 }]);
});
