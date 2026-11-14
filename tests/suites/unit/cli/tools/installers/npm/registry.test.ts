import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { writeNpmrc, readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';

const NPMRC_REFUSALS = [
    {
        name: 'a registry password with a broken percent escape',
        source: 'registry=https://u:pa%zz@host/\n',
    },
    {
        name: 'a number setting with text',
        source: 'maxsockets=not-a-number\n',
    },
] as const;

const LINKED_NODE_FILES = {
    'actual/bin/node': '',
    'actual/etc/npmrc': 'registry=https://actual.example/\n',
    'linked/bin/.keep': '',
    'linked/etc/npmrc': 'registry=https://wrong.example/\n',
    'project/package.json': '{"private":true}',
};

const NPM_PREFIX_ENVIRONMENT = {
    PREFIX: undefined,
    npm_config_prefix: undefined,
    NPM_CONFIG_PREFIX: undefined,
    npm_config_globalconfig: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
    NPM_CONFIG_USERCONFIG: undefined,
    npm_config_registry: undefined,
    NPM_CONFIG_REGISTRY: undefined,
};

test.each([...NPMRC_REFUSALS])('an invalid .npmrc setting stops the registry read: $name', async ({ source }) => {
    await using sandbox = await testdir({ '.npmrc': source, 'package.json': '{"private":true}\n' });

    const error = await captureRejection(readRegistryEnvironment(sandbox.path));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
});

test('npm settings refer to private environment values and Bun receives the same registry', async () => {
    await using sandbox = await testdir({
        '.npmrc': 'registry=https://packages.example/\n',
        'package.json': '{"private":true}',
    });
    const environment = await readRegistryEnvironment(sandbox.path);
    expect(environment['BUN_CONFIG_REGISTRY']).toBe('https://packages.example/');
    const isolated: Record<string, string> = { npm_config_registry: 'https://packages.example/' };
    writeNpmrc(sandbox.path, isolated);
    expect(readFileSync(join(sandbox.path, '.npmrc'), 'utf8')).toBe('registry=${GSPOT_PACKAGE_SETTING_0}\n');
    expect(isolated).toStrictEqual({
        npm_config_registry: 'https://packages.example/',
        GSPOT_PACKAGE_SETTING_0: 'https://packages.example/',
    });
});

test.skipIf(isWindows)('npm reads the global registry beside the real Node executable behind a link', async () => {
    await using sandbox = await testdir(LINKED_NODE_FILES);
    const linkedNode = join(sandbox.path, 'linked/bin/node');
    await symlink('../../actual/bin/node', linkedNode);
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? linkedNode : null));
    using _environment = overrideEnvironment({
        ...NPM_PREFIX_ENVIRONMENT,
        npm_config_userconfig: join(sandbox.path, 'absent.npmrc'),
    });
    const environment = await readRegistryEnvironment(join(sandbox.path, 'project'));
    expect(environment['npm_config_registry']).toBe('https://actual.example/');
});
