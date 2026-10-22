import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildConfiguration } from '#tests/setup/cli/configurations.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/data/repository/dependency-files.ts';
import { buildTrackedFile, readTestRepository } from '#tests/setup/cli/repository.ts';
import { PRISMA_SCHEMA_CASES, SITE_DETECTION_PATHS, RUNTIME_DETECTION_CASES } from '#tests/data/repository/detect.ts';

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations(
        { root: process.cwd(), files: [buildTrackedFile('a.sh')], dependencyFiles: [] },
        readConfigurations(),
    );
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.some((plan) => plan.configuration === 'spelling')).toBe(true);
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
    expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
    expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles },
            configurations,
            'other',
        ).some((entry) => entry.configuration === 'fastapi'),
    ).toBe(false);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles: corrected },
            configurations,
            'api',
        ).some((entry) => entry.configuration === 'fastapi'),
    ).toBe(false);
});

test.each(PRISMA_SCHEMA_CASES.flatMap((entry) => ['', 'apps/api'].map((scope) => ({ ...entry, scope }))))(
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
            ).some((entry) => entry.configuration === 'postgres'),
        ).toBe(detected);
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: [] },
                configurations,
                'other',
            ).find((entry) => entry.configuration === 'postgres'),
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
        ).some((entry) => entry.configuration === 'postgres'),
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
    expect(read.mock.calls.some(([path]) => String(path).endsWith('/prisma/schema.prisma'))).toBe(false);
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

test.each(RUNTIME_DETECTION_CASES)('$name decides runtime detection within its project', async (entry) => {
    await using sandbox = await testdir({
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('toolProjectPackageJson' in entry ? entry.toolProjectPackageJson : {}),
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const configuration = buildConfiguration('runtime', {
        group: 'general',
        tables: `[detect]\nruntimes = ["${entry.runtime}"]\n`,
    });
    const detected = detectConfigurations(
        { root: sandbox.path, files: repository.files, dependencyFiles },
        new Map([['runtime', configuration]]),
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
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
