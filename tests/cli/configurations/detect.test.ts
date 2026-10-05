import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { detectUnselected, detectConfigurations } from '#cli/configurations/detect.ts';

test('proposes a language from an extension and the defaults for every repository', () => {
    const plans = detectConfigurations([buildTrackedFile('a.sh')], configurationManifests(), []);
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.some((plan) => plan.configuration === 'spelling')).toBe(true);
});

test.each([
    '@tanstack/vue-query',
    '@tanstack/svelte-query',
    '@tanstack/solid-query',
    '@tanstack/angular-query-experimental',
])('TanStack Query detects the declared %s adapter and drops the evidence when removed', async (adapter) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        'package.json': JSON.stringify({ name: 'app', private: true, dependencies: { [adapter]: '5.91.2' } }),
    });
    const selected = await openSession(sandbox.path);
    expect(
        detectUnselected(sandbox.path, selected.repository.files, selected.manifests, []).find(
            (row) => row.configuration === 'tanstack-query',
        ),
    ).toMatchObject({ configuration: 'tanstack-query', command: 'gspot add tanstack-query' });
    await Bun.write(join(sandbox.path, 'package.json'), '{"name":"app","private":true}\n');
    const removed = await openSession(sandbox.path);
    expect(
        detectUnselected(sandbox.path, removed.repository.files, removed.manifests, []).map((row) => row.configuration),
    ).not.toContain('tanstack-query');
});

test.each([
    ['cloudflare', 'wrangler.toml', undefined],
    ['cloudflare', 'apps/api/wrangler.toml', undefined],
    ['cloudflare', 'wrangler.json', undefined],
    ['cloudflare', 'apps/api/wrangler.json', undefined],
    ['cloudflare', 'wrangler.jsonc', undefined],
    ['cloudflare', 'apps/api/wrangler.jsonc', undefined],
    ['cloudflare', '_worker.js', undefined],
    ['cloudflare', 'public/_worker.js', undefined],
    ['cloudflare', 'functions/_middleware.js', undefined],
    ['cloudflare', 'functions/_middleware.ts', undefined],
    ['cloudflare', 'apps/api/functions/_middleware.ts', undefined],
    ['supabase', 'supabase/config.toml', undefined],
    ['supabase', 'apps/api/supabase/config.toml', undefined],
    ['python', 'pyproject.toml', undefined],
    ['python', 'apps/api/pyproject.toml', undefined],
    ['python', 'requirements.txt', undefined],
    ['python', 'apps/api/requirements-dev.txt', undefined],
    ['python', 'Pipfile', undefined],
    ['python', 'apps/api/Pipfile', undefined],
    ['swift', 'Package.swift', '1 .swift file'],
    ['swift', 'apps/api/Package.swift', '1 .swift file'],
])('%s detects the supported project path %s without unrelated file evidence', (configuration, path, evidence) => {
    const manifests = configurationManifests();
    expect(
        detectConfigurations([buildTrackedFile(path)], manifests, []).find(
            (row) => row.configuration === configuration,
        ),
    ).toMatchObject({ configuration, evidence: evidence ?? path });
    expect(
        detectConfigurations([buildTrackedFile('config.toml')], manifests, []).map((row) => row.configuration),
    ).not.toContain(configuration);
});
