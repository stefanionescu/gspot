import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

import {
    runGspot,
    spawnGspot,
    parseCheckReport,
    buildInitArguments,
    installGeneratedTools,
} from '#tests/setup/cli/commands.ts';
import {
    MIT_ONLY,
    LICENSED_PACKAGES,
    FONT_PACKAGE_FILES,
    LICENSES_ROOT_PACKAGE,
    PIP_LICENSES_PYPROJECT,
    LICENSED_EXAMPLE_METADATA,
} from '#tests/config/integration/checks/general/licenses.ts';

test('licenses/allowed accepts an allowed license choice and reports a disallowed dependency', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'package.json': LICENSES_ROOT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        ...LICENSED_PACKAGES,
    });
    commitAll(root);
    for (const command of [buildInitArguments(['licenses']), ['set', 'licenses.allowed', '["MIT","Apache-2.0"]']]) {
        const applied = await spawnGspot(root, command);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    }
    await installGeneratedTools(root);
    const baseline = parseCheckReport(await spawnGspot(root, ['check', '--only', 'licenses/allowed', '--json']));
    expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
    expect(baseline.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await writeFile(
        join(root, 'node_modules/strict/package.json'),
        JSON.stringify({ name: 'strict', version: '1.0.0', license: 'GPL-3.0-only' }),
    );
    const checked = parseCheckReport(await spawnGspot(root, ['check', '--only', 'licenses/allowed', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks[0]?.findings).toStrictEqual([
        matchFields({
            file: 'package.json',
            line: 1,
            rule: 'disallowed-license',
            message: 'strict@1.0.0 uses GPL-3.0-only, which is not allowed.',
        }),
    ]);
});

test("licenses/allowed reads installed Python packages, ignores the project's pip-licenses settings, and matches an allowed package by its normalized name", async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: stringify({ licenses: MIT_ONLY }), level: 'all' }),
        'pyproject.toml': PIP_LICENSES_PYPROJECT,
    });
    const venv = await runCommand(['uv', 'venv', '.venv'], { cwd: root });
    expect(venv.code, venv.stdout + venv.stderr).toBe(0);
    await installGeneratedTools(root);
    const location = await runCommand(
        [
            buildVenvExecutablePath(join(root, '.venv'), 'python'),
            '-I',
            '-c',
            'import sysconfig; print(sysconfig.get_path("purelib"))',
        ],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    await createFileTree(location.stdout.trim(), {
        'licensed_example-1.0.0.dist-info/METADATA': LICENSED_EXAMPLE_METADATA,
    });
    const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'licenses/allowed', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        matchFields({
            file: 'pyproject.toml',
            rule: 'disallowed-license',
            message: 'licensed-example@1.0.0 uses GPL-3.0-only, which is not allowed.',
        }),
    ]);
    await writeFile(
        join(root, 'gspot.toml'),
        buildSandboxSettings(['licenses'], {
            tables: stringify({
                licenses: {
                    ...MIT_ONLY,
                    allowed_package: [
                        {
                            name: 'Licensed._Example',
                            version: '1.0.0',
                            reason: 'GPL-3.0-only. This test checks name normalization.',
                        },
                    ],
                },
            }),
            level: 'all',
        }),
    );
    const corrected = await runGspot(root, ['apply', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const passed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'licenses/allowed', '--json']));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('an allowed package at the root also covers that package in a child scope without its own package.json', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['licenses'], {
            tables: stringify({
                licenses: {
                    ...MIT_ONLY,
                    allowed_package: [
                        {
                            name: '@fontsource/inter',
                            version: '5.2.8',
                            reason: 'OFL-1.1. Documentation distributes the font.',
                        },
                    ],
                },
            }),
            scopes: [{ path: 'docs' }],
        }),
        ...FONT_PACKAGE_FILES,
    });
    await installGeneratedTools(sandbox.path);
    const checked = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'licenses/allowed', '--json'], {
            PATH: [join(sandbox.path, `${GSPOT_PATHS.nodeModules}/.bin`), readEnvironmentVariable('PATH') ?? ''].join(
                delimiter,
            ),
        }),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
