import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { isPythonLockfileFresh } from '#cli/tools/installers/python/lockfiles.ts';
import type { PythonToolProject } from '#cli/types/tools.ts';
import {
    PYTHON_TOOL_LOCKFILE,
    PYTHON_TOOL_PROJECT,
    UV_LOCKFILE_MISMATCHES,
    UV_LOCKFILE_ORIGINS,
} from '#tests/config/tools.ts';

const pythonProject = (parse(PYTHON_TOOL_PROJECT) as { project: PythonToolProject }).project;

test('the uv lockfile check ignores name spelling and requirement order and refuses invalid TOML and a range', () => {
    expect(isPythonLockfileFresh(pythonProject, PYTHON_TOOL_LOCKFILE, {})).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, 'not valid =', {})).toBe(false);
    const rangedProject = (parse(PYTHON_TOOL_PROJECT.replace('==1.2.3', '>=1.2.3')) as { project: PythonToolProject })
        .project;
    expect(isPythonLockfileFresh(rangedProject, PYTHON_TOOL_LOCKFILE, {})).toBe(false);
});

test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    expect(
        isPythonLockfileFresh(
            pythonProject,
            PYTHON_TOOL_LOCKFILE.replace(before, () => after),
            {},
        ),
    ).toBe(false);
});

test.each([...UV_LOCKFILE_ORIGINS])(
    'a uv lockfile with $name is fresh: $expected',
    ({ registry, url, expected, indexes }) => {
        const lockfile = `${PYTHON_TOOL_LOCKFILE}\n[[package]]\nname = "example-package"\nversion = "1.2.3"\nsource = { registry = "${registry}" }\nsdist = { url = "${url}" }\nwheels = [{ url = "${url}" }]\n`;
        expect(isPythonLockfileFresh(pythonProject, lockfile, indexes)).toBe(expected);
    },
);
