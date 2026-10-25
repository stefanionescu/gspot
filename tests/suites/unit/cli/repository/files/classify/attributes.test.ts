import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';

import {
    ATTRIBUTE_KINDS,
    ATTRIBUTE_FILES,
    CLASSIFICATION_FILES,
    TYPE_DECLARATION_FILES,
    CLEARED_ATTRIBUTE_KINDS,
} from '#tests/config/repository/files/classify.ts';

test('Git attributes win over the generated files of configurations', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nextjs', 'cloudflare'], {
            scopes: [{ path: 'app', configurations: ['nextjs', 'cloudflare'] }],
        }),
        ...TYPE_DECLARATION_FILES,
        '.gitattributes':
            '/next-env.d.ts linguist-vendored\n/worker-configuration.d.ts linguist-vendored\napp/next-env.d.ts -text !linguist-vendored\napp/worker-configuration.d.ts !linguist-vendored\n',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const session = await openSession(sandbox.path);
    const files = new Map(session.repository.files.map((file) => [file.path, file]));
    expect(files.get('next-env.d.ts')).toMatchObject({ kind: 'vendored', kindOrigin: '.gitattributes' });
    expect(files.get('worker-configuration.d.ts')).toMatchObject({ kind: 'vendored', kindOrigin: '.gitattributes' });
    expect(files.get('app/next-env.d.ts')).toMatchObject({ kind: 'binary', kindOrigin: '.gitattributes' });
    expect(files.get('app/worker-configuration.d.ts')).toMatchObject({ kind: 'generated', kindOrigin: 'cloudflare' });
});

test('.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the file content', async () => {
    await using sandbox = await createGitSandbox(CLASSIFICATION_FILES);
    runGitStep(sandbox.path, ['add', '.']);
    const declarations = [
        { paths: ['src/a.ts', 'generated/declared.ts'], configuration: 'example', kind: 'generated' as const },
    ];
    const configuredRepository = await readRepository(createReadCache(sandbox.path), {
        generatedPaths: declarations,
        scopes: [],
        configurations: readConfigurations(),
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
    expect(files.get('vendor/lib.js')).toMatchObject({ kind: 'vendored', kindOrigin: 'directory' });
    expect(files.get('assets/a.bin')).toMatchObject({ kind: 'binary', kindOrigin: '.gitattributes' });
    expect(files.get('src/a.ts')).toMatchObject({ kind: 'source', kindOrigin: 'default' });
});

test('a folder without Git does not read Git attributes', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    await mkdir(join(sandbox.path, '.gitattributes'));
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path, kind }) => ({ path, kind }))).toStrictEqual([
        { path: 'source.ts', kind: 'source' },
    ]);
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

test('Git attribute reads honor later and nested overrides', async () => {
    await using sandbox = await createGitSandbox(ATTRIBUTE_FILES);

    runGitStep(sandbox.path, ['add', '.']);
    const repository = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(ATTRIBUTE_KINDS);
    await createFileTree(sandbox.path, { '.gitattributes': '', 'nested/.gitattributes': '' });
    const corrected = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(
        CLEARED_ATTRIBUTE_KINDS,
    );
});

test('Git info attributes override the tracked .gitattributes until removed', async () => {
    await using sandbox = await createGitSandbox({
        '.gitattributes': '*.ts linguist-generated\n',
        'source.ts': 'export const source = 1;\n',
        'control.ts': 'export const control = 2;\n',
    });
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts -linguist-generated\ncontrol.ts linguist-vendored\n',
    });
    const repository = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'source',
        'control.ts': 'vendored',
    });
    await unlink(join(sandbox.path, '.git/info/attributes'));
    const corrected = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'generated',
        'control.ts': 'generated',
    });
});
