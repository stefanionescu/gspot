import { existsSync } from 'node:fs';
import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { buildTsconfig } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { REFERENCE_BUILD_FILES, REFERENCE_BUILD_RESULTS } from '#tests/config/configurations/language.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkInstalledModules, linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('a project with its own tsconfig.json keeps its own compiler options', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":false,"types":[]},"include":["*.ts"]}',
        'source.ts': 'export function echo(value) { return value; }\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['typescript/tsc'] }));
    expect(result.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'passed', findings: [] },
    ]);
});

test('projects without tsconfig.json get required options and framework options only in their scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'service', configurations: ['nestjs'] }],
        }),
        'source.ts': 'export const port = 8080;\n',
        'service/source.ts': 'export const port = 3000;\n',
    });
    const session = await openSession(sandbox.path);
    const options = session.scopes.map((scope) => {
        const path = join(sandbox.path, GSPOT_FOLDER, scope.path, 'tsconfig.json');
        const { strict, experimentalDecorators, emitDecoratorMetadata } = buildTsconfig(session, scope, path)[
            'compilerOptions'
        ] as Record<string, unknown>;
        return { scope: scope.path, strict, experimentalDecorators, emitDecoratorMetadata };
    });
    expect(options).toStrictEqual([
        { scope: '', strict: true, experimentalDecorators: undefined, emitDecoratorMetadata: undefined },
        { scope: 'service', strict: true, experimentalDecorators: true, emitDecoratorMetadata: true },
    ]);
});

test('a solution builds referenced projects in a copy and leaves each scope its own findings', async () => {
    await using sandbox = await createGitSandbox({
        ...REFERENCE_BUILD_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [
                { path: 'app', configurations: ['typescript'] },
                { path: 'neighbor', configurations: ['typescript'] },
            ],
        }),
    });
    const authored = JSON.stringify({ extends: join(sandbox.path, 'config/base.json'), include: ['src/**/*.ts'] });
    await createFileTree(sandbox.path, {
        'tsconfig.json': JSON.stringify({ files: [], references: [{ path: join(sandbox.path, 'app') }] }),
        'app/tsconfig.json': authored,
    });
    await chmod(join(sandbox.path, 'app/tsconfig.json'), 0o640);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['typescript/tsc'] }));
    expect(
        failed.report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            findings: findings.map(({ file, rule }) => ({ file, rule })),
        })),
    ).toStrictEqual([...REFERENCE_BUILD_RESULTS]);
    expect(existsSync(join(sandbox.path, 'app/src/main.js'))).toBe(false);
    expect(existsSync(join(sandbox.path, 'app/tsconfig.tsbuildinfo'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'app/tsconfig.json'), 'utf8')).toBe(authored);
    const attributes = await stat(join(sandbox.path, 'app/tsconfig.json'));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    expect(await readFile(join(sandbox.path, 'config/base.json'), 'utf8')).toBe(
        REFERENCE_BUILD_FILES['config/base.json'],
    );
    await writeFile(
        join(sandbox.path, 'app/src/main.ts'),
        REFERENCE_BUILD_FILES['app/src/main.ts'].replace('"wrong"', '8080'),
    );
    const remaining = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['typescript/tsc'] }));
    expect(
        remaining.report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([{ file: 'neighbor/source.ts', rule: 'TS18047' }]);
});

test('typescript/tsc notes that a missing module is a package of this repository', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"root","private":true,"workspaces":["packages/*"]}',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"module":"esnext","moduleResolution":"bundler"}}',
        'packages/shared/package.json': '{"name":"@example/shared","exports":"./dist/index.js"}',
        'entry.ts': 'import { value } from "@example/shared/values";\n\nexport const copy: number = value;\n',
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    commitAll(sandbox.path);
    await applyGeneratedFiles(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['typescript/tsc'] }));
    expect(result.report.checks.map(({ status, note }) => ({ status, note }))).toStrictEqual([
        {
            status: 'failed',
            note: '@example/shared is a package of this repository, and its types may need a build. Run your build, then check again.',
        },
    ]);
    expect(listFindingRows(result.report)).toStrictEqual([{ file: 'entry.ts', line: 1, rule: 'TS2307' }]);
});
