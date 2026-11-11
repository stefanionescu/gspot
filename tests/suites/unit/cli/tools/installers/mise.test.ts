import { existsSync, realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GITHUB_TOKEN_MESSAGE, MISE_PROJECT_MESSAGE, NETWORK_ADVICE } from '#cli/config/tools/installers.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { installMiseTools, isMiseLockfileFresh, reinstallMiseTools } from '#cli/tools/installers/mise.ts';
import { listMisePins } from '#cli/tools/pins.ts';
import type { MiseToolPin } from '#cli/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall, buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import type { MiseProject } from '#tests/types/setup.ts';

test('mise lock freshness needs the tool, its version, a URL and a sha256 checksum', () => {
    const checksum = `sha256:${'a'.repeat(64)}`;
    const project = [{ name: 'vale', version: '1.2.3', checksums: { 'linux-x64': checksum } }];
    const lock = `[[tools.vale]]\nversion = "1.2.3"\n[tools.vale."platforms.linux-x64"]\nurl = "https://github.com/vale-cli/vale/releases/download/v1.2.3/vale.zip"\nchecksum = "${checksum}"\n`;
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
    const otherChecksum = lock.replace(checksum, () => `sha256:${'b'.repeat(64)}`);
    expect(isMiseLockfileFresh(project, otherChecksum)).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace('https://github.com/', 'https://example.com/'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replaceAll('https:', 'http:'))).toBe(false);
    expect(isMiseLockfileFresh(project, lock.replace('https://api.github.com/', 'https://example.com/'))).toBe(false);
    expect(isMiseLockfileFresh([{ ...project[0]!, checksums: {} }], lock)).toBe(false);
});

test('mise installs tools of manual checks under a trust for that call, and not beside another mise config file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling']),
        '.env.example': 'API_URL=https://example.com\n',
        'README.md': '# Example\n',
        'uv.lock': 'version = 1\n',
    });
    const session = await openSession(sandbox.path);
    session.configuredChecks = session.configuredChecks.map((planned) => ({
        ...planned,
        check: { ...planned.check, stage: 'manual' },
    }));
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    install.misePath = 'mise';
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const trusted = join(realpathSync(sandbox.path), GSPOT_PATHS.miseProject);
    using _environment = overrideEnvironment({ MISE_CEILING_PATHS: sandbox.path });
    const pins = listMisePins(session.toolConfigurations);
    const audited = new Map(pins.map((pin) => [pin.name, pin.checksums['linux-x64']]));
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
                                checksum: audited.get(name),
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
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(isMiseLockfileFresh(pins, lockfile)).toBe(true);
    await writeFile(join(sandbox.path, '.gspot/mise.local.toml'), '[env]\n');
    expect(await captureRejection(installMiseTools(install))).toMatchObject({
        code: 'install',
        message: MISE_PROJECT_MESSAGE,
    });
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual(installs);
});

test('mise fills missing release checksums from the audited pins without fetching archives', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    install.misePath = 'mise';
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const url = 'https://github.com/tamasfe/taplo/releases/download/0.10.0/taplo-linux-x86_64.gz';
    const respond = Object.assign(() => Promise.resolve(new Response('archive')), { preconnect: fetch.preconnect });
    using request = spyOn(globalThis, 'fetch').mockImplementation(respond);
    using _commands = fakeCommands('mise', async (command, options) => {
        if (command[1] === 'lock') {
            const project = parse(await readFile(join(options.cwd, 'mise.toml'), 'utf8')) as MiseProject;
            const sections = Object.entries(project.tools).map(([name, version]) => {
                const key = /^[\w-]+$/u.test(name) ? name : JSON.stringify(name);
                const pin = typeof version === 'string' ? version : version.version;
                return `[[tools.${key}]]\nversion = "${pin}"\n\n[tools.${key}."platforms.linux-x64"]\nurl = "${url}"\n`;
            });
            await writeFile(join(options.cwd, 'mise.lock'), sections.join('\n'));
        }
        return buildProcessResult();
    });
    await installMiseTools(install);
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(request).not.toHaveBeenCalled();
    expect(isMiseLockfileFresh(listMisePins(session.toolConfigurations), lockfile)).toBe(true);
    expect(lockfile).toStartWith('[[tools.');
    expect(lockfile).toContain(`[tools.taplo."platforms.linux-x64"]\nurl = "${url}"\nchecksum = `);
});

