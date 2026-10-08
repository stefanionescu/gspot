import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parsePythonSettings } from '#cli/tools/python/registry.ts';
import { PROJECT_INDEX, AUTHORED_UV_INDEX } from '#tests/config/samples/python.ts';

test('uv.toml takes precedence and local index paths follow the authored repository', () => {
    const root = join(process.cwd(), 'authored-repository');
    expect(parsePythonSettings(root, { uv: AUTHORED_UV_INDEX, project: PROJECT_INDEX })).toStrictEqual({
        settings: {
            'index-url': 'https://alex:test%2Bpassword@example.com/simple',
            'find-links': [join(root, 'wheels'), 'https://example.com/wheels'],
            offline: true,
            index: [{ name: 'local', url: join(root, 'packages') }],
        },
        credentials: ['test%2Bpassword', 'test+password'],
    });
});

test('project index settings are used only when uv.toml is absent', () => {
    const root = join(process.cwd(), 'authored-repository');
    expect(parsePythonSettings(root, { uv: undefined, project: PROJECT_INDEX })).toStrictEqual({
        settings: { 'index-url': 'https://example.com/simple', 'find-links': [join(root, 'wheels')] },
        credentials: [],
    });
    expect(parsePythonSettings(root, { uv: '', project: PROJECT_INDEX })).toStrictEqual({
        settings: {},
        credentials: [],
    });
    expect(parsePythonSettings(root, { uv: undefined, project: undefined })).toStrictEqual({
        settings: {},
        credentials: [],
    });
    expect(() => parsePythonSettings(root, { uv: 'find-links = [7]', project: undefined })).toThrow(
        'Invalid input: expected string, received number',
    );
});
