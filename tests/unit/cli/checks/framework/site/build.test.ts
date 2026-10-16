import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { checkReport, buildRunOptions } from '#tests/setup/run-gspot.ts';
import { filesUnder, requireBuild } from '#cli/checks/framework/site/build.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';

import {
    SITE_SETTINGS,
    SITE_BUILD_SCRIPT,
    BUILD_OUTPUT_CHECKS,
    WORKSPACE_SITE_FILES,
} from '#tests/config/site/build.ts';

test('a push run builds the site without changing committed dist files or Git status', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_SETTINGS,
        '.gitignore': '.gspot/\n',
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'committed output\n',
    });
    commitAll(sandbox.path);
    const outcome = await checkReport(sandbox.path, ['check', '--only', 'site/build', '--json']);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
    expect(outcome.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(gitOutput(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await Bun.file(join(sandbox.path, 'dist/index.html')).text()).toBe('committed output\n');
});

test('a build that reads an untracked file fails until the file is in the paths', async () => {
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
    expect(await CHECK_FUNCTIONS['site/build'](request)).toStrictEqual([
        containing({ rule: 'build', message: textContaining('local-input.txt') }),
    ]);
    const corrected = await requireBuild(
        buildCheckInput(await openSession(sandbox.path), 'site/build', {
            paths: ['build.js', 'local-input.txt'],
            resources: resources,
        }),
    );
    expect(corrected.isBuilt).toBe(true);
    expect(await pathExists(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])("a run deletes the build's scratch copy after exit %i", async (code) => {
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
    const outcome = await executeRun(session, buildRunOptions({ only: ['site/build'] }));
    expect(outcome.report.exitCode).toBe(code === 0 ? 0 : 1);
    expect(cwd).not.toBe(sandbox.path);
    expect(cwd).not.toBe('');
    expect(await pathExists(cwd)).toBe(false);
    expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('authored output');
});

test('a dist link that leaves the build folder is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_SETTINGS,
        'dist/local.txt': 'local',
        'external.txt': 'external',
    });
    const link = join(sandbox.path, 'dist/linked.txt');
    await symlink('../external.txt', link);
    expect(() => filesUnder(join(sandbox.path, 'dist'))).toThrow(
        'The build output links outside the build folder: linked.txt',
    );
    await unlink(link);
    await symlink('local.txt', link);
    expect(filesUnder(join(sandbox.path, 'dist'))).toStrictEqual(['linked.txt', 'local.txt']);
});

test("a scope's site build copies only the workspace packages it depends on", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, WORKSPACE_SITE_FILES);
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink('../packages/unused', join(sandbox.path, 'node_modules/unused'));
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'site/build', { scope: 'web', resources });
    const built = await requireBuild(input);
    expect(built.isBuilt, built.outputTail).toBe(true);
    expect(await readFile(join(built.folder, 'index.html'), 'utf8')).toBe('<h1>Workspace site</h1>');
    expect(await pathExists(join(built.cwd, '../packages/unused/private.txt'))).toBe(false);
    expect(await pathExists(join(sandbox.path, 'web/dist'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
        'export const value = "<h1>Workspace site</h1>";',
    );
});
test('a failed site build skips every check that reads the build, and a new session builds again', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['site'], {
            tables: '[site]\nbuild_command = ["bun", "build.js"]\n[[site.size_limit]]\npaths = ["dist/**"]\nkilobytes = 100\n',
            level: 'all',
        }),
        'build.js': 'console.error("Test build failure"); process.exitCode = 1;',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const consumers = new Set(BUILD_OUTPUT_CHECKS);
    const session = await openSession(sandbox.path);
    session.resources = resources;
    const failed = await executeRun(session, buildRunOptions({ only: ['site/build', ...consumers] }));
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
            { check: 'site/build', status: 'failed', message: textContaining('Test build failure') },
            ...[...consumers].map((check) => ({ check, status: 'skipped', note: textContaining('did not build') })),
        ].toSorted((left, right) => left.check.localeCompare(right.check)),
    );
    await writeFile(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path);
    next.resources = resources;
    const rebuilt = await executeRun(next, buildRunOptions({ only: ['site/build'] }));
    expect(rebuilt.report.exitCode).toBe(0);
    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});
