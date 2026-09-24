import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import type { Session } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import type { EngineInput } from '#cli/checks/input.ts';
import { denoLint } from '#cli/checks/supabase/deno.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';

function input(session: Session, scope: string, name: string): EngineInput {
    const spec = session.manifests.get('supabase')!.checks.find((check) => check.name === name)!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === scope)!,
        spec: spec,
        files: session.repository.files,
    });
}

test('pinned Deno reports a lint defect and accepts its correction in a scoped edge function', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n',
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
        expect(await denoLint(selected)).toStrictEqual([]);
        selected.cancelSignal = AbortSignal.abort();
        await rejects(denoLint(selected), { message: 'The command was canceled.' });
    } finally {
        resolution.mockRestore();
    }
});
