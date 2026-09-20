// Acceptance on the reference repositories: init and check in a detached worktree, the repository untouched.

import { git } from '#tests/harness/planted.ts';
// Runs when GSPOT_ACCEPTANCE names the repositories, separated by a colon.
import { describe, expect, test } from 'bun:test';
import { acceptanceRun } from '#tests/harness/worktree.ts';
import { acceptanceRepositories } from '#cli/platform/environment.ts';

const ACCEPTANCE_TIMEOUT_MS = 900_000;
const repositories = acceptanceRepositories();

describe.skipIf(repositories.length === 0)('acceptance on the reference repositories', () => {
    for (const repository of repositories)
        test(
            `gspot installs and checks ${repository} in a worktree and leaves the repository as it was`,
            async () => {
                const before = git(repository, ['status', '--porcelain']).stdout;
                const worktrees = git(repository, ['worktree', 'list', '--porcelain']);
                expect(worktrees.code, worktrees.stderr).toBe(0);
                const result = await acceptanceRun(repository);
                expect(result.init).toContain('written: gspot.toml');
                expect(result.report.checks.length).toBeGreaterThan(0);
                expect(result.report.coverage.checked).toBeGreaterThan(0);
                expect(result.report.exitCode, JSON.stringify(result.report.checks)).toBe(0);
                expect(result.report.failed).toEqual([]);
                expect(result.report.skips.filter((skip) => skip.source !== 'rules')).toEqual([]);
                for (const check of result.report.checks) {
                    expect(['ok', 'skipped'], JSON.stringify(check)).toContain(check.status);
                    if (check.status === 'skipped')
                        expect(result.report.skips).toContainEqual({ check: check.check, source: 'rules' });
                    expect(check.findings, JSON.stringify(check)).toEqual([]);
                }
                expect(git(repository, ['status', '--porcelain']).stdout).toBe(before);
                const after = git(repository, ['worktree', 'list', '--porcelain']);
                expect(after.code, after.stderr).toBe(0);
                expect(after.stdout).toBe(worktrees.stdout);
            },
            ACCEPTANCE_TIMEOUT_MS,
        );
});
