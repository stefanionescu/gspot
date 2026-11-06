import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import * as installers from '#cli/tools/installers/install.ts';
import { LOCAL_PLUGIN, LOCAL_PLUGIN_TABLES } from '#tests/config/configurations/javascript/plugins.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('install refuses a gspot.toml that links outside the repository and writes nothing', async () => {
    const outside = 'configurations = []\n';
    await using sandbox = await testdir({ 'project/.gspot/configurations/.keep': '', outside });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    await symlink(join(sandbox.path, 'outside'), join(project, 'gspot.toml'));
    const refused = await runGspot(project, ['install', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
});

test('install exits 2 and prints one line for a plugin that takes the gspot rule prefix', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: LOCAL_PLUGIN_TABLES.replace('"local"', '"gspot"'),
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tools/lint/plugin.mjs': LOCAL_PLUGIN,
    });
    const refused = await runGspot(sandbox.path, ['install']);
    expect(refused.code).toBe(2);
    expect({ stdout: refused.stdout, stderr: refused.stderr }).toStrictEqual({
        stdout: '',
        stderr: 'tools.eslint.plugins: gspot is the rule prefix of a plugin that gspot loads. Choose another name.\n',
    });
});

test('install --json exits 2 with a settings error for a plugin record with a package and no version', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[[tools.eslint.plugins]]\nname = "acme"\npackage = "eslint-plugin-acme"\nrules = {}\n',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
    });
    const refused = await runGspot(sandbox.path, ['install', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'settings' });
});

test('install --json exits 2 with a settings error for options of a rule that the level does not run', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'basic',
            tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const refused = await runGspot(sandbox.path, ['install', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'settings',
        message: expect.stringContaining('n/no-process-exit') as string,
    });
});
