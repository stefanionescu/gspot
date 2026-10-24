import { join } from 'node:path';
import { testdir } from 'testdirs';
import { createHash } from 'node:crypto';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { openWriter } from '#cli/apply/write/writer.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import type { MiseProject } from '#cli/types/install/mise.ts';
import { MISE_LOCK_ARGUMENTS } from '#cli/config/install/mise.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { installMiseTools, isMiseLockfileFresh } from '#cli/install/mise.ts';

test('mise lock freshness requires the exact tool, version, URL and checksum', () => {
    const project = '[tools]\nvale = "1.2.3"\n';
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

test('mise prepares every platform before a locked install and retains its checksum lock', async () => {
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
    expect(install.steps[1]).toStrictEqual([...MISE_LOCK_ARGUMENTS]);
    expect(install.steps.some((command) => command[1] === 'install')).toBe(true);
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    const isContents = isMiseLockfileFresh(
        project.content,
        await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8'),
    );
    expect(isContents).toBe(true);
});

test('mise lock gets a SHA-256 checksum for each platform archive whose release publishes none', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer);
    install.misePath = 'mise';
    const url = 'https://example.com/taplo-linux-x86_64.gz';
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
                return `[[tools.${key}]]\nversion = "${pin}"\n\n[tools.${key}."platforms.linux-x64"]\nurl = "${url}"\n`;
            });
            await writeFile(join(options.cwd, 'mise.lock'), sections.join('\n'));
        }
        return buildProcessResult();
    });
    await installMiseTools(install);
    const lockfile = await readFile(join(sandbox.path, GSPOT_PATHS.miseLockfile), 'utf8');
    expect(request.mock.calls.map(([address]) => address)).toContain(url);
    expect(lockfile).toContain(`checksum = "sha256:${createHash('sha256').update('archive').digest('hex')}"`);
    const project = install.generated.files.find(({ path }) => path === GSPOT_PATHS.miseProject)!;
    expect(isMiseLockfileFresh(project.content, lockfile)).toBe(true);
});
