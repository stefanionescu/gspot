import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkJavascript } from '#cli/checks/language/javascript/tsc.ts';

test('a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['javascript'],
            '[guides]\ninstall = false\n[[scope]]\npath = "site"\nkits = ["javascript"]\n',
        ),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = emitted(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    for (const project of projects) await Bun.write(join(sandbox.path, project.path), project.content);
    const reopened = await openSession(sandbox.path);
    const [root] = planRun(reopened, { stage: 'push', skips: [], only: ['javascript/tsc'] });
    // A policy change plans the check in every scope, including one with no JavaScript file.
    const site = { ...root!, scope: reopened.scopes.find((entry) => entry.scope.path === 'site')!, files: [] };
    expect(await checkJavascript(reopened, site)).toMatchObject({
        check: 'javascript/tsc',
        scope: 'site',
        status: 'ok',
        files: 0,
        findings: [],
    });
});
