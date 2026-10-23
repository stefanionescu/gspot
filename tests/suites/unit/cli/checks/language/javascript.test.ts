import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { generate } from '#cli/generation/generate.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { EMPTY_PROJECT_RESULT } from '#tests/config/checks/language/javascript.ts';

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
    expect(projects.map(({ path }) => path)).toStrictEqual([findConfigFilePath(session, 'jsconfig')]);
    await applyGeneratedFiles(sandbox.path);
    const reopened = await openSession(sandbox.path);
    const site = planChecks(reopened, {
        stage: 'push',
        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((check) => check.scope.folder.path === 'site')!;
    expect(await runCheckCode(reopened, site, findCheckCode(site.check))).toMatchObject(EMPTY_PROJECT_RESULT);
});
