// The Docker guide examples pass the generated hadolint configuration, and a floating image fails.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { allRuleExamples } from '#cli/agents/examples.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

test('Docker guide examples pass all while a floating image fails', async () => {
    await using sandbox = await testdir();
    const examples = allRuleExamples().filter((example) => example.language === 'dockerfile');
    expect(examples.length).toBeGreaterThan(0);
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['docker'], '', 'all'),
        ...Object.fromEntries(examples.map((example, index) => [`Dockerfile.${String(index)}`, example.body])),
        'Dockerfile.rejected': 'FROM node:latest\nUSER node\nCMD ["node", "--version"]\n',
    });
    const session = await openSession(sandbox.path);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter((file) => file.kind === 'config'))
        await Bun.write(join(sandbox.path, file.path), file.content);
    const options = {
        stage: 'commit' as const,
        only: ['docker/hadolint'],
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    };
    const rejected = await executeRun(session, options);
    expect(rejected.report.exitCode, JSON.stringify(rejected.report)).toBe(1);
    expect(
        rejected.report.checks.flatMap((check) => check.findings.map((finding) => [finding.file, finding.rule])),
    ).toStrictEqual([['Dockerfile.rejected', 'DL3007']]);
    await Bun.write(
        join(sandbox.path, 'Dockerfile.rejected'),
        'FROM node:24-bookworm-slim\nUSER node\nCMD ["node", "--version"]\n',
    );
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(corrected.report.checks[0]?.files).toBe(examples.length + 1);
});
