import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
    await applyGeneratedFiles(root);
    const command = ['check', '--only', 'licenses/allowed', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        matchFields({
            file: 'package-lock.json',
            line: 1,
            rule: 'disallowed-license',
            message: expect.stringMatching(/caniuse-lite@1\.0\.30001700.*CC-BY-4\.0/u) as string,
        }),
    ]);
    await writeFile(
        join(root, 'gspot.toml'),
        buildSandboxSettings(['licenses'], {
            tables: `${allowed}[[licenses.allowed_package]]\nname = "caniuse-lite"\nversion = "*"\nreason = "CC-BY-4.0. The data file stays unchanged."\n`,
        }),
    );
    await applyGeneratedFiles(root);
    const passed = parseCheckReport(await spawnGspot(root, command));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
