import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { JSCONFIG_SANDBOX, KNIP_FOLDER_FILES, OWN_TYPESCRIPT_RESULTS } from '#tests/config/integration/javascript.ts';
import { COMPILER_SOURCE } from '#tests/config/setup/languages.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox(JSCONFIG_SANDBOX);

test("javascript/tsc uses gspot's own TypeScript when the project has none", async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': COMPILER_SOURCE,
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks).toMatchObject([...OWN_TYPESCRIPT_RESULTS]);
    expect(broken.report.checks[0]!.command![1]).toBe(join(root, GSPOT_PATHS.nodeModules, 'typescript/bin/tsc'));
    await writeFile(join(root, 'source.js'), 'export const value = 1;\n');
    const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'javascript/tsc', status: 'passed', findings: [] }]);
});

test('Knip checks an independent package with directory instead of workspace', async () => {
    const { root } = installedSandbox();
    await using _changes = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'docs', configurations: [] }] }),
            ...KNIP_FOLDER_FILES,
        }),
    );
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/knip', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'docs', status: 'passed' },
    ]);
    await writeFile(join(root, 'docs/unused.js'), 'export const unused = 1;\n');
    const unused = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/knip', '--json']));
    await rm(join(root, 'docs/unused.js'));
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect(unused.report.checks.find(({ scope }) => scope === 'docs')).toMatchObject({
        status: 'failed',
        findings: [{ file: 'docs/unused.js' }],
    });
});
