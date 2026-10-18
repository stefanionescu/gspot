import { join } from 'node:path';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { runCheckSample } from '#tests/setup/sample-checks.ts';
import { SITE_SANDBOX } from '#tests/data/checks/site/project.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { BUILT_PAGE_CASES } from '#tests/data/checks/site/built-pages.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { listBuiltFiles, getSuccessfulBuild } from '#cli/checks/framework/site/build.ts';

import {
    SITE_SETTINGS,
    SITE_BUILD_SCRIPT,
    BUILD_OUTPUT_CHECKS,
    WORKSPACE_SITE_FILES,
} from '#tests/data/checks/site/build.ts';

test('build: a push run builds the site without changing committed dist files or Git status', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_SETTINGS,
        '.gitignore': '.gspot/\n',
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'committed output\n',
    });
    commitAll(sandbox.path);
    const result = await checkReport(sandbox.path, ['check', '--only', 'site/build', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(readGitOutput(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await Bun.file(join(sandbox.path, 'dist/index.html')).text()).toBe('committed output\n');
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
    const request = buildCheckInput(await openSession(sandbox.path), 'site/build', {
        paths: ['build.js'],
        resources: resources,
    });
    expect(await CHECK_IMPLEMENTATIONS['site/build'].check(request)).toStrictEqual([
        matchFields({ rule: 'build', message: matchSubstring('local-input.txt') }),
    ]);
    const corrected = await getSuccessfulBuild(
        buildCheckInput(await openSession(sandbox.path), 'site/build', {
            paths: ['build.js', 'local-input.txt'],
            resources: resources,
        }),
    );
    expect(corrected.isBuilt).toBe(true);
    expect(await isOnDisk(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])("build: a run deletes the build's scratch copy after exit %i", async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_SETTINGS,
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'authored output',
    });
    const session = await openSession(sandbox.path);
    let cwd = '';
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (_argv, options) => {
            cwd = options.cwd!;
            await mkdir(join(cwd, 'dist'), { recursive: true });
            await writeFile(join(cwd, 'dist/index.html'), 'isolated output');
            return {
                code,
                stdout: '',
                stderr: code === 0 ? '' : 'Test build failure',
                missing: false,
                duration: 1,
            };
        }),
    );
    const result = await runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(result.report.exitCode).toBe(code === 0 ? 0 : 1);
    expect(cwd).not.toBe(sandbox.path);
    expect(cwd).not.toBe('');
    expect(await isOnDisk(cwd)).toBe(false);
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('authored output');
});

test('build: a dist link that leaves the build folder is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, WORKSPACE_SITE_FILES);
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink('../packages/unused', join(sandbox.path, 'node_modules/unused'));
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'site/build', { scope: 'web', resources });
    const built = await getSuccessfulBuild(input);
    expect(built.isBuilt, built.outputTail).toBe(true);
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
        'gspot.toml': buildSettingsText(['site'], {
            tables: '[site]\nbuild_command = ["bun", "build.js"]\n[[site.size_limit]]\npaths = ["dist/**"]\nkilobytes = 100\n',
            level: 'all',
        }),
        'build.js': 'console.error("Test build failure"); process.exitCode = 1;',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const consumers = new Set(BUILD_OUTPUT_CHECKS);
    const session = await openSession(sandbox.path);
    session.resources = resources;
    const failed = await runChecks(session, buildRunOptions({ only: ['site/build', ...consumers] }));
    expect(failed.report.exitCode).toBe(1);
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
            { check: 'site/build', status: 'failed', message: matchSubstring('Test build failure') },
            ...[...consumers].map((check) => ({ check, status: 'skipped', note: matchSubstring('did not build') })),
        ].toSorted((left, right) => left.check.localeCompare(right.check)),
    );
    await writeFile(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path);
    next.resources = resources;
    const rebuilt = await runChecks(next, buildRunOptions({ only: ['site/build'] }));
    expect(rebuilt.report.exitCode).toBe(0);
    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});
test.each([...BUILT_PAGE_CASES])(
    'built-pages: $check reports its source and accepts the corrected output',
    async (entry) => {
        await using repository = await createSandbox(SITE_SANDBOX);
        const { failed, passed } = await runCheckSample(repository, entry, SITE_SANDBOX);
        expect(failed.code, failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { check: entry.check, status: 'failed', findings: [entry.expected] },
        ]);
        expect(passed.code, passed.stderr).toBe(0);
    },
);
