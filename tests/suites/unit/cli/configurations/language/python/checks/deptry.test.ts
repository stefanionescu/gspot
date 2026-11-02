import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { getTool } from '#cli/tools/pins.ts';
import { runChecks } from '#cli/engine/run.ts';
import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { executableLayout } from '#cli/system/paths.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { DEPTRY_SCOPE_PATHS } from '#tests/config/configurations/python.ts';
import { fakeToolExecutables, buildPythonToolFiles } from '#tests/setup/system/fakes.ts';

test('deptry skips a scope without pyproject.toml', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': 'value = 1\n',
    });

    const absent = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['python/deptry'] }));

    expect(absent.report.checks).toMatchObject([
        { check: 'python/deptry', status: 'skipped', note: 'This scope has no pyproject.toml for deptry to read.' },
    ]);
});

test('deptry excludes nested scopes and keeps your own exclude patterns', async () => {
    await using sandbox = await createGitSandbox({});
    const scopes = Object.keys(DEPTRY_SCOPE_PATHS) as (keyof typeof DEPTRY_SCOPE_PATHS)[];
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
                [join(scope, '.venv/pyvenv.cfg'), ''],
            ]),
        ),
        [join(join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder), 'deptry')]: 'stub',
        ...buildPythonToolFiles('deptry'),
    });
    const { checked, commands } = await runFakeDeptry(sandbox.path);

    expect(checked.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual(
        scopes.map((scope) => [scope, 'passed']),
    );
    for (const scope of scopes) {
        const command = commands.find((commandArguments) => commandArguments.includes(join(sandbox.path, scope)))!;
        const patterns = command.flatMap((value, index) => (value === '--extend-exclude' ? command[index + 1]! : []));
        expect(patterns).toContain('authored');
        const { excluded, kept } = DEPTRY_SCOPE_PATHS[scope];
        expect(
            [...excluded, ...kept].filter((path) => patterns.some((pattern) => new RegExp(pattern, 'u').test(path))),
        ).toStrictEqual([...excluded]);
    }
});

async function runFakeDeptry(root: string) {
    const session = await openSession(root);
    using resources = fakeToolExecutables(['uv', 'deptry'].map((name) => getTool(readConfigurations().values(), name)));
    const spawn = resources.use(spyOn(processes, 'runProcess').mockResolvedValue(buildProcessResult({ stdout: '[]' })));
    const checked = await runChecks(session, buildRunOptions({ only: ['python/deptry'] }));
    expect(checked.report.failed).toStrictEqual([]);
    return { checked, commands: spawn.mock.calls.map(([command]) => command) };
}

async function readFirstPartyPackages(settings: string, pyproject: string, sources: Record<string, string>) {
    await using sandbox = await createGitSandbox({
        ...sources,
        'gspot.toml': settings,
        'pyproject.toml': pyproject,
        '.venv/pyvenv.cfg': '',
        [join(join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder), 'deptry')]: 'stub',
        ...buildPythonToolFiles('deptry'),
    });
    const { commands } = await runFakeDeptry(sandbox.path);
    const command = commands.find((each) => each.includes('deptry'))!;
    return command.flatMap((value, index) => (value === '--known-first-party' ? command[index + 1]! : []));
}

test('deptry counts python.externals as first party beside the known_first_party of the project', async () => {
    const firstParty = await readFirstPartyPackages(
        buildSandboxSettings(['python'], {
            tables: '[python]\nexternals = { value = ["folder_paths", "comfy"], reason = "The host application provides these modules at run time." }\n',
        }),
        '[project]\nname = "example"\nversion = "1.0.0"\n[tool.deptry]\nknown_first_party = ["nodes"]\n',
        { 'main.py': 'import folder_paths\n' },
    );
    expect(firstParty).toStrictEqual(['example', 'nodes', 'folder_paths', 'comfy']);
});

test('deptry counts the project name and each package under src as first party', async () => {
    const firstParty = await readFirstPartyPackages(
        buildSandboxSettings(['python']),
        '[project]\nname = "Shop-Core"\nversion = "1.0.0"\n',
        {
            'src/shop_core/__init__.py': '',
            'src/shop_tools/__init__.py': '',
            'src/shop_tools/nested/__init__.py': '',
        },
    );
    expect(firstParty).toStrictEqual(['shop_core', 'shop_tools']);
});
