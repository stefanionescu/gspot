import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { allRuleExamples } from '#cli/agents/examples.ts';
import { containingAll } from '#tests/support/expectations.ts';
import { DOCSTRING_COMMAND } from '#cli/config/checks/python.ts';
import { PYTHON_STRUCTURE } from '#cli/checks/python/analyses.ts';
import { generatedFile } from '#tests/support/cli/generated/files.ts';

const examples = allRuleExamples().filter((example) => example.language === 'python');

test.each(['recommended', 'all'] as const)(
    'Python guide examples satisfy %s types and docstrings',
    async (level) => {
        await using sandbox = await testdir();
        const pins = kitManifests()
            .get('python')!
            .tools.filter((tool) => ['basedpyright', 'pydoclint'].includes(tool.name))
            .map((tool) => `${tool.name}==${tool.version!}`);
        const paths = examples.map((_example, index) => `example_${String(index)}.py`);
        const dependencies = [...pins, 'fastapi>=0.135,<1', 'python-multipart>=0.0.20,<1'];
        await createFileTree(sandbox.path, {
            'pyproject.toml': `[project]\nname = "guide-examples"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ${JSON.stringify(dependencies)}\n`,
            ...Object.fromEntries(examples.map((example, index) => [paths[index]!, example.body])),
            'rejected.py': 'count: int = "one"\n',
            '.gspot/config/basedpyrightconfig.json': await generatedFile(
                `version = 1\nlevel = "${level}"\nkits = ["python", "fastapi"]\n`,
                '.gspot/config/basedpyrightconfig.json',
            ),
        });
        const locked = await processes.run(['uv', 'lock'], { cwd: sandbox.path });
        expect(locked.code, locked.stdout + locked.stderr).toBe(0);
        const command = [
            'uv',
            'run',
            '--locked',
            'basedpyright',
            '--project',
            '.gspot/config/basedpyrightconfig.json',
            '--outputjson',
        ];
        const rejected = await processes.run(command, { cwd: sandbox.path });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(JSON.parse(rejected.stdout)).toMatchObject({
            generalDiagnostics: [{ rule: 'reportAssignmentType' }],
            summary: { errorCount: 1 },
        });
        await Bun.write(join(sandbox.path, 'rejected.py'), 'count: int = 1\n');
        const corrected = await processes.run(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toMatchObject({ generalDiagnostics: [], summary: { errorCount: 0 } });
        const docstrings = await processes.run(
            ['uv', 'run', '--locked', ...DOCSTRING_COMMAND.flatMap((part) => (part === '{files}' ? paths : [part]))],
            { cwd: sandbox.path },
        );
        expect(docstrings.code, docstrings.stdout + docstrings.stderr).toBe(0);
    },
    60_000,
);

test('Python guide examples retain required signatures and reject an unnecessary wrapper', async () => {
    await using sandbox = await testdir();
    const first = examples[0]!;
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nkits = ["python"]\n',
        ...Object.fromEntries(examples.map((example, index) => [`example_${String(index)}.py`, example.body])),
    });
    const session = await openSession(sandbox.path);
    const only = session.manifests
        .get('python')!
        .checks.filter((check) => Object.hasOwn(PYTHON_STRUCTURE, check.analysis ?? ''))
        .map((check) => check.name);
    const options = { stage: 'all' as const, only, skips: [], fix: false, isDryRun: false, noCache: true };
    const target = join(sandbox.path, 'example_0.py');
    await Bun.write(target, `${first.body}\n\ndef wrapper():\n    return 1\n`);
    const rejected = await executeRun(await openSession(sandbox.path), options);
    expect(rejected.report.exitCode, JSON.stringify(rejected.report)).toBe(1);
    expect(rejected.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'python/trivial-function', file: 'example_0.py', rule: 'trivial-function' },
    ]);
    await Bun.write(target, first.body);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(corrected.report.checks).toHaveLength(only.length);
    expect(corrected.report.checks.every((check) => check.status === 'ok')).toBe(true);
});

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nkits = ["python"]\n[tools.ruff]\nselect = ["S101"]\n[[scope]]\npath = "app"\nkits = ["pytest"]\n[scope.tools.ruff]\nselect = ["PT001"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const root = parse(configs.find(({ path }) => path === '.gspot/config/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: containingAll(['PT001']) } });
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
    const run = (config: string, path: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const unselected = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(unselected.exitCode, unselected.stdout.toString() + unselected.stderr.toString()).toBe(0);
    const failed = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), 'assert True\n');
    const rootAssertion = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(rootAssertion.exitCode, rootAssertion.stderr.toString()).toBe(1);
    expect(JSON.parse(rootAssertion.stdout.toString())).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(testAssertion.exitCode, testAssertion.stderr.toString()).toBe(0);
});

test.each(
    [...new Set(examples.map((example) => example.file))].flatMap((path) =>
        (['recommended', 'all'] as const).map((level) => [level, path] as const),
    ),
)('Python %s %s examples reject undefined input and accept their correction', async (level, path) => {
    await using sandbox = await testdir();
    const selected = examples.filter((example) => example.file === path);
    expect(selected.length).toBeGreaterThan(0);
    await createFileTree(sandbox.path, {
        'examples/__init__.py': '"""Executable Python guide examples."""\n',
        ...Object.fromEntries(selected.map((example) => [`examples/example_${String(example.line)}.py`, example.body])),
        'examples/rejected.py': '"""A reference to undeclared input."""\nresult = missing_input\n',
        'ruff.toml': await generatedFile(
            `version = 1\nlevel = "${level}"\nkits = ["python"${path.startsWith('framework/fastapi/') ? ', "fastapi"' : ''}]\n`,
            '.gspot/config/ruff.toml',
        ),
    });
    const command = ['ruff', 'check', '--config', 'ruff.toml', '--no-cache', '--output-format', 'json', 'examples'];
    const rejected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(rejected.exitCode, rejected.stderr.toString()).toBe(1);
    expect(JSON.parse(rejected.stdout.toString())).toMatchObject([
        { code: 'F821', message: 'Undefined name `missing_input`' },
    ]);
    await Bun.write(join(sandbox.path, 'examples/rejected.py'), '"""A declared input value."""\n\nresult = 1\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    expect(JSON.parse(corrected.stdout.toString())).toStrictEqual([]);
    const formatted = Bun.spawnSync(['ruff', 'format', '--check', '--config', 'ruff.toml', 'examples'], {
        cwd: sandbox.path,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(formatted.exitCode, formatted.stdout.toString() + formatted.stderr.toString()).toBe(0);
});
