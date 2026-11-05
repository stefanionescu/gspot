import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { SOURCE_KIND } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { detectConditions, detectConfigurations } from '#cli/repository/detect.ts';
import { createRunCache } from '#cli/system/cache.ts';
import {
    MKDOCS_CASES,
    PRISMA_SCHEMA_CASES,
    PYTHON_DEPENDENCY_CASES,
    RUNTIME_DETECTION_CASES,
} from '#tests/config/repository/detect.ts';
import { buildConfiguration, listAlwaysSelected } from '#tests/setup/cli/manifests.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function detectSandboxConfigurations(root: string): Promise<string[]> {
    const repository = await readTestRepository(root);
    const dependencyFiles = await readDependencyFiles(createRunCache(root), repository.files);
    return detectConfigurations({ root, files: repository.files, dependencyFiles }).map(
        ({ configuration }) => configuration,
    );
}

test('detection proposes a language from an extension and the always-selected configurations', () => {
    const plans = detectConfigurations({
        root: process.cwd(),
        files: [
            {
                path: 'a.sh',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
        ],
        dependencyFiles: [],
    });
    const names = new Set(plans.map(({ configuration }) => configuration));
    expect(plans).toContainEqual({ configuration: 'bash', group: 'language', evidence: '1 .sh file', count: 1 });
    expect(plans).toContainEqual({ configuration: 'gspot', group: 'general', evidence: 'every repository' });
    expect(listAlwaysSelected().filter((name) => !names.has(name))).toStrictEqual([]);
});

test.each(['.d.ts'])('TypeScript declarations in %s need a tsconfig.json to propose typescript', async (extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
        'source.js': 'export const value = 1;\n',
        [`types/library${extension}`]: 'export declare const value: number;\n',
    });

    const before = await openSession(sandbox.path);
    expect(detectConfigurations(before.repository).map(({ configuration }) => configuration)).not.toContain(
        'typescript',
    );
    await writeFile(join(sandbox.path, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
    const configured = await openSession(sandbox.path);
    expect(
        detectConfigurations(configured.repository).find(({ configuration }) => configuration === 'typescript')
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
    expect(proposed.find((detection) => detection.configuration === 'fastapi')?.evidence).toBe(
        `fastapi in api/${path}`,
    );
    expect(proposed.find((detection) => detection.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles }, 'other').filter(
            (detection) => detection.configuration === 'fastapi',
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: corrected }, 'api').filter(
            (detection) => detection.configuration === 'fastapi',
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
            detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, scope).filter(
                (detection) => detection.configuration === 'postgres',
            ),
        ).toStrictEqual(detected ? [{ configuration: 'postgres', group: 'database', evidence: owned }] : []);
        expect(
            detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }, 'other').find(
                (detection) => detection.configuration === 'postgres',
            ),
        ).toStrictEqual({ configuration: 'postgres', group: 'database', evidence: 'other/prisma/schema.prisma' });
    },
);

test.each([...MKDOCS_CASES])('mkdocs is detected from $name: $detected', async ({ path, source, detected }) => {
    await using sandbox = await createGitSandbox({ [path]: source });
    const repository = await readTestRepository(sandbox.path);
    expect(
        detectConfigurations({ root: sandbox.path, files: repository.files, dependencyFiles: [] }).filter(
            (detection) => detection.configuration === 'mkdocs',
        ),
    ).toStrictEqual(detected ? [{ configuration: 'mkdocs', group: 'framework', evidence: path }] : []);
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
            ).find((row) => row.configuration === 'testing-library'),
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

test('a favicon manifest alone does not select the static site checks', () => {
    expect(
        detectConfigurations({
            root: process.cwd(),
            files: [
                {
                    path: 'public/site.webmanifest',
                    kind: 'source' as const,
                    kindOrigin: SOURCE_KIND.origin,
                    tags: ['text'],
                    executable: false,
                    size: 1,
                },
            ],
            dependencyFiles: [],
        }).map(({ configuration }) => configuration),
    ).not.toContain('site');
});
