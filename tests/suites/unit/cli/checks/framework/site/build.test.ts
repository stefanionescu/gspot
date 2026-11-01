import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { compareText, quoteArgument } from '#cli/system/text.ts';
import { runChecks, buildCheckSession } from '#cli/engine/run.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildRunOptions, CHECK_GENERATION } from '#tests/setup/cli/runs.ts';
import { getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { listBuiltFiles, readSuccessfulBuild } from '#cli/checks/framework/site/build.ts';
import { BUILD_OUTPUT_CHECKS, WORKSPACE_SITE_FILES } from '#tests/config/checks/framework/site.ts';

test('build: a push run builds the site without changing committed dist files or Git status', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/tool', '--write', 'dist/index.html=built'))}\n`,
        }),
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'dist/index.html': 'committed output\n',
    });

    commitAll(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['site/build'] }));

    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(runGitStep(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('committed output\n');
});

test('build: a scope build reads the tracked files at the repository root in its copy', async () => {
    const command = buildProgramCommand('fakes/site-build', '--copy', '../README.md=dist/index.html');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            level: 'all',
            tables: `[[scope]]\npath = "docs"\nconfigurations = ["site"]\n[scope.site]\nbuild_command = ${JSON.stringify(command)}\n`,
        }),
        'README.md': '# Project\n',
        'docs/page.md': '# Page\n',
    });
    commitAll(sandbox.path);
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const build = await readSuccessfulBuild(
        buildCheckSession(session, CHECK_GENERATION),
        planSandboxCheck(session, 'site/build', { scope: 'docs' }),
    );
    expect(await readFile(join(build.folder, 'index.html'), 'utf8')).toBe('# Project\n');
});

test('build: a build that reads an untracked file fails until the file is in the paths', async () => {
    const command = buildProgramCommand('fakes/site-build', '--copy', 'local-input.txt=dist/index.html');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(command)}\n`,
        }),
        'local-input.txt': 'Only available in the working tree.',
    });
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const request = planSandboxCheck(session, 'site/build', { paths: [] });
    const findings = await getBuiltInCheck('site/build')(session, request);
    expect(findings).toMatchObject([{ rule: 'build', line: 1 }]);
    const [summary, ...output] = findings[0]!.message.split('\n');
    expect(summary).toBe(`${command.map((argument) => quoteArgument(argument)).join(' ')} did not build the site.`);
    expect(output).toContain("ENOENT: no such file or directory, stat 'local-input.txt'");
    const checkedSession = await openSession(sandbox.path, { resources });
    const corrected = await readSuccessfulBuild(
        buildCheckSession(checkedSession, CHECK_GENERATION),
        planSandboxCheck(checkedSession, 'site/build', { paths: ['local-input.txt'] }),
    );
    expect(corrected.built).toBe(true);
    expect(await isOnDisk(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])("build: a run deletes the build's copy after exit %i", async (code) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/tool'))}\n`,
        }),
        'dist/index.html': 'authored output',
    });

    let cwd = '';
    using resources = new DisposableStack();
    resources.use(
        fakeCommands().mockImplementation(async (_argv, options) => {
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
    await using sandbox = await createGitSandbox({ 'dist/local.txt': 'local', 'external.txt': 'external' });

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
    await using sandbox = await createGitSandbox({
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
    const built = await readSuccessfulBuild(buildCheckSession(session, CHECK_GENERATION), input);
    expect(built.built, built.failure).toBe(true);
    expect(await readFile(join(built.folder, 'index.html'), 'utf8')).toBe('<h1>Workspace site</h1>');
    expect(await isOnDisk(join(built.cwd, '../packages/unused/private.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'web/dist'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
        'export const value = "<h1>Workspace site</h1>";',
    );
});

test('build: a failed site build skips every check that reads the build, and a new session builds again', async () => {
    const failing = buildProgramCommand('fakes/tool', '--stderr', 'Test build failure\n', '--exit', '1');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(failing)}\n`,
        }),
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
            .toSorted((left, right) => compareText(left.check, right.check)),
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
        ].toSorted((left, right) => compareText(left.check, right.check)),
    );
    const built = buildProgramCommand('fakes/tool', '--write', 'dist/index.html=built');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(built)}\n`,
        }),
    );
    const next = await openSession(sandbox.path, { resources });
    const rebuilt = await runChecks(next, buildRunOptions({ only: ['site/build'] }));

    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});
