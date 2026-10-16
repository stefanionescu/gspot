import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { executableNames } from '#cli/system/paths.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { hasValePackages, installValePackages } from '#cli/install/vale.ts';
import { VALE_PACKAGES_INI, VALE_INSTALL_FAILURES, FIXED_VALE_INSTALL_SCRIPT } from '#tests/config/prose.ts';

test.each([...VALE_INSTALL_FAILURES])(
    'a failed Vale package install reports %s, and the next install succeeds after the fix',
    async (_failure, script, expected) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['prose'], { level: 'all', tables: 'tool_timeout_seconds=1\n' }),
            '.gspot/config/vale.ini': VALE_PACKAGES_INI,
            '.gspot/vale/Google/terms.yml': 'previous bytes\n',
            'guide.md': 'Authored text.\n',
        });
        const session = await openSession(sandbox.path);
        const tool = toolDeclaration(session.manifests.values(), 'vale');
        const executable = join(sandbox.path, 'node_modules/.bin', executableNames('vale')[0]!);
        const launcher = `#!${process.execPath}\nif(process.argv.includes('--version')) console.log(${JSON.stringify(tool.version)}); else {${script}\n}\n`;
        await fakeTool(sandbox.path, 'node_modules/.bin/vale', launcher);
        using writer = openWriter(sandbox.path);
        const failedSteps: (readonly string[])[] = [];
        const request = { session, writer, generated: emitAll(session), tools: [], mise: null, steps: failedSteps };
        expect(installValePackages(request)).rejects.toThrow(expected);
        expect(await readFile(join(sandbox.path, '.gspot/vale/Google/terms.yml'), 'utf8')).toBe('previous bytes\n');
        expect(failedSteps).toStrictEqual([[executable, '--config', textContaining('vale-'), 'sync']]);
        expect(await readFile(join(sandbox.path, 'guide.md'), 'utf8')).toBe('Authored text.\n');
        await writeFile(
            join(sandbox.path, 'node_modules/.bin/vale.js'),
            launcher.replace(script, FIXED_VALE_INSTALL_SCRIPT),
        );
        const steps: (readonly string[])[] = [];
        expect(installValePackages({ ...request, steps })).resolves.toBe('installed Vale packages in .gspot/vale');
        expect(steps).toStrictEqual([[executable, '--config', textContaining('vale-'), 'sync']]);
        expect(await readFile(join(sandbox.path, '.gspot/vale/Google/terms.yml'), 'utf8')).toBe('corrected bytes\n');
        expect(hasValePackages(sandbox.path, 'all')).toBe(true);
    },
);

test.each([...LEVELS])(
    'Vale packages are ready at %s only with the generated vale.ini and the installed folders',
    async (level) => {
        await using sandbox = await testdir();
        expect(hasValePackages(sandbox.path, level)).toBe(false);
        await createFileTree(sandbox.path, { '.gspot/config/vale.ini': VALE_PACKAGES_INI });
        expect(hasValePackages(sandbox.path, level)).toBe(level === 'recommended');
        for (const folder of VALE_PACKAGE_FOLDERS)
            await createFileTree(sandbox.path, { [`.gspot/vale/${folder}/.keep`]: '' });
        expect(hasValePackages(sandbox.path, level)).toBe(true);
    },
);

test.each([...VALE_PACKAGE_FOLDERS])(
    'level all needs the shipped %s folder whatever the Packages line says',
    async (missing) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = \n' });
        for (const folder of VALE_PACKAGE_FOLDERS.filter((folder) => folder !== missing))
            await createFileTree(sandbox.path, { [`.gspot/vale/${folder}/.keep`]: '' });
        expect(hasValePackages(sandbox.path, 'all')).toBe(false);
    },
);

test('at level recommended install installs no Vale packages', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText(['prose'], { level: 'recommended' }) });
    const session = await openSession(sandbox.path);
    const steps: (readonly string[])[] = [];
    using writer = openWriter(sandbox.path);
    expect(
        installValePackages({ session, writer, generated: emitAll(session), tools: [], mise: null, steps }),
    ).resolves.toBe('');
    expect(steps).toStrictEqual([]);
    expect(await pathExists(join(sandbox.path, '.gspot/vale'))).toBe(false);
});
