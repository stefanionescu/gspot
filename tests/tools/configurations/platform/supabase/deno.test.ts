import executables from 'which';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { buildToolsPath } from '#tests/harness/install.ts';

test('pinned Deno reports its lint finding and passes after the fix in a scoped edge function', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[scope."apps/api"]\nconfigurations = ["supabase"]\n' }),
        'apps/api/supabase/functions/hello/index.ts': 'export function greet(value: any) { return value; }\n',
    });
    const native = Bun.which('deno', { PATH: buildToolsPath(['deno']) });
    if (native === null) throw new Error('Pinned Deno is required for this integration test.');
    const which = executables.sync;
    const executableLookup = spyOn(executables, 'sync').mockImplementation(((name: string) =>
        name === 'deno' ? native : which(name, { nothrow: true })) as typeof executables.sync);
    try {
        const session = await openSession(sandbox.path);
        const selected = checkInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === 'apps/api')!,
            check: session.manifests.get('supabase')!.checks.find((check) => check.name === 'supabase/deno-lint')!,
            files: session.repository.files,
        });
        expect(await BUILT_IN_CHECKS['supabase/deno-lint'].input(selected)).toMatchObject([
            {
                check: 'supabase/deno-lint',
                file: 'apps/api/supabase/functions/hello/index.ts',
                line: 1,
                rule: 'no-explicit-any',
            },
        ]);
        await writeFile(
            join(sandbox.path, 'apps/api/supabase/functions/hello/index.ts'),
            'export function greet(value: string) { return value; }\n',
        );
        expect(await BUILT_IN_CHECKS['supabase/deno-lint'].input(selected)).toStrictEqual([]);
    } finally {
        executableLookup.mockRestore();
    }
});
