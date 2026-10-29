import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { writeNpmrc, readRegistryEnvironment } from '#cli/installers/npm/registry.ts';
import { INSECURE_TLS_MESSAGE, SETTINGS_FILE_MESSAGE } from '#cli/config/installers/npm/registry.ts';
import { NPMRC_REFUSALS, LINKED_NODE_FILES, NPM_PREFIX_ENVIRONMENT } from '#tests/config/installers/npm/registry.ts';

test.each([...NPMRC_REFUSALS])(
    'an invalid .npmrc setting stops the registry read with $message',
    async ({ source, message }) => {
        await using sandbox = await testdir({ '.npmrc': source, 'package.json': '{"private":true}\n' });

        const error = await captureRejection(readRegistryEnvironment(sandbox.path));
        expect(error).toMatchObject({ name: 'GspotError', code: 'install', message });
    },
);

test('npm settings refer to private environment values and Bun receives the same registry', async () => {
    await using sandbox = await testdir({
        'user.npmrc': 'registry=https://packages.example/\n',
        'package.json': '{"private":true}',
    });
    using _environment = overrideEnvironment({ npm_config_userconfig: join(sandbox.path, 'user.npmrc') });
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

test('the tool install reads only the scope registries of the repository .npmrc', async () => {
    await using sandbox = await testdir({
        '.npmrc': 'registry=https://other.example/\nstrict-ssl=false\n@team:registry=https://team.example/\n',
        'user.npmrc': 'registry=https://packages.example/\n',
        'package.json': '{"private":true}',
    });
    using _environment = overrideEnvironment({ npm_config_userconfig: join(sandbox.path, 'user.npmrc') });
    const environment = await readRegistryEnvironment(sandbox.path);
    expect(environment).toMatchObject({
        npm_config_registry: 'https://packages.example/',
        'npm_config_@team:registry': 'https://team.example/',
        'npm_config_strict-ssl': 'true',
    });
});

test.each([
    { files: { '.npmrc': 'userconfig=user.npmrc\n' }, message: SETTINGS_FILE_MESSAGE },
    { files: { 'user.npmrc': 'strict-ssl=false\n' }, message: INSECURE_TLS_MESSAGE },
])('npm settings that the tool install refuses stop the registry read with $message', async ({ files, message }) => {
    await using sandbox = await testdir({ ...files, 'package.json': '{"private":true}' });
    using _environment = overrideEnvironment({ npm_config_userconfig: join(sandbox.path, 'user.npmrc') });
    const error = await captureRejection(readRegistryEnvironment(sandbox.path));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install', message });
});

test.skipIf(isWindows)('npm reads the global registry beside the real Node executable behind a link', async () => {
    await using sandbox = await testdir(LINKED_NODE_FILES);
    const linkedNode = join(sandbox.path, 'linked/bin/node');
    await symlink('../../actual/bin/node', linkedNode);
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? linkedNode : undefined));
    using _environment = overrideEnvironment({
        ...NPM_PREFIX_ENVIRONMENT,
        npm_config_userconfig: join(sandbox.path, 'absent.npmrc'),
    });
    const environment = await readRegistryEnvironment(join(sandbox.path, 'project'));
    expect(environment['npm_config_registry']).toBe('https://actual.example/');
});
