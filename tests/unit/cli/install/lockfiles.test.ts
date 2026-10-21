import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { isLockfileCurrent } from '#cli/install/npm/lockfiles.ts';
import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';
import { isPythonLockfileCurrent } from '#cli/install/python/project.ts';
import { ROOT_DEPENDENCIES } from '#tests/data/install/npm-tool-project.ts';
import { toolPyprojectSchema } from '#cli/schemas/install/python/project.ts';

import {
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
} from '#tests/data/install/python-tool-project.ts';

const projectText = PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION);
const lockfileText = PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION);
const pythonProject = toolPyprojectSchema.parse(parse(projectText));

test.each(ROOT_DEPENDENCIES)('%s lockfile: only the root dev dependencies', (name, source, expected) => {
    expect(isLockfileCurrent(name, source, expected)).toBe(true);
    expect(isLockfileCurrent(name, source, { ...expected, unrelated: '1.0.0' })).toBe(false);
});
test('the uv lockfile check ignores name spelling and requirement order', () => {
    expect(isPythonLockfileCurrent(pythonProject, lockfileText)).toBe(true);
    expect(isPythonLockfileCurrent(pythonProject, 'not valid =')).toBe(false);
    expect(
        isPythonLockfileCurrent(
            toolPyprojectSchema.parse(parse(projectText.replace('==1.2.3', '>=1.2.3'))),
            lockfileText,
        ),
    ).toBe(false);
});

test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    expect(isPythonLockfileCurrent(pythonProject, lockfileText.replace(before, after))).toBe(false);
});
