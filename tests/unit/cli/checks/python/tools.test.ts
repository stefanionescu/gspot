import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { checkPydoclint } from '#cli/checks/python/pydoclint.ts';
import { PYPROJECT } from '#tests/data/checks/python/project.ts';
import { IMPORT_CONTRACT_REPORT } from '#tests/data/checks/python/imports.ts';
import { buildVenvBinPath, buildVenvExecutablePath } from '#cli/system/paths.ts';
import { getToolDeclaration, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    NUMPY_DOCSTRING_MODULE,
    GOOGLE_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/data/checks/python/docstrings.ts';

test('deptry skips a scope without pyproject.toml', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python']),
        'main.py': 'value = 1\n',
    });
    const command = ['check', '--only', 'python/deptry', '--json'];
    const absent = await checkReport(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect(absent.report.checks).toMatchObject([
        { check: 'python/deptry', status: 'skipped', note: 'This scope has no pyproject.toml for deptry to read.' },
    ]);
});

test('deptry excludes nested scopes and keeps your own exclude patterns', async () => {
    await using sandbox = await testdir();
    const scopes = ['', 'app', 'app/nested', 'other'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/nested"\n[[scope]]\npath = "other"\n',
        }),
        ...Object.fromEntries(
            scopes.flatMap((scope) => [
                [
                    join(scope, 'pyproject.toml'),
                    '[project]\nname = "example"\nversion = "1.0.0"\n[tool.deptry]\nextend_exclude = ["authored"]\n',
                ],
                [join(scope, 'main.py'), 'VALUE = 1\n'],
            ]),
        ),
        [join(buildVenvBinPath('.gspot/.venv'), 'deptry')]: 'fixture',
    });
    const { checked, commands } = await runFakeDeptry(sandbox.path);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual(
        scopes.map((scope) => [scope, 'passed']),
    );
    for (const scope of scopes) {
        const command = commands.find((commandArguments) => commandArguments.includes(join(sandbox.path, scope)))!;
        expect(command.slice(1, 5)).toStrictEqual(['run', '--no-sync', '--project', join(sandbox.path, scope)]);
        const patterns = command.flatMap((value, index) => (value === '--extend-exclude' ? [command[index + 1]!] : []));
        expect(patterns.at(-1)).toBe('authored');
        expect(patterns.some((pattern) => new RegExp(pattern).test('.gspot/pyproject.toml'))).toBe(true);
        for (const candidate of scopes.filter(
            (path) => path !== scope && path.startsWith(scope === '' ? '' : `${scope}/`),
        )) {
            const relative = candidate.slice(scope === '' ? 0 : scope.length + 1);
            expect(patterns.some((pattern) => new RegExp(pattern).test(`${relative}/.venv/sample.py`))).toBe(true);
        }
        expect(patterns.some((pattern) => new RegExp(pattern).test('appish/sample.py'))).toBe(false);
    }
});
test('deptry counts python.externals as first party beside the known_first_party of the project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['python'], { tables: '[python]\nexternals = ["folder_paths", "comfy"]\n' }),
        'pyproject.toml':
            '[project]\nname = "example"\nversion = "1.0.0"\n[tool.deptry]\nknown_first_party = ["nodes"]\n',
        'main.py': 'import folder_paths\n',
        [join(buildVenvBinPath('.gspot/.venv'), 'deptry')]: 'fixture',
    });
    const { checked, commands } = await runFakeDeptry(sandbox.path);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const command = commands.find((entry) => entry.includes('deptry'))!;
    const firstParty = command.flatMap((value, index) =>
        value === '--known-first-party' ? [command[index + 1]!] : [],
    );
    expect(firstParty).toStrictEqual(['nodes', 'folder_paths', 'comfy']);
});

test('vulture reads every Python file of the scope and reports unused definitions and unreachable code only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['python'], { level: 'all', tables: '[[scope]]\npath = "child"\n' }),
        'app/nodes.py': 'def helper():\n    return 1\n',
        'app/main.py': 'import os\n',
        'child/other.py': 'VALUE = 1\n',
        [join(buildVenvBinPath('.gspot/.venv'), 'vulture')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = fakePinnedExecutables([getToolDeclaration(session.manifests.values(), 'vulture')]);
    const output = [
        "app/main.py:1: unused import 'os' (90% confidence)",
        "app/nodes.py:1: unused function 'helper' (60% confidence)",
        "app/nodes.py:3: unreachable code after 'return' (100% confidence)",
        "app/nodes.py:4: unused variable 'value' (60% confidence)",
    ].join('\n');
    const executed = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: output, code: 3 })),
    );
    const checked = await checkReport(sandbox.path, ['check', '--only', 'python/vulture', '--json']);
    const findings = checked.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file, line, rule, name }) => ({ file, line, rule, name }))).toStrictEqual([
        { file: 'app/nodes.py', line: 1, rule: 'unused-function', name: 'helper' },
        { file: 'app/nodes.py', line: 3, rule: 'unreachable-code', name: undefined },
    ]);
    const command = executed.mock.calls
        .map(([entry]) => entry)
        .find((entry) => entry.some((part) => part.endsWith('vulture')))!;
    expect(command.slice(1).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'app/main.py',
        'app/nodes.py',
    ]);
});

