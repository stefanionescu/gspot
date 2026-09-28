import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { initCommand } from '#cli/commands/init/command.ts';
import { initPlanText } from '#cli/commands/init/plan/text.ts';
import type { TakeoverPlan } from '#cli/types/commands/init.ts';

test.each(['bitbucket-pipelines.yml', 'Jenkinsfile', ''])(
    'no-workflow guidance includes setup and failed-job reports for %s',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, path === '' ? { 'README.md': 'Example\n' } : { [path]: '{}\n' });
        const result = await initCommand({
            cwd: sandbox.path,
            yes: true,
            isDryRun: true,
            json: true,
            configurations: ['none'],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: false,
        });
        expect(result.exitCode).toBe(0);
        const { plan } = result.json as { plan: TakeoverPlan };
        expect(plan.ci?.commands).toStrictEqual([
            'npm install --global "gspot@$(cat .gspot/version)"',
            'gspot install',
            'gspot check',
        ]);
        const text = initPlanText(plan);
        expect(text).toContain('Upload .gspot/reports/report.* as job artifacts');
        expect(text).toContain('including when it fails');
        expect(plan.retained.map((entry) => entry.path)).toStrictEqual(path === '' ? [] : [path]);
    },
);
