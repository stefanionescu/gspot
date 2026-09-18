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
            () => {
                const before = git(repository, ['status', '--porcelain']).stdout;
                const result = acceptanceRun(repository);
                expect(result.init).toContain('written: gspot.toml');
                expect(result.statuses['error'] ?? 0, JSON.stringify(result.statuses)).toBe(0);
                expect(git(repository, ['status', '--porcelain']).stdout).toBe(before);
                expect(git(repository, ['worktree', 'list']).stdout.trim().split('\n')).toHaveLength(1);
            },
            ACCEPTANCE_TIMEOUT_MS,
        );
});
