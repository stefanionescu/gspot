import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkjs } from '#cli/checks/language/javascript/tsc.ts';

test('a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[agent_rules]\nenabled = false\n[[scope]]\npath = "site"\nconfigurations = ["javascript"]\n',
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = emitAll(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/config/jsconfig.json']);
    for (const project of projects) await Bun.write(join(sandbox.path, project.path), project.content);
    const reopened = await openSession(sandbox.path);
    const [root] = planRun(reopened, { stage: 'push', skips: [], only: ['javascript/tsc'] });
    // Saved scope policy can outlive its JavaScript inputs and generated compiler configuration.
    const site = { ...root!, scope: reopened.scopes.find((entry) => entry.scope.path === 'site')!, files: [] };
    expect(await checkjs(reopened, site)).toMatchObject({
        check: 'javascript/tsc',
        scope: 'site',
        status: 'passed',
        fileCount: 0,
        findings: [],
    });
});
