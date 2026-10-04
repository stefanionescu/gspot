import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildInitOptions } from '#tests/harness/init.ts';
import { initPlanText } from '#cli/commands/init/plan.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { initCommand } from '#cli/commands/init/command.ts';

test.each(['bitbucket-pipelines.yml', 'Jenkinsfile', ''])(
    'no-workflow guidance includes setup and failed-job reports for %s',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, path === '' ? { 'README.md': 'Example\n' } : { [path]: '{}\n' });
        const result = await initCommand(
            buildInitOptions(sandbox.path, {
                isDryRun: true,
                configurations: ['none'],
                hooks: false,
                runner: 'none',
                ci: 'none',
                rules: false,
            }),
        );
        expect(result.exitCode).toBe(0);
        const { plan } = result.json as Required<Pick<InitJson, 'plan'>>;
        expect(initPlanText(plan)).toContain('gspot install');
        expect(plan.retained.map((entry) => entry.path)).toStrictEqual(path === '' ? [] : [path]);
    },
);
