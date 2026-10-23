import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { buildConfiguration } from '#tests/setup/cli/configurations.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/config/repository/samples.ts';
import { buildTrackedFile, readTestRepository } from '#tests/setup/cli/repository.ts';
import { PRISMA_SCHEMA_CASES, SITE_DETECTION_PATHS, RUNTIME_DETECTION_CASES } from '#tests/config/repository/detect.ts';

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations(
        { root: process.cwd(), files: [buildTrackedFile('a.sh')], dependencyFiles: [] },
        readConfigurations(),
    );
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.map(({ configuration }) => configuration)).toContain('spelling');
});

test.each(['.d.ts', '.d.mts', '.d.cts'])(
    'TypeScript tooling with %s declarations needs a tsconfig.json to propose typescript',
    async (extension) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript']),
            'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
            'source.js': 'export const value = 1;\n',
            [`types/library${extension}`]: 'export declare const value: number;\n',
        });

        const before = await openSession(sandbox.path);
        expect(
            detectConfigurations(before.repository, before.configurations).map(({ configuration }) => configuration),
        ).not.toContain('typescript');
        await writeFile(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectConfigurations(configured.repository, configured.configurations).find(
                ({ configuration }) => configuration === 'typescript',
            )?.evidence,
        ).toBe('tsconfig.json');
    },
);

test('a FastAPI dependency proposes fastapi and python in its own scope until it is removed', async () => {
    const { path, source } = PYTHON_DEPENDENCY_CASES[0];
    await using sandbox = await testdir({
        [`api/${path}`]: source,
        'other/readme.txt': 'No Python dependencies.\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const configurations = readConfigurations();
    const proposed = detectConfigurations(
        { root: sandbox.path, files: repository.files, dependencyFiles },
        configurations,
        'api',
    );
    expect(proposed.find((detection) => detection.configuration === 'fastapi')?.evidence).toBe(
        `fastapi in api/${path}`,
    );
    expect(proposed.find((detection) => detection.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles },
            configurations,
            'other',
        ).some((detection) => detection.configuration === 'fastapi'),
    ).toBe(false);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles: corrected },
            configurations,
            'api',
        ).some((detection) => detection.configuration === 'fastapi'),
    ).toBe(false);
});

test.each(PRISMA_SCHEMA_CASES.flatMap((row) => ['', 'apps/api'].map((scope) => ({ ...row, scope }))))(
    'a Prisma schema with $name selects postgres in "$scope" as expected, and a sibling scope keeps its own detection',
    async ({ path, source, detected, scope }) => {
        await using sandbox = await testdir();
        const owned = scope === '' ? path : `${scope}/${path}`;
        await createFileTree(sandbox.path, {
            [owned]: source,
            'other/prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n}\n',
        });
        const repository = await readTestRepository(sandbox.path);
        const configurations = readConfigurations();
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: [] },
                configurations,
                scope,
            ).some((detection) => detection.configuration === 'postgres'),
        ).toBe(detected);
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: [] },
                configurations,
                'other',
            ).find((detection) => detection.configuration === 'postgres'),
        ).toStrictEqual({ configuration: 'postgres', group: 'database', evidence: 'other/prisma/schema.prisma' });
    },
);

test('content detection skips a file deleted after the repository read', async () => {
    await using sandbox = await testdir({ 'prisma/schema.prisma': 'provider = "postgresql"\n' });

    const repository = await readTestRepository(sandbox.path);
    await unlink(join(sandbox.path, 'prisma/schema.prisma'));
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles: [] },
            readConfigurations(),
        ).some((detection) => detection.configuration === 'postgres'),
    ).toBe(false);
});

test('a Prisma read error stops detection, and a session with saved choices does not read the file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'prisma/schema.prisma': 'provider = "postgresql"\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const configurations = readConfigurations();
    const failure = Object.assign(new Error('Prisma read failed.'), { code: 'EIO' });
    using read = spyOn(filesystem, 'readFileSync').mockImplementationOnce(() => {
        throw failure;
    });
    expect(() =>
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, configurations),
    ).toThrow(failure);
    expect(String(read.mock.calls[0]?.[0])).toBe(join(sandbox.path, 'prisma/schema.prisma'));
    read.mockClear();
    await openSession(sandbox.path);
    expect(
        read.mock.calls.map(([path]) => String(path)).filter((path) => path.endsWith('/prisma/schema.prisma')),
    ).toStrictEqual([]);
});

test('Testing Library is detected only in the scope that declares it', async () => {
    const dependency = '@testing-library/react';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
        'child/package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '1.0.0' } }),
        'neighbor/package.json': '{"private":true,"dependencies":{"testing-library-like":"1.0.0"}}\n',
    });

    const session = await openSession(sandbox.path);
    const projects = await readDependencyFiles(createReadCache(sandbox.path), session.repository.files);
    const detectTestingLibrary = (scope: string) =>
        detectConfigurations(
            { root: sandbox.path, files: session.repository.files, dependencyFiles: projects },
            session.configurations,
            scope,
        ).find((row) => row.configuration === 'testing-library');
    expect(detectTestingLibrary('child')).toMatchObject({ evidence: `${dependency} in child/package.json` });
    expect(detectTestingLibrary('neighbor')).toBeUndefined();
});

test.each(RUNTIME_DETECTION_CASES)('$name decides runtime detection within its project', async (row) => {
    await using sandbox = await testdir({
        'package.json': JSON.stringify({ engines: { [row.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(row.package),
        'api/entry.js': row.source,
        [GSPOT_PATHS.npmProject]: JSON.stringify('toolProjectPackageJson' in row ? row.toolProjectPackageJson : {}),
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const configuration = buildConfiguration('runtime', {
        group: 'general',
        tables: `[detect]\nruntimes = ["${row.runtime}"]\n`,
    });
    const detected = detectConfigurations(
        { root: sandbox.path, files: repository.files, dependencyFiles },
        new Map([['runtime', configuration]]),
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(row.detected ? ['runtime'] : []);
});

test('site is detected from a site.webmanifest or sitemap.xml in any folder', () => {
    const configurations = readConfigurations();
    for (const path of SITE_DETECTION_PATHS) {
        const detected = detectConfigurations(
            { root: process.cwd(), files: [buildTrackedFile(path)], dependencyFiles: [] },
            configurations,
        );
        expect(detected.find(({ configuration }) => configuration === 'site')?.evidence).toBe(path);
    }
});
