import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { readRepository } from '#cli/repository/read.ts';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { LICENSE_LIKE_SOURCES } from '#tests/data/checks/repository.ts';
import { GENERATED_HEADER_TEXT } from '#cli/config/generation/header.ts';
import { classifyFile, hasGeneratedHeader } from '#cli/repository/classify.ts';

import {
    SHEBANGS,
    LICENSE_FILES,
    NOT_GENERATED,
    ATTRIBUTE_FILES,
    ATTRIBUTE_KINDS,
    DECLARATION_FILES,
    GENERATED_HEADERS,
    GENERATED_LAUNCHERS,
    CLASSIFICATION_FILES,
    CLEARED_ATTRIBUTE_KINDS,
} from '#tests/data/repository/file-classification.ts';

describe('generated-header', () => {
    test.each([...GENERATED_HEADERS])('the generated header is found in each comment form: %j', (text) => {
        expect(hasGeneratedHeader(text.replaceAll('{generated-header}', GENERATED_HEADER_TEXT))).toBe(true);
    });
    test.each([...NOT_GENERATED])('your own comment is not a generated header: %j', (text) => {
        expect(hasGeneratedHeader(text)).toBe(false);
    });
});

test('generated Gradle and Maven launchers are classified generated and never select Bash', async () => {
    await using sandbox = await testdir({ ...GENERATED_LAUNCHERS, 'gspot.toml': buildSandboxSettings([]) });

    readGitOutput(sandbox.path, ['init', '--quiet']);
    readGitOutput(sandbox.path, ['add', '.']);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.filter(({ path }) => path !== 'gspot.toml').map(({ kind }) => kind)).toStrictEqual([
        'generated',
        'generated',
        'generated',
        'generated',
    ]);
    expect(
        detectConfigurations(
            { root: session.root, files: session.repository.files, dependencyFiles: [] },
            session.manifests,
        ).map(({ configuration }) => configuration),
    ).not.toContain('bash');
    await writeFile(join(sandbox.path, '.gitattributes'), 'mvnw linguist-vendored\n');
    const declared = await readClassificationRepository(sandbox.path);
    expect(declared.files.find(({ path }) => path === 'mvnw')).toMatchObject({
        kind: 'vendored',
        kindOrigin: '.gitattributes',
    });
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash']));
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'bash/shellcheck,bash/shfmt', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'skipped', fileCount: 0, findings: [] },
        { check: 'bash/shfmt', status: 'skipped', fileCount: 0, findings: [] },
    ]);
});

test('Git attributes win over the generated files of configurations', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nextjs', 'cloudflare'], {
            scopes: [{ path: 'app', configurations: ['nextjs', 'cloudflare'] }],
        }),
        ...DECLARATION_FILES,
        '.gitattributes':
            '/next-env.d.ts linguist-vendored\n/worker-configuration.d.ts linguist-vendored\napp/next-env.d.ts -text !linguist-vendored\napp/worker-configuration.d.ts !linguist-vendored\n',
    });
    readGitOutput(sandbox.path, ['init', '--quiet']);
    readGitOutput(sandbox.path, ['add', '.']);
    const session = await openSession(sandbox.path);
    const files = new Map(session.repository.files.map((file) => [file.path, file]));
    expect(files.get('next-env.d.ts')).toMatchObject({ kind: 'vendored', kindOrigin: '.gitattributes' });
    expect(files.get('worker-configuration.d.ts')).toMatchObject({ kind: 'vendored', kindOrigin: '.gitattributes' });
    expect(files.get('app/next-env.d.ts')).toMatchObject({ kind: 'binary', kindOrigin: '.gitattributes' });
    expect(files.get('app/worker-configuration.d.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'cloudflare' });
});

test('.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the content sniff', async () => {
    await using sandbox = await testdir(CLASSIFICATION_FILES);

    readGitOutput(sandbox.path, ['init', '--quiet']);
    readGitOutput(sandbox.path, ['add', '.']);
    const declarations = [
        { paths: ['src/a.ts', 'generated/declared.ts'], configuration: 'example', kind: 'generated' as const },
    ];
    const declared = await readRepository(createReadCache(sandbox.path), {
        declarations: declarations,
        scopes: [],
        manifests: readManifests(),
    });
    expect(declared.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
        kind: 'generated',
        kindOrigin: 'example',
    });
    expect(declared.files.find((file) => file.path === 'generated/declared.ts')).toMatchObject({
        kind: 'vendored',
        kindOrigin: '.gitattributes',
    });
    const repository = await readClassificationRepository(sandbox.path);
    const files = new Map(repository.files.map((file) => [file.path, file]));
    expect(files.get('generated/x.ts')?.kindOrigin).toBe('.gitattributes');
    expect(files.get('types.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'banner' });
    expect(files.get('vendor/types.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'banner' });
    expect(files.get('vendor/lib.js')).toMatchObject({ kind: 'vendored', kindOrigin: 'directory' });
    expect(files.get('assets/a.bin')).toMatchObject({ kind: 'binary', kindOrigin: '.gitattributes' });
    expect(files.get('src/a.ts')).toMatchObject({ kind: 'source', kindOrigin: 'default' });
});

test('an @generated marker in a comment line makes a file generated, and the bare word does not', async () => {
    await using sandbox = await testdir({
        'marked.ts': '/**\n * @generated by the schema compiler\n */\nexport const a = 1;\n',
        'marked.py': '# @generated\nA = 1\n',
        'named.ts': 'export const MARKERS = [/@generated\\b/u];\n',
    });

    const repository = await readClassificationRepository(sandbox.path);
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({ 'marked.py': 'generated', 'marked.ts': 'generated', 'named.ts': 'source' });
});

test('a license text is vendored, and a source file named like one stays source', async () => {
    await using sandbox = await testdir(
        Object.fromEntries([...LICENSE_FILES, ...LICENSE_LIKE_SOURCES].map((path) => [path, 'x\n'])),
    );

    const repository = await readClassificationRepository(sandbox.path);
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({
        ...Object.fromEntries(LICENSE_FILES.map((path) => [path, 'vendored'])),
        ...Object.fromEntries(LICENSE_LIKE_SOURCES.map((path) => [path, 'source'])),
    });
});

test('a folder without Git does not read Git attributes', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    await mkdir(join(sandbox.path, '.gitattributes'));
    const repository = await readClassificationRepository(sandbox.path);
    expect(repository.files.map(({ path, kind }) => ({ path, kind }))).toStrictEqual([
        { path: 'source.ts', kind: 'source' },
    ]);
});

test('Git attributes follow Git order and are not decoded from the working tree', async () => {
    await using sandbox = await testdir();
    readGitOutput(sandbox.path, ['init', '-q']);
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts linguist-generated\n',
        'source.ts': 'export {};\n',
    });
    await writeFile(join(sandbox.path, '.gitattributes'), Buffer.from([0xff, 0x0a]));
    const repository = await readClassificationRepository(sandbox.path);
    expect(repository.attributes.get('source.ts')).toMatchObject({
        'linguist-generated': 'set',
    });
});

