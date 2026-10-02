import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { initCommand } from '#cli/commands/init/command.ts';
import { initOptions } from '#tests/harness/planted/init.ts';
import type { ReplacePlan } from '#cli/types/commands/init.ts';
import { initPlanText } from '#cli/commands/init/plan/text.ts';

test.each(['bitbucket-pipelines.yml', 'Jenkinsfile', ''])(
    'no-workflow guidance includes setup and failed-job reports for %s',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, path === '' ? { 'README.md': 'Example\n' } : { [path]: '{}\n' });
        const result = await initCommand(
            initOptions(sandbox.path, {
                isDryRun: true,
                kits: ['none'],
                hooks: 'none',
                runner: 'none',
                ci: 'none',
                rules: 'no',
            }),
        );
        expect(result.exitCode).toBe(0);
        const { plan } = result.json as { plan: ReplacePlan };
        expect(initPlanText(plan)).toContain('gspot install');
        expect(plan.retained.map((entry) => entry.path)).toStrictEqual(path === '' ? [] : [path]);
    },
);
