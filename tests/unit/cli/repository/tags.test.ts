import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { SHEBANGS } from '#tests/config/repository.ts';
import { readRepository } from '#cli/repository/read.ts';
import { classifyFile } from '#cli/repository/classify.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';

test('tags and kinds come from the extension, the file name, and the content', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
        Dockerfile: 'FROM x\n',
        'binary.js': 'text\0binary',
        'source.js': 'export {};\n',
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(createReadCache(process.cwd())),
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
        kindSource: 'content',
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