test('import-linter skips a project without contracts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python']),
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json'];
    const absent = await checkReport(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    const report = absent.report;
    expect(report.checks).toMatchObject([{ check: 'python/import-linter', status: 'skipped' }]);
});

test('import-linter reads setup.cfg first and reports each broken contract with its import chain', async () => {
    await using sandbox = await testdir();
    const config = '[importlinter]\nroot_package = example\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python']),
        'setup.cfg': config,
        '.importlinter': config,
        'pyproject.toml': '[tool.importlinter]\nroot_package = "example"\n',
        'example/__init__.py': '',
        [join(buildVenvBinPath('.gspot/.venv'), 'lint-imports')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(
        fakePinnedExecutables([
            getToolDeclaration(session.manifests.values(), 'uv'),
            getToolDeclaration(session.manifests.values(), 'lint-imports'),
        ]),
    );
    const command = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: 1, stdout: IMPORT_CONTRACT_REPORT }),
        ),
    );
    const findings = await checkFindings(session.root, 'python/import-linter');
    expect(findings.map((finding) => [finding.file, finding.rule])).toStrictEqual([
        ['setup.cfg', 'contract'],
        ['setup.cfg', 'contract'],
    ]);
    expect(findings[0]?.message).toContain('example.low -> example.high (l. 1)');
    expect(findings[0]?.message).not.toContain('example.other');
    expect(findings[1]?.message).toContain('example.other -> example.high (l. 3)');
    expect(command.mock.calls.flatMap(([commandArguments]) => commandArguments.slice(1))).toStrictEqual([
        'run',
        '--no-sync',
        '--project',
        session.root,
        '--with',
        ...listToolProjectPins([...session.manifests.values()]).python.filter((pin) =>
            pin.startsWith('import-linter=='),
        ),
        'lint-imports',
        '--no-cache',
        '--verbose',
        '--config',
        'setup.cfg',
    ]);
    expect(command.mock.calls.map(([, options]) => options.env?.['PYTHONDONTWRITEBYTECODE'])).toStrictEqual(['1']);
});
test.each(PYDOCLINT_PROJECT_CASES)('pydoclint $name', async ({ project, setting, expected, command }) => {
    await using sandbox = await testdir();
    const executable = buildVenvExecutablePath('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python'], {
            tables: setting === undefined ? '' : `[tools.ruff]\ndocstring_convention = "${setting}"\n`,
        }),
        'pyproject.toml': project,
        'source.py': 'value = 1\n',
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['python/pydoclint'] });
    using _version = fakePinnedExecutables([getToolDeclaration(session.manifests.values(), 'pydoclint')]);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    const result = await checkPydoclint(session, planned!);
    expect(result.status).toBe('passed');
    expect(run.mock.calls[0]?.[0].slice(1)).toStrictEqual([
        ...command.slice(1).map((part) => (part === '{files}' ? 'source.py' : part)),
        '--style',
        expected,
    ]);
});

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await testdir();
    const executable = buildVenvExecutablePath('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python']),
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['python/pydoclint'] });
    using _version = fakePinnedExecutables([getToolDeclaration(session.manifests.values(), 'pydoclint')]);
    using command = spyOn(processes, 'spawnProcess')
        .mockResolvedValueOnce(
            buildProcessResult({
                code: 1,
                stdout: 'google.py\n    1: DOC103: The documented argument is wrong.\n',
                duration: 2,
            }),
        )
        .mockResolvedValueOnce(
            buildProcessResult({
                code: 2,
                stderr: 'The native command could not read its configuration.',
                isErrored: true,
                duration: 3,
            }),
        );
    const result = await checkPydoclint(session, planned!);
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toMatchObject([{ file: 'google.py', rule: 'DOC103' }]);
    expect(result.note).toContain('The native command could not read its configuration.');
    expect(
        command.mock.calls.map(([commandArguments]) => commandArguments[commandArguments.indexOf('--style') + 1]),
    ).toStrictEqual(['google', 'numpy']);
});

async function runFakeDeptry(root: string) {
    const session = await openSession(root);
    using resources = fakePinnedExecutables(
        ['uv', 'deptry'].map((name) => getToolDeclaration(session.manifests.values(), name)),
    );
    const executed = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: '[]' })),
    );
    const checked = await checkReport(root, ['check', '--only', 'python/deptry', '--json']);
    return { checked, commands: executed.mock.calls.map(([command]) => command) };
}
