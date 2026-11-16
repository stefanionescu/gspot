import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { CI_PINS } from '#cli/config/settings/tables.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { LINUX_PIPELINE } from '#tests/config/generation/builders.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/setup.ts';
import { GITLAB_CACHE, GITHUB_MISE_CACHE_KEY } from '#cli/config/generation/builders.ts';
import { listPackageCaches, buildGithubWorkflow, buildGitlabWorkflow } from '#cli/generation/builders/ci.ts';

const NPM_CACHES = {
    ...LINUX_PIPELINE,
    packageCaches: { lockfiles: ['package-lock.json'], variables: ['npm_config_cache'] },
};

test('the GitHub job caches its mise tools, keyed on the workflow and the gspot mise files', () => {
    const { jobs } = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    const mise = jobs['lint']!.steps.find((step) => step.uses?.startsWith(`${CI_PINS.actions.mise.name}@`) === true);
    expect(mise?.with).toStrictEqual({
        version: CI_PINS.mise.version,
        cache_save_post: true,
        cache_key: GITHUB_MISE_CACHE_KEY,
    });
});

test('CI caches the downloads of each tracked lockfile, and leaves out Yarn 2 and later', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'web' }, { path: 'app' }, { path: 'legacy' }],
        }),
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3}',
        'uv.lock': 'version = 1\n',
        'web/package.json': '{"private":true}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'app/package.json': '{"private":true,"packageManager":"yarn@4.9.2"}',
        'app/yarn.lock': '__metadata:\n  version: 8\n',
        'legacy/package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
        'legacy/yarn.lock': '# yarn lockfile v1\n',
    });
    expect(listPackageCaches(await openSession(sandbox.path))).toStrictEqual({
        lockfiles: ['package-lock.json', 'uv.lock', 'legacy/yarn.lock', 'web/pnpm-lock.yaml'],
        variables: ['npm_config_cache', 'UV_CACHE_DIR', 'YARN_CACHE_FOLDER', 'npm_config_store_dir'],
    });
});

test('the GitHub job points the package managers at one folder and restores it, keyed on the lockfiles', () => {
    const { jobs } = parse(buildGithubWorkflow(NPM_CACHES).content) as GithubWorkflow;
    const names = jobs['lint']!.steps.map(({ name }) => name);
    expect(names.slice(2, 5)).toStrictEqual([
        'Install gspot',
        'Point package caches at one folder',
        'Restore package caches',
    ]);
    const [folders, cache] = jobs['lint']!.steps.slice(3, 5);
    expect(folders?.run).toBe('echo "npm_config_cache=$RUNNER_TEMP/packages/npm_config_cache" >> "$GITHUB_ENV"');
    expect(cache?.uses).toBe(`${CI_PINS.actions.cache.name}@${CI_PINS.actions.cache.sha}`);
    expect(cache?.with).toStrictEqual({
        path: `\${{ runner.temp }}/packages`,
        key: `packages-\${{ runner.os }}-\${{ hashFiles('.github/workflows/gspot.yml', 'package-lock.json') }}`,
    });
});

test('the GitLab job keeps the package caches in the project folder, keyed on the pipeline and the lockfile', () => {
    const { gspot } = parse(buildGitlabWorkflow(NPM_CACHES).content) as GitlabPipeline;
    expect(gspot.variables['npm_config_cache']).toBe('$CI_PROJECT_DIR/.cache/packages/npm_config_cache');
    expect(gspot.cache).toStrictEqual([
        GITLAB_CACHE,
        {
            key: { files: ['.gitlab/ci/gspot.yml', 'package-lock.json'], prefix: 'packages' },
            paths: ['.cache/packages/'],
        },
    ]);
});

test('a repository without lockfiles gets no package cache', () => {
    const { jobs } = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    expect(jobs['lint']!.steps.map(({ name }) => name)).not.toContain('Restore package caches');
    const { gspot } = parse(buildGitlabWorkflow(LINUX_PIPELINE).content) as GitlabPipeline;
    expect(gspot.cache).toStrictEqual(GITLAB_CACHE);
});
