import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependencies.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/data/repository/dependency-files.ts';
import { buildManifest, buildTrackedFile, readTestRepository } from '#tests/setup/builders.ts';

import {
    SWIFT_TARGET_CASES,
    SWIFT_TEST_SAMPLES,
    PRISMA_CONTENT_CASES,
    SITE_DETECTION_PATHS,
} from '#tests/data/configurations/detection.ts';

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations(
        { root: process.cwd(), files: [buildTrackedFile('a.sh')], dependencyFiles: [] },
        readManifests(),
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
            detectConfigurations(before.repository, before.manifests).map(({ configuration }) => configuration),
        ).not.toContain('typescript');
        await writeFile(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectConfigurations(configured.repository, configured.manifests).find(
                ({ configuration }) => configuration === 'typescript',
            )?.evidence,
        ).toBe('tsconfig.json');
    },
);

test.each([...PYTHON_DEPENDENCY_CASES])(
    'Python dependencies are read from $name in $path',
    async ({ path, source }) => {
        await using sandbox = await testdir({
            [`api/${path}`]: source,
            'other/readme.txt': 'No Python dependencies.\n',
        });

        const repository = await readTestRepository(sandbox.path);
        const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
        expect(
            Object.keys(dependencyFiles[0]!.dependencies).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['fastapi', 'friendly-bard']);
        const manifests = readManifests();
        const proposed = detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles },
            manifests,
            'api',
        );
        expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
        expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles },
                manifests,
                'other',
            ).some((entry) => entry.configuration === 'fastapi'),
        ).toBe(false);
        await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
        const corrected = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: corrected },
                manifests,
                'api',
            ).some((entry) => entry.configuration === 'fastapi'),
        ).toBe(false);
    },
);

test.each([...SWIFT_TEST_SAMPLES])('Swift test detection: $name', async ({ source, selected }) => {
    await using sandbox = await testdir({ 'Examples/Checks.swift': source });

    const repository = await readTestRepository(sandbox.path);
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
});

test.each([...SWIFT_TARGET_CASES])('Swift package test targets: $name', async ({ source, declared }) => {
    await using sandbox = await testdir({ 'Package.swift': source });

    const repository = await readTestRepository(sandbox.path);
    expect(repository.files[0]!.tags.includes('swift-test-target')).toBe(declared);
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
        const repository = await readTestRepository(sandbox.path);
        const manifests = readManifests();
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: [] },
                manifests,
                scope,
            ).some((entry) => entry.configuration === 'postgres'),
        ).toBe(detected);
        expect(
            detectConfigurations(
                { root: sandbox.path, files: repository.files, dependencyFiles: [] },
                manifests,
                'other',
            ).find((entry) => entry.configuration === 'postgres'),
        ).toStrictEqual({ configuration: 'postgres', group: 'database', evidence: 'other/prisma/schema.prisma' });
    },
);

test('content detection skips a deleted file and refuses an invalid pattern', async () => {
    await using sandbox = await testdir({ 'prisma/schema.prisma': 'provider = "postgresql"\n' });

    const repository = await readTestRepository(sandbox.path);
    await unlink(join(sandbox.path, 'prisma/schema.prisma'));
    expect(
        detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles: [] },
            readManifests(),
        ).some((entry) => entry.configuration === 'postgres'),
    ).toBe(false);
    expect(() =>
        buildManifest('content', {
            group: 'database',
            tables: '[detect.content]\n"prisma/schema.prisma" = "["\n',
        }),
    ).toThrow('valid Unicode regular expression');
});

test('a Prisma read error stops detection, and a session with saved choices does not read the file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'prisma/schema.prisma': 'provider = "postgresql"\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const manifests = readManifests();
    const failure = Object.assign(new Error('Prisma read failed.'), { code: 'EIO' });
    using read = spyOn(filesystem, 'readFileSync').mockImplementationOnce(() => {
        throw failure;
    });
    expect(() =>
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, manifests),
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
            session.manifests,
            scope,
        ).find((row) => row.configuration === 'testing-library');
    expect(detectTestingLibrary('child')).toMatchObject({ evidence: `${dependency} in child/package.json` });
    expect(detectTestingLibrary('neighbor')).toBeUndefined();
});

test.each(runtimeDetectionRows())('$name decides runtime detection within its project', async (entry) => {
    await using sandbox = await testdir({
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const manifest = buildManifest('runtime', {
        group: 'general',
        tables: `[detect]\nruntimes = ["${entry.runtime}"]\n`,
    });
    const detected = detectConfigurations(
        { root: sandbox.path, files: repository.files, dependencyFiles },
        new Map([['runtime', { ...manifest, tools: [] }]]),
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
});

function runtimeDetectionRows() {
    const rows = JAVASCRIPT_RUNTIMES.flatMap((runtime) =>
        [
            { name: `${runtime} engine`, package: { engines: { [runtime]: '>=1' } }, source: '', detected: true },
            {
                name: `${runtime} script`,
                package: { scripts: { start: `${runtime} run entry.js` } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} shebang`,
                package: {},
                source: `#!/usr/bin/env ${runtime}\nconsole.log(1);\n`,
                detected: true,
            },
            {
                name: `${runtime} quoted script text`,
                package: { scripts: { start: `echo "${runtime} entry.js"` } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} type dependency`,
                package: { devDependencies: { [`@types/${runtime}`]: '1.0.0' } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} tool-project manifest`,
                package: {},
                source: '',
                toolProjectManifest: { engines: { [runtime]: '>=1' } },
                detected: false,
            },
        ].map((row) => ({ ...row, runtime })),
    );
    return [
        ...rows,
        {
            name: 'JavaScript without a declared runtime',
            runtime: 'node',
            package: {},
            source: 'console.log(1);\n',
            detected: false,
        },
    ];
}

test('site is detected from a site.webmanifest or sitemap.xml in any folder', () => {
    const manifests = readManifests();
    for (const path of SITE_DETECTION_PATHS) {
        const detected = detectConfigurations(
            { root: process.cwd(), files: [buildTrackedFile(path)], dependencyFiles: [] },
            manifests,
        );
        expect(detected.find(({ configuration }) => configuration === 'site')?.evidence).toBe(path);
    }
});
