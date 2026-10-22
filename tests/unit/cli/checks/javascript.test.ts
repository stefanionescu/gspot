import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EMPTY_PROJECT_RESULT } from '#tests/data/checks/javascript.ts';

test('a scope whose jsconfig lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'site', configurations: ['javascript'] }],
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });

    const session = await openSession(sandbox.path);
    const projects = generate(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/configurations/language/javascript/jsconfig.json']);
    {
        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), writer);
    }
    const reopened = await openSession(sandbox.path);
    const site = planChecks(reopened, {
        stage: 'push',
        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((entry) => entry.scope.folder.path === 'site')!;
    expect(await runCheckCode(reopened, site, findCheckCode(site.check))).toMatchObject(EMPTY_PROJECT_RESULT);
});