test('every generated header format marks a file generated outside .gspot', async () => {
    await using sandbox = await testdir();
    const paths = ['tool.js', 'tool.py', 'tool.sql', 'tool.md', 'tool.html'];
    const files = Object.fromEntries(paths.map((path) => [path, `${formatHeader(path)}content\n`]));
    await createFileTree(sandbox.path, files);
    const repository = await readClassificationRepository(sandbox.path);
    expect(repository.files.map(({ path, kind, kindOrigin }) => ({ path, kind, kindOrigin }))).toStrictEqual(
        paths
            .toSorted((left, right) => left.localeCompare(right))
            .map((path) => ({
                path,
                kind: 'generated',
                kindOrigin: 'banner',
            })),
    );
});

test('Git attribute reads honor later and nested overrides', async () => {
    await using sandbox = await testdir(ATTRIBUTE_FILES);

    readGitOutput(sandbox.path, ['init', '--quiet']);
    readGitOutput(sandbox.path, ['add', '.']);
    const repository = await readClassificationRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(ATTRIBUTE_KINDS);
    await createFileTree(sandbox.path, { '.gitattributes': '', 'nested/.gitattributes': '' });
    const corrected = await readClassificationRepository(sandbox.path);
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(
        CLEARED_ATTRIBUTE_KINDS,
    );
});

test('Git info attributes override tracked declarations until removed', async () => {
    await using sandbox = await testdir({
        '.gitattributes': '*.ts linguist-generated\n',
        'source.ts': 'export const source = 1;\n',
        'control.ts': 'export const control = 2;\n',
    });

    readGitOutput(sandbox.path, ['init', '--quiet']);
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts -linguist-generated\ncontrol.ts linguist-vendored\n',
    });
    const repository = await readClassificationRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'source',
        'control.ts': 'vendored',
    });
    await unlink(join(sandbox.path, '.git/info/attributes'));
    const corrected = await readClassificationRepository(sandbox.path);
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'generated',
        'control.ts': 'generated',
    });
});

describe('tags', () => {
    test('tags and kinds come from the extension, the file name, and the content', async () => {
        await using sandbox = await testdir({
            'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
            Dockerfile: 'FROM x\n',
            'binary.js': 'text\0binary',
            'source.js': 'export {};\n',
        });

        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopes: [],
            manifests: readManifests(),
        });
        const files = new Map(repository.files.map((file) => [file.path, file]));
        expect(files.get('a.png')!.kind).toBe('binary');
        expect(files.get('binary.js')!.kind).toBe('binary');
        expect(files.get('Dockerfile')!.tags).toContain('dockerfile');
        expect(files.get('source.js')!.tags).toContain('javascript');
    });

    test.each([...SHEBANGS])('a $name shebang gives only its language and runtime tags', ({ source, tags }) => {
        const prefix = Buffer.from(source);
        const result = classifyFile(
            '.',
            { path: 'script', size: prefix.length, executable: false, symlink: false },
            prefix,
            { attributes: new Map(), declarations: [] },
        );
        expect(result.kind).toBe('source');
        expect(new Set(result.tags)).toStrictEqual(new Set(tags));
    });

    test('binary content gets no shebang language or runtime tags', () => {
        const prefix = Buffer.from('#!/usr/bin/env bun\n\0');
        expect(
            classifyFile('.', { path: 'script', size: prefix.length, executable: true, symlink: false }, prefix, {
                attributes: new Map(),
                declarations: [],
            }),
        ).toStrictEqual({
            path: 'script',
            kind: 'binary',
            kindOrigin: 'content',
            tags: ['binary', 'executable'],
            executable: true,
            size: prefix.length,
        });
    });

    test('sh overrides the Bash extension tag of a .sh script', () => {
        const prefix = Buffer.from('#!/bin/sh\nprintf "%s\\n" example\n');
        const result = classifyFile(
            '.',
            { path: 'script.sh', size: prefix.length, executable: false, symlink: false },
            prefix,
            { attributes: new Map(), declarations: [] },
        );
        expect(result.tags).toContain('sh');
        expect(result.tags).not.toContain('bash');
    });
});

/** Read classifications without extra declared files or scopes, using the shipped manifests. */
async function readClassificationRepository(root: string): Promise<Repository> {
    return await readRepository(createReadCache(root), {
        declarations: [],
        scopes: [],
        manifests: readManifests(),
    });
}
