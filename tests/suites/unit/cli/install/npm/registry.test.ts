import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readRegistryEnvironment } from '#cli/install/npm/registry.ts';
import { NPMRC_REFUSALS } from '#tests/config/install/npm/registry.ts';

test.each([...NPMRC_REFUSALS])(
    'an invalid .npmrc setting stops the registry read with $message',
    async ({ source, message }) => {
        await using sandbox = await testdir({ '.npmrc': source, 'package.json': '{"private":true}\n' });

        expect(await captureRejection(readRegistryEnvironment(sandbox.path))).toBe(message);
        expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    },
);
