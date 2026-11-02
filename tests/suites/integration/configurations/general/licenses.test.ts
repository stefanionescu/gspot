import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('licenses/allowed passes a project whose every package has an allowed license', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }),
        'package-lock.json': JSON.stringify({
            name: 'example',
            version: '1.0.0',
            lockfileVersion: 3,
            requires: true,
            packages: {
                '': { name: 'example', version: '1.0.0', dependencies: { ms: '2.1.3' } },
                'node_modules/ms': { version: '2.1.3' },
            },
        }),
    });
    await applyThenInstall(sandbox.path);
    const passed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'licenses/allowed', '--json']));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks).toMatchObject([{ check: 'licenses/allowed', status: 'passed', findings: [] }]);
});

test('licenses/allowed reads the license of a locked package, and an allowed_package record covers it', async () => {
    const lockfile = JSON.stringify({
        name: 'example',
        version: '1.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
            '': {
                name: 'example',
                version: '1.0.0',
                dependencies: { 'caniuse-lite': '1.0.30001700', lodash: '4.17.21' },
            },
            'node_modules/caniuse-lite': { version: '1.0.30001700' },
            'node_modules/lodash': { version: '4.17.21' },
        },
    });
    const allowed = '[licenses]\nallowed = ["MIT"]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: allowed }),
        'package-lock.json': lockfile,
    });
    const root = sandbox.path;
    await applyThenInstall(root);
    const command = ['check', '--only', 'licenses/allowed', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        matchFields({
            file: 'package-lock.json',
            line: 1,
            rule: 'disallowed-license',
            message: 'caniuse-lite@1.0.30001700 uses CC-BY-4.0, which is not allowed.',
        }),
    ]);
    await writeFile(
        join(root, 'gspot.toml'),
        buildSandboxSettings(['licenses'], {
            tables: `${allowed}[[licenses.allowed_package]]\nname = "caniuse-lite"\nversion = "*"\nreason = "CC-BY-4.0. The data file stays unchanged."\n`,
        }),
    );
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const passed = parseCheckReport(await spawnGspot(root, command));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
