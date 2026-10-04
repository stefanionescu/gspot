// A constraint a configuration sets on a package Semgrep pulls in reaches the private Python project, and a lock resolved
// without it is out of date.
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { UV_LOCK } from '#cli/config/platform/locations.ts';
import { toolEnvironment } from '#cli/generation/python.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { pythonLockDrift } from '#cli/tools/python/project.ts';
import { pyprojectSchema } from '#cli/parsers/schema/python/tools.ts';
import { CONSTRAINT } from '#tests/config/cli/tools/python/project.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

// The security configuration with a floor on the pyjwt Semgrep pulls in.
function constrainedManifest(): Manifest {
    const manifest = structuredClone(configurationManifests().get('security')!);
    const semgrep = manifest.tools.find((tool) => tool.name === 'semgrep')!;
    semgrep.installers['pypi'] = { ...semgrep.installers['pypi']!, constraints: ['pyjwt>=2.14.0'] };
    return manifest;
}

// A uv lock for the project's pins, with the constraints it was resolved under.
function lockFor(dependencies: string[], constraints: (typeof CONSTRAINT)[]): string {
    const requires = dependencies.map((dependency) => {
        const [name = '', version = ''] = dependency.split('==');
        return { name, specifier: `==${version}` };
    });
    return stringify({
        version: 1,
        'requires-python': '>=3.11',
        ...(constraints.length === 0 ? {} : { manifest: { constraints } }),
        package: [
            {
                name: 'gspot-tools',
                version: '0.0.0',
                source: { virtual: '.' },
                metadata: { 'requires-dist': requires },
            },
        ],
    });
}

test('a pypi constraint reaches the tool project, and only a lock resolved under it is current', async () => {
    await using sandbox = await testdir();
    const generated = toolEnvironment([constrainedManifest()]);
    const project = pyprojectSchema.parse(parse(generated[0]!.content));
    expect(project.tool.uv['constraint-dependencies']).toStrictEqual(['pyjwt>=2.14.0']);
    await createFileTree(sandbox.path, { [UV_LOCK]: lockFor(project.project.dependencies, []) });
    expect(pythonLockDrift(sandbox.path, generated)).toStrictEqual({ path: UV_LOCK, kind: 'changed' });
    await createFileTree(sandbox.path, { [UV_LOCK]: lockFor(project.project.dependencies, [CONSTRAINT]) });
    expect(pythonLockDrift(sandbox.path, generated)).toStrictEqual({ path: UV_LOCK });
});
