import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getTool } from '#cli/configurations/tools.ts';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { VALE_PACKAGES_INI } from '#tests/config/install/vale.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/install/vale.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { hasValePackages, installValePackages } from '#cli/install/vale.ts';

test.each([...LEVELS])(
    'Vale packages are ready at %s only with the generated vale.ini and the installed folders',
    async (level) => {
        await using sandbox = await testdir();
        expect(hasValePackages(sandbox.path, level)).toBe(false);
        await createFileTree(sandbox.path, { [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI });
        expect(hasValePackages(sandbox.path, level)).toBe(level === 'recommended');
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

test('at level recommended install installs no Vale packages', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['prose'], { level: 'recommended' }) });

    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const context = buildToolInstall(session, writer);
    expect(await installValePackages(context)).toBe('');
    expect(context.steps).toStrictEqual([]);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.valePackages))).toBe(false);
});

test('a changed Vale archive is refused before sync and preserves installed packages', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeConfigFile]: VALE_PACKAGES_INI,
        [`${GSPOT_PATHS.valePackages}/Google/terms.yml`]: 'previous bytes\n',
    });
    const session = await openSession(sandbox.path);
    const tool = getTool(session.configurations.values(), 'vale');
    await writeScriptCommand(sandbox.path, 'node_modules/.bin/vale', `console.log(${JSON.stringify(tool.version)});`);
    using _request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('replaced archive'));
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    const installValePackagesError = await captureRejection(installValePackages(install));
    expect(installValePackagesError.message).toBe(
        'The Vale package Google failed SHA-256 verification. gspot kept the installed packages.',
    );
    expect(install.steps).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
        'previous bytes\n',
    );
});
