import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import type { ScanReport } from '#cli/types/commands/reports.ts';
import { API_TOKEN } from '#tests/config/integration/general.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('scan installs the tools in its copy, reports a committed secret and a file to format, and changes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'credential.txt': `api_key = "${API_TOKEN}"\n`,
        'package.json': '{ "name": "example", "private": true, "type": "module" }\n',
        'source.js': 'export const value = {enabled:true}\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await spawnGspot(sandbox.path, ['scan', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as ScanReport;
    expect(report.notRun).toStrictEqual([]);
    expect(report.categories[0]?.name).toBe('Secrets');
    expect(report.categories[0]?.examples).toMatchObject([
        { check: 'secrets/gitleaks-staged', file: 'credential.txt' },
    ]);
    expect(report.filesToFormat).toBeGreaterThan(0);
    expect(report.cost.megabytes).toBeGreaterThan(0);
    expect(report.cost.perHook.map(({ name }) => name)).toContain('pre-commit');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
