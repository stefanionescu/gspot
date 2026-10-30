import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { VALE_PACKAGES_INI } from '#tests/config/vale.ts';
import { buildInstallKey } from '#cli/installers/record.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { PREVIOUS_BYTES } from '#tests/config/installers/vale.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { hasValePackages, installValePackages } from '#cli/installers/vale.ts';
import { VALE_PACKAGE_FOLDERS, VALE_PACKAGE_RELEASES } from '#cli/config/installers/vale.ts';

test.each([...LEVELS])(
    'Vale packages are ready at %s only with the generated vale.ini and the installed folders',
    async (level) => {
        await using sandbox = await testdir();
        expect(hasValePackages(sandbox.path, level)).toBe(false);
        await createFileTree(sandbox.path, { [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI });
        expect(hasValePackages(sandbox.path, level)).toBe(level === 'basic');
        for (const folder of VALE_PACKAGE_FOLDERS)
            await createFileTree(sandbox.path, { [`${GSPOT_PATHS.valePackages}/${folder}/.keep`]: '' });
        expect(hasValePackages(sandbox.path, level)).toBe(true);
    },
);

test.each([...VALE_PACKAGE_FOLDERS])(
    'level all needs the shipped %s folder whatever the Packages line says',
    async (missing) => {
        await using sandbox = await testdir({ [GSPOT_PATHS.valeConfigFile]: 'Packages = \n' });

        for (const folder of VALE_PACKAGE_FOLDERS) {
            if (folder === missing) continue;
            await createFileTree(sandbox.path, { [`${GSPOT_PATHS.valePackages}/${folder}/.keep`]: '' });
        }
        expect(hasValePackages(sandbox.path, 'all')).toBe(false);
    },
);

test('at level basic install installs no Vale packages', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['prose'], { level: 'basic' }) });

    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const context = buildToolInstall(session, writer);
    expect(await installValePackages(context, [])).toBe('');
    expect(context.steps).toStrictEqual([]);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.valePackages))).toBe(false);
});

test('a changed Vale archive is refused before sync and preserves installed packages', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI,
        [`${GSPOT_PATHS.valePackages}/Google/terms.yml`]: PREVIOUS_BYTES,
    });
    const session = await openSession(sandbox.path);
    const tool = getTool(session.configurationsByName.values(), 'vale');
    const miseBin = await writeProgramCommand(
        sandbox.path,
        'mise/bin/vale',
        'fakes/tool',
        '--line',
        String(tool.version),
    );
    using _request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('replaced archive'));
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    const error = await captureRejection(installValePackages(install, [miseBin]));
    expect(error.message).toBe(
        'The Vale package Google failed SHA-256 verification. gspot kept the installed packages.',
    );
    expect(install.steps).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
        PREVIOUS_BYTES,
    );
});

test.each([false, true])(
    'a matching Vale record skips downloads only while every package folder exists (one folder deleted: %p)',
    async (deleted) => {
        const [first, ...kept] = VALE_PACKAGE_FOLDERS;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            [GSPOT_PATHS.installRecord]: JSON.stringify({
                vale: buildInstallKey(['all', JSON.stringify(VALE_PACKAGE_RELEASES)]),
            }),
            [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI,
            ...Object.fromEntries(
                (deleted ? kept : [first, ...kept]).map((folder) => [
                    `${GSPOT_PATHS.valePackages}/${folder}/terms.yml`,
                    'installed bytes',
                ]),
            ),
        });
        const writer = openFiles(sandbox.path);
        using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected download'));
        const install = buildToolInstall(await openSession(sandbox.path), writer);
        if (deleted) {
            const failure = await captureRejection(installValePackages(install, []));
            expect(failure.message).toContain('vale');
            return;
        }
        expect(await installValePackages(install, [])).toBe('');
        expect(request).not.toHaveBeenCalled();
        expect(install.steps).toStrictEqual([]);
    },
);
