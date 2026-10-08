import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { runtimeEvidenceCases } from '#tests/harness/repository.ts';
import { PYTHON_PROJECT_FILES } from '#tests/config/samples/python.ts';
import { readPackageManifests } from '#cli/repository/package-manifests.ts';
import { detectUnselected, detectConfigurations } from '#cli/configurations/detect.ts';
import { parseManifest, configurationManifests } from '#cli/configurations/manifests.ts';

import {
    SWIFT_TEST_CASES,
    SWIFT_TARGET_CASES,
    PYTHON_DEPENDENCY_CASES,
} from '#tests/config/cli/configurations/detect.ts';

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

test.each(['.d.ts', '.d.mts', '.d.cts'])(
    'a JavaScript package with TypeScript tooling and %s declarations needs real TypeScript project evidence',
    async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript']),
            'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
            'source.js': 'export const value = 1;\n',
            [`types/library${extension}`]: 'export declare const value: number;\n',
        });
        const before = await openSession(sandbox.path);
        expect(
            detectUnselected(sandbox.path, before.repository.files, before.manifests, []).map(
                ({ configuration }) => configuration,
            ),
        ).not.toContain('typescript');
        await Bun.write(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectUnselected(sandbox.path, configured.repository.files, configured.manifests, []).find(
                ({ configuration }) => configuration === 'typescript',
            )?.evidence,
        ).toBe('tsconfig.json');
    },
);

test('Python project detection uses captured dependencies after the authored manifest changes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_PROJECT_FILES);
    const repository = await readRepository(sandbox.path, [], [], []);
    const packageManifests = readPackageManifests(sandbox.path, repository.files);
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(
        detectConfigurations(repository.files, configurationManifests(), packageManifests, 'api').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(true);
});

test.each(PYTHON_DEPENDENCY_CASES)('Python dependency detection reads $name from $path', async ({ path, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`api/${path}`]: source, 'other/readme.txt': 'No Python dependencies.\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const packageManifests = readPackageManifests(sandbox.path, repository.files);
    expect(
        Object.keys(packageManifests[0]!.dependencies).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['fastapi', 'friendly-bard']);
    const manifests = configurationManifests();
    const proposed = detectConfigurations(repository.files, manifests, packageManifests, 'api');
    expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
    expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(repository.files, manifests, packageManifests, 'other').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(false);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = readPackageManifests(sandbox.path, repository.files);
    expect(
        detectConfigurations(repository.files, manifests, corrected, 'api').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(false);
});

test.each(runtimeEvidenceCases())('$name determines runtime applicability within its project', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        'api/.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const packageManifests = readPackageManifests(sandbox.path, repository.files);
    const manifest = parseManifest(
        `[configuration]\ntitle = "Runtime"\ndescription = "Detects the runtime declared by this project."\n[detect]\nruntimes = ["${entry.runtime}"]\n`,
        'configurations/general/runtime',
    );
    const detected = detectConfigurations(repository.files, new Map([['runtime', manifest]]), packageManifests, 'api');
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
});

test.each(SWIFT_TEST_CASES)('Swift test detection identifies $name', async ({ source, selected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Examples/Checks.swift': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
    expect(
        detectConfigurations(repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'xctest',
        ),
    ).toBe(selected);
});

test.each(SWIFT_TARGET_CASES)('Swift package test detection recognizes $name', async ({ source, declared }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Package.swift': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(
        detectConfigurations(repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'xctest',
        ),
    ).toBe(declared);
});
