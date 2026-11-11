import * as fs from 'node:fs';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { GspotError } from '#cli/system/errors.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const GENERATED_WRITE_MESSAGE = 'Generated write denied';

test('init keeps the old config file when the generated one cannot be written', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    commitAll(sandbox.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, getManifestTarget('spelling', 'typos.toml')))
            throw new Error(GENERATED_WRITE_MESSAGE);
        rename(source, target);
    });
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'spelling', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'unexpected' });
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
});

test.each([
    {
        name: 'a package.json without a pin needs the install of the package manager',
        manifest: '{"name":"example","private":true,"dependencies":{"left-pad":"1.0.0"}}\n',
        next: 'Next: run npm install to install the gspot that package.json now pins, commit the setup files, then fix each file as you touch it.',
    },
    {
        name: 'a repository with a pin goes on to gspot check --fix',
        manifest: `{"name":"example","private":true,"devDependencies":{"${cliPackage.name}":"${cliPackage.version}"}}\n`,
        next: 'Next: commit the setup files, then fix each file as you touch it.',
    },
])('the last line of init: $name', async ({ manifest, next }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'package.json': manifest });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'gspot']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trimEnd().split('\n').at(-1)).toBe(next);
});

test('init writes the generated files, then installs the tools of the plan', async () => {
    await using sandbox = await createGitSandbox({ 'entry.sh': 'echo example\n' });
    using _commands = fakeCommands(undefined, (command) => {
        if (command[1] === 'lock') throw new GspotError('install', 'The test stops at the first tool.');
        return Promise.resolve(buildProcessResult({ stdout: '11.19.0\n' }));
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'bash', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'install', message: 'The test stops at the first tool.' });
    const shellcheck = join(sandbox.path, getManifestTarget('bash', 'shellcheckrc'));
    expect(existsSync(shellcheck)).toBe(true);
});

test('init keeps a replaced config that changes after the plan reads it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    commitAll(sandbox.path);
    const edited = '[default.extend-words]\nChanged = "Changed"\n';
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, 'gspot.toml'))
            fs.writeFileSync(join(sandbox.path, 'typos.toml'), edited);
        rename(source, target);
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'spelling']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(edited);
    expect(result.stdout).toContain('kept typos.toml: it changed after init read it');
});

test('init stopped by SIGINT while it installs tools names what it wrote and the command that finishes the setup', async () => {
    using _install = spyOn(installers, 'installTools').mockImplementation(() => {
        process.emit('SIGINT');
        return Promise.reject(new Error('Installation canceled.'));
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    const stopped = await runGspot(sandbox.path, ['init', '--json']);
    expect(stopped.code).toBe(130);
    const failure = JSON.parse(stopped.stdout) as { error: string; message: string };
    expect(failure.error).toBe('canceled');
    expect(failure.message).toContain('gspot.toml');
    expect(failure.message).toContain('Run gspot install to finish the setup.');
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
});
