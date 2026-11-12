import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { listAlwaysSelected } from '#cli/manifests/select.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { detectConditions, detectConfigurations } from '#cli/repository/detect.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/config/repository/detect.ts';
import { TRACKED_SOURCE } from '#tests/config/repository/files.ts';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const PRISMA_SCHEMA_CASES = [
    {
        name: 'Postgres provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "postgresql"
}
`,
        detected: true,
    },
    {
        name: 'SQLite provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "sqlite"
}
`,
        detected: false,
    },
    {
        name: 'a commented provider',
        path: 'prisma/schema.prisma',
        source: '// provider = "postgresql"\n',
        detected: false,
    },
    { name: 'an unrelated text file', path: 'notes.txt', source: 'provider = "postgresql"\n', detected: false },
] as const;

const MKDOCS_CASES = [
    {
        name: 'admonitions in a nested mkdocs.yml',
        path: 'docs/mkdocs.yml',
        source: 'site_name: Example\nmarkdown_extensions:\n  - admonition\n  - toc:\n      permalink: true\n',
        detected: true,
    },
    {
        name: 'content tabs with options',
        path: 'mkdocs.yaml',
        source: 'markdown_extensions:\n  - pymdownx.tabbed:\n      alternate_style: true\n',
        detected: true,
    },
    {
        name: 'no indented extension',
        path: 'mkdocs.yml',
        source: 'markdown_extensions:\n  - toc\n  # - admonition\n',
        detected: false,
    },
] as const;

const RUNTIME_DETECTION_CASES = [
    { name: 'node engine', runtime: 'node', package: { engines: { node: '>=1' } }, source: '', detected: true },
    {
        name: 'node script',
        runtime: 'node',
        package: { scripts: { start: 'node run entry.js' } },
        source: '',
        detected: true,
    },
    {
        name: 'node shebang',
        runtime: 'node',
        package: {},
        source: '#!/usr/bin/env node\nconsole.log(1);\n',
        detected: true,
    },
    {
        name: 'node quoted script text',
        runtime: 'node',
        package: { scripts: { start: 'echo "node entry.js"' } },
        source: '',
        detected: false,
    },
    {
        name: 'node type dependency',
        runtime: 'node',
        package: { devDependencies: { '@types/node': '1.0.0' } },
        source: '',
        detected: false,
    },
    {
        name: 'node tool-project manifest',
        runtime: 'node',
        package: {},
        source: '',
        toolProjectPackageJson: { engines: { node: '>=1' } },
        detected: false,
    },
    {
        name: 'JavaScript without a declared runtime',
        runtime: 'node',
        package: {},
        source: 'console.log(1);\n',
        detected: false,
    },
];

async function detectSandboxConfigurations(root: string): Promise<string[]> {
    const repository = await readTestRepository(root);
    const dependencyFiles = await readDependencyFiles(createRunCache(root), repository.files);
    return detectConfigurations({ root, files: repository.files, dependencyFiles }).map(
        ({ configuration }) => configuration.name,
    );
}

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations({
        root: process.cwd(),
        files: [{ path: 'a.sh', ...TRACKED_SOURCE }],
        dependencyFiles: [],
    });
    const names = new Set(plans.map(({ configuration }) => configuration.name));
    const evidence = plans.map(({ configuration, ...found }) => ({ ...found, name: configuration.name }));
    expect(evidence).toContainEqual({ name: 'bash', evidence: '1 .sh file', count: 1 });
    expect(evidence).toContainEqual({ name: 'gspot', evidence: 'every repository' });
    expect(listAlwaysSelected().filter((name) => !names.has(name))).toStrictEqual([]);
});

test('TypeScript declarations in .d.ts need a tsconfig.json to propose typescript', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
        'source.js': 'export const value = 1;\n',
        'types/library.d.ts': 'export declare const value: number;\n',
    });

    const before = await openSession(sandbox.path);
    expect(detectConfigurations(before.repository).map(({ configuration }) => configuration.name)).not.toContain(
        'typescript',
    );
    await writeFile(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
    const configured = await openSession(sandbox.path);
    expect(
        detectConfigurations(configured.repository).find(({ configuration }) => configuration.name === 'typescript')
            ?.evidence,
    ).toBe('tsconfig.json');
});

test('a FastAPI dependency proposes fastapi and python in its own scope until it is removed', async () => {
    const { path, source } = PYTHON_DEPENDENCY_CASES[0];
    await using sandbox = await createGitSandbox({
        [`api/${path}`]: source,
        'other/readme.txt': 'No Python dependencies.\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    const proposed = detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles }, 'api');
    expect(proposed.find((detection) => detection.configuration.name === 'fastapi')?.evidence).toBe(
        `fastapi in api/${path}`,
    );
    expect(proposed.find((detection) => detection.configuration.name === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles }, 'other').filter(
            (detection) => detection.configuration.name === 'fastapi',
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: corrected }, 'api').filter(
            (detection) => detection.configuration.name === 'fastapi',
        ),
    ).toStrictEqual([]);
});

