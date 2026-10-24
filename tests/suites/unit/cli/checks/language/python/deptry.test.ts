import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { buildVenvBinPath } from '#cli/system/paths.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

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
        [join(buildVenvBinPath(GSPOT_PATHS.pythonEnvironment), 'deptry')]: 'fixture',
    });
    const { checked, commands } = await runFakeDeptry(sandbox.path);

    expect(checked.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual(
        scopes.map((scope) => [scope, 'passed']),
    );
    for (const scope of scopes) {
        const command = commands.find((commandArguments) => commandArguments.includes(join(sandbox.path, scope)))!;
        expect(command.slice(1, 5)).toStrictEqual(['run', '--no-sync', '--project', join(sandbox.path, scope)]);
        const patterns = command.flatMap((value, index) => (value === '--extend-exclude' ? command[index + 1]! : []));
        expect(patterns.at(-1)).toBe('authored');
        expect(patterns.some((pattern) => new RegExp(pattern).test(GSPOT_PATHS.pythonProject))).toBe(true);
        const nestedScopes = scopes.filter(
            (path) => path !== scope && path.startsWith(scope === '' ? '' : `${scope}/`),
        );
        for (const nestedScope of nestedScopes) {
            const relative = nestedScope.slice(scope === '' ? 0 : scope.length + 1);
            expect(patterns.some((pattern) => new RegExp(pattern).test(`${relative}/.venv/sample.py`))).toBe(true);
        }
        expect(patterns.some((pattern) => new RegExp(pattern).test('appish/sample.py'))).toBe(false);
    }
});
async function runFakeDeptry(root: string) {
    const session = await openSession(root);
    using resources = fakeToolExecutables(
        ['uv', 'deptry'].map((name) => getTool(session.configurations.values(), name)),
    );
    const executed = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: '[]' })),
    );
    const checked = await runChecks(session, buildRunOptions({ only: ['python/deptry'] }));
    expect(checked.report.failed).toStrictEqual([]);
    return { checked, commands: executed.mock.calls.map(([command]) => command) };
}
test('deptry counts python.externals as first party beside the known_first_party of the project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { tables: '[python]\nexternals = ["folder_paths", "comfy"]\n' }),
        'pyproject.toml':
            '[project]\nname = "example"\nversion = "1.0.0"\n[tool.deptry]\nknown_first_party = ["nodes"]\n',
        'main.py': 'import folder_paths\n',
        [join(buildVenvBinPath(GSPOT_PATHS.pythonEnvironment), 'deptry')]: 'fixture',
    });
    const { commands } = await runFakeDeptry(sandbox.path);
    const command = commands.find((command) => command.includes('deptry'))!;
    const firstParty = command.flatMap((value, index) => (value === '--known-first-party' ? command[index + 1]! : []));
    expect(firstParty).toStrictEqual(['nodes', 'folder_paths', 'comfy']);
});
