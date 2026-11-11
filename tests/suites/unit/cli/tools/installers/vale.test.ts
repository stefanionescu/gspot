import { existsSync, utimesSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { VALE_PACKAGE_FOLDERS, VALE_PACKAGE_RELEASES } from '#cli/config/tools/vale.ts';
import { openSession } from '#cli/engine/session.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { downloadArchive, hasValePackages, installValePackages } from '#cli/tools/installers/vale.ts';
import { VALE_PACKAGES_INI } from '#tests/config/setup/configurations.ts';
import { PREVIOUS_BYTES } from '#tests/config/setup/programs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';

test('Vale packages are ready only with the generated vale.ini and the installed folders', async () => {
    await using sandbox = await testdir();
    expect(hasValePackages(sandbox.path)).toBe(false);
    await createFileTree(sandbox.path, { [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI });
    expect(hasValePackages(sandbox.path)).toBe(false);
    for (const folder of VALE_PACKAGE_FOLDERS)
        await createFileTree(sandbox.path, { [`${GSPOT_PATHS.valePackages}/${folder}/.keep`]: '' });
    expect(hasValePackages(sandbox.path)).toBe(true);
});

test('at level basic install installs no Vale packages', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['prose'], { level: 'basic' }) });

    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const context = await buildSandboxToolInstall(session, writer);
    expect(await installValePackages(context, [])).toBe('');
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
    await installValePackages(await buildSandboxToolInstall(session, openFiles(sandbox.path)), []);
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
    const tool = getTool(readConfigurations().values(), 'vale');
    const miseBin = await writeProgramCommand(
        sandbox.path,
        'mise/bin/vale',
        'fakes/tool',
        '--line',
        String(tool.version),
    );
    using _request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('replaced archive'));
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    const error = await captureRejection(installValePackages(install, [miseBin]));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('Google');
    expect(install.steps).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.valePackages}/Google/terms.yml`), 'utf8')).toBe(
        PREVIOUS_BYTES,
    );
});

test.each(['the pinned releases', 'a deleted folder', 'other releases'] as const)(
    'the Vale release file skips downloads only while it names the pinned releases and every package folder exists (%s)',
    async (state) => {
        const [first, ...kept] = VALE_PACKAGE_FOLDERS;
        const releases = state === 'other releases' ? {} : VALE_PACKAGE_RELEASES;
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            [GSPOT_PATHS.valeReleases]: `${JSON.stringify(releases, null, JSON_INDENT)}\n`,
            [GSPOT_PATHS.valeConfig]: VALE_PACKAGES_INI,
            ...Object.fromEntries(
                (state === 'a deleted folder' ? kept : [first, ...kept]).map((folder) => [
                    `${GSPOT_PATHS.valePackages}/${folder}/terms.yml`,
                    'installed bytes',
                ]),
            ),
        });
        const writer = openFiles(sandbox.path);
        using _request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected download'));
        const install = await buildSandboxToolInstall(await openSession(sandbox.path), writer);
        if (state !== 'the pinned releases') {
            const failure = await captureRejection(installValePackages(install, []));
            expect(failure).toMatchObject({ name: 'GspotError', code: 'install' });
            expect(failure.message).toContain('vale');
            return;
        }
        expect(await installValePackages(install, [])).toBe('');
    },
);

test('an oversized archive cancels its response stream before reporting the size error', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    let isCanceled = false;
    const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
            controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel: () => {
            isCanceled = true;
        },
    });
    using _request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response(stream)), { preconnect: fetch.preconnect }),
    );
    const error = await captureRejection(
        downloadArchive(install.session, {
            url: 'https://example.com/styles.zip',
            name: 'styles',
            limit: 2,
        }),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('https://example.com/styles.zip');
    expect(isCanceled).toBe(true);
});

test('a failed download behind a proxy says how to turn the proxy on', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _environment = overrideEnvironment({ HTTPS_PROXY: 'https://proxy.example.com:8080' });
    const refuse = Object.assign(() => Promise.reject(new Error('The proxy refused the connection.')), {
        preconnect: fetch.preconnect,
    });
    using _fetch = spyOn(globalThis, 'fetch').mockImplementation(refuse);
    const setProxy: unknown = Reflect.get(http, 'setGlobalProxyFromEnv');
    Reflect.deleteProperty(http, 'setGlobalProxyFromEnv');
    const failure = await captureRejection(
        downloadArchive(install.session, { url: 'https://example.com/a.zip', name: 'the archive', limit: 1 }),
    );
    Reflect.set(http, 'setGlobalProxyFromEnv', setProxy);
    expect(failure).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(failure.message).toContain('NODE_USE_ENV_PROXY=1');
});
