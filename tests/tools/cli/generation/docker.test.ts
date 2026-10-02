import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { writeConfigs } from '#tests/harness/cli/generated.ts';

test('Docker configuration scans isolate deepest scopes and retain scoped advisory exceptions', async () => {
    await using sandbox = await testdir();
    const source =
        'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nUSER root\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const policy = policyOf(
        ['docker'],
        '[[scope]]\npath = "app"\n[scope.tools.trivy]\nignore = [{ id = "DS-0002", reason = "This test exercises inherited advisory exceptions." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, source])),
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'untracked/Dockerfile'), source);
    const session = await openSession(sandbox.path);
    await writeConfigs(session, sandbox.path);
    const options = runOptions({ stage: 'push', only: ['docker/trivy-config'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    expect(
        failed.report.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'fail', files: ['Dockerfile'] },
        { scope: 'app', status: 'ok', files: [] },
        { scope: 'app/child', status: 'ok', files: [] },
        { scope: 'sibling', status: 'fail', files: ['sibling/Dockerfile'] },
    ]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await Bun.write(join(sandbox.path, path), source.replace('USER root', 'USER node'));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'app/Dockerfile')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'untracked/Dockerfile')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});
