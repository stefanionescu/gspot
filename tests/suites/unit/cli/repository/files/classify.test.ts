import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { detectConfigurations } from '#cli/repository/detection/configurations.ts';
import { classifyFile, hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { listRepositoryFiles, readRepository } from '#cli/repository/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { compareText } from '#cli/system/text/order.ts';
import { GENERATED_HEADERS, GENERATED_PATH_CASES, NOT_GENERATED, SHEBANGS } from '#tests/config/repository.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a license text is vendored, and a source file named like one stays source', async () => {
    await using sandbox = await createGitSandbox({
        'LICENSE-MIT': 'x\n',
        'COPYING.txt': 'x\n',
        NOTICE: 'x\n',
        'license-lockfiles.test.ts': 'x\n',
        'licenses.json': 'x\n',
        'notice.py': 'x\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({
        'LICENSE-MIT': 'vendored',
        'COPYING.txt': 'vendored',
        NOTICE: 'vendored',
        'license-lockfiles.test.ts': 'source',
        'licenses.json': 'source',
        'notice.py': 'source',
    });
});

test('tags and kinds come from the extension, the file name, and the content', async () => {
    await using sandbox = await createGitSandbox({
        'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
        Dockerfile: 'FROM x\n',
        'binary.js': 'text\0binary',
        'source.js': 'export {};\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const files = new Map(repository.files.map((file) => [file.path, file]));
    expect(
        ['a.png', 'binary.js', 'Dockerfile', 'source.js'].map((path) => ({
            path,
            kind: files.get(path)!.kind,
            tags: files.get(path)!.tags,
        })),
    ).toStrictEqual([
        { path: 'a.png', kind: 'binary', tags: ['binary'] },
        { path: 'binary.js', kind: 'binary', tags: ['binary', 'javascript', 'text'] },
        { path: 'Dockerfile', kind: 'source', tags: ['dockerfile', 'text'] },
        { path: 'source.js', kind: 'source', tags: ['javascript', 'text'] },
    ]);
});

test.each([...SHEBANGS])('a $name shebang gives only its language and runtime tags', ({ source, tags }) => {
    const prefix = Buffer.from(source);
    const result = classifyFile(
        '.',
        { path: 'script', size: prefix.length, executable: false, isSymlink: false, prefix },
        { attributes: new Map(), generatedPaths: [] },
    );
    expect(result.kind).toBe('source');
    expect(new Set(result.tags)).toStrictEqual(new Set(tags));
});

test('binary content gets no shebang language or runtime tags', () => {
    const prefix = Buffer.from('#!/usr/bin/env bun\n\0');
    expect(
        classifyFile(
            '.',
            { path: 'script', size: prefix.length, executable: true, isSymlink: false, prefix },
            {
                attributes: new Map(),
                generatedPaths: [],
            },
        ),
    ).toStrictEqual({
        path: 'script',
        kind: 'binary',
        kindOrigin: 'content',
        tags: ['binary', 'executable'],
        executable: true,
        size: prefix.length,
    });
});

test('a Swift file that imports XCTest gets the swift-test tag', async () => {
    await using sandbox = await createGitSandbox({ 'Examples/Checks.swift': 'import XCTest\n' });
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files[0]!.tags).toContain('swift-test');
});

test('.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the file content', async () => {
    await using sandbox = await createGitSandbox({
        '.gitattributes':
            'generated/* linguist-generated\ngenerated/declared.ts -linguist-generated linguist-vendored\nassets/** binary\n',
        'types.ts': '// This file was automatically generated\nexport type A = 1;\n',
        'generated/x.ts': '// This file was automatically generated\nexport const x = 1;\n',
        'generated/declared.ts': '// This file was automatically generated\nexport const declared = 1;\n',
        'vendor/types.ts': '// This file was automatically generated\nexport type Vendor = 1;\n',
        'vendor/lib.js': 'x',
        'assets/a.bin': 'x',
        'src/a.ts': 'export const a = 1;\n',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const declarations = [
        {
            scopePath: '',
            isMatch: buildPathMatcher(['src/a.ts', 'generated/declared.ts']),
            configuration: 'example',
            kind: 'generated' as const,
        },
    ];
    const cache = createRunCache(sandbox.path);
    const configuredRepository = await readRepository(cache, await listRepositoryFiles(cache), {
        generatedPaths: declarations,
        scopes: [],
    });
    expect(configuredRepository.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
        kind: 'generated',
        kindOrigin: 'example',
    });
    expect(configuredRepository.files.find((file) => file.path === 'generated/declared.ts')).toMatchObject({
        kind: 'vendored',
        kindOrigin: '.gitattributes',
    });
    const repository = await readTestRepository(sandbox.path);
    const files = new Map(repository.files.map((file) => [file.path, file]));
    expect(files.get('generated/x.ts')?.kindOrigin).toBe('.gitattributes');
    expect(files.get('types.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'banner' });
    expect(files.get('vendor/types.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'banner' });
    expect(files.get('vendor/lib.js')).toMatchObject({ kind: 'vendored', kindOrigin: 'folder' });
    expect(files.get('assets/a.bin')).toMatchObject({ kind: 'binary', kindOrigin: '.gitattributes' });
    expect(files.get('src/a.ts')).toMatchObject({ kind: 'source', kindOrigin: 'default' });
});

test('a -text line keeps text files as source', async () => {
    await using sandbox = await createGitSandbox({ '.gitattributes': '* -text\n', 'src/index.ts': 'export {};\n' });
    runGitStep(sandbox.path, ['add', '.']);
    const repository = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'src/index.ts': 'source',
    });
});

test('a text attribute keeps a file with NUL bytes a source file', async () => {
    await using sandbox = await createGitSandbox({ '.gitattributes': 'data.txt text\n', 'data.txt': 'text\0bytes' });
    const repository = await readTestRepository(sandbox.path);
    const data = repository.files.find(({ path }) => path === 'data.txt');
    expect(data?.kind).toBe('source');
    expect(data?.tags).toContain('binary');
});

test('.git/info/attributes marks a file generated while the working .gitattributes holds invalid UTF-8', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts linguist-generated\n',
        'source.ts': 'export {};\n',
    });
    await writeFile(join(sandbox.path, '.gitattributes'), Buffer.from([0xff, 0x0a]));
    const repository = await readTestRepository(sandbox.path);
    expect(repository.attributes.get('source.ts')).toMatchObject({
        'linguist-generated': 'set',
    });
});

test.each([...GENERATED_HEADERS])('the generated header is found in each comment form: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(true);
});

