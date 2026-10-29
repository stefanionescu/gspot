import { test, expect } from 'bun:test';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    SHEBANGS,
    LICENSE_FILES,
    SWIFT_TAG_CASES,
    LICENSE_LIKE_SOURCES,
} from '#tests/config/repository/files/classify.ts';

test('a license text is vendored, and a source file named like one stays source', async () => {
    await using sandbox = await createGitSandbox(
        Object.fromEntries([...LICENSE_FILES, ...LICENSE_LIKE_SOURCES].map((path) => [path, 'x\n'])),
    );

    const repository = await readTestRepository(sandbox.path);
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({
        ...Object.fromEntries(LICENSE_FILES.map((path) => [path, 'vendored'])),
        ...Object.fromEntries(LICENSE_LIKE_SOURCES.map((path) => [path, 'source'])),
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
        { path: 'script', size: prefix.length, executable: false, isSymlink: false },
        prefix,
        { attributes: new Map(), generatedPaths: [] },
    );
    expect(result.kind).toBe('source');
    expect(new Set(result.tags)).toStrictEqual(new Set(tags));
});

test('binary content gets no shebang language or runtime tags', () => {
    const prefix = Buffer.from('#!/usr/bin/env bun\n\0');
    expect(
        classifyFile('.', { path: 'script', size: prefix.length, executable: true, isSymlink: false }, prefix, {
            attributes: new Map(),
            generatedPaths: [],
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
        { path: 'script.sh', size: prefix.length, executable: false, isSymlink: false },
        prefix,
        { attributes: new Map(), generatedPaths: [] },
    );
    expect(result.tags).toStrictEqual(['shell', 'text', 'executable', 'shebang:shell', 'sh']);
});

test.each([...SWIFT_TAG_CASES])(
    'a Swift $name gives the $tag tag only outside comments and strings',
    async ({ path, source, tag, tagged }) => {
        await using sandbox = await createGitSandbox({ [path]: source });
        const repository = await readTestRepository(sandbox.path);
        expect(repository.files[0]!.tags.includes(tag)).toBe(tagged);
    },
);
