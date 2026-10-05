// Python constraints reach the private project; previews plan lock repair without changing recorded inputs.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/open.ts';
import { parse, TomlError, stringify } from 'smol-toml';
import { UV_MISE_PIN } from '#cli/config/tools/python.ts';
import { pythonProject } from '#cli/generation/python.ts';
import { UV_LOCK } from '#cli/config/platform/locations.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { pyprojectSchema } from '#cli/parsers/schema/python/tools.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { pythonLockDrift, pythonInstallationPlan } from '#cli/tools/python/project.ts';
import { PRIVATE_PYTHON_LOCK, PRIVATE_PYTHON_PROJECT } from '#tests/config/samples/python/tools.ts';
import { CONSTRAINT, PYTHON_LOCK_PLANS, PYTHON_ENVIRONMENT_STEPS } from '#tests/config/cli/tools/python/project.ts';

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
    const generated = pythonProject([constrainedManifest()]);
    const project = pyprojectSchema.parse(parse(generated[0]!.content));
    expect(project.tool.uv['constraint-dependencies']).toStrictEqual(['pyjwt>=2.14.0']);
    await createFileTree(sandbox.path, { [UV_LOCK]: lockFor(project.project.dependencies, []) });
    expect(pythonLockDrift(sandbox.path, generated)).toStrictEqual({ path: UV_LOCK, kind: 'changed' });
    await createFileTree(sandbox.path, { [UV_LOCK]: lockFor(project.project.dependencies, [CONSTRAINT]) });
    expect(pythonLockDrift(sandbox.path, generated)).toStrictEqual({ path: UV_LOCK });
});

test.each(PYTHON_LOCK_PLANS)(
    'a $state Python lock plans resolution when needed and preserves recorded inputs',
    async ({ lock, floor, refreshLocks, steps }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
            'source.py': 'print("authored")\n',
            ...(lock === undefined ? {} : { [UV_LOCK]: lock.replace('>=3.11', floor) }),
        });
        using files = openRoot(sandbox.path);
        const recorded = files.read(UV_LOCK);
        expect(pythonInstallationPlan(sandbox.path, undefined, 'none', { refreshLocks })).toStrictEqual({
            installer: [],
            lock: steps,
            environment: PYTHON_ENVIRONMENT_STEPS,
        });
        expect(files.read(UV_LOCK)).toStrictEqual(recorded);
        expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(PRIVATE_PYTHON_PROJECT);
        expect(readFileSync(join(sandbox.path, 'source.py'), 'utf8')).toBe('print("authored")\n');
    },
);

test('a proposed Python project overrides invalid recorded bytes without writing them', async () => {
    await using sandbox = await testdir();
    const recorded = '<<<<<<< interrupted project\n';
    await createFileTree(sandbox.path, { '.gspot/pyproject.toml': recorded, [UV_LOCK]: PRIVATE_PYTHON_LOCK });
    expect(pythonInstallationPlan(sandbox.path, PRIVATE_PYTHON_PROJECT, 'mise', { refreshLocks: false })).toStrictEqual(
        {
            installer: [['mise', 'install', UV_MISE_PIN]],
            lock: [],
            environment: PYTHON_ENVIRONMENT_STEPS,
        },
    );
    expect(() => pythonInstallationPlan(sandbox.path, undefined, 'none', { refreshLocks: false })).toThrow(TomlError);
    expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(recorded);
    expect(readFileSync(join(sandbox.path, UV_LOCK), 'utf8')).toBe(PRIVATE_PYTHON_LOCK);
});

test('a repository without a Python tool project plans no acquisition or installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.py': 'print("authored")\n' });
    expect(pythonInstallationPlan(sandbox.path, undefined, 'mise', { refreshLocks: true })).toStrictEqual({
        installer: [],
        lock: [],
        environment: [],
    });
    expect(readFileSync(join(sandbox.path, 'source.py'), 'utf8')).toBe('print("authored")\n');
});
