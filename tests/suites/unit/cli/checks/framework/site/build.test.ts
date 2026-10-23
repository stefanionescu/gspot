import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { SITE_SETTINGS } from '#tests/config/checks/framework/site/pages.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listBuiltFiles, getSuccessfulBuild } from '#cli/checks/framework/site/build.ts';

import {
    SITE_BUILD_SCRIPT,
    BUILD_OUTPUT_CHECKS,
    WORKSPACE_SITE_FILES,
} from '#tests/config/checks/framework/site/build.ts';

test('build: a push run builds the site without changing committed dist files or Git status', async () => {
    await using sandbox = await testdir({
        'gspot.toml': SITE_SETTINGS,
        '.gitignore': `${DOT_GSPOT}/\n`,
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'committed output\n',
    });

    commitAll(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['site/build'] }));

    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(runGitStep(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('committed output\n');
});

test('build: a build that reads an untracked file fails until the file is in the paths', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_SETTINGS,
        'local-input.txt': 'Only available in the working tree.',
        'build.js': `import { readFileSync } from 'node:fs';
readFileSync('local-input.txt');
${SITE_BUILD_SCRIPT}`,
    });
    const session = await openSession(sandbox.path, { resources });
    const request = planSandboxCheck(session, 'site/build', { paths: ['build.js'] });
    const findings = await findBuiltInCheck('site/build')(session, request);
    expect(findings).toMatchObject([{ rule: 'build', line: 1 }]);
    // The message ends with the stack frame in the build folder and the Bun version.
    expect(findings[0]!.message).toStartWith(
        `bun build.js did not build the site.\n1 | import { readFileSync } from 'node:fs';\n2 | readFileSync('local-input.txt');`,
    );
    expect(findings[0]!.message).toContain("ENOENT: no such file or directory, open 'local-input.txt'");
    const checkedSession = await openSession(sandbox.path, { resources });
    const corrected = await getSuccessfulBuild(
        checkedSession,
        planSandboxCheck(checkedSession, 'site/build', { paths: ['build.js', 'local-input.txt'] }),
    );
    expect(corrected.isBuilt).toBe(true);
    expect(await isOnDisk(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])("build: a run deletes the build's copy after exit %i", async (code) => {
    await using sandbox = await testdir({
        'gspot.toml': SITE_SETTINGS,
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'authored output',
    });

    let cwd = '';
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (_argv, options) => {
            cwd = options.cwd!;
            await mkdir(join(cwd, 'dist'), { recursive: true });
            await writeFile(join(cwd, 'dist/index.html'), 'isolated output');
            return buildProcessResult({ code, stderr: code === 0 ? '' : 'Test build failure' });
        }),
    );
    const runResources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources: runResources });
    const result = await runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: code === 0 ? 'passed' : 'failed' }]);
    runResources[Symbol.dispose]();
    expect(cwd).not.toBe(sandbox.path);
    expect(cwd).not.toBe('');
    expect(await isOnDisk(cwd)).toBe(false);
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('authored output');
});

test('build: a dist link that leaves the build folder is refused', async () => {
    await using sandbox = await testdir({
        'gspot.toml': SITE_SETTINGS,
        'dist/local.txt': 'local',
        'external.txt': 'external',
    });

    const link = join(sandbox.path, 'dist/linked.txt');
    await symlink('../external.txt', link);
    expect(() => listBuiltFiles(join(sandbox.path, 'dist'))).toThrow(
        'The build output links outside the build folder: linked.txt',
    );
    await unlink(link);
    await symlink('local.txt', link);
    expect(listBuiltFiles(join(sandbox.path, 'dist'))).toStrictEqual(['linked.txt', 'local.txt']);
});

test("build: a scope's site build copies only the workspace packages it depends on", async () => {
    await using sandbox = await testdir(WORKSPACE_SITE_FILES);

    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink('../packages/unused', join(sandbox.path, 'node_modules/unused'));
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const input = planSandboxCheck(session, 'site/build', { scope: 'web' });
    const built = await getSuccessfulBuild(session, input);
    expect(built.isBuilt, built.failure).toBe(true);
    expect(await readFile(join(built.folder, 'index.html'), 'utf8')).toBe('<h1>Workspace site</h1>');
    expect(await isOnDisk(join(built.cwd, '../packages/unused/private.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'web/dist'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
        'export const value = "<h1>Workspace site</h1>";',
    );
});

test('build: a failed site build skips every check that reads the build, and a new session builds again', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['site'], {
            tables: '[site]\nbuild_command = ["bun", "build.js"]\n[[site.size_limit]]\npaths = ["dist/**"]\nkilobytes = 100\n',
            level: 'all',
        }),
        'build.js': 'console.error("Test build failure"); process.exitCode = 1;',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const consumers = new Set(BUILD_OUTPUT_CHECKS);
    const session = await openSession(sandbox.path, { resources });
    const failed = await runChecks(session, buildRunOptions({ only: ['site/build', ...consumers] }));

    expect(
        failed.report.checks
            .map((result) => ({
                check: result.check,
                status: result.status,
                note: result.note,
                message: result.findings[0]?.message,
            }))
            .toSorted((left, right) => left.check.localeCompare(right.check)),
    ).toMatchObject(
        [
            {
                check: 'site/build',
                status: 'failed',
                message: 'bun build.js did not build the site.\nTest build failure',
            },
            ...[...consumers].map((check) => ({
                check,
                status: 'skipped',
                note: 'The site did not build.',
            })),
        ].toSorted((left, right) => left.check.localeCompare(right.check)),
    );
    await writeFile(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path, { resources });
    const rebuilt = await runChecks(next, buildRunOptions({ only: ['site/build'] }));

    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});
