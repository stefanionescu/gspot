import { parse } from '@decimalturn/toml-patch';
import { test, expect, describe } from 'bun:test';
import { isLockfileCurrent } from '#cli/tools/npm/lockfiles.ts';
import { type PythonToolProject } from '#cli/types/tools/project.ts';
import { isPythonLockfileCurrent } from '#cli/tools/python/project.ts';
import { PYTHON_VERSION } from '#cli/config/parsers/dependency-files.ts';
import { ROOT_DEPENDENCIES } from '#tests/data/tools/npm-tool-project.ts';

import {
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
} from '#tests/data/tools/python-tool-project.ts';

describe('lockfiles', () => {
    test.each(ROOT_DEPENDENCIES)('%s lockfile: only the root dev dependencies', (name, source, expected) => {
        expect(isLockfileCurrent(name, source, expected)).toBe(true);
        expect(isLockfileCurrent(name, source, { ...expected, unrelated: '1.0.0' })).toBe(false);
    });
});
describe('lockfiles', () => {
    test('the uv lockfile check ignores name spelling and requirement order', () => {
        const project = parse(PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION)) as PythonToolProject;
        expect(
            isPythonLockfileCurrent(project, PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION)),
        ).toBe(true);
        expect(isPythonLockfileCurrent(project, 'not valid =')).toBe(false);
        expect(
            isPythonLockfileCurrent(
                parse(
                    PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION).replace('==1.2.3', '>=1.2.3'),
                ) as PythonToolProject,
                PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
            ),
        ).toBe(false);
    });

    test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
        const project = parse(PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION)) as PythonToolProject;
        expect(
            isPythonLockfileCurrent(
                project,
                PYTHON_TOOL_LOCKFILE.replace(before, after).replaceAll('{python-version}', PYTHON_VERSION),
            ),
        ).toBe(false);
    });
});
