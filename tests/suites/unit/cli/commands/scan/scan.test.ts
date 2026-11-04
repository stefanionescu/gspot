import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { scanOutputSchema } from '#cli/schemas/commands.ts';
import * as installers from '#cli/tools/installers/install.ts';
import type { ScanReport } from '#cli/types/commands/reports.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function runScan(root: string): Promise<ScanReport> {
    using install = spyOn(installers, 'installTools').mockResolvedValue({
        installed: [],
        missing: [],
        notes: [],
        steps: [],
    });
    const result = await runGspot(root, ['scan', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(install).toHaveBeenCalledTimes(1);
    expect(install.mock.calls[0]?.[1].generated.files.map(({ path }) => path)).not.toContain('.gspot/hooks/pre-commit');
    return scanOutputSchema.parse(JSON.parse(result.stdout));
}

test('scan refuses a repository that already has a gspot.toml', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'configurations = []\n' });
    const result = await runGspot(sandbox.path, ['scan', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
});

test('scan refuses --markdown with --json before it copies the repository', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['scan', '--markdown', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
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
    expect(report.settingsText).toContain('configurations = ');
    expect(report.categories.find(({ name }) => name === 'Secrets')?.examples).toMatchObject([
        { check: 'secrets/environment-examples', file: 'src/a.js', line: 1 },
    ]);
    expect(report.notRun.length).toBeGreaterThan(0);
    expect(report.nextSteps).toStrictEqual([
        `npm install --save-dev --save-exact @gspothq/cli@${cliPackage.version}`,
        'npm exec --no -- gspot init',
        'npm exec --no -- gspot check --fix',
        'npm exec --no -- gspot baseline',
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('scan runs the commit checks of the setup, and lists each command that would break and what init carries', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierrc.json': '{"semi":false,"quoteProps":"consistent"}',
        '.prettierignore': 'src/made/\n',
        'package.json': '{"name":"example","private":true,"type":"module","scripts":{"lint":"eslint ."}}\n',
        'src/a.js': 'export const value = 1\n',
        'src/made/b.js': 'export const value = 2\n',
    });
    commitAll(sandbox.path);
    const report = await runScan(sandbox.path);
    const results = report.checks.filter(({ check }) => check.startsWith('gspot/'));
    expect(results.find(({ check }) => check === 'gspot/detected-configurations')?.status).toBe('passed');
    expect(
        results.find(({ check }) => check === 'gspot/conflicting-configs')?.findings.map(({ rule }) => rule),
    ).toStrictEqual(['lint-command']);
    expect(report.plan.lintCommands).toMatchObject([{ file: 'package.json', command: 'eslint .', tool: 'eslint' }]);
    expect(report.plan.carryover).toMatchObject([
        { path: '.prettierrc.json', carried: ['semi'], dropped: ['quoteProps'] },
        { path: '.prettierignore', carried: ['src/made'] },
    ]);
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
    const generated = checks.find(({ check }) => check === 'gspot/generated-files')?.findings ?? [];
    expect(generated.filter(({ rule }) => rule === 'changed')).toStrictEqual([]);
});

test('scan links the Python environment of the repository into its copy', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': '.venv/\n',
        'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
        'main.py': 'VALUE = 1\n',
    });
    commitAll(sandbox.path);
    await mkdir(join(sandbox.path, '.venv'));
    const { notRun } = await runScan(sandbox.path);
    expect(notRun.filter((row) => row.includes('.venv'))).toStrictEqual([]);
});

test('scan reads the staged files, so a file that Git does not track stays out of the report', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const { totals } = await runScan(sandbox.path);
    expect(totals.files).toBe(0);
});
