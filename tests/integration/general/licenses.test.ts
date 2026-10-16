import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/setup/run-gspot.ts';
import { virtualEnvironmentExecutable } from '#cli/system/paths.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { sandboxPath, installToolProjects } from '#tests/setup/install.ts';

import {
    LICENSE_CHECK,
    LICENSED_PACKAGES,
    FONT_PACKAGE_FILES,
    LICENSES_ROOT_PACKAGE,
    PIP_LICENSES_PYPROJECT,
    LICENSED_EXAMPLE_METADATA,
} from '#tests/config/licenses.ts';

test('licenses/allowed accepts an allowed license choice and reports a disallowed dependency', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'package.json': LICENSES_ROOT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        ...LICENSED_PACKAGES,
    });
    commitAll(root);
    const environment = { PATH: sandboxPath() };
    for (const command of [buildInitArguments(['licenses']), ['set', 'licenses.allowed', '["MIT","Apache-2.0"]']]) {
        const prepared = await spawnGspot(root, command, environment);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    await installToolProjects(root);
    const baseline = await spawnGspot(root, LICENSE_CHECK, environment);
    expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
    expect((JSON.parse(baseline.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await Bun.write(
        join(root, 'node_modules/strict/package.json'),
        JSON.stringify({ name: 'strict', version: '1.0.0', license: 'GPL-3.0-only' }),
    );
    const checked = await spawnGspot(root, LICENSE_CHECK, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toStrictEqual([
        containing({
            file: 'package.json',
            line: 1,
            rule: 'disallowed-license',
            message: textContaining('strict@1.0.0 uses GPL-3.0-only'),
        }),
    ]);
});

test("licenses/allowed reads installed Python packages, ignores the project's pip-licenses settings, and matches an allowed package by its normalized name", async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const files = {
        'gspot.toml': settingsText(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n', level: 'all' }),
        'pyproject.toml': PIP_LICENSES_PYPROJECT,
    };
    await createFileTree(root, files);
    const environment = await runCommand(['uv', 'venv', '.venv'], { cwd: root });
    expect(environment.code, environment.stdout + environment.stderr).toBe(0);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(root);
    const location = await runCommand(
        [
            virtualEnvironmentExecutable(join(root, '.venv'), 'python'),
            '-I',
            '-c',
            'import sysconfig; print(sysconfig.get_path("purelib"))',
        ],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
    await Bun.write(metadata, LICENSED_EXAMPLE_METADATA);
    const failed = await spawnGspot(root, LICENSE_CHECK);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual([
        containing({
            file: 'pyproject.toml',
            rule: 'disallowed-license',
            message: textContaining('licensed-example@1.0.0 uses GPL-3.0-only'),
        }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        settingsText(['licenses'], {
            tables: '[licenses]\nallowed = ["MIT"]\n[[licenses.allowed_package]]\nname = "Licensed._Example"\nversion = "1.0.0"\nreason = "GPL-3.0-only. This fixture tests name normalization."\n',
            level: 'all',
        }),
    );
    const corrected = await runGspot(root, ['apply', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const passed = await spawnGspot(root, LICENSE_CHECK);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect((JSON.parse(passed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('an allowed package at the root covers the same package in a scope with no package.json of its own at the root', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['licenses'], {
            tables: '[licenses]\nallowed = ["MIT"]\n[[licenses.allowed_package]]\nname = "@fontsource/inter"\nversion = "5.2.8"\nreason = "OFL-1.1. Documentation distributes the font."\n[[scope]]\npath = "docs"\n',
        }),
        ...FONT_PACKAGE_FILES,
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    using state = new DisposableStack();
    state.use(
        useEnvironment({
            PATH: [join(sandbox.path, '.gspot/node_modules/.bin'), sandboxPath()].join(delimiter),
        }),
    );
    const checked = await spawnGspot(sandbox.path, LICENSE_CHECK);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect((JSON.parse(checked.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
