import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { openWriter } from '#cli/repository/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import type { MiseProject } from '#cli/types/installers/mise.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MISE_LOCK_ARGUMENTS } from '#cli/config/installers/mise.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { installMiseTools, isMiseLockfileFresh } from '#cli/installers/mise.ts';

test('mise lock freshness needs the tool, its version, a URL and a sha256 checksum', () => {
    const project = [{ name: 'vale', version: '1.2.3' }];
    const lock =
        '[[tools.vale]]\nversion = "1.2.3"\n[tools.vale."platforms.linux-x64"]\nurl = "https://example.com/vale.zip"\nchecksum = "sha256:' +
        'a'.repeat(64) +
        '"\n';
    expect(isMiseLockfileFresh(project, lock)).toBe(true);
    expect(isMiseLockfileFresh(project, lock.replace('1.2.3', '1.2.4'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replaceAll('tools.vale', 'tools.other'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace(/checksum =[^\n]+/u, ''))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace(/url =[^\n]+/u, ''))).toBe(false);
    expect(isMiseLockfileFresh(project, '[[tools.')).toBe(false);
    expect(isMiseLockfileFresh(project, undefined)).toBe(false);
});

test('mise prepares every platform before a locked install and keeps its checksum lock', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    const runBlocking = processes.spawnProcessBlocking;
    using _paths = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'mise' ? buildProcessResult() : runBlocking(command, options),
    );
    using _commands = fakeCommand('mise', async (command, options) => {
        if (command[1] === 'lock') {
            expect(options.env).toHaveProperty('MISE_TRUSTED_CONFIG_PATHS', options.cwd);
            const project = parse(await readFile(join(options.cwd, 'mise.toml'), 'utf8')) as MiseProject;
            const tools = Object.fromEntries(
                Object.entries(project.tools).map(([name, version]) => [
                    name,
                    [
                        {
                            version: typeof version === 'string' ? version : version.version,
                            'platforms.linux-x64': {
                                url: 'https://example.com/tool.zip',
                                checksum: `sha256:${'a'.repeat(64)}`,
                            },
                        },
                    ],
                ]),
            );
            await writeFile(join(options.cwd, 'mise.lock'), stringify({ tools }, { inlineTableStart: 3 }));
        } else if (command[1] === 'install') expect(options.env).toHaveProperty('MISE_LOCKED', '1');
        return buildProcessResult();
    });
    await installMiseTools(install);
    expect(install.steps[0]).toStrictEqual([...MISE_LOCK_ARGUMENTS]);
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([
        ['mise', 'install', ...listMisePins(session.toolConfigurations).map((pin) => pin.name)],
    ]);
    const isContents = isMiseLockfileFresh(
        listMisePins(session.toolConfigurations),
        await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8'),
    );
    expect(isContents).toBe(true);
});

test('mise fills missing release checksums from the audited pins without fetching archives', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    const url = 'https://example.com/taplo-linux-x86_64.gz';
    const audited = listMisePins(session.toolConfigurations).find((pin) => pin.checksums !== undefined)!;
    const runBlocking = processes.spawnProcessBlocking;
    using _paths = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'mise' ? buildProcessResult() : runBlocking(command, options),
    );
    const respond = Object.assign(() => Promise.resolve(new Response('archive')), { preconnect: fetch.preconnect });
    using request = spyOn(globalThis, 'fetch').mockImplementation(respond);
    using _commands = fakeCommand('mise', async (command, options) => {
        if (command[1] === 'lock') {
            const project = parse(await readFile(join(options.cwd, 'mise.toml'), 'utf8')) as MiseProject;
            const sections = Object.entries(project.tools).map(([name, version]) => {
                const key = /^[\w-]+$/u.test(name) ? name : JSON.stringify(name);
                const pin = typeof version === 'string' ? version : version.version;
                const checksum = name === audited.name ? '' : `checksum = "sha256:${'a'.repeat(64)}"\n`;
                return `[[tools.${key}]]\nversion = "${pin}"\n\n[tools.${key}."platforms.linux-x64"]\nurl = "${url}"\n${checksum}`;
            });
            await writeFile(join(options.cwd, 'mise.lock'), sections.join('\n'));
        }
        return buildProcessResult();
    });
    await installMiseTools(install);
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(request).not.toHaveBeenCalled();
    expect(lockfile).toContain(audited.checksums!['linux-x64']!);
    expect(isMiseLockfileFresh(listMisePins(session.toolConfigurations), lockfile)).toBe(true);
});

test('mise lock that leaves a platform without a download URL is refused and writes no lockfile', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    using _commands = fakeCommand('mise', async (command, options) => {
        if (command[1] === 'lock') {
            const project = parse(await readFile(join(options.cwd, 'mise.toml'), 'utf8')) as MiseProject;
            const sections = Object.keys(project.tools).map((name) => {
                const key = /^[\w-]+$/u.test(name) ? name : JSON.stringify(name);
                return `[[tools.${key}]]\nversion = "1.0.0"\n\n[tools.${key}."platforms.linux-x64"]\nchecksum = "sha256:${'a'.repeat(64)}"\n`;
            });
            await writeFile(join(options.cwd, 'mise.lock'), sections.join('\n'));
        }
        return buildProcessResult({ stdout: 'locked\n' });
    });
    const error = await captureRejection(installMiseTools(install));
    const pins = listMisePins(session.toolConfigurations)
        .map((pin) => `${pin.name} ${pin.version}`)
        .join(', ');
    expect(error.message).toBe(`mise lock did not lock ${pins}.\nlocked`);
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([]);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.miseLockfile))).toBe(false);
});

test('mise refuses a lock that omits pins and keeps the previous lock', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling']),
        [GSPOT_PATHS.miseLockfile]: '[tools]\n',
    });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    using _commands = fakeCommand('mise', async (command, options) => {
        if (command[1] === 'lock') await writeFile(join(options.cwd, 'mise.lock'), '[tools]\n');
        return buildProcessResult({ stderr: 'WARN skipped tool after rate limit' });
    });
    const error = await captureRejection(installMiseTools(install));
    const names = listMisePins(session.toolConfigurations)
        .map((pin) => `${pin.name} ${pin.version}`)
        .join(', ');
    expect(error.message).toBe(`mise lock did not lock ${names}.\nWARN skipped tool after rate limit`);
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8')).toBe('[tools]\n');
});
