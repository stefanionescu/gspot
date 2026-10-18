import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { rm, writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { writePythonSettings } from '#cli/install/python/settings.ts';
import { UV_TOML, PYPROJECT_UV_INDEX } from '#tests/data/install/python-tool-project.ts';

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    await using repository = await testdir({ 'uv.toml': UV_TOML, 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(repository.path, scratch.path)).toStrictEqual(['test%2Bpassword', 'test+password']);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({
        'index-url': 'https://alex:test%2Bpassword@example.com/simple',
        'find-links': [join(repository.path, 'wheels'), 'https://example.com/wheels'],
        offline: true,
        index: [{ name: 'local', url: join(repository.path, 'packages') }],
    });
});

test('project index settings are used only when uv.toml is absent', async () => {
    await using repository = await testdir({ 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(repository.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({
        'index-url': 'https://example.com/simple',
        'find-links': [join(repository.path, 'wheels')],
    });
    await createFileTree(repository.path, { 'uv.toml': '' });
    expect(writePythonSettings(repository.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({});
    await rm(join(repository.path, 'uv.toml'));
    await rm(join(repository.path, 'pyproject.toml'));
    expect(writePythonSettings(repository.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({});
    await writeFile(join(repository.path, 'uv.toml'), 'find-links = [7]');
    expect(() => writePythonSettings(repository.path, scratch.path)).toThrow(
        'Invalid input: expected string, received number',
    );
});
