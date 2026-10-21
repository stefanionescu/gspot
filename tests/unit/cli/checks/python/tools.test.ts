import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import * as processes from '#cli/system/processes.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { PYPROJECT } from '#tests/data/checks/python/project.ts';
import { runChecks, runCheckCode } from '#cli/commands/check/run.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { buildVenvBinPath, buildVenvExecutablePath } from '#cli/system/paths.ts';

import {
    NUMPY_DOCSTRING_MODULE,
    GOOGLE_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/data/checks/python/docstrings.ts';

/** Prepare the Python project, pinned executable, and planned pydoclint check together. */
async function preparePydoclintCheck(
    root: string,
    files: Record<string, string>,
    tables = '',
): Promise<DisposableStack & { session: Session; planned: PlannedCheck }> {
    using cleanup = new DisposableStack();
    const resources = cleanup.use(new DisposableStack());
    const executable = buildVenvExecutablePath('.gspot/.venv', 'pydoclint');
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildSandboxSettings(['python'], { tables }),
        [executable]: '',
    });
    await chmod(join(root, executable), EXECUTABLE_FILE);
    const session = await openSession(root, { resources });
    const [planned] = planChecks(session, { stage: 'all', only: ['python/pydoclint'] });
    if (planned === undefined) throw new Error('The Python sandbox does not plan pydoclint.');
    resources.use(fakePinnedExecutables([getTool(session.configurations.values(), 'pydoclint')]));
    return Object.assign(cleanup.move(), { session, planned });
}

async function runFakeDeptry(root: string) {
    const session = await openSession(root);
    using resources = fakePinnedExecutables(
        ['uv', 'deptry'].map((name) => getTool(session.configurations.values(), name)),
    );
    const executed = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: '[]' })),
    );
    const checked = await runChecks(await openSession(root), buildRunOptions({ only: ['python/deptry'] }));
    expect(checked.report.failed).toStrictEqual([]);
    return { checked, commands: executed.mock.calls.map(([command]) => command) };
}

test('deptry skips a scope without pyproject.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': 'value = 1\n',
    });

    const absent = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['python/deptry'] }));

    expect(absent.report.checks).toMatchObject([
        { check: 'python/deptry', status: 'skipped', note: 'This scope has no pyproject.toml for deptry to read.' },
    ]);
});

test('deptry excludes nested scopes and keeps your own exclude patterns', async () => {
    await using sandbox = await testdir();
    const scopes = ['', 'app', 'app/nested', 'other'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/nested' }, { path: 'other' }],
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

    expect(checked.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual(
        scopes.map((scope) => [scope, 'passed']),
    );
    for (const scope of scopes) {
        const command = commands.find((commandArguments) => commandArguments.includes(join(sandbox.path, scope)))!;
        expect(command.slice(1, 5)).toStrictEqual(['run', '--no-sync', '--project', join(sandbox.path, scope)]);
        const patterns = command.flatMap((value, index) => (value === '--extend-exclude' ? [command[index + 1]!] : []));
        expect(patterns.at(-1)).toBe('authored');
        expect(patterns.some((pattern) => new RegExp(pattern).test('.gspot/pyproject.toml'))).toBe(true);
        for (const nestedScope of scopes.filter(
            (path) => path !== scope && path.startsWith(scope === '' ? '' : `${scope}/`),
        )) {
            const relative = nestedScope.slice(scope === '' ? 0 : scope.length + 1);
            expect(patterns.some((pattern) => new RegExp(pattern).test(`${relative}/.venv/sample.py`))).toBe(true);
        }
        expect(patterns.some((pattern) => new RegExp(pattern).test('appish/sample.py'))).toBe(false);
    }
});
test('deptry counts python.externals as first party beside the known_first_party of the project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { tables: '[python]\nexternals = ["folder_paths", "comfy"]\n' }),
        'pyproject.toml':
            '[project]\nname = "example"\nversion = "1.0.0"\n[tool.deptry]\nknown_first_party = ["nodes"]\n',
        'main.py': 'import folder_paths\n',
        [join(buildVenvBinPath('.gspot/.venv'), 'deptry')]: 'fixture',
    });
    const { checked, commands } = await runFakeDeptry(sandbox.path);
    expect(checked.report.failed).toStrictEqual([]);

    const command = commands.find((entry) => entry.includes('deptry'))!;
    const firstParty = command.flatMap((value, index) =>
        value === '--known-first-party' ? [command[index + 1]!] : [],
    );
    expect(firstParty).toStrictEqual(['nodes', 'folder_paths', 'comfy']);
});

test('vulture reads every Python file of the scope and reports unused definitions and unreachable code only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', scopes: [{ path: 'child' }] }),
        'app/nodes.py': 'def helper():\n    return 1\n',
        'app/main.py': 'import os\n',
        'child/other.py': 'VALUE = 1\n',
        [join(buildVenvBinPath('.gspot/.venv'), 'vulture')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = fakePinnedExecutables([getTool(session.configurations.values(), 'vulture')]);
    const output = [
        "app/main.py:1: unused import 'os' (90% confidence)",
        "app/nodes.py:1: unused function 'helper' (60% confidence)",
        "app/nodes.py:3: unreachable code after 'return' (100% confidence)",
        "app/nodes.py:4: unused variable 'value' (60% confidence)",
    ].join('\n');
    const executed = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: output, code: 3 })),
    );
    const checked = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['python/vulture'] }));
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

test.each(PYDOCLINT_PROJECT_CASES)('pydoclint $name', async ({ project, setting, expected, command }) => {
    await using sandbox = await testdir();
    using prepared = await preparePydoclintCheck(
        sandbox.path,
        { 'pyproject.toml': project, 'source.py': 'value = 1\n' },
        setting === undefined ? '' : `[tools.ruff]\ndocstring_convention = "${setting}"\n`,
    );
    const { session, planned } = prepared;
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    const result = await runCheckCode(session, planned, findCheckCode(planned.check));
    expect(result.status).toBe('passed');
    expect(run.mock.calls[0]?.[0].slice(1)).toStrictEqual([
        ...command.slice(1).map((part) => (part === '{files}' ? 'source.py' : part)),
        '--style',
        expected,
    ]);
});

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await testdir();
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
    });
    const { session, planned } = prepared;
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
                errored: true,
                duration: 3,
            }),
        );
    const result = await runCheckCode(session, planned, findCheckCode(planned.check));
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toMatchObject([{ file: 'google.py', rule: 'DOC103' }]);
    expect(result.note).toContain('The native command could not read its configuration.');
    expect(
        command.mock.calls.map(([commandArguments]) => commandArguments[commandArguments.indexOf('--style') + 1]),
    ).toStrictEqual(['google', 'numpy']);
});
