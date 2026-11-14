import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { LOCAL_PLUGIN_TABLES } from '#tests/config/setup/configurations.ts';

test('install exits 2 and prints one line for a plugin that takes the gspot rule prefix', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: LOCAL_PLUGIN_TABLES.replace('"local"', '"gspot"'),
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tools/lint/plugin.mjs': 'export default {};\n',
    });
    const refused = await runGspot(sandbox.path, ['install']);
    expect(refused.code).toBe(2);
    expect({ stdout: refused.stdout, stderr: refused.stderr }).toStrictEqual({
        stdout: '',
        stderr: 'tools.eslint.plugins: gspot is the rule prefix of a plugin that gspot loads. Choose another name.\n',
    });
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
