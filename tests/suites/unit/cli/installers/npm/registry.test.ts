import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { NPMRC_REFUSALS } from '#tests/config/installers/npm/registry.ts';
import { writeNpmrc, readRegistryEnvironment } from '#cli/installers/npm/registry.ts';

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
