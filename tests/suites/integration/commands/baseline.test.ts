import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('a baseline holds the findings that no fixer fixes, and a prune drops the counts that went away', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{ "name": "example", "private": true, "type": "module" }\n',
        'source.js': 'export const value = {enabled:true}\n',
    });
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, ['init', '--configurations', 'javascript']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const before = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const written = await spawnGspot(sandbox.path, ['baseline']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const unfixed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(unfixed.report.failed).toStrictEqual(['format/prettier']);
    expect(unfixed.report.baselined).toStrictEqual({ 'javascript/knip': 1 });
    const fixed = await spawnGspot(sandbox.path, ['check', '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    await rm(join(sandbox.path, 'source.js'));
    const stale = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--json']));
    expect(stale.code, stale.stdout + stale.stderr).toBe(1);
    expect(stale.report.failed).toStrictEqual(['gspot/baseline']);
    const pruned = await spawnGspot(sandbox.path, ['baseline', '--prune']);
    expect(pruned.code, pruned.stdout + pruned.stderr).toBe(0);
    const clean = await spawnGspot(sandbox.path, ['check']);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});