test.each([...NOT_GENERATED])('your own comment is not a generated header: %j', (text) => {
    expect(hasGeneratedHeader(text)).toBe(false);
});

test('generated Gradle and Maven launchers are classified generated and never select Bash', async () => {
    await using sandbox = await createGitSandbox({
        gradlew: '#!/bin/sh\nbroken (\n',
        'android/gradlew.bat': '@echo off\r\n',
        mvnw: '#!/bin/sh\nbroken (\n',
        'server/mvnw.cmd': '@echo off\r\n',
        'gspot.toml': buildSandboxSettings([]),
    });
    runGitStep(sandbox.path, ['add', '.']);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.filter(({ path }) => path !== 'gspot.toml').map(({ kind }) => kind)).toStrictEqual([
        'generated',
        'generated',
        'generated',
        'generated',
    ]);
    expect(
        detectConfigurations({ root: session.root, files: session.repository.files, dependencyFiles: [] }).map(
            ({ configuration }) => configuration.name,
        ),
    ).not.toContain('bash');
});

test('an @generated marker in a comment line makes a file generated, and the bare word does not', async () => {
    await using sandbox = await createGitSandbox({
        'marked.ts': '/**\n * @generated by the schema compiler\n */\nexport const a = 1;\n',
        'marked.py': '# @generated\nA = 1\n',
        'named.ts': 'export const MARKERS = [/@generated\\b/u];\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({ 'marked.py': 'generated', 'marked.ts': 'generated', 'named.ts': 'source' });
});

test.each([...GENERATED_PATH_CASES])(
    'the configurations each scope selects mark their generated files: $configurations $tables',
    async ({ configurations, tables, generated }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(configurations, { tables }),
            'next-env.d.ts': '/// <reference types="next" />\n',
            'worker-configuration.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
            'handwritten.d.ts': '/// <reference types="next" />\n',
            'app/next-env.d.ts': '/// <reference types="next" />\n',
            'app/worker-configuration.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
            'app/handwritten.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
        });
        const session = await openSession(sandbox.path);
        const classified = session.repository.files.filter(({ path }) => path.endsWith('.d.ts'));
        expect(
            classified
                .filter(({ kind }) => kind === 'generated')
                .map(({ path }) => path)
                .toSorted(compareText),
        ).toStrictEqual(generated.toSorted(compareText));
        expect(
            classified.filter(({ path }) => path.endsWith('handwritten.d.ts')).map(({ kind }) => kind),
        ).toStrictEqual(['source', 'source']);
    },
);
