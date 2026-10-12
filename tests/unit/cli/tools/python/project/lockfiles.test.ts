import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { staleLockfiles } from '#cli/tools/lockfiles.ts';
import { pythonProject } from '#cli/generation/python.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { UV_LOCKFILE } from '#cli/config/system/locations.ts';
import { pythonLockfileMatches } from '#cli/tools/python/project.ts';
import type { PythonToolProject } from '#cli/types/tools/project.ts';
import { dependencyFileParser } from '#cli/parsers/dependency-files.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    REQUIRES_PYTHON,
    PYJWT_CONSTRAINT,
    TOOL_PROJECT_NAME,
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
    PYJWT_CONSTRAINT_ARGUMENT,
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

// The security configuration with a floor on the pyjwt Semgrep pulls in.
function constrainedManifest(): Manifest {
    const manifest = structuredClone(configurationManifests().get('security')!);
    const semgrep = manifest.tools.find((tool) => tool.name === 'semgrep')!;
    semgrep.installers['pypi'] = { ...semgrep.installers['pypi']!, constraints: [PYJWT_CONSTRAINT_ARGUMENT] };
    return manifest;
}

// A uv lockfile that follows the project pins and constraints.
function lockfileFor(dependencies: string[], constraints: (typeof PYJWT_CONSTRAINT)[]): string {
    const requires = dependencies.map((dependency) => {
        const [name = '', version = ''] = dependency.split('==');
        return { name, specifier: `==${version}` };
    });
    return stringify({
        version: 1,
        'requires-python': REQUIRES_PYTHON,
        ...(constraints.length === 0 ? {} : { manifest: { constraints } }),
        package: [
            {
                name: TOOL_PROJECT_NAME,
                version: '0.0.0',
                source: { virtual: '.' },
                metadata: { 'requires-dist': requires },
            },
        ],
    });
}

test('a pypi constraint reaches the tool project, and only a lockfile made under it is current', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText([]) });
    const session = await openSession(sandbox.path);
    const generated = pythonProject([constrainedManifest()]);
    const parsed = parse(generated[0]!.content);
    const project = await dependencyFileParser('pyproject.toml')!('pyproject.toml', generated[0]!.content);
    expect(parsed).toMatchObject({ tool: { uv: { 'constraint-dependencies': [PYJWT_CONSTRAINT_ARGUMENT] } } });
    await createFileTree(sandbox.path, { [UV_LOCKFILE]: lockfileFor(Object.values(project.dependencies), []) });
    expect(staleLockfiles(session, generated)).toStrictEqual([{ path: UV_LOCKFILE, kind: 'changed' }]);
    await createFileTree(sandbox.path, {
        [UV_LOCKFILE]: lockfileFor(Object.values(project.dependencies), [PYJWT_CONSTRAINT]),
    });
    expect(staleLockfiles(session, generated)).toStrictEqual([{ path: UV_LOCKFILE }]);
});
