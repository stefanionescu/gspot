// Python constraints reach the private project; previews plan lockfile repair without changing recorded inputs.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/open.ts';
import { parse, TomlError, stringify } from 'smol-toml';
import { UV_MISE_PIN } from '#cli/config/tools/python.ts';
import { pythonProject } from '#cli/generation/python.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { UV_LOCKFILE } from '#cli/config/platform/locations.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { pythonToolProjectSchema } from '#cli/parsers/schema/python/tools.ts';
import { toolProjectDrift, toolInstallationPlan } from '#cli/tools/project.ts';
import { PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCKFILE } from '#tests/config/samples/python/tools.ts';
import { CONSTRAINT, PYTHON_LOCKFILE_PLANS, PYTHON_ENVIRONMENT_STEPS } from '#tests/config/cli/tools/python/project.ts';

// The security configuration with a floor on the pyjwt Semgrep pulls in.
function constrainedManifest(): Manifest {
    const manifest = structuredClone(configurationManifests().get('security')!);
    const semgrep = manifest.tools.find((tool) => tool.name === 'semgrep')!;
    semgrep.installers['pypi'] = { ...semgrep.installers['pypi']!, constraints: ['pyjwt>=2.14.0'] };
    return manifest;
}

// A uv lockfile for the project's pins, with the constraints it was resolved under.
function lockfileFor(dependencies: string[], constraints: (typeof CONSTRAINT)[]): string {
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

test('a pypi constraint reaches the tool project, and only a lockfile resolved under it is current', async () => {
    await using sandbox = await testdir();
    const generated = pythonProject([constrainedManifest()]);
    const project = pythonToolProjectSchema.parse(parse(generated[0]!.content));
    expect(project.tool.uv['constraint-dependencies']).toStrictEqual(['pyjwt>=2.14.0']);
    await createFileTree(sandbox.path, { [UV_LOCKFILE]: lockfileFor(project.project.dependencies, []) });
    expect(toolProjectDrift(sandbox.path, generated)).toStrictEqual([{ path: UV_LOCKFILE, kind: 'changed' }]);
    await createFileTree(sandbox.path, { [UV_LOCKFILE]: lockfileFor(project.project.dependencies, [CONSTRAINT]) });
    expect(toolProjectDrift(sandbox.path, generated)).toStrictEqual([{ path: UV_LOCKFILE }]);
});

test.each(PYTHON_LOCKFILE_PLANS)(
    'a $state Python lockfile plans resolution when needed and preserves recorded inputs',
    async ({ lockfile, floor, refreshLockfiles, steps }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
            'source.py': 'print("authored")\n',
            ...(lockfile === undefined ? {} : { [UV_LOCKFILE]: lockfile.replace('>=3.11', floor) }),
        });
        using files = openRoot(sandbox.path);
        const recorded = files.read(UV_LOCKFILE);
        expect(
            toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'none', { refreshLockfiles }),
        ).toStrictEqual({
            installer: [],
            lockfile: steps,
            environment: PYTHON_ENVIRONMENT_STEPS,
        });
        expect(files.read(UV_LOCKFILE)).toStrictEqual(recorded);
        expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(PRIVATE_PYTHON_PROJECT);
        expect(readFileSync(join(sandbox.path, 'source.py'), 'utf8')).toBe('print("authored")\n');
    },
);

test('a proposed Python project overrides invalid recorded bytes without writing them', async () => {
    await using sandbox = await testdir();
    const recorded = '<<<<<<< interrupted project\n';
    await createFileTree(sandbox.path, { '.gspot/pyproject.toml': recorded, [UV_LOCKFILE]: PRIVATE_PYTHON_LOCKFILE });
    expect(
        toolInstallationPlan(sandbox.path, pythonToolProject, PRIVATE_PYTHON_PROJECT, 'mise', {
            refreshLockfiles: false,
        }),
    ).toStrictEqual({
        installer: [['mise', 'install', UV_MISE_PIN]],
        lockfile: [],
        environment: PYTHON_ENVIRONMENT_STEPS,
    });
    expect(() =>
        toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'none', { refreshLockfiles: false }),
    ).toThrow(TomlError);
    expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(recorded);
    expect(readFileSync(join(sandbox.path, UV_LOCKFILE), 'utf8')).toBe(PRIVATE_PYTHON_LOCKFILE);
});

test('a repository without a Python tool project plans no acquisition or installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.py': 'print("authored")\n' });
    expect(
        toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'mise', { refreshLockfiles: true }),
    ).toStrictEqual({
        installer: [],
        lockfile: [],
        environment: [],
    });
    expect(readFileSync(join(sandbox.path, 'source.py'), 'utf8')).toBe('print("authored")\n');
});
