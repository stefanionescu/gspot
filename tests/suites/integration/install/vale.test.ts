import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareProseSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { hasValePackages, installValePackages } from '#cli/install/vale.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { VALE_PACKAGES_INI, VALE_INSTALL_FAILURES, CORRECTED_VALE_INSTALL_SCRIPT } from '#tests/config/install/vale.ts';
import { GOOGLE_TERMS_PATH, AUTHORED_STYLE_PATH, AUTHORED_VALE_FILES } from '#tests/config/integration/install/vale.ts';

const installedSandbox = shareProseSandbox();

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

test('Vale package install deletes a package gspot no longer ships', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeAppliedSandbox(sandbox, AUTHORED_VALE_FILES);
    await createFileTree(sandbox.root, { [`${GSPOT_PATHS.valePackages}/Retired/terms.yml`]: 'old rule\n' });
    const installed = await spawnGspot(sandbox.root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.root, `${GSPOT_PATHS.valePackages}/Retired`))).toBe(false);
    expect(await isOnDisk(join(sandbox.root, GOOGLE_TERMS_PATH))).toBe(true);
    expect({
        authored: await readFile(join(sandbox.root, 'authored.txt'), 'utf8'),
        style: await readFile(join(sandbox.root, AUTHORED_STYLE_PATH), 'utf8'),
    }).toStrictEqual({ authored: 'keep\n', style: 'authored legacy bytes\n' });
});

test('Vale package install replaces an edited package and keeps your files', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeAppliedSandbox(sandbox, AUTHORED_VALE_FILES);
    const original = await readFile(join(sandbox.root, GOOGLE_TERMS_PATH));
    await chmod(join(sandbox.root, GOOGLE_TERMS_PATH), 0o644);
    await writeFile(join(sandbox.root, GOOGLE_TERMS_PATH), 'edited\n');
    const installed = await spawnGspot(sandbox.root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(join(sandbox.root, GOOGLE_TERMS_PATH))).toStrictEqual(original);
    expect({
        authored: await readFile(join(sandbox.root, 'authored.txt'), 'utf8'),
        style: await readFile(join(sandbox.root, AUTHORED_STYLE_PATH), 'utf8'),
    }).toStrictEqual({ authored: 'keep\n', style: 'authored legacy bytes\n' });
});

test.each([...VALE_INSTALL_FAILURES])(
    'a failed Vale package install reports $name, and the next install succeeds after the fix',
    async ({ script, message, settings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all', tables: settings }),
            [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI,
            [`${GSPOT_PATHS.valePackages}/Google/terms.yml`]: 'previous bytes\n',
            'guide.md': 'Authored text.\n',
        });

        const session = await openSession(sandbox.path);
        const tool = getTool(session.configurations.values(), 'vale');
        const executable = join(sandbox.path, 'node_modules/.bin', listExecutableNames('vale')[0]!);
        const runBlocking = processes.spawnProcessBlocking;
        using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
            command[0] === executable && command[1] === '--version'
                ? buildProcessResult({ stdout: String(tool.version) })
                : runBlocking(command, options),
        );
        const launcher = `if(process.argv.includes('--version')) console.log(${JSON.stringify(tool.version)}); else {${script}\n}\n`;
        await writeScriptCommand(sandbox.path, 'node_modules/.bin/vale', launcher);
        using writer = openWriter(sandbox.path);
        const request = buildToolInstall(session, writer);
        const failure = await captureRejection(installValePackages(request));
        expect(failure.message).toEndWith(message);
        expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
            'previous bytes\n',
        );
        expect(request.steps).toStrictEqual([
            [executable, '--config', expect.stringContaining('vale-') as string, 'sync'],
        ]);
        await writeFile(
            join(sandbox.path, 'node_modules/.bin/vale.js'),
            launcher.replace(script, () => CORRECTED_VALE_INSTALL_SCRIPT),
        );
        await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['prose'], { level: 'all' }));
        const fixed = buildToolInstall(await openSession(sandbox.path), writer);
        expect(await installValePackages(fixed)).toBe(`installed Vale packages in ${GSPOT_PATHS.valePackages}`);
        expect(fixed.steps).toStrictEqual([
            [executable, '--config', expect.stringContaining('vale-') as string, 'sync'],
        ]);
        expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
            'corrected bytes\n',
        );
        expect(hasValePackages(sandbox.path, 'all')).toBe(true);
    },
);
