// Python constraints reach the private project; previews plan lockfile repair without changing recorded inputs.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parse, TomlError, stringify } from 'smol-toml';
import { toolProjectDrift } from '#cli/tools/public.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { pythonProject } from '#cli/generation/contracts.ts';
import { toolInstallationPlan } from '#cli/tools/contracts.ts';
import { UV_LOCKFILE } from '#cli/config/platform/locations.ts';
import { pythonToolProject } from '#cli/tools/python/public.ts';
import { pythonToolProjectSchema } from '#cli/parsers/schema/public.ts';
import { pythonInstallerPin, configurationManifests } from '#cli/configurations/public.ts';
import { PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCKFILE } from '#tests/config/samples/python.ts';

import {
    CONSTRAINT,
    CONSTRAINT_ARGUMENT,
    PYTHON_LOCKFILE_PLANS,
    PYTHON_ENVIRONMENT_STEPS,
} from '#tests/config/cli/tools/python/project.ts';

// The security configuration with a floor on the pyjwt Semgrep pulls in.
function constrainedManifest(): Manifest {
    const manifest = structuredClone(configurationManifests().get('security')!);
    const semgrep = manifest.tools.find((tool) => tool.name === 'semgrep')!;
    semgrep.installers['pypi'] = { ...semgrep.installers['pypi']!, constraints: [CONSTRAINT_ARGUMENT] };
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
    expect(project.tool.uv['constraint-dependencies']).toStrictEqual([CONSTRAINT_ARGUMENT]);
    await createFileTree(sandbox.path, { [UV_LOCKFILE]: lockfileFor(project.project.dependencies, []) });
    expect(toolProjectDrift(sandbox.path, generated)).toStrictEqual([{ path: UV_LOCKFILE, kind: 'changed' }]);
    await createFileTree(sandbox.path, { [UV_LOCKFILE]: lockfileFor(project.project.dependencies, [CONSTRAINT]) });
    expect(toolProjectDrift(sandbox.path, generated)).toStrictEqual([{ path: UV_LOCKFILE }]);
});

test.each(PYTHON_LOCKFILE_PLANS)(
    'a $state Python lockfile plans resolution when needed',
    async ({ lockfile, floor, refreshLockfiles, steps }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
            'source.py': 'print("authored")\n',
            ...(lockfile === undefined ? {} : { [UV_LOCKFILE]: lockfile.replace('>=3.11', floor) }),
        });
        expect(
            toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'none', { refreshLockfiles }),
        ).toStrictEqual({
            installer: [],
            lockfile: steps,
            environment: PYTHON_ENVIRONMENT_STEPS,
        });
    },
);

test('a proposed Python project overrides invalid recorded bytes without writing them', async () => {
    const uv = pythonInstallerPin();
    const pin = `${uv.name}@${uv.version}`;
    await using sandbox = await testdir();
    const recorded = '<<<<<<< interrupted project\n';
    await createFileTree(sandbox.path, { '.gspot/pyproject.toml': recorded, [UV_LOCKFILE]: PRIVATE_PYTHON_LOCKFILE });
    expect(
        toolInstallationPlan(sandbox.path, pythonToolProject, PRIVATE_PYTHON_PROJECT, 'mise', {
            refreshLockfiles: false,
        }),
    ).toStrictEqual({
        installer: [['mise', 'install', pin]],
        lockfile: [],
        environment: PYTHON_ENVIRONMENT_STEPS,
    });
    expect(() =>
        toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'none', { refreshLockfiles: false }),
    ).toThrow(TomlError);
});

test('a repository without a Python tool project plans no installation or installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.py': 'print("authored")\n' });
    expect(
        toolInstallationPlan(sandbox.path, pythonToolProject, undefined, 'mise', { refreshLockfiles: true }),
    ).toStrictEqual({
        installer: [],
        lockfile: [],
        environment: [],
    });
});

test.each(['missing', 'unversioned'])('a %s bundled uv pin cannot bootstrap Python tools', (state) => {
    const manifest = configurationManifests().get('python')!;
    const tools = manifest.tools;
    try {
        manifest.tools = tools.filter((tool) => tool.name !== 'uv');
        if (state === 'unversioned')
            manifest.tools.push({ name: 'uv', kind: 'binary', installers: { mise: { name: 'uv' } } });
        expect(pythonInstallerPin).toThrow('tool uv requires a pinned mise installer version.');
        expect(pythonInstallerPin).toThrow('configuration manifest for `python`');
    } finally {
        manifest.tools = tools;
    }
});
