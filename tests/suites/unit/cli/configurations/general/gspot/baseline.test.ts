import { test, expect } from 'bun:test';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const staleCount = { file: 'guide.md', check: 'docs/missing-paths', rule: 'docs/missing-paths', count: 1 };

test.each([
    { name: 'a run of the file judges the count', paths: ['guide.md'], findings: ['guide.md'] },
    { name: 'a run of another file leaves it', paths: ['notes.md'], findings: [] },
])('gspot/baseline: $name', async ({ paths, findings }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'guide.md': 'The guide names no path.\n',
        'notes.md': 'The notes name no path.\n',
    });
    commitAll(sandbox.path);
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['docs/missing-paths', 'gspot/baseline'], paths: [...paths], baseline: [staleCount] }),
    );
    const check = report.checks.find((result) => result.check === 'gspot/baseline');
    expect(check?.findings.map(({ file }) => file)).toStrictEqual([...findings]);
});

test('gspot/baseline leaves a count alone when its check did not run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'guide.md': 'The guide names no path.\n',
    });
    commitAll(sandbox.path);
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/baseline'], baseline: [staleCount] }),
    );
    expect(report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
