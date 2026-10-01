import executables from 'which';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { denoLint } from '#cli/checks/supabase/deno.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

test('pinned Deno reports a lint defect and accepts its correction in a scoped edge function', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[[scope]]\npath = "apps/api"\nkits = ["supabase"]\n'),
        'apps/api/supabase/functions/hello/index.ts': 'export function greet(value: any) { return value; }\n',
    });
    const native = Bun.which('deno', { PATH: toolsPath(['deno']) });
    if (native === null) throw new Error('Pinned Deno is required for this integration test.');
    const which = executables.sync;
    const executableLookup = spyOn(executables, 'sync').mockImplementation(((name: string) =>
        name === 'deno' ? native : which(name, { nothrow: true })) as typeof executables.sync);
    try {
        const session = await openSession(sandbox.path);
        const selected = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === 'apps/api')!,
            spec: session.manifests.get('supabase')!.checks.find((check) => check.name === 'supabase/deno-lint')!,
            files: session.repository.files,
        });
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
        expect(await denoLint(selected)).toStrictEqual([]);
    } finally {
        executableLookup.mockRestore();
    }
});
