import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { headerFor } from '#cli/generation/headers.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/file-reads.ts';
import { rm, mkdir, unlink, writeFile } from 'node:fs/promises';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    LICENSE_FILES,
    ATTRIBUTE_FILES,
    ATTRIBUTE_KINDS,
    DECLARATION_FILES,
    GENERATED_LAUNCHERS,
    LICENSE_LIKE_SOURCES,
    CLEARED_ATTRIBUTE_KINDS,
} from '#tests/config/repository.ts';

/** Generated text formats whose public pointers sit outside the private directory. */

test('generated Gradle and Maven launchers are classified generated and never select Bash', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...GENERATED_LAUNCHERS, 'gspot.toml': settingsText([]) });
    const session = await openSession(sandbox.path);
    expect(session.repository.files.filter(({ path }) => path !== 'gspot.toml').map(({ kind }) => kind)).toStrictEqual([
        'generated',
        'generated',
        'generated',
        'generated',
    ]);
    expect(
        session.scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)),
    ).not.toContain('bash');
    expect(
        detectConfigurations(session.root, session.repository.files, session.manifests, []).map(
            ({ configuration }) => configuration,
        ),
    ).not.toContain('bash');
    await writeFile(join(sandbox.path, '.gitattributes'), 'mvnw linguist-vendored\n');
    const declared = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(declared.files.find(({ path }) => path === 'mvnw')).toMatchObject({
        kind: 'vendored',
        kindSource: '.gitattributes',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText(['bash']));
    const checked = await checkReport(sandbox.path, [
        'check',
        '--only',
        'bash/bash-syntax',
        'bash/shellcheck',
        'bash/shfmt',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toStrictEqual([]);
});

test('Git attributes win over the generated files of configurations', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['nextjs', 'cloudflare'], {
            tables: '[[scope]]\npath = "app"\nconfigurations = ["nextjs", "cloudflare"]',
        }),
        ...DECLARATION_FILES,
        '.gitattributes':
            '/next-env.d.ts linguist-vendored\n/worker-configuration.d.ts linguist-vendored\napp/next-env.d.ts -text !linguist-vendored\napp/worker-configuration.d.ts !linguist-vendored\n',
    });
    const session = await openSession(sandbox.path);
    const files = new Map(session.repository.files.map((file) => [file.path, file]));
    expect(files.get('next-env.d.ts')).toMatchObject({ kind: 'vendored', kindSource: '.gitattributes' });
    expect(files.get('worker-configuration.d.ts')).toMatchObject({ kind: 'vendored', kindSource: '.gitattributes' });
    expect(files.get('app/next-env.d.ts')).toMatchObject({ kind: 'binary', kindSource: '.gitattributes' });
    expect(files.get('app/worker-configuration.d.ts')).toMatchObject({ kind: 'generated', kindSource: 'cloudflare' });
});

test('.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the content sniff', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitattributes':
            'generated/* linguist-generated\ngenerated/declared.ts -linguist-generated linguist-vendored\nassets/** -text\n',
        'types.ts': '// This file was automatically generated\nexport type A = 1;\n',
        'generated/x.ts': '// This file was automatically generated\nexport const x = 1;\n',
        'generated/declared.ts': '// This file was automatically generated\nexport const declared = 1;\n',
        'vendor/types.ts': '// This file was automatically generated\nexport type Vendor = 1;\n',
        'vendor/lib.js': 'x',
        'assets/a.bin': 'x',
        'src/a.ts': 'export const a = 1;\n',
    });
    const declarations = [
        { paths: ['src/a.ts', 'generated/declared.ts'], configuration: 'example', kind: 'generated' as const },
    ];
    const declared = await readRepository(sandbox.path, {
        declarations: declarations,
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(declared.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
        kind: 'generated',
        kindSource: 'example',
    });
    expect(declared.files.find((file) => file.path === 'generated/declared.ts')).toMatchObject({
        kind: 'vendored',
        kindSource: '.gitattributes',
    });
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const files = new Map(repository.files.map((file) => [file.path, file]));
    expect(files.get('generated/x.ts')?.kindSource).toBe('.gitattributes');
    expect(files.get('types.ts')).toMatchObject({ kind: 'generated', kindSource: 'banner' });
    expect(files.get('vendor/types.ts')).toMatchObject({ kind: 'generated', kindSource: 'banner' });
    expect(files.get('vendor/lib.js')).toMatchObject({ kind: 'vendored', kindSource: 'directory' });
    expect(files.get('assets/a.bin')).toMatchObject({ kind: 'binary', kindSource: '.gitattributes' });
    expect(files.get('src/a.ts')).toMatchObject({ kind: 'source', kindSource: 'default' });
});
test('an @generated marker in a comment line makes a file generated, and the bare word does not', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'marked.ts': '/**\n * @generated by the schema compiler\n */\nexport const a = 1;\n',
        'marked.py': '# @generated\nA = 1\n',
        'named.ts': 'export const MARKERS = [/@generated\\b/u];\n',
    });
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({ 'marked.py': 'generated', 'marked.ts': 'generated', 'named.ts': 'source' });
});

