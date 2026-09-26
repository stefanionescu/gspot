import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { createFileTree, testdir } from 'testdirs';
import type { EngineInput } from '#cli/checks/input.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/execution/session.ts';
import { functionFolders } from '#cli/checks/supabase/project.ts';
import { projectValid, storagePolicies } from '#cli/checks/supabase/config-checks.ts';

function input(session: Session, scope: string, name: string): EngineInput {
    const spec = session.manifests.get('supabase')!.checks.find((check) => check.name === name)!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === scope)!,
        spec: spec,
        files: session.repository.files,
    });
}

test('Supabase configurations and function discovery stay within nested project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["supabase"]\n[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n[scope.tools.supabase]\nfunctions_directory = "edge"\n',
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const root = input(session, '', 'supabase/config');
    const nested = input(session, 'apps/api', 'supabase/config');
    expect(functionFolders(root)).toStrictEqual(['supabase/functions/root']);
    expect(functionFolders(nested)).toStrictEqual(['apps/api/edge/hello']);
    expect(await projectValid(root)).toMatchObject([{ file: 'supabase/config.toml', line: 1, rule: 'function' }]);
    expect(await projectValid(nested)).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'supabase/config.toml'), '[functions.root]\nverify_jwt = true\n');
    expect(await projectValid(input(await openSession(sandbox.path), '', 'supabase/config'))).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'apps/api/supabase/config.toml'), '[broken');
    await rejects(storagePolicies(input(await openSession(sandbox.path), 'apps/api', 'supabase/config')), {
        message: /Cannot inspect storage policies/u,
    });
});
