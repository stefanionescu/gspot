import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { SCAN_SETTINGS_MESSAGE } from '#cli/config/commands/reports.ts';
import * as installers from '#cli/tools/installers/install.ts';
import type { ScanReport } from '#cli/types/commands.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { scanOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

async function runScan(root: string): Promise<ScanReport> {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const result = await runGspot(root, ['scan', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    return scanOutputSchema.parse(JSON.parse(result.stdout));
}

test('scan refuses a repository that already has a gspot.toml', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'configurations = []\n', 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['scan', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments', message: SCAN_SETTINGS_MESSAGE });
});

test('scan refuses a repository that tracks no file, because the copy it checks holds only tracked files', async () => {
    using install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'package.json': '{"private":true}\n', 'src/a.js': 'export {};\n' });
    const result = await runGspot(sandbox.path, ['scan', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
    expect(install).not.toHaveBeenCalled();
});

test('scan reports its run and the plan of init, and leaves the repository as it was', async () => {
    await using sandbox = await createGitSandbox({
        '.env.example': 'OTHER=\n',
        '.eslintrc.json': '{}\n',
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'src/a.js': 'export const value = process.env.API_URL;\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const report = await runScan(sandbox.path);
    expect(report.plan.deleted.map(({ path }) => path)).toContain('.eslintrc.json');
    expect(report.categories.find(({ name }) => name === 'Secrets')?.examples).toMatchObject([
        { check: 'secrets/environment-examples', file: 'src/a.js', line: 1 },
    ]);
    expect(report.nextSteps).toStrictEqual([
        `npm install --save-dev --save-exact @gspothq/cli@${cliPackage.version}`,
        'npm exec --no -- gspot init',
        'Commit the setup files.',
        'Fix each file as you touch it.',
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('scan runs the gspot commit checks of the planned setup', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module","scripts":{"lint":"eslint ."}}\n',
        'src/a.js': 'export const value = 1\n',
    });
    commitAll(sandbox.path);
    const report = await runScan(sandbox.path);
    const results = report.checks.filter(({ check }) => check.startsWith('gspot/'));
    expect(results.find(({ check }) => check === 'gspot/detected-configurations')?.status).toBe('passed');
    expect(
        results.find(({ check }) => check === 'gspot/conflicting-configs')?.findings.map(({ rule }) => rule),
    ).toStrictEqual(['lint-command']);
});

test('scan leaves the pin out of its copy, so the lockfile of the repository stays current', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'package-lock.json': '{"name":"example","lockfileVersion":3,"packages":{"":{"name":"example"}}}\n',
        'src/a.js': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    const { checks } = await runScan(sandbox.path);
    expect(checks.find(({ check }) => check === 'dependencies/stale-lockfile')?.findings).toStrictEqual([]);
});

test('scan links the Python environment of the repository into its copy', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': '.venv/\n',
        'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
        'main.py': 'VALUE = 1\n',
    });
    commitAll(sandbox.path);
    await mkdir(join(sandbox.path, '.venv'));
    await writeFile(join(sandbox.path, '.venv/pyvenv.cfg'), 'home = /usr/bin\n');
    const { checks } = await runScan(sandbox.path);
    // Without the link, the note asks for a .venv folder; with it, the note names the first tool that the run lacks.
    expect(checks.find(({ check }) => check === 'python/deptry')?.note).toMatch(
        /^[\w.-]+ \S+ is not installed\. Run gspot install\.$/u,
    );
});

test('scan names a lockfile that Git does not track, because init picks its package manager and the scan cannot', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'src/a.js': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'bun.lock'), '{"lockfileVersion":1,"workspaces":{},"packages":{}}\n');
    const report = await runScan(sandbox.path);
    expect(report.nextSteps[0]).toStartWith('npm install');
    expect(report.notRun).toContain('Stage bun.lock, so the scan picks the same package manager as init.');
});

test('scan reads the hooks of the repository, and not the hooks of its copy', async () => {
    await using sandbox = await createGitSandbox({
        '.husky/pre-commit': 'npm test\n',
        'README.md': '# Example\n',
    });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.husky/_']);
    const husky = await runScan(sandbox.path);
    expect(husky.plan.keep.map(({ path }) => path)).toContain('.husky');
    runGitStep(sandbox.path, ['config', '--unset', 'core.hooksPath']);
    await writeFile(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const gitFolder = await runScan(sandbox.path);
    expect(gitFolder.plan.keep.map(({ path }) => path)).toStrictEqual(['.git/hooks']);
});

test('scan reads the staged files, so a file that Git does not track stays out of the report', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'NOTES.md'), '# Notes\n');
    const { totals } = await runScan(sandbox.path);
    expect(totals.files).toBe(1);
});
