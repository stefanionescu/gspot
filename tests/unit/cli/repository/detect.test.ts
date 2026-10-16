import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { readRepository } from '#cli/repository/read.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { runtimeDetectionRows } from '#tests/setup/sandbox.ts';
import { buildTrackedFile } from '#tests/setup/tracked-file.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';

import {
    SWIFT_TEST_CASES,
    SWIFT_TARGET_CASES,
    PRISMA_CONTENT_CASES,
    PYTHON_DEPENDENCY_CASES,
} from '#tests/config/detect.ts';

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations(process.cwd(), [buildTrackedFile('a.sh')], configurationManifests(), []);
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.some((plan) => plan.configuration === 'spelling')).toBe(true);
});

test.each(['.d.ts', '.d.mts', '.d.cts'])(
    'TypeScript tooling with %s declarations needs a tsconfig.json to propose typescript',
    async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['javascript']),
            'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
            'source.js': 'export const value = 1;\n',
            [`types/library${extension}`]: 'export declare const value: number;\n',
        });
        const before = await openSession(sandbox.path);
        expect(
            detectConfigurations(sandbox.path, before.repository.files, before.manifests, before.packageManifests).map(
                ({ configuration }) => configuration,
            ),
        ).not.toContain('typescript');
        await Bun.write(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectConfigurations(
                sandbox.path,
                configured.repository.files,
                configured.manifests,
                configured.packageManifests,
            ).find(({ configuration }) => configuration === 'typescript')?.evidence,
        ).toBe('tsconfig.json');
    },
);

test.each([...PYTHON_DEPENDENCY_CASES])(
    'Python dependencies are read from $name in $path',
    async ({ path, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [`api/${path}`]: source,
            'other/readme.txt': 'No Python dependencies.\n',
        });
        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
        });
        const packageManifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
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
        const corrected = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, corrected, 'api').some(
                (entry) => entry.configuration === 'fastapi',
            ),
        ).toBe(false);
    },
);

test.each(runtimeDetectionRows())('$name decides runtime detection within its project', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        'api/.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    const packageManifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const manifest = buildManifest('runtime', {
        group: 'general',
        tables: `[configuration]\ntitle = "Runtime"\ndescription = "Detects the runtime declared by this project."\n[detect]\nruntimes = ["${entry.runtime}"]\n`.replace(
            /^\s*\[configuration\][\s\S]*?(?=\n\[|$)/u,
            '',
        ),
    });
    const detected = detectConfigurations(
        sandbox.path,
        repository.files,
        new Map([['runtime', { ...manifest, tools: [] }]]),
        packageManifests,
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
});

test.each([...SWIFT_TEST_CASES])('Swift test detection: $name', async ({ source, selected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Examples/Checks.swift': source });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'swift-tests',
        ),
    ).toBe(selected);
});

test.each([...SWIFT_TARGET_CASES])('Swift package test targets: $name', async ({ source, declared }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Package.swift': source });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            ({ configuration }) => configuration === 'swift-tests',
        ),
    ).toBe(declared);
});

test.each(PRISMA_CONTENT_CASES.flatMap((entry) => ['', 'apps/api'].map((scope) => ({ ...entry, scope }))))(
    'Prisma content detection handles $name in "$scope" and not in a sibling scope',
    async ({ path, source, detected, scope }) => {
        await using sandbox = await testdir();
        const owned = scope === '' ? path : `${scope}/${path}`;
        await createFileTree(sandbox.path, {
            [owned]: source,
            'other/prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n}\n',
        });
        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
        });
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
        ).toStrictEqual({ configuration: 'postgres', group: 'database', evidence: 'other/prisma/schema.prisma' });
    },
);

test('content detection skips a deleted file and refuses an invalid pattern', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'prisma/schema.prisma': 'provider = "postgresql"\n' });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    await unlink(join(sandbox.path, 'prisma/schema.prisma'));
    expect(
        detectConfigurations(sandbox.path, repository.files, configurationManifests(), []).some(
            (entry) => entry.configuration === 'postgres',
        ),
    ).toBe(false);
    expect(() =>
        buildManifest('content', {
            group: 'database',
            tables: '[configuration]\ntitle = "Content"\ndescription = "Detects declared content."\n[detect.content]\n"prisma/schema.prisma" = "["\n'.replace(
                /^\s*\[configuration\][\s\S]*?(?=\n\[|$)/u,
                '',
            ),
        }),
    ).toThrow('valid Unicode regular expression');
});

test('a Prisma read error stops detection, and a session with saved choices does not read the file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript']),
        'prisma/schema.prisma': 'provider = "postgresql"\n',
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    const manifests = configurationManifests();
    const failure = Object.assign(new Error('Prisma read failed.'), { code: 'EIO' });
    using read = spyOn(filesystem, 'readFileSync').mockImplementationOnce(() => {
        throw failure;
    });
    expect(() => detectConfigurations(sandbox.path, repository.files, manifests, [])).toThrow(failure);
    expect(String(read.mock.calls[0]?.[0])).toBe(join(sandbox.path, 'prisma/schema.prisma'));
    read.mockClear();
    const session = await openSession(sandbox.path);
    const selected = session.scopes.flatMap((scope) => scope.selected.map((manifest) => manifest.configuration.name));
    expect(selected).toContain('javascript');
    expect(selected).not.toContain('postgres');
    expect(read.mock.calls.some(([path]) => String(path).endsWith('/prisma/schema.prisma'))).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'prisma/schema.prisma')).text()).toBe('provider = "postgresql"\n');
});

test('Testing Library is detected only in the scope that declares it', async () => {
    const dependency = '@testing-library/react';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript']),
        'package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
        'child/package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '1.0.0' } }),
        'neighbor/package.json': '{"private":true,"dependencies":{"testing-library-like":"1.0.0"}}\n',
    });
    const session = await openSession(sandbox.path);
    const projects = await readDependencyFiles(createReadCache(sandbox.path), session.repository.files);
    const detected = (scope: string) =>
        detectConfigurations(sandbox.path, session.repository.files, session.manifests, projects, scope).find(
            (row) => row.configuration === 'testing-library',
        );
    expect(detected('child')).toMatchObject({ evidence: `${dependency} in child/package.json` });
    expect(detected('neighbor')).toBeUndefined();
    expect(
        session.scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)),
    ).not.toContain('testing-library');
});

test.each(['next-intl', 'react-i18next'])(
    'detection selects translations for %s without proposing Next.js',
    async (dependency) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText([]),
            'package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '4.8.3' } }),
            'source.ts': 'export {};\n',
        });
        const session = await openSession(sandbox.path);
        const detected = detectConfigurations(
            session.root,
            session.repository.files,
            session.manifests,
            await readDependencyFiles(createReadCache(session.root), session.repository.files),
        );
        expect(detected.some((entry) => entry.configuration === 'translations')).toBe(true);
        expect(detected.some((entry) => entry.configuration === 'nextjs')).toBe(false);
    },
);
