import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/commands/public.ts';
import { checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/samples/python.ts';

test('a module-level instance is a singleton until its composition file has a policy ignore', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/shared.py': `${PYTHON_MODULE_HEADER}class Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
    });
    const unallowed = await BUILT_IN_CHECKS['python/singletons'].input(
        buildCheckInput(await openSession(sandbox.path), 'python/singletons'),
    );
    expect(unallowed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'example/shared.py', line: 8, rule: 'singleton' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "python/singletons"\npaths = ["example/shared.py"]\nreason = "The framework requires one application object."\n',
        }),
    );
    const ignored = await checkReport(sandbox.path, ['check', '--only', 'python/singletons', '--json']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    expect(ignored.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('FastAPI composition objects use the same explicit file ignores as other Python singletons', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['fastapi'], { level: 'all' }),
        'api.py': 'app = FastAPI()\nrouter = APIRouter()\nsettings = Settings()\n',
        'outside.py': 'settings = Settings()\n',
    });
    const native = await BUILT_IN_CHECKS['python/singletons'].input(
        buildCheckInput(await openSession(sandbox.path), 'python/singletons'),
    );
    expect(native.map(({ file, line }) => ({ file, line }))).toStrictEqual([
        { file: 'api.py', line: 1 },
        { file: 'api.py', line: 2 },
        { file: 'api.py', line: 3 },
        { file: 'outside.py', line: 1 },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['fastapi'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "python/singletons"\npaths = ["api.py"]\nreason = "FastAPI composes its application and routers in this module."\n',
        }),
    );
    const result = await checkReport(sandbox.path, ['check', '--only', 'python/singletons', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'outside.py', line: 1, rule: 'singleton' },
    ]);
});

test('singleton file ignores preserve unaccepted files in root and nested scopes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: '[scope."app"]\nconfigurations = ["python"]\n[[ignore]]\ncheck = "python/singletons"\npaths = ["example/allowed.py", "app/allowed.py"]\nreason = "These modules own the application composition objects."\n',
        }),
        'example/allowed.py': 'store = Store()\nother = Store()\n',
        'example/restricted.py': 'store = Store()\n',
        'outside.py': 'store = Store()\n',
        'app/allowed.py': 'store = Store()\n',
        'app/restricted.py': 'store = Store()\n',
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'python/singletons', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        result.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file, line }) => ({ file, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([
        { file: 'app/restricted.py', line: 1 },
        { file: 'example/restricted.py', line: 1 },
        { file: 'outside.py', line: 1 },
    ]);
});

test('the removed singleton allowance setting is refused while preserving source bytes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: '[structure.python]\nsingletons_allowed = [{ names = ["store"], reason = "The framework requires a shared object." }]\n',
        }),
        'example.py': 'store = Store()\n',
    });
    expect(await rejection(openSession(sandbox.path))).toContain('python');
    expect(await Bun.file(`${sandbox.path}/example.py`).text()).toBe('store = Store()\n');
});
