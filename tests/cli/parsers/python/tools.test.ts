import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pythonLockMatches, parsePythonSettings } from '#cli/parsers/python/tools.ts';

import {
    PROJECT_INDEX,
    AUTHORED_UV_INDEX,
    UV_LOCK_MISMATCHES,
    PRIVATE_PYTHON_LOCK,
    PRIVATE_PYTHON_PROJECT,
} from '#tests/config/samples/python/tools.ts';

test('private Python lock comparison normalizes distribution names and ignores requirement order', () => {
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCK)).toBe(true);
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, 'not valid =')).toBe(false);
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT.replace('==1.2.3', '>=1.2.3'), PRIVATE_PYTHON_LOCK)).toBe(false);
});

test.each(UV_LOCK_MISMATCHES)('a changed %s makes a private Python lock stale', (_name, before, after) => {
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCK.replace(before, after))).toBe(false);
});

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