test('a license text is vendored, and a source file named like one stays source', async () => {
    await using sandbox = await testdir();
    const licenses = LICENSE_FILES;
    const sources = LICENSE_LIKE_SOURCES;
    await createFileTree(sandbox.path, Object.fromEntries([...licenses, ...sources].map((path) => [path, 'x\n'])));
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const kinds = Object.fromEntries(repository.files.map((file) => [file.path, file.kind]));
    expect(kinds).toStrictEqual({
        ...Object.fromEntries(licenses.map((path) => [path, 'vendored'])),
        ...Object.fromEntries(sources.map((path) => [path, 'source'])),
    });
});

test('an unreadable .gitattributes is an error, not an empty rule set', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    await mkdir(join(sandbox.path, '.gitattributes'));
    await rejection(
        readRepository(sandbox.path, {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
            reads: createReadCache(sandbox.path),
        }).catch((error: unknown) => {
            expect(error).toMatchObject({ code: 'EISDIR' });
            throw error;
        }),
    );
});

test('Git attributes follow Git order and are not decoded from the working tree', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init', '-q']);
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts linguist-generated\n',
        'source.ts': 'export {};\n',
    });
    await writeFile(join(sandbox.path, '.gitattributes'), Buffer.from([0xff, 0x0a]));
    const awaitedRepository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(awaitedRepository.attributes.get('source.ts')).toMatchObject({
        'linguist-generated': 'set',
    });
    await rm(join(sandbox.path, '.git'), { recursive: true });
    expect(
        readRepository(sandbox.path, {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
            reads: createReadCache(sandbox.path),
        }),
    ).rejects.toThrow('.gitattributes is not UTF-8 text.');
});

test('every generated header format marks a file generated outside .gspot', async () => {
    await using sandbox = await testdir();
    const paths = ['tool.js', 'tool.py', 'tool.sql', 'tool.md', 'tool.html'];
    const files = Object.fromEntries(paths.map((path) => [path, `${headerFor(path)}content\n`]));
    await createFileTree(sandbox.path, files);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(repository.files.map(({ path, kind, kindSource }) => ({ path, kind, kindSource }))).toStrictEqual(
        paths
            .toSorted((left, right) => left.localeCompare(right))
            .map((path) => ({
                path,
                kind: 'generated',
                kindSource: 'banner',
            })),
    );
});

test.each(['folder', 'Git'])('%s attribute reads honor later and nested overrides', async (backend) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, ATTRIBUTE_FILES);
    if (backend === 'Git') gitOutput(sandbox.path, ['init', '--quiet']);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(ATTRIBUTE_KINDS);
    await createFileTree(sandbox.path, { '.gitattributes': '', 'nested/.gitattributes': '' });
    const corrected = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual(
        CLEARED_ATTRIBUTE_KINDS,
    );
});

test('Git info attributes override tracked declarations until removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitattributes': '*.ts linguist-generated\n',
        'source.ts': 'export const source = 1;\n',
        'control.ts': 'export const control = 2;\n',
    });
    gitOutput(sandbox.path, ['init', '--quiet']);
    await createFileTree(sandbox.path, {
        '.git/info/attributes': '*.ts -linguist-generated\ncontrol.ts linguist-vendored\n',
    });
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'source',
        'control.ts': 'vendored',
    });
    await unlink(join(sandbox.path, '.git/info/attributes'));
    const corrected = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(Object.fromEntries(corrected.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'source.ts': 'generated',
        'control.ts': 'generated',
    });
});
