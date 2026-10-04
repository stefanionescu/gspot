import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { projectValid, functionFolders, storagePolicies } from '#cli/checks/platform/supabase.ts';

function input(session: Session, scope: string, name: string): EngineInput {
    const spec = session.manifests.get('supabase')!.checks.find((check) => check.name === name)!;
    return buildEngineInput(session, spec.name, { scope: scope });
}

test('Supabase configurations and function discovery stay within nested project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "edge"\n',
        }),
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
    expect(projectValid(root)).toMatchObject([{ file: 'supabase/config.toml', line: 1, rule: 'function' }]);
    expect(projectValid(nested)).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'supabase/config.toml'), '[functions.root]\nverify_jwt = true\n');
    expect(projectValid(input(await openSession(sandbox.path), '', 'supabase/config'))).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'apps/api/supabase/config.toml'), '[broken');
    const broken = input(await openSession(sandbox.path), 'apps/api', 'supabase/config');
    expect(projectValid(broken)).toMatchObject([{ file: 'apps/api/supabase/config.toml', line: 1, rule: 'syntax' }]);
    expect(await storagePolicies(broken)).toStrictEqual([]);
});
