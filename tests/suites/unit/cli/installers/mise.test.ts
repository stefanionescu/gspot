import { realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { listMisePins } from '#cli/configurations/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import type { MiseProject } from '#tests/types/packages.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MISE_PROJECT_MESSAGE } from '#cli/config/installers/mise.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { installMiseTools, isMiseLockfileFresh } from '#cli/installers/mise.ts';

test('mise lock freshness needs the tool, its version, a URL and a sha256 checksum', () => {
    const project = [{ name: 'vale', version: '1.2.3' }];
    const lock =
        '[[tools.vale]]\nversion = "1.2.3"\n[tools.vale."platforms.linux-x64"]\nurl = "https://github.com/vale-cli/vale/releases/download/v1.2.3/vale.zip"\nchecksum = "sha256:' +
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

test('mise lock freshness refuses a download from another host and a checksum other than the audited one', () => {
    const checksum = `sha256:${'a'.repeat(64)}`;
    const project = [{ name: 'vale', version: '1.2.3', checksums: { 'linux-x64': checksum } }];
    const lock = stringify({
        tools: {
            vale: [
                {
                    version: '1.2.3',
                    'platforms.linux-x64': {
                        url: 'https://github.com/vale-cli/vale/releases/download/v1.2.3/vale.zip',
                        url_api: 'https://api.github.com/repos/vale-cli/vale/releases/assets/1',
                        checksum,
                    },
                },
            ],
        },
    });
    expect(isMiseLockfileFresh(project, lock)).toBe(true);
    expect(isMiseLockfileFresh(project, lock.replace(checksum, `sha256:${'b'.repeat(64)}`))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace('https://github.com/', 'https://example.com/'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replaceAll('https:', 'http:'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace('https://api.github.com/', 'https://example.com/'))).toBe(false);
});

test.each(['commit', 'manual'] as const)(
    'mise installs tools of %s checks under a trust for that call, and not beside another mise config file',
    async (stage) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
        const session = await openSession(sandbox.path);
        session.configuredChecks = session.configuredChecks.map((planned) => ({
            ...planned,
            check: { ...planned.check, stage },
        }));
        const writer = openFiles(sandbox.path);
        const install = buildToolInstall(session, writer);
        install.misePath = 'mise';
        const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
        await createFileTree(sandbox.path, { [project.path]: project.content });
        const trusted = join(realpathSync(sandbox.path), GSPOT_PATHS.miseProject);
        using _environment = overrideEnvironment({ MISE_CEILING_PATHS: sandbox.path });
        const pins = listMisePins(session.toolConfigurations);
        const audited = new Map(pins.map((pin) => [pin.name, pin.checksums?.['linux-x64']]));
        const runBlocking = processes.spawnProcessBlocking;
        using _paths = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
            command[0] === 'mise' ? buildProcessResult() : runBlocking(command, options),
        );
        using _commands = fakeCommands('mise', async (command, options) => {
            if (command[1] === 'lock') {
                expect(options.env).toHaveProperty('MISE_TRUSTED_CONFIG_PATHS', options.cwd);
                expect(options.env).toHaveProperty('MISE_CEILING_PATHS', dirname(options.cwd));
                const project = parse(await readFile(join(options.cwd, 'mise.toml'), 'utf8')) as MiseProject;
                const tools = Object.fromEntries(
                    Object.entries(project.tools).map(([name, version]) => [
                        name,
                        [
                            {
                                version: typeof version === 'string' ? version : version.version,
                                'platforms.linux-x64': {
                                    url: 'https://github.com/example/tool/releases/download/v1.0.0/tool.zip',
                                    checksum: audited.get(name) ?? `sha256:${'a'.repeat(64)}`,
                                },
                            },
                        ],
                    ]),
                );
                await writeFile(join(options.cwd, 'mise.lock'), stringify({ tools }, { inlineTableStart: 3 }));
            } else if (command[1] === 'install')
                expect(options.env).toMatchObject({ MISE_LOCKED: '1', MISE_TRUSTED_CONFIG_PATHS: trusted });
            return buildProcessResult();
        });
        await installMiseTools(install);
        const installs = [['mise', 'install', ...pins.map((pin) => pin.name)]];
        expect(install.steps[0]?.slice(0, 2)).toStrictEqual(['mise', 'lock']);
        expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual(installs);
        expect(install.steps.filter((command) => command[1] === 'trust')).toStrictEqual([]);
        const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
        expect(isMiseLockfileFresh(pins, lockfile)).toBe(true);
        await writeFile(join(sandbox.path, '.gspot/mise.local.toml'), '[env]\n');
        expect(await captureRejection(installMiseTools(install))).toMatchObject({
            code: 'install',
            message: MISE_PROJECT_MESSAGE,
        });
        expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual(installs);
    },
);

test('mise fills missing release checksums from the audited pins without fetching archives, and counts the tools', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const url = 'https://github.com/tamasfe/taplo/releases/download/0.10.0/taplo-linux-x86_64.gz';
    const audited = listMisePins(session.toolConfigurations).find((pin) => pin.checksums !== undefined)!;
    const runBlocking = processes.spawnProcessBlocking;
    using _paths = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'mise' ? buildProcessResult() : runBlocking(command, options),
    );
    const respond = Object.assign(() => Promise.resolve(new Response('archive')), { preconnect: fetch.preconnect });
    using request = spyOn(globalThis, 'fetch').mockImplementation(respond);
    using _commands = fakeCommands('mise', async (command, options) => {
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
    const installed = await installMiseTools(install);
    expect(installed.installed).toBe(
        `installed ${String(listMisePins(session.toolConfigurations).length)} mise tools with mise`,
    );
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(request).not.toHaveBeenCalled();
    expect(lockfile).toContain(audited.checksums!['linux-x64']!);
    expect(isMiseLockfileFresh(listMisePins(session.toolConfigurations), lockfile)).toBe(true);
});

test('mise lock that leaves a platform without a download URL is refused and writes no lockfile', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    using _commands = fakeCommands('mise', async (command, options) => {
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

test.each(['pin', 'checksum'])('mise refuses a lock that omits a %s and keeps the previous lock', async (omitted) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling']),
        [GSPOT_PATHS.miseLockfile]: '[tools]\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    const pin = listMisePins(session.toolConfigurations).find((pin) => pin.checksums === undefined)!;
    const lockfile =
        omitted === 'pin'
            ? '[tools]\n'
            : stringify({
                  tools: {
                      [pin.name]: [
                          {
                              version: pin.version,
                              'platforms.linux-x64': {
                                  url: 'https://github.com/example/tool/releases/download/v1.0.0/tool.zip',
                              },
                          },
                      ],
                  },
              });
    using _commands = fakeCommands('mise', async (command, options) => {
        if (command[1] === 'lock') await writeFile(join(options.cwd, 'mise.lock'), lockfile);
        return buildProcessResult({ stderr: 'WARN skipped tool after rate limit' });
    });
    const error = await captureRejection(installMiseTools(install));
    const names = listMisePins(session.toolConfigurations)
        .map((pin) => `${pin.name} ${pin.version}`)
        .join(', ');
    expect(error.message).toBe(
        omitted === 'pin'
            ? `mise lock did not lock ${names}.\nWARN skipped tool after rate limit\nGitHub limits the release lookups of mise without a token. Set GITHUB_TOKEN to a GitHub token, then run gspot install again.`
            : `mise lock omitted a checksum for ${pin.name} on linux-x64. Add an audited installer checksum before retrying.`,
    );
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8')).toBe('[tools]\n');
});
