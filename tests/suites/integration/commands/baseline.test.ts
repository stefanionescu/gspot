import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/system/git.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('a baseline holds the findings of real tools, and the formatter leaves its file alone', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{ "name": "example", "private": true, "type": "module" }\n',
        'source.js': 'export const value = {enabled:true}\n',
    });
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, ['init', '--configurations', 'javascript']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    await applyThenInstall(sandbox.path);
    const before = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const written = await spawnGspot(sandbox.path, ['baseline']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const after = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(after.code, after.stdout + after.stderr).toBe(0);
    expect(after.report.baselined['format/prettier']).toBeGreaterThan(0);
    await writeFile(join(sandbox.path, 'source.js'), 'export const value = { enabled: true };\n');
    const stale = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(stale.code, stale.stdout + stale.stderr).toBe(1);
    expect(stale.report.failed).toStrictEqual(['gspot/baseline']);
    const pruned = await spawnGspot(sandbox.path, ['baseline', '--prune']);
    expect(pruned.code, pruned.stdout + pruned.stderr).toBe(0);
    const clean = await spawnGspot(sandbox.path, ['check']);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});
