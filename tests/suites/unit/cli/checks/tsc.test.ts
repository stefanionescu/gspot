import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildTsconfig } from '#cli/checks/tsc/scope-tsconfig.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { join, parse, dirname, resolve, relative } from 'node:path';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    REFERENCE_BUILD_FILES,
    REFERENCE_BUILD_RESULTS,
    IMPLICIT_RETURNS_IGNORE,
    DEFAULT_TSCONFIG_PROJECTS,
} from '#tests/config/checks/tsc.ts';

test('a project with its own tsconfig.json gets a tsconfig that extends it and adds only typeRoots', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            tables: IMPLICIT_RETURNS_IGNORE,
            level: 'all',
        }),
        'source.ts': 'export const value = 1;',
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
    });

    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const path = join(sandbox.path, GSPOT_PATHS.state, 'tsconfig.json');
    const parsed = buildTsconfig(session, scope, path);
    expect(parsed).toMatchObject({
        extends: '../../tsconfig.json',
    });
    expect(Object.keys(parsed['compilerOptions']!)).toStrictEqual(['typeRoots']);
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
    const toolsRoot = parse(sandbox.path).root;
    const session = await openSession(sandbox.path, { toolsRoot: toolsRoot });
    const projects = session.scopes.map((scope) => {
        const path = join(sandbox.path, GSPOT_PATHS.state, scope.path, 'tsconfig.json');
        const config = buildTsconfig(session, scope, path);
        const compilerOptions = config['compilerOptions'] as Record<string, unknown>;
        compilerOptions['typeRoots'] = (compilerOptions['typeRoots'] as string[]).map((root) => {
            const found = relative(toolsRoot, resolve(dirname(path), root));
            return convertToPosixPath(found);
        });
        return { scope: scope.path, config };
    });
    expect(projects).toStrictEqual([...DEFAULT_TSCONFIG_PROJECTS]);
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
