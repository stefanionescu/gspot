import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { javascriptTsc } from '#cli/checks/language/typescript/tsc.ts';

test('a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: '[[scope]]\npath = "site"\nconfigurations = ["javascript"]\n',
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = generate(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/config/jsconfig.json']);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    const reopened = await openSession(sandbox.path);
    const site = planRun(reopened, {
        stage: 'push',

        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((entry) => entry.scope.scope.path === 'site')!;
    expect(await javascriptTsc(reopened, site)).toMatchObject({
        check: 'javascript/tsc',
        scope: 'site',
        status: 'passed',
        fileCount: 0,
        findings: [],
    });
});
