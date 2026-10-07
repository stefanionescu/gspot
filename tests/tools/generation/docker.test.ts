import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';

test('Docker configuration scans isolate deepest scopes and retain scoped advisory exceptions', async () => {
    await using sandbox = await testdir();
    const source =
        'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nUSER root\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const policy = buildPolicy(['docker'], {
        tables: '[[scope]]\npath = "app"\n[scope.tools.trivy]\nignore = [{ id = "DS-0002", reason = "This test exercises inherited advisory exceptions." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, source])),
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'untracked/Dockerfile'), source);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'push', only: ['docker/trivy-config'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    expect(
        failed.report.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', files: ['Dockerfile'] },
        { scope: 'app', status: 'passed', files: [] },
        { scope: 'app/child', status: 'passed', files: [] },
        { scope: 'sibling', status: 'failed', files: ['sibling/Dockerfile'] },
    ]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await Bun.write(join(sandbox.path, path), source.replace('USER root', 'USER node'));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
});
