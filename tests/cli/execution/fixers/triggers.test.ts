import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { mkdir, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { applyFixers } from '#cli/execution/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { projectChecks } from '#tests/harness/input.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { getStaged, getChanged } from '#cli/repository/revisions/public.ts';
import { NESTED_POLICY, PROJECT_OPTIONS, PROJECT_TRIGGERS } from '#tests/config/samples/commands.ts';

test.each(PROJECT_TRIGGERS)(
    'a last-file %s supports fixer preview and publication with %s selection',
    async (operation, selection) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': NESTED_POLICY,
            'api/source.ts': 'export {};\n',
            'web/kept.ts': 'export {};\n',
        });
        commitAll(sandbox.path);
        if (operation === 'delete') gitOutput(sandbox.path, ['rm', 'api/source.ts']);
        else gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
        await mkdir(join(sandbox.path, 'api'), { recursive: true });
        const session = await openSession(sandbox.path);
        projectChecks(session);
        const revision =
            selection === 'staged'
                ? await getStaged(sandbox.path).then(({ staged }) => ({ staged }))
                : await getChanged(sandbox.path, 'HEAD').then(({ paths }) => ({ changed: paths }));
        const api = planRun(session, { ...PROJECT_OPTIONS, ...revision }).find(
            (check) => check.scope.scope.path === 'api',
        )!;
        const preview = await applyFixers(session, [api], { checks: BUILT_IN_CHECKS, isDryRun: true });
        expect(preview.changed).toStrictEqual(['api/source.ts']);
        expect(await pathExists(join(sandbox.path, 'api/source.ts'))).toBe(false);
        const applied = await applyFixers(session, [api], { checks: BUILT_IN_CHECKS, isDryRun: false });
        expect(applied.changed).toStrictEqual(['api/source.ts']);
        expect(await readFile(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
    },
);
