import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { toolsPath } from '../../../../../tests/harness/planted.ts';
import { openSession } from '#cli/run/session.ts';
import { denoLint } from '#cli/checks/supabase/deno.ts';
import { functionFolders } from '#cli/checks/supabase/project.ts';
import { projectValid, storagePolicies } from '#cli/checks/supabase/config-checks.ts';
import type { EngineInput, Session } from '#types/run.ts';

function input(session: Session, scope: string, name: string): EngineInput {
    const selected = session.scopes.find((entry) => entry.scope.path === scope)!;
    const spec = session.manifests.get('supabase')!.checks.find((check) => check.name === name)!;
    return { session, root: session.root, scope, spec, view: selected.view, files: session.repository.files };
}

test('Supabase configurations and function discovery stay within nested project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["supabase"]\n[[scope]]\npath = "apps/api"\npresets = ["supabase"]\n[scope.tools.supabase]\nfunctions_dir = "edge"\n',
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const root = input(session, '', 'supabase/config');
    const nested = input(session, 'apps/api', 'supabase/config');
    expect(functionFolders(root)).toEqual(['supabase/functions/root']);
    expect(functionFolders(nested)).toEqual(['apps/api/edge/hello']);
    expect(await projectValid(root)).toMatchObject([{ file: 'supabase/config.toml', line: 1, rule: 'function' }]);
    expect(await projectValid(nested)).toEqual([]);
    writeFileSync(join(sandbox.path, 'supabase/config.toml'), '[functions.root]\nverify_jwt = true\n');
    expect(await projectValid(root)).toEqual([]);
    writeFileSync(join(sandbox.path, 'apps/api/supabase/config.toml'), '[broken');
    await rejects(storagePolicies(nested), { message: /Cannot inspect storage policies/u });
});

test('pinned Deno reports a lint defect and accepts its correction in a scoped edge function', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[[scope]]\npath = "apps/api"\npresets = ["supabase"]\n',
        'apps/api/supabase/functions/hello/index.ts': 'export function greet(value: any) { return value; }\n',
    });
    const native = Bun.which('deno', { PATH: toolsPath(['deno']) });
    if (native === null) throw new Error('Pinned Deno is required for this integration test.');
    const which = Bun.which;
    const resolution = spyOn(Bun, 'which').mockImplementation((name, options) =>
        name === 'deno' ? native : which(name, options),
    );
    try {
        const session = await openSession(sandbox.path);
        const selected = input(session, 'apps/api', 'supabase/deno-lint');
        expect(await denoLint(selected)).toMatchObject([
            {
                check: 'supabase/deno-lint',
                file: 'apps/api/supabase/functions/hello/index.ts',
                line: 1,
                rule: 'no-explicit-any',
            },
        ]);
        writeFileSync(
            join(sandbox.path, 'apps/api/supabase/functions/hello/index.ts'),
            'export function greet(value: string) { return value; }\n',
        );
        expect(await denoLint(selected)).toEqual([]);
        session.cancelSignal = AbortSignal.abort();
        await rejects(denoLint(selected), { message: 'The command was canceled.' });
    } finally {
        resolution.mockRestore();
    }
});
