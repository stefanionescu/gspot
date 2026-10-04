import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
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
