import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { svelteCheck } from '#cli/checks/svelte.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';

test.each([
    { scope: '', typescript: false },
    { scope: '', typescript: true },
    { scope: 'app', typescript: false },
    { scope: 'app', typescript: true },
])('Svelte selects only its scoped generated TypeScript target: %j', async ({ scope, typescript }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = ["svelte"${typescript ? ', "typescript"' : ''}]\n[[scope]]\npath = "app"\n`,
        'Component.svelte': '<p>Root</p>\n',
        'app/Component.svelte': '<p>Nested</p>\n',
    });
    const session = await openSession(sandbox.path);
    const version = session.manifests.get('svelte')!.tools.find((tool) => tool.name === 'svelte-check')!.version!;
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/svelte-check/package.json': JSON.stringify({ name: 'svelte-check', version }),
        '.gspot/node_modules/.bin/svelte-check': `#!${process.execPath}\nconsole.log(${JSON.stringify(version)});\n`,
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/.bin/svelte-check'), 0o755);
    const input = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === scope)!,
        spec: session.manifests.get('svelte')!.checks.find((check) => check.name === 'svelte/check')!,
        files: session.repository.files,
    });
    const spawn = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        missing: false,
        stdout: '',
        stderr: '',
        duration: 1,
    });
    try {
        expect(await svelteCheck(input)).toStrictEqual([]);
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(spawn.mock.calls[0]![0].slice(1)).toStrictEqual([
            '--workspace',
            '.',
            '--output',
            'machine-verbose',
            '--fail-on-warnings',
            ...(typescript ? ['--tsconfig', join(sandbox.path, '.gspot/config', scope, 'tsconfig.check.json')] : []),
        ]);
        expect(spawn.mock.calls[0]![1].cwd).toBe(join(sandbox.path, scope));
    } finally {
        spawn.mockRestore();
    }
});
