import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { pythonLockfileMatches } from '#cli/tools/python/project.ts';
import type { PythonToolProject } from '#cli/types/tools/project.ts';

import {
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
} from '#tests/config/python/tool-project.ts';

test('the uv lockfile check ignores name spelling and requirement order', () => {
    const project = parse(PYTHON_TOOL_PROJECT) as PythonToolProject;
    expect(pythonLockfileMatches(project, PYTHON_TOOL_LOCKFILE)).toBe(true);
    expect(pythonLockfileMatches(project, 'not valid =')).toBe(false);
    expect(
        pythonLockfileMatches(
            parse(PYTHON_TOOL_PROJECT.replace('==1.2.3', '>=1.2.3')) as PythonToolProject,
            PYTHON_TOOL_LOCKFILE,
        ),
    ).toBe(false);
});

test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    const project = parse(PYTHON_TOOL_PROJECT) as PythonToolProject;
    expect(pythonLockfileMatches(project, PYTHON_TOOL_LOCKFILE.replace(before, after))).toBe(false);
});
