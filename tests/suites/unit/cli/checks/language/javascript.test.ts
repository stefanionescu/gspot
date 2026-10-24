import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { generate } from '#cli/generation/generate.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runChecks, runCheckCode } from '#cli/commands/check/run.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { EMPTY_PROJECT_RESULT } from '#tests/config/checks/language/javascript.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';

test('javascript/tsc excludes type roots inherited from folders above the repository', async () => {
    await using sandbox = await testdir({
        'node_modules/@types/ancestor/index.d.ts': 'declare const outside: string;\n',
        'project/gspot.toml': buildSandboxSettings(['javascript']),
        'project/source.js': 'export const ready = true;\n',
    });
    const root = join(sandbox.path, 'project');
    await applyGeneratedFiles(root);
    await fakeNpmTool(root, 'tsc');
    using boundary = spyOn(processes, 'spawnProcess').mockImplementation(async (command) => {
        const path = command.find((argument) => argument.endsWith('jsconfig.json'))!;
        const config = JSON.parse(await readFile(path, 'utf8')) as TypeScriptConfiguration['raw'];
        expect(config.compilerOptions?.['typeRoots']).toStrictEqual([join(path, '../../../../../node_modules/@types')]);
        return buildProcessResult();
    });
    const result = await runChecks(await openSession(root), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(result.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    expect(boundary).toHaveBeenCalledTimes(1);
});

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
