import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { CLEAR_DEPENDENCIES_SCRIPT } from '#tests/config/commands/check/fixes/rereads.ts';
import { REACT_VUE_PACKAGES, ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/config/repository/dependencies.ts';

test('a fix run rereads the repository and keeps the package scopes it found', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'package.json': '{"name":"root","private":true,"scripts":{"root":"true"}}',
        'README.md': 'Run `bun run root`.\n',
        'app/package.json': '{"name":"app","private":true,"scripts":{"child":"true"}}',
        'app/README.md': 'Run `bun run child`.\n',
        'app/main.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toContain('app');
    const options = buildRunOptions({ only: ['docs/missing-paths'] });
    const unchanged = await runChecks(session, options);
    const fixed = await runChecks(await openSession(session.root), { ...options, fix: true });
    expect(unchanged.report.exitCode).toBe(0);
    expect(fixed.report.exitCode, JSON.stringify(fixed.report.checks)).toBe(0);
    expect(fixed.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings }))).toStrictEqual(
        unchanged.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings })),
    );
});

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir({
        'source.txt': 'input',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/inventory',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: [
                            process.execPath,
                            '-e',
                            'process.exitCode = process.argv.includes("added.txt") ? 0 : 1',
                            '{files}',
                        ],
                        fix: [process.execPath, '-e', 'await Bun.write("added.txt", "created")'],
                    },
                ],
            }),
        }),
    });

    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/inventory'] });
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks[0]!.fileCount).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});

test('a fix run leaves the session of its caller and the dependencies of each package unchanged', async () => {
    await using sandbox = await testdir({
        ...REACT_VUE_PACKAGES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'app', configurations: ['javascript'] }],
            tables: stringify({
                command_check: [
                    {
                        id: 'project/update-package',
                        command: [process.execPath, '-e', 'process.exitCode = 0'],
                        fix: [process.execPath, '-e', CLEAR_DEPENDENCIES_SCRIPT],
                        paths: ['package.json'],
                        stage: 'commit',
                        output: { format: 'none' },
                    },
                ],
            }),
        }),
    });

    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const result = await runChecks(session, buildRunOptions({ only: ['project/update-package'], fix: true }));
    expect(result.report.exitCode).toBe(0);
    expect(result.fixes?.results).toMatchObject([
        { check: 'project/update-package', status: 'changed', changed: ['package.json'] },
    ]);
    expect(listProjectDependencyNames(session.repository.dependencyFiles, '')).toStrictEqual([]);
    expect(listProjectDependencyNames(session.repository.dependencyFiles, 'app')).toStrictEqual(['vue']);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(REACT_VUE_PACKAGES['app/package.json']);
});
