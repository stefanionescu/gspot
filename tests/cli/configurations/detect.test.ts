import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { throws } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readRepository } from '#cli/repository/public.ts';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import { runtimeEvidenceCases } from '#tests/harness/repository.ts';
import { PYTHON_PROJECT_FILES } from '#tests/config/samples/python.ts';
import { detectUnselected, detectConfigurations } from '#cli/repository/selection/contracts.ts';
import { parseManifest, linkManifestTools, configurationManifests } from '#cli/configurations/public.ts';

import {
    SWIFT_TEST_CASES,
    SWIFT_TARGET_CASES,
    POSTGRES_CONTENT_CASES,
    PYTHON_DEPENDENCY_CASES,
    POSTGRES_DEPENDENCY_CASES,
} from '#tests/config/cli/configurations/detect.ts';

test('proposes a language from an extension and the defaults for every repository', () => {
    const plans = detectConfigurations(process.cwd(), [buildTrackedFile('a.sh')], configurationManifests(), []);
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
        detectUnselected(
            sandbox.path,
            selected.repository.files,
            selected.manifests,
            [],
            selected.packageManifests,
        ).find((row) => row.configuration === 'tanstack-query'),
    ).toMatchObject({ configuration: 'tanstack-query', command: 'gspot add tanstack-query' });
    await Bun.write(join(sandbox.path, 'package.json'), '{"name":"app","private":true}\n');
    const removed = await openSession(sandbox.path);
    expect(
        detectUnselected(sandbox.path, removed.repository.files, removed.manifests, [], removed.packageManifests).map(
            (row) => row.configuration,
        ),
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
    ['openapi', 'swagger.json', undefined],
    ['openapi', 'apps/api/swagger.yaml', undefined],
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
        detectConfigurations(process.cwd(), [buildTrackedFile(path)], manifests, []).find(
            (row) => row.configuration === configuration,
        ),
    ).toMatchObject({ configuration, evidence: evidence ?? path });
    expect(
        detectConfigurations(process.cwd(), [buildTrackedFile('config.toml')], manifests, []).map(
            (row) => row.configuration,
        ),
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
            detectUnselected(sandbox.path, before.repository.files, before.manifests, [], before.packageManifests).map(
                ({ configuration }) => configuration,
            ),
        ).not.toContain('typescript');
        await Bun.write(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectUnselected(
                sandbox.path,
                configured.repository.files,
                configured.manifests,
                [],
                configured.packageManifests,
            ).find(({ configuration }) => configuration === 'typescript')?.evidence,
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
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), packageManifests, 'api').some(
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
    const proposed = detectConfigurations(sandbox.path, repository.files, manifests, packageManifests, 'api');
    expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
    expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(sandbox.path, repository.files, manifests, packageManifests, 'other').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(false);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = readPackageManifests(sandbox.path, repository.files);
    expect(
        detectConfigurations(sandbox.path, repository.files, manifests, corrected, 'api').some(
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
    const detected = detectConfigurations(
        sandbox.path,
        repository.files,
        linkManifestTools([manifest]),
        packageManifests,
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
});

test.each(SWIFT_TEST_CASES)('Swift test detection identifies $name', async ({ source, selected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Examples/Checks.swift': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'swift-tests',
        ),
    ).toBe(selected);
});

test.each(SWIFT_TARGET_CASES)('Swift package test detection recognizes $name', async ({ source, declared }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Package.swift': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'swift-tests',
        ),
    ).toBe(declared);
});

test.each(POSTGRES_DEPENDENCY_CASES.flatMap((entry) => ['', 'apps/api'].map((scope) => ({ ...entry, scope }))))(
    'Postgres detection reads $name from "$scope" and leaves sibling scopes independent',
    async ({ name, path, source, scope }) => {
        await using sandbox = await testdir();
        const owned = scope === '' ? path : `${scope}/${path}`;
        await createFileTree(sandbox.path, { [owned]: source, 'other/migrations/1_initial.sql': 'SELECT 1;\n' });
        const repository = await readRepository(sandbox.path, [], [], []);
        const manifests = configurationManifests();
        const packages = readPackageManifests(sandbox.path, repository.files);
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, packages, scope).find(
                (entry) => entry.configuration === 'postgres',
            ),
        ).toMatchObject({ evidence: `${name} in ${owned}` });
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, packages, 'other').some(
                (entry) => entry.configuration === 'postgres',
            ),
        ).toBe(false);
        await writeFile(join(sandbox.path, owned), path === 'package.json' ? '{"private":true}\n' : '');
        const corrected = readPackageManifests(sandbox.path, repository.files);
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, corrected, scope).some(
                (entry) => entry.configuration === 'postgres',
            ),
        ).toBe(false);
    },
);

test.each(POSTGRES_CONTENT_CASES.flatMap((entry) => ['', 'apps/api'].map((scope) => ({ ...entry, scope }))))(
    'Postgres content detection handles $name in "$scope" without borrowing sibling evidence',
    async ({ path, source, detected, scope }) => {
        await using sandbox = await testdir();
        const owned = scope === '' ? path : `${scope}/${path}`;
        await createFileTree(sandbox.path, {
            [owned]: source,
            'other/prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n}\n',
        });
        const repository = await readRepository(sandbox.path, [], [], []);
        const manifests = configurationManifests();
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, [], scope).some(
                (entry) => entry.configuration === 'postgres',
            ),
        ).toBe(detected);
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, [], 'other').find(
                (entry) => entry.configuration === 'postgres',
            ),
        ).toStrictEqual({ configuration: 'postgres', kind: 'database', evidence: 'other/prisma/schema.prisma' });
    },
);

test('Postgres content detection retains native missing-file behavior and refuses invalid declared patterns', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'prisma/schema.prisma': 'provider = "postgresql"\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    await unlink(join(sandbox.path, 'prisma/schema.prisma'));
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            (entry) => entry.configuration === 'postgres',
        ),
    ).toBe(false);
    expect(() =>
        parseManifest(
            '[configuration]\ntitle = "Content"\ndescription = "Detects declared content."\n[detect.content]\n"prisma/schema.prisma" = "["\n',
            'configurations/database/content',
        ),
    ).toThrow('valid Unicode regular expression');
});

test('Prisma content discovery returns the native read error while ordinary sessions retain manual selection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript']),
        'prisma/schema.prisma': 'provider = "postgresql"\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const manifests = configurationManifests();
    const failure = Object.assign(new Error('Prisma read failed.'), { code: 'EIO' });
    using read = spyOn(filesystem, 'readFileSync').mockImplementationOnce(() => {
        throw failure;
    });
    throws(
        () => detectConfigurations(sandbox.path, repository.files, manifests, []),
        (error) => error === failure,
    );
    expect(String(read.mock.calls[0]?.[0])).toBe(join(sandbox.path, 'prisma/schema.prisma'));
    read.mockClear();
    const session = await openSession(sandbox.path);
    const selected = session.scopes.flatMap((scope) => scope.selected.map((manifest) => manifest.configuration.name));
    expect(selected).toContain('javascript');
    expect(selected).not.toContain('postgres');
    expect(read.mock.calls.some(([path]) => String(path).endsWith('/prisma/schema.prisma'))).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'prisma/schema.prisma')).text()).toBe('provider = "postgresql"\n');
});
