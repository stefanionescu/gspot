import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { buildManifest, buildTrackedFile } from '#tests/setup/builders.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/data/repository/dependency-files.ts';

import {
    SWIFT_TARGET_CASES,
    SWIFT_TEST_SAMPLES,
    PRISMA_CONTENT_CASES,
    SITE_DETECTION_PATHS,
} from '#tests/data/configurations/detection.ts';

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations(
        process.cwd(),
        [buildTrackedFile('a.sh')],
        readManifests(createReadCache(process.cwd())),
        [],
    );
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.some((plan) => plan.configuration === 'spelling')).toBe(true);
});

test.each(['.d.ts', '.d.mts', '.d.cts'])(
    'TypeScript tooling with %s declarations needs a tsconfig.json to propose typescript',
    async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['javascript']),
            'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
            'source.js': 'export const value = 1;\n',
            [`types/library${extension}`]: 'export declare const value: number;\n',
        });
        const before = await openSession(sandbox.path);
        expect(
            detectConfigurations(
                sandbox.path,
                before.repository.files,
                before.manifests,
                before.repository.dependencyFiles,
            ).map(({ configuration }) => configuration),
        ).not.toContain('typescript');
        await Bun.write(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
        const configured = await openSession(sandbox.path);
        expect(
            detectConfigurations(
                sandbox.path,
                configured.repository.files,
                configured.manifests,
                configured.repository.dependencyFiles,
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
            scopes: [],
            manifests: readManifests(createReadCache(process.cwd())),
        });
        const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
        expect(
            Object.keys(dependencyFiles[0]!.dependencies).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['fastapi', 'friendly-bard']);
        const manifests = readManifests(createReadCache(process.cwd()));
        const proposed = detectConfigurations(sandbox.path, repository.files, manifests, dependencyFiles, 'api');
        expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
        expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
        expect(
            detectConfigurations(sandbox.path, repository.files, manifests, dependencyFiles, 'other').some(
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

test.each([...SWIFT_TEST_SAMPLES])('Swift test detection: $name', async ({ source, selected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Examples/Checks.swift': source });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
});

test.each([...SWIFT_TARGET_CASES])('Swift package test targets: $name', async ({ source, declared }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Package.swift': source });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
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
        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopes: [],
            manifests: readManifests(createReadCache(process.cwd())),
        });
        const manifests = readManifests(createReadCache(process.cwd()));
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
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    await unlink(join(sandbox.path, 'prisma/schema.prisma'));
    expect(
        detectConfigurations(sandbox.path, repository.files, readManifests(createReadCache(process.cwd())), []).some(
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
        'gspot.toml': buildSettingsText(['javascript']),
        'prisma/schema.prisma': 'provider = "postgresql"\n',
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    const manifests = readManifests(createReadCache(process.cwd()));
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
        'gspot.toml': buildSettingsText(['javascript']),
        'package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
        'child/package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '1.0.0' } }),
        'neighbor/package.json': '{"private":true,"dependencies":{"testing-library-like":"1.0.0"}}\n',
    });
    const session = await openSession(sandbox.path);
    const projects = await readDependencyFiles(createReadCache(sandbox.path), session.repository.files);
    const detectTestingLibrary = (scope: string) =>
        detectConfigurations(sandbox.path, session.repository.files, session.manifests, projects, scope).find(
            (row) => row.configuration === 'testing-library',
        );
    expect(detectTestingLibrary('child')).toMatchObject({ evidence: `${dependency} in child/package.json` });
    expect(detectTestingLibrary('neighbor')).toBeUndefined();
    expect(
        session.scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)),
    ).not.toContain('testing-library');
});

test.each(runtimeDetectionRows())('$name decides runtime detection within its project', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
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
        dependencyFiles,
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
    const manifests = readManifests(createReadCache(process.cwd()));
    for (const path of SITE_DETECTION_PATHS) {
        const detected = detectConfigurations(process.cwd(), [buildTrackedFile(path)], manifests, []);
        expect(detected.find(({ configuration }) => configuration === 'site')?.evidence).toBe(path);
    }
});
