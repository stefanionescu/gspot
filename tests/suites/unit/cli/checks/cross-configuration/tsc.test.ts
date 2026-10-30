import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { buildTsconfig } from '#cli/checks/cross-configuration/tsc/scope-tsconfig.ts';

import {
    REFERENCE_BUILD_FILES,
    REFERENCE_BUILD_RESULTS,
    IMPLICIT_RETURNS_IGNORE,
} from '#tests/config/checks/cross-configuration/cross-configuration.ts';

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
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            tables: IMPLICIT_RETURNS_IGNORE,
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
    expect(await isOnDisk(join(sandbox.path, 'app/src/main.js'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'app/tsconfig.tsbuildinfo'))).toBe(false);
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
    ).toStrictEqual([{ file: 'neighbor/source.ts', rule: 'TS2322' }]);
});
