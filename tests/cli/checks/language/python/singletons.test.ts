import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { singletons } from '#cli/checks/language/python/singletons.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/samples/python/source.ts';

test('a module-level instance is a singleton unless its name is allowed', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/shared.py': `${PYTHON_MODULE_HEADER}class Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
    });
    const unallowed = await singletons(buildEngineInput(await openSession(sandbox.path), 'python/singletons'));
    expect(unallowed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'example/shared.py', line: 8, rule: 'singleton' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], {
            level: 'all',
            tables: '[structure.python]\nsingletons_allowed = [{ names = ["store"], reason = "The framework requires one application object." }]\n',
        }),
    );
    expect(await singletons(buildEngineInput(await openSession(sandbox.path), 'python/singletons'))).toStrictEqual([]);
});

test('FastAPI owns its application and router allowances without exempting general Python names', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'api.py': 'app = FastAPI()\nrouter = APIRouter()\nsettings = Settings()\n',
    });
    const manifests = configurationManifests();
    const python = knownSettings(selectConfigurations(['python'], manifests), 'all');
    const framework = knownSettings(selectConfigurations(['fastapi'], manifests), 'all');
    expect(framework.defaults.get('structure.python.singletons_allowed')!.value).toMatchObject([
        { names: ['app', 'router'] },
    ]);
    expect(python.defaults.get('structure.python.singletons_allowed')!.value).toStrictEqual([]);
    const pythonFindings = await singletons(buildEngineInput(await openSession(sandbox.path), 'python/singletons'));
    expect(pythonFindings.map(({ line }) => line)).toStrictEqual([1, 2, 3]);
    await Bun.write(`${sandbox.path}/gspot.toml`, buildPolicy(['fastapi'], { level: 'all' }));
    const frameworkFindings = await singletons(buildEngineInput(await openSession(sandbox.path), 'python/singletons'));
    expect(frameworkFindings.map(({ line }) => line)).toStrictEqual([3]);
});

test('singleton allowances match both names and repository paths, including excluded files and nested scopes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: '[structure.python]\nsingletons_allowed = [{ names = ["store"], paths = ["example/**", "!example/restricted.py"], reason = "Only the public example modules share their store." }]\n[[scope]]\npath = "app"\nconfigurations = ["python"]\n[scope.structure.python]\nsingletons_allowed = [{ names = ["store"], paths = ["app/allowed.py"], reason = "Only the application composition module shares its store." }]\n',
        }),
        'example/allowed.py': 'store = Store()\nother = Store()\n',
        'example/restricted.py': 'store = Store()\n',
        'outside.py': 'store = Store()\n',
        'app/allowed.py': 'store = Store()\n',
        'app/restricted.py': 'store = Store()\n',
    });
    const session = await openSession(sandbox.path);
    const findings = [
        ...(await singletons(
            buildEngineInput(session, 'python/singletons', {
                paths: ['example/allowed.py', 'example/restricted.py', 'outside.py'],
            }),
        )),
        ...(await singletons(
            buildEngineInput(session, 'python/singletons', {
                scope: 'app',
                paths: ['app/allowed.py', 'app/restricted.py'],
            }),
        )),
    ];
    expect(
        findings
            .map(({ file, line }) => ({ file, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([
        { file: 'app/restricted.py', line: 1 },
        { file: 'example/allowed.py', line: 2 },
        { file: 'example/restricted.py', line: 1 },
        { file: 'outside.py', line: 1 },
    ]);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failed = await spawnGspot(sandbox.path, ['check', '--only', 'python/singletons', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .map(({ file, line }) => ({ file, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual(
        findings
            .map(({ file, line }) => ({ file, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    );
});

test.each([
    '{ names = "store", reason = "The framework requires a shared object." }',
    '{ names = [], reason = "The framework requires a shared object." }',
    '{ names = ["store"], paths = "example/**", reason = "The framework requires a shared object." }',
    '{ names = ["store"], paths = [], reason = "The framework requires a shared object." }',
])('invalid singleton allowances fail while reading policy: %s', async (entry) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: `[structure.python]\nsingletons_allowed = [${entry}]\n`,
        }),
        'example.py': 'store = Store()\n',
    });
    expect(await rejection(openSession(sandbox.path))).toContain('singletons_allowed');
    expect(await Bun.file(`${sandbox.path}/example.py`).text()).toBe('store = Store()\n');
});
