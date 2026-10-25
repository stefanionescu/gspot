import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import * as processes from '#cli/system/processes.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSiteSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { listBuiltFiles, readSuccessfulBuild } from '#cli/checks/framework/site/build.ts';
import { BUILD_OUTPUT_CHECKS, WORKSPACE_SITE_FILES } from '#tests/config/checks/framework/site/build.ts';

test('build: a push run builds the site without changing committed dist files or Git status', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSiteSettings(buildProgramCommand('fakes/tool', '--write', 'dist/index.html=built')),
        '.gitignore': `${DOT_GSPOT}/\n`,
        'dist/index.html': 'committed output\n',
    });

    commitAll(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['site/build'] }));

    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(runGitStep(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('committed output\n');
});

test('build: a build that reads an untracked file fails until the file is in the paths', async () => {
    const command = buildProgramCommand('fakes/site-build', '--copy', 'local-input.txt=dist/index.html');
    await using sandbox = await testdir({
        'gspot.toml': buildSiteSettings(command),
        'local-input.txt': 'Only available in the working tree.',
    });
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const request = planSandboxCheck(session, 'site/build', { paths: [] });
    const findings = await findBuiltInCheck('site/build')(session, request);
    expect(findings).toMatchObject([{ rule: 'build', line: 1 }]);
    const [summary, ...output] = findings[0]!.message.split('\n');
    expect(summary).toBe(`${command.map((argument) => quoteArgument(argument)).join(' ')} did not build the site.`);
    expect(output).toContain("ENOENT: no such file or directory, lstat 'local-input.txt'");
    const checkedSession = await openSession(sandbox.path, { resources });
    const corrected = await readSuccessfulBuild(
        buildCheckSession(checkedSession),
        planSandboxCheck(checkedSession, 'site/build', { paths: ['local-input.txt'] }),
    );
    expect(corrected.isBuilt).toBe(true);
    expect(await isOnDisk(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])("build: a run deletes the build's copy after exit %i", async (code) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSiteSettings(buildProgramCommand('fakes/tool')),
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
    await using sandbox = await testdir({ 'dist/local.txt': 'local', 'external.txt': 'external' });

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
    const command = buildProgramCommand('fakes/site-build', '--import', 'core=dist/index.html');
    await using sandbox = await testdir({
        ...WORKSPACE_SITE_FILES,
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'web', configurations: ['site', 'javascript'] }],
            tables: `site.build_command = ${JSON.stringify(command)}\n`,
        }),
    });

    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink('../packages/unused', join(sandbox.path, 'node_modules/unused'));
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const input = planSandboxCheck(session, 'site/build', { scope: 'web' });
    const built = await readSuccessfulBuild(buildCheckSession(session), input);
    expect(built.isBuilt, built.failure).toBe(true);
    expect(await readFile(join(built.folder, 'index.html'), 'utf8')).toBe('<h1>Workspace site</h1>');
    expect(await isOnDisk(join(built.cwd, '../packages/unused/private.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'web/dist'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
        'export const value = "<h1>Workspace site</h1>";',
    );
});

test('build: a failed site build skips every check that reads the build, and a new session builds again', async () => {
    const failing = buildProgramCommand('fakes/tool', '--stderr', 'Test build failure\n', '--exit', '1');
    const tables = '[[site.size_limit]]\npaths = ["dist/**"]\nkilobytes = 100\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSiteSettings(failing, { tables }),
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    using resources = new DisposableStack();
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
                message: `${failing.map((argument) => quoteArgument(argument)).join(' ')} did not build the site.\nTest build failure`,
            },
            ...[...consumers].map((check) => ({
                check,
                status: 'skipped',
                note: 'The site did not build.',
            })),
        ].toSorted((left, right) => left.check.localeCompare(right.check)),
    );
    const built = buildProgramCommand('fakes/tool', '--write', 'dist/index.html=built');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSiteSettings(built, { tables }));
    const next = await openSession(sandbox.path, { resources });
    const rebuilt = await runChecks(next, buildRunOptions({ only: ['site/build'] }));

    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});
