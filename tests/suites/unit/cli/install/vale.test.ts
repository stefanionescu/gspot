import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { getTool } from '#cli/configurations/tools.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/install/vale.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { hasValePackages, installValePackages } from '#cli/install/vale.ts';
import { VALE_PACKAGES_INI, VALE_INSTALL_FAILURES, CORRECTED_VALE_INSTALL_SCRIPT } from '#tests/config/install/vale.ts';

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
        const launcher = `if(process.argv.includes('--version')) console.log(${JSON.stringify(tool.version)}); else {${script}\n}\n`;
        await writeScriptCommand(sandbox.path, 'node_modules/.bin/vale', launcher);
        using writer = openWriter(sandbox.path);
        const request = buildToolInstall(session, writer);
        expect(await captureRejection(installValePackages(request))).toEndWith(message);
        expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
            'previous bytes\n',
        );
        expect(request.steps).toStrictEqual([
            [executable, '--config', expect.stringContaining('vale-') as string, 'sync'],
        ]);
        await writeFile(
            join(sandbox.path, 'node_modules/.bin/vale.js'),
            launcher.replace(script, CORRECTED_VALE_INSTALL_SCRIPT),
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

        for (const folder of VALE_PACKAGE_FOLDERS.filter((folder) => folder !== missing))
            await createFileTree(sandbox.path, { [`${GSPOT_PATHS.valePackages}/${folder}/.keep`]: '' });
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
