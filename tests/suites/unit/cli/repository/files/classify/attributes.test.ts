import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { listRepositoryFiles, readRepository } from '#cli/repository/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { CLASSIFICATION_FILES, LINGUIST_GENERATED_LINE } from '#tests/config/repository/files.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the file content', async () => {
    await using sandbox = await createGitSandbox(CLASSIFICATION_FILES);
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

test('a -text line keeps text files as source, and the content of a file marks it binary', async () => {
    await using sandbox = await createGitSandbox({ '.gitattributes': '* -text\n', 'src/index.ts': 'export {};\n' });
    await writeFile(join(sandbox.path, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
    runGitStep(sandbox.path, ['add', '.']);
    const repository = await readTestRepository(sandbox.path);
    expect(Object.fromEntries(repository.files.map(({ path, kind }) => [path, kind]))).toStrictEqual({
        '.gitattributes': 'source',
        'image.png': 'binary',
        'src/index.ts': 'source',
    });
});

test('.git/info/attributes marks a file generated while the working .gitattributes holds invalid UTF-8', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, {
        '.git/info/attributes': LINGUIST_GENERATED_LINE,
        'source.ts': 'export {};\n',
    });
    await writeFile(join(sandbox.path, '.gitattributes'), Buffer.from([0xff, 0x0a]));
    const repository = await readTestRepository(sandbox.path);
    expect(repository.attributes.get('source.ts')).toMatchObject({
        'linguist-generated': 'set',
    });
});
