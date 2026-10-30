import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    MIT_ONLY,
    LICENSED_PACKAGES,
    LICENSES_ROOT_PACKAGE,
    PIP_LICENSES_PYPROJECT,
} from '#tests/config/integration/checks/general/licenses.ts';

test('licenses/allowed accepts an allowed license choice and reports a disallowed dependency', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': LICENSES_ROOT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        ...LICENSED_PACKAGES,
    });
    const root = sandbox.path;
    commitAll(root);
    for (const command of [
        ['init', '--yes', '--configurations', 'licenses'],
        ['set', 'licenses.allowed', '["MIT","Apache-2.0"]'],
    ]) {
        const applied = await spawnGspot(root, command);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    }
    await applyThenInstall(root);
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: stringify({ licenses: MIT_ONLY }), level: 'all' }),
        'pyproject.toml': PIP_LICENSES_PYPROJECT,
    });
    const root = sandbox.path;
    const venv = await runCommand(['uv', 'venv', '.venv'], { cwd: root });
    expect(venv.code, venv.stdout + venv.stderr).toBe(0);
    await applyThenInstall(root);
    const [packages] = [...new Bun.Glob('**/site-packages').scanSync({ cwd: join(root, '.venv'), onlyFiles: false })];
    await createFileTree(join(root, '.venv', packages!), {
        'licensed_example-1.0.0.dist-info/METADATA': `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`,
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
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const passed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'licenses/allowed', '--json']));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('an allowed package of the root covers that package in a child scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], {
            tables: stringify({ licenses: MIT_ONLY }),
            scopes: [{ path: 'docs' }],
        }),

        'docs/package.json': '{"name":"docs","private":true,"dependencies":{"@fontsource/inter":"5.2.8"}}',
        'docs/node_modules/@fontsource/inter/package.json':
            '{"name":"@fontsource/inter","version":"5.2.8","license":"OFL-1.1"}',
    });
    await applyThenInstall(sandbox.path);
    const refused = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'licenses/allowed', '--json']));
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(refused.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'docs/package.json', rule: 'disallowed-license' },
    ]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['licenses'], {
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
    );
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'licenses/allowed', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
