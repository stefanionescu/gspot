import { existsSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { installValePackages } from '#cli/tools/installers/vale.ts';
import { PROSE_SANDBOX } from '#tests/config/integration/prose.ts';
import { PREVIOUS_BYTES, VALE_PACKAGES_INI } from '#tests/config/setup/configurations.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';

const STRAY_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Google/legacy.yml`;

const AUTHORED_VALE_FILES = {
    files: { 'authored.txt': 'keep\n', [STRAY_STYLE_PATH]: 'stray style bytes\n' },
} as const;

const GOOGLE_RULE_PATH = `${GSPOT_PATHS.valePackages}/Google/Passive.yml`;

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test('gspot install restores deleted Vale dictionaries, and prose/vale passes again', async () => {
    const { root } = installedSandbox();
    await rm(join(root, GSPOT_PATHS.valePackages, 'config', 'dictionaries'), { recursive: true });
    const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
    expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
    expect(broken.report.checks).toMatchObject([{ check: 'prose/vale', status: 'missing' }]);
    const installed = await spawnGspot(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'prose/vale', status: 'passed', findings: [] }]);
});

test('a Vale reinstall for new package releases deletes a package gspot no longer ships', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeSandbox(sandbox, AUTHORED_VALE_FILES);
    await writeFile(join(sandbox.root, GSPOT_PATHS.valeReleases), '{}\n');
    await createFileTree(sandbox.root, { [`${GSPOT_PATHS.valePackages}/Retired/terms.yml`]: 'old rule\n' });
    const installed = await spawnGspot(sandbox.root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(existsSync(join(sandbox.root, `${GSPOT_PATHS.valePackages}/Retired`))).toBe(false);
    expect(existsSync(join(sandbox.root, GOOGLE_RULE_PATH))).toBe(true);
    expect({
        authored: await readFile(join(sandbox.root, 'authored.txt'), 'utf8'),
        stray: existsSync(join(sandbox.root, STRAY_STYLE_PATH)),
    }).toStrictEqual({ authored: 'keep\n', stray: false });
});

test('a Vale reinstall for new package releases replaces an edited package and keeps the authored files', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeSandbox(sandbox, AUTHORED_VALE_FILES);
    await writeFile(join(sandbox.root, GSPOT_PATHS.valeReleases), '{}\n');
    const previous = await readFile(join(sandbox.root, GOOGLE_RULE_PATH));
    await chmod(join(sandbox.root, GOOGLE_RULE_PATH), 0o644);
    await writeFile(join(sandbox.root, GOOGLE_RULE_PATH), 'edited\n');
    const installed = await spawnGspot(sandbox.root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(join(sandbox.root, GOOGLE_RULE_PATH))).toStrictEqual(previous);
});

test('a failed Vale package install reports its error and keeps the installed packages', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI,
        [`${GSPOT_PATHS.valePackages}/Google/terms.yml`]: PREVIOUS_BYTES,
        'guide.md': 'Authored text.\n',
    });

    const session = await openSession(sandbox.path);
    const tool = getTool(readConfigurations().values(), 'vale');
    const miseBin = join(sandbox.path, 'mise/bin');
    await writeProgramCommand(
        sandbox.path,
        'mise/bin/vale',
        'fakes/tool',
        '--version-line',
        String(tool.version),
        '--stderr',
        'Registry request failed: https://alex:synthetic-password@example.com/styles.zip',
        '--exit',
        '7',
    );
    const request = await buildSandboxToolInstall(session);
    const failure = await captureRejection(installValePackages(request, [miseBin]));
    expect(failure.message).toContain('https://[redacted]@example.com/styles.zip');
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
        PREVIOUS_BYTES,
    );
});
