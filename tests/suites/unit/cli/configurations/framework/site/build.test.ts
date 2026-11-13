import { existsSync } from 'node:fs';
import { mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { listBuiltFiles, readSuccessfulBuild } from '#cli/configurations/framework/site/checks/build.ts';
import { buildCheckSession, runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/check-generation.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text/order.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import { planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

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
    using resources = createRunResources();
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
    const findings = await runSandboxCheck(sandbox.path, 'site/build', { paths: [] });
    expect(findings).toMatchObject([{ rule: 'build', line: 1 }]);
    expect(findings[0]?.message).toContain(command.map((argument) => quoteArgument(argument)).join(' '));
    expect(await runSandboxCheck(sandbox.path, 'site/build', { paths: ['local-input.txt'] })).toStrictEqual([]);
});

test('build: a passing build runs in a copy that is removed afterwards and leaves committed dist files and Git status unchanged', async () => {
    const buildCommand = buildProgramCommand('fakes/tool');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'dist/index.html': 'committed output\n',
    });
    commitAll(sandbox.path);

    let cwd = '';
    using resources = new DisposableStack();
    resources.use(
        fakeCommands().mockImplementation(async (_argv, options) => {
            cwd = options.cwd!;
            await mkdir(join(cwd, 'dist'), { recursive: true });
            await writeFile(join(cwd, 'dist/index.html'), 'isolated output');
            return buildProcessResult({ code: 0 });
        }),
    );
    const runResources = createRunResources();
    const session = await openSession(sandbox.path, { resources: runResources });
    const result = await runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    runResources[Symbol.dispose]();
    expect(cwd).not.toBe('');
    expect(existsSync(cwd)).toBe(false);
    expect(runGitStep(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('committed output\n');
});

test('a site build whose output folder is a link stops with an error', async () => {
    const buildCommand = buildProgramCommand('fakes/tool');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        'page.md': '# Page\n',
    });
    using _build = fakeCommands().mockImplementation(async (_argv, options) => {
        await mkdir(join(options.cwd, 'output'));
        await symlink('output', join(options.cwd, 'dist'));
        return buildProcessResult({ code: 0 });
    });
    const error = await captureRejection(runSandboxCheck(sandbox.path, 'site/build'));
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
});

test('build: a dist link that leaves the build folder is refused', async () => {
    await using sandbox = await createGitSandbox({ 'dist/local.txt': 'local', 'external.txt': 'external' });

    const link = join(sandbox.path, 'dist/linked.txt');
    await symlink('../external.txt', link);
    expect(() => listBuiltFiles(join(sandbox.path, 'dist'))).toThrow(
        matchFields<CheckStop>({
            name: 'CheckStop',
            status: 'error',
            message: expect.stringContaining('linked.txt') as string,
        }),
    );
    await unlink(link);
    await symlink('local.txt', link);
    expect(listBuiltFiles(join(sandbox.path, 'dist'))).toStrictEqual(['linked.txt', 'local.txt']);
    await mkdir(join(sandbox.path, 'dist/pages'));
    await symlink('pages', join(sandbox.path, 'dist/linked-pages'));
    expect(() => listBuiltFiles(join(sandbox.path, 'dist'))).toThrow(
        matchFields<CheckStop>({
            name: 'CheckStop',
            status: 'error',
            message: expect.stringContaining('linked-pages') as string,
        }),
    );
});

test('build: a failed site build skips every check that reads the build', async () => {
    const failing = buildProgramCommand('fakes/tool', '--stderr', 'Test build failure\n', '--exit', '1');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(failing)}\n`,
        }),
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    using resources = createRunResources();
    const consumers = new Set(
        readConfigurations()
            .get('site')
            ?.checks.filter(({ id, needs }) => id !== 'site/build' && needs?.includes('build') === true)
            .map(({ id }) => id),
    );
    expect(consumers.size).toBeGreaterThan(0);
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
                message: expect.stringContaining('Test build failure') as string,
            },
            ...[...consumers].map((check) => ({
                check,
                status: 'skipped',
            })),
        ].toSorted((left, right) => compareText(left.check, right.check)),
    );
});

test('build: without site.build_command, the build script runs with the package manager of the repository', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all' }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}\n',
        'package.json': '{"private":true,"scripts":{"build":"astro build"}}\n',
    });
    commitAll(sandbox.path);
    using commands = fakeCommands('bun');
    commands.mockImplementation(async (_argv, options) => {
        await mkdir(join(options.cwd, 'dist'), { recursive: true });
        return buildProcessResult({ code: 0 });
    });
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    const result = await runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(commands.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([['run', 'build']]);
});
