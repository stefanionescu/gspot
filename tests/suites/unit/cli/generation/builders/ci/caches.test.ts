import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { CI_PINS } from '#cli/config/settings/tables.ts';
import type { GithubWorkflow } from '#tests/types/setup.ts';
import { buildGithubWorkflow } from '#cli/generation/builders/ci.ts';
import { LINUX_PIPELINE } from '#tests/config/generation/builders.ts';
import { GITHUB_MISE_CACHE_KEY } from '#cli/config/generation/builders.ts';

test('the GitHub job caches its mise tools, keyed on the workflow and the gspot mise files', () => {
    const { jobs } = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    const mise = jobs['lint']!.steps.find((step) => step.uses?.startsWith(`${CI_PINS.actions.mise.name}@`) === true);
    expect(mise?.with).toStrictEqual({
        version: CI_PINS.mise.version,
        cache_save_post: true,
        cache_key: GITHUB_MISE_CACHE_KEY,
    });
});
