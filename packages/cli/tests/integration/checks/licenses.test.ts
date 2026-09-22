import { rejects } from 'node:assert/strict';
import { test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { licensesNpm } from '#cli/checks/licenses.ts';
import { openSession } from '#cli/run/session.ts';
import type { EngineInput } from '#cli/run/types.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'licenses/npm')!;
    return { session, root, scope: '', view: selected.view, spec, files: session.repository.files };
}

test('license analysis refuses absent dependencies instead of reporting a successful scan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["licenses"]\n',
        'package.json': '{"name":"example","private":true}',
    });
    await rejects(licensesNpm(await input(sandbox.path)), {
        message: 'Dependency licenses cannot be checked before installing the project dependencies.',
    });
});
