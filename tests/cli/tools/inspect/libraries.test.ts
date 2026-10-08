import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { cp, realpath } from 'node:fs/promises';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';

test('library inspection reads native package metadata without executing an authored ESLint configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript']),
        'main.js': 'export const value = 1;\n',
        'eslint.config.mjs': 'throw new Error("Authored ESLint configuration executed during version inspection.");\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await cp(
        await realpath(join(sandbox.path, 'node_modules/eslint-config-prettier')),
        join(sandbox.path, '.gspot/node_modules/eslint-config-prettier'),
        { recursive: true },
    );
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'eslint-config-prettier');
    expect(pin.kind).toBe('library');
    expect(inspectTool(session, pin)).toMatchObject({
        name: 'eslint-config-prettier',
        state: 'ok',
        found: pin.version,
        path: join(sandbox.path, '.gspot/node_modules/eslint-config-prettier/package.json'),
    });
    expect(await Bun.file(join(sandbox.path, 'eslint.config.mjs')).text()).toBe(
        'throw new Error("Authored ESLint configuration executed during version inspection.");\n',
    );
});