test.each(
    PRISMA_SCHEMA_CASES.flatMap((row) => (row.detected ? ['', 'apps/api'] : ['']).map((scope) => ({ ...row, scope }))),
)(
    'a Prisma schema with $name selects postgres in "$scope", and a sibling scope keeps its own detection',
    async ({ path, source, detected, scope }) => {
        await using sandbox = await createGitSandbox({});
        const owned = scope === '' ? path : `${scope}/${path}`;
        await createFileTree(sandbox.path, {
            [owned]: source,
            'other/prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n}\n',
        });
        const repository = await readTestRepository(sandbox.path);
        expect(
            detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, scope)
                .filter((detection) => detection.configuration.name === 'postgres')
                .map((detection) => detection.evidence),
        ).toStrictEqual(detected ? [owned] : []);
        expect(
            detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, 'other')
                .filter((detection) => detection.configuration.name === 'postgres')
                .map((detection) => detection.evidence),
        ).toStrictEqual(['other/prisma/schema.prisma']);
    },
);

test.each([...MKDOCS_CASES])('mkdocs is detected from $name: $detected', async ({ path, source, detected }) => {
    await using sandbox = await createGitSandbox({ [path]: source });
    const repository = await readTestRepository(sandbox.path);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] })
            .filter((detection) => detection.configuration.name === 'mkdocs')
            .map((detection) => detection.evidence),
    ).toStrictEqual(detected ? [path] : []);
});

test('Testing Library is detected only in the scope that declares it', async () => {
    const dependency = '@testing-library/react';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
        'child/package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '1.0.0' } }),
        'neighbor/package.json': '{"private":true,"dependencies":{"testing-library-like":"1.0.0"}}\n',
    });

    const session = await openSession(sandbox.path);
    const projects = await readDependencyFiles(createRunCache(sandbox.path), session.repository.files);
    expect(
        ['child', 'neighbor'].map((scope) =>
            detectConfigurations(
                { root: sandbox.path, files: session.repository.files, dependencyFiles: projects },
                scope,
            ).find((row) => row.configuration.name === 'testing-library'),
        ),
    ).toMatchObject([{ evidence: `${dependency} in child/package.json` }, undefined]);
});

test.each(RUNTIME_DETECTION_CASES)('$name decides runtime detection', async (row) => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify(row.package),
        'entry.js': row.source,
        [GSPOT_PATHS.npmProject]: JSON.stringify('toolProjectPackageJson' in row ? row.toolProjectPackageJson : {}),
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    const { detect } = buildConfiguration('runtime', { tables: `[detect]\nruntimes = ["${row.runtime}"]\n` });
    expect(detectConditions([detect], repository.files, dependencyFiles).has(detect)).toBe(row.detected);
});

test('a package.json with no dependency selects no JavaScript in a shell repository', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"scripts","bin":{"run":"run.sh"}}',
        'run.sh': '#!/bin/sh\nexit 0\n',
    });
    expect(await detectSandboxConfigurations(sandbox.path)).not.toContain('javascript');
});

test('a package.json with a dependency that vitest detects selects it and javascript', async () => {
    const devDependencies = { typescript: '0.0.0-test', vitest: '0.0.0-test' };
    await using sandbox = await createGitSandbox({ 'package.json': JSON.stringify({ devDependencies }) });
    const proposed = await detectSandboxConfigurations(sandbox.path);
    expect(proposed).toContain('vitest');
    expect(proposed).toContain('javascript');
});

test('a package.json with only gspot, its tools, and a hook manager selects no javascript', async () => {
    const names = ['@gspothq/cli', 'prettier', 'eslint', 'typescript', 'husky'];
    const devDependencies = Object.fromEntries(names.map((name) => [name, '0.0.0-test']));
    await using sandbox = await createGitSandbox({ 'package.json': JSON.stringify({ devDependencies }) });
    expect(await detectSandboxConfigurations(sandbox.path)).not.toContain('javascript');
});

test('site is detected from a sitemap.xml in any folder', async () => {
    await using sandbox = await createGitSandbox({ 'docs/public/sitemap.xml': '<urlset/>' });
    expect(await detectSandboxConfigurations(sandbox.path)).toContain('site');
});

test('site detection excludes a server framework even when a sitemap is present', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"dependencies":{"next":"15.5.4"}}',
        'public/sitemap.xml': '<urlset/>',
    });
    expect(await detectSandboxConfigurations(sandbox.path)).not.toContain('site');
});
