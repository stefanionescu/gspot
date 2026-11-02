import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import cliPackage from '#cli-package' with { type: 'json' };
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
    return JSON.parse(result.stdout) as ScanReport;
}

test('scan refuses a repository that already has a gspot.toml', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'configurations = []\n' });
    const result = await runGspot(sandbox.path, ['scan']);
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(
        'This repository already has a gspot.toml, so gspot scan has nothing to preview. Run gspot check.\n',
    );
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
    expect(report.plan.delete.map(({ path }) => path)).toContain('.eslintrc.json');
    expect(report.settingsText).toContain('configurations = ');
    expect(report.categories.find(({ name }) => name === 'Secrets')?.examples).toMatchObject([
        { check: 'secrets/env-examples', file: 'src/a.js', line: 1 },
    ]);
    expect(report.notRun.length).toBeGreaterThan(0);
    expect(report.nextSteps).toStrictEqual([
        `npm install --save-dev --save-exact @gspothq/cli@${cliPackage.version}`,
        'npm exec --no -- gspot init',
        'npm exec --no -- gspot install',
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
    expect(report.plan.carry).toMatchObject([
        { path: '.prettierrc.json', carried: ['semi'], dropped: ['quoteProps'] },
        { path: '.prettierignore', carried: ['src/made'] },
    ]);
});

test('scan reads the staged files, so a file that Git does not track stays out of the report', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const { totals } = await runScan(sandbox.path);
    expect(totals.files).toBe(0);
});