test('mise lock that leaves a platform without a download URL is refused and writes no lockfile', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
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
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain(pins);
    expect(error.message).toContain('locked');
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([]);
    expect(existsSync(join(sandbox.path, GSPOT_PATHS.miseLockfile))).toBe(false);
});

test.each(['pin', 'checksum'])('mise refuses a lock that omits a %s and keeps the previous lock', async (omitted) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling']),
        [GSPOT_PATHS.miseLockfile]: '[tools]\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    install.misePath = 'mise';
    const [pin] = listMisePins(session.toolConfigurations) as [MiseToolPin];
    const lockfile =
        omitted === 'pin'
            ? '[tools]\n'
            : stringify({
                  tools: {
                      [pin.name]: [
                          {
                              version: pin.version,
                              'platforms.linux-riscv64': {
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
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    const named =
        omitted === 'pin' ? [names, 'WARN skipped tool after rate limit', 'GITHUB_TOKEN'] : [pin.name, 'linux-riscv64'];
    for (const value of named) expect(error.message).toContain(value);
    expect(install.steps.filter((command) => command[1] === 'install')).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8')).toBe('[tools]\n');
});

test('a GitHub limit named before the output is cut names the token, and not the network', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const install = await buildSandboxToolInstall(session, openFiles(sandbox.path));
    install.misePath = 'mise';
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const lockfile = buildToolLockfiles(session.toolConfigurations)[GSPOT_PATHS.miseLockfile]!;
    using _commands = fakeCommands('mise', async (command, options) => {
        if (command[1] === 'lock') await writeFile(join(options.cwd, 'mise.lock'), lockfile);
        return buildProcessResult({
            code: command[1] === 'install' ? 1 : 0,
            stderr: `No lockfile URL found for the tool\n${'progress\n'.repeat(1000)}`,
        });
    });
    const { message } = await captureRejection(installMiseTools(install));
    expect(message).toContain(GITHUB_TOKEN_MESSAGE);
    expect(message).not.toContain(NETWORK_ADVICE);
});

test('mise lock starts fresh from a broken lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling']),
        [GSPOT_PATHS.miseLockfile]: 'tools = [',
    });
    const session = await openSession(sandbox.path);
    const install = await buildSandboxToolInstall(session, openFiles(sandbox.path));
    install.misePath = 'mise';
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const lockfiles = buildToolLockfiles(session.toolConfigurations);
    const copied: boolean[] = [];
    using _commands = fakeCommands('mise', async (command, options) => {
        if (command[1] === 'lock') {
            copied.push(existsSync(join(options.cwd, 'mise.lock')));
            await writeFile(join(options.cwd, 'mise.lock'), lockfiles[GSPOT_PATHS.miseLockfile]!);
        }
        return buildProcessResult();
    });
    await installMiseTools(install);
    expect(copied).toStrictEqual([false]);
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(isMiseLockfileFresh(listMisePins(session.toolConfigurations), lockfile)).toBe(true);
});

test('a failed mise tool installs again at its pin with the force flag', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    const install = await buildSandboxToolInstall(session, openFiles(sandbox.path));
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    await createFileTree(sandbox.path, { [project.path]: project.content });
    const [pin] = listMisePins(session.toolConfigurations) as [MiseToolPin];
    using _commands = fakeCommands('mise', () => Promise.resolve(buildProcessResult()));
    await reinstallMiseTools(install, [pin]);
    expect(install.steps).toStrictEqual([['mise', 'install', '--force', `${pin.name}@${pin.version}`]]);
});
