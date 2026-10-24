import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { rm, writeFile } from 'node:fs/promises';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { writePythonSettings } from '#cli/install/python/settings.ts';
import { UV_TOML, PYPROJECT_UV_INDEX, INVALID_UV_SETTINGS } from '#tests/config/install/python.ts';

test.each(INVALID_UV_SETTINGS)(
    'invalid $file $field settings name the file and field',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({ [file]: text });
        await using scratch = await testdir();
        expect(() => writePythonSettings(sandbox.path, scratch.path)).toThrow(
            new GspotError(
                'filesystem',
                `${file}: ${field}: Invalid input: expected array, received string. Fix the field.`,
            ),
        );
    },
);

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    await using sandbox = await testdir({ 'uv.toml': UV_TOML, 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(sandbox.path, scratch.path)).toStrictEqual(['test%2Bpassword', 'test+password']);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({
        'index-url': 'https://alex:test%2Bpassword@example.com/simple',
        'find-links': [join(sandbox.path, 'wheels'), 'https://example.com/wheels'],
        offline: true,
        index: [{ name: 'local', url: join(sandbox.path, 'packages') }],
    });
});

test('project index settings apply only without uv.toml, missing or empty files give none, and an invalid uv.toml is refused', async () => {
    await using sandbox = await testdir({ 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(sandbox.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({
        'index-url': 'https://example.com/simple',
        'find-links': [join(sandbox.path, 'wheels')],
    });
    await createFileTree(sandbox.path, { 'uv.toml': '' });
    expect(writePythonSettings(sandbox.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({});
    await rm(join(sandbox.path, 'uv.toml'));
    await rm(join(sandbox.path, 'pyproject.toml'));
    expect(writePythonSettings(sandbox.path, scratch.path)).toStrictEqual([]);
    expect(parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'))).toStrictEqual({});
    await writeFile(join(sandbox.path, 'uv.toml'), 'find-links = [7]');
    expect(() => writePythonSettings(sandbox.path, scratch.path)).toThrow(
        new GspotError(
            'filesystem',
            'uv.toml: find-links.0: Invalid input: expected string, received number. Fix the field.',
        ),
    );
});
