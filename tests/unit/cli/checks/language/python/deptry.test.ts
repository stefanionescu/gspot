import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { virtualEnvironmentBin } from '#cli/system/paths.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';

test('deptry skips a scope without pyproject.toml', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python']),
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
        'gspot.toml': settingsText(['python'], {
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
        [join(virtualEnvironmentBin('.gspot/.venv'), 'deptry')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = mockPinnedExecutables(
        ['uv', 'deptry'].map((name) => toolDeclaration(session.manifests.values(), name)),
    );
    const executed = resources.use(spyOn(processes, 'run').mockResolvedValue(processResult({ stdout: '[]' })));
    const checked = await checkReport(sandbox.path, ['check', '--only', 'python/deptry', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual(
        scopes.map((scope) => [scope, 'passed']),
    );
    const commands = executed.mock.calls.map(([command]) => command);
    for (const scope of scopes) {
        const command = commands.find((argv) => argv.includes(join(sandbox.path, scope)))!;
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
