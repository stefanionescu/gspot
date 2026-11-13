import { existsSync, utimesSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { VALE_PACKAGE_FOLDERS, VALE_PACKAGE_RELEASES } from '#cli/config/tools/vale.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { hasValePackages, installValePackages } from '#cli/tools/installers/vale.ts';
import { VALE_PACKAGES_INI } from '#tests/config/setup/configurations.ts';
import { PREVIOUS_BYTES } from '#tests/config/setup/programs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';

async function writeValeProgram(root: string): Promise<string> {
    const tool = getTool(readConfigurations().values(), 'vale');
    return await writeProgramCommand(root, 'mise/bin/vale', 'fakes/tool', '--line', String(tool.version));
}

test('Vale packages are ready only with the generated vale.ini and the installed folders', async () => {
    await using sandbox = await testdir();
    expect(hasValePackages(sandbox.path)).toBe(false);
    await createFileTree(sandbox.path, { [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI });
    expect(hasValePackages(sandbox.path)).toBe(false);
    for (const folder of VALE_PACKAGE_FOLDERS)
        await createFileTree(sandbox.path, { [`${GSPOT_PATHS.valePackages}/${folder}/.keep`]: '' });
    expect(hasValePackages(sandbox.path)).toBe(true);
});

test('install reclaims interrupted Vale downloads while preserving live downloads', async () => {
    const exited = 12_345;
    const stale = `.gspot/vale-${String(exited)}-abcdef`;
    const active = `.gspot/vale-${String(process.pid)}-abcdef`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'basic' }),
        [`${stale}/archive.zip`]: 'interrupted',
        [`${active}/archive.zip`]: 'active',
        '.gspot/vale-ABCDEF/archive.zip': 'old download',
        '.gspot/vale-notes/notes.txt': 'authored',
    });
    utimesSync(join(sandbox.path, '.gspot/vale-ABCDEF'), new Date(0), new Date(0));
    const kill: typeof process.kill = process.kill.bind(process);
    using _processes = spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === exited) throw Object.assign(new Error('The process exited.'), { code: 'ESRCH' });
        return kill(pid, signal);
    });
    const session = await openSession(sandbox.path);
    await installValePackages(await buildSandboxToolInstall(session), []);
    expect(existsSync(join(sandbox.path, stale))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot/vale-ABCDEF'))).toBe(false);
    expect(existsSync(join(sandbox.path, `${active}/archive.zip`))).toBe(true);
    expect(existsSync(join(sandbox.path, '.gspot/vale-notes/notes.txt'))).toBe(true);
});

test('a changed Vale archive is refused before sync and preserves installed packages', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI,
        [`${GSPOT_PATHS.valePackages}/Google/terms.yml`]: PREVIOUS_BYTES,
    });
    const session = await openSession(sandbox.path);
    const miseBin = await writeValeProgram(sandbox.path);
    using _request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('replaced archive'));
    const install = await buildSandboxToolInstall(session);
    const error = await captureRejection(installValePackages(install, [miseBin]));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('Google');
    expect(install.steps).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
        PREVIOUS_BYTES,
    );
});

test('the Vale release file skips downloads while it names the pinned releases and every package folder exists', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeReleases]: `${JSON.stringify(VALE_PACKAGE_RELEASES, null, JSON_INDENT)}\n`,
        [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI,
        ...Object.fromEntries(
            VALE_PACKAGE_FOLDERS.map((folder) => [
                `${GSPOT_PATHS.valePackages}/${folder}/terms.yml`,
                'installed bytes',
            ]),
        ),
    });
    using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected download'));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    expect(await installValePackages(install, [])).toBe('');
    expect(request).not.toHaveBeenCalled();
});

test.each([
    { name: 'a deleted folder', releases: VALE_PACKAGE_RELEASES, folders: VALE_PACKAGE_FOLDERS.slice(1) },
    { name: 'other releases', releases: {}, folders: VALE_PACKAGE_FOLDERS },
])('the Vale release file with $name downloads the packages again', async ({ releases, folders }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        [GSPOT_PATHS.valeReleases]: `${JSON.stringify(releases, null, JSON_INDENT)}\n`,
        [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI,
        ...Object.fromEntries(
            folders.map((folder) => [`${GSPOT_PATHS.valePackages}/${folder}/terms.yml`, 'installed bytes']),
        ),
    });
    const miseBin = await writeValeProgram(sandbox.path);
    using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('The download failed.'));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const failure = await captureRejection(installValePackages(install, [miseBin]));
    expect(failure).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(request).toHaveBeenCalled();
});
