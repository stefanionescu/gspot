import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects/tsconfig.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { runChecks, runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { EMPTY_PROJECT_RESULT, IMPORTED_AMBIENT_FILES } from '#tests/config/checks/language/javascript.ts';

test('javascript/tsc checks a stale jsconfig and skips an absent one with apply advice', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export const ready = true;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    await fakeNpmTool(sandbox.path, 'tsc');
    const session = await openSession(sandbox.path);
    const target = getConfigFilePath(session, 'jsconfig');
    const path = join(sandbox.path, target);
    const text = await readFile(path, 'utf8');
    await chmod(path, 0o644);
    await writeFile(path, text.replace('{', '{ '));
    using boundary = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['javascript/tsc', 'gspot/generated-files'] }),
    );
    expect(result.report.checks.find(({ check }) => check === 'javascript/tsc')).toMatchObject({
        status: 'passed',
        findings: [],
    });
    const drift = result.report.checks.find(({ check }) => check === 'gspot/generated-files');
    expect(drift?.status).toBe('failed');
    expect(drift?.findings.filter(({ file }) => file === target)).toMatchObject([{ file: target, rule: 'changed' }]);
    await unlink(path);
    const absent = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(absent.report.checks).toMatchObject([
        { status: 'missing', note: `The config file ${target} is missing. Run gspot apply.` },
    ]);
    expect(boundary).toHaveBeenCalledTimes(1);
});

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
        const config = JSON.parse(await readFile(path, 'utf8')) as ParsedTsconfig['raw'];
        expect(config.compilerOptions?.['typeRoots']).toStrictEqual([join(path, '../../../../../node_modules/@types')]);
        return buildProcessResult();
    });
    const session = await openSession(root);
    const planned = planChecks(session, buildRunOptions({ only: ['javascript/tsc'] }))[0]!;
    const result = await runCheckCode(buildCheckSession(session), planned, CHECK_CODE['javascript/tsc']);
    expect(result.findings).toStrictEqual([]);
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
    const projects = generateFiles(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual([getConfigFilePath(session, 'jsconfig')]);
    await applyGeneratedFiles(sandbox.path);
    const reopened = await openSession(sandbox.path);
    const site = planChecks(reopened, {
        stage: 'push',
        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((check) => check.scope.path === 'site')!;
    expect(
        await runCheckCode(
            buildCheckSession(reopened),
            site,
            site.check.generator_outputs === undefined ? CHECK_CODE[site.check.id] : { check: checkGeneratorOutputs },
        ),
    ).toStrictEqual(EMPTY_PROJECT_RESULT);
});

test('javascript/tsc of one named file copies its imported declarations and leaves other scopes apart', async () => {
    await using sandbox = await createGitSandbox({
        ...IMPORTED_AMBIENT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', scopes: [{ path: 'apps/web' }] }),
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    expect(
        await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope: 'apps/web', paths: ['apps/web/src/main.js'] }),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), 'export declare const amount: string;\n');
    const findings = await runSandboxCheck(sandbox.path, 'javascript/tsc', {
        scope: 'apps/web',
        paths: ['apps/web/src/main.js'],
    });
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'apps/web/src/main.js', line: 1, rule: 'TS2339' },
    ]);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), IMPORTED_AMBIENT_FILES['types/api.d.ts']);
    expect(
        await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope: 'apps/web', paths: ['apps/web/src/main.js'] }),
    ).toStrictEqual([]);
});

test('javascript/tsc puts incremental build information in the check copy', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'jsconfig.json': '{"compilerOptions":{"incremental":true,"types":[]},"include":["src"]}\n',
        'src/value.js': '/** @type {number} */ export const value = "wrong";\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const incremental = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    const first = incremental.report.checks[0]!;
    expect(first.status).toBe('failed');
    expect(first.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'src/value.js', rule: 'TS2322' },
    ]);
    const flag = first.command!.indexOf('--tsBuildInfoFile');
    expect(flag).toBeGreaterThan(-1);
    expect(first.command!.slice(flag, flag + 2)).toStrictEqual([
        '--tsBuildInfoFile',
        join(sandbox.path, '.gspot/jsconfig.check.tsbuildinfo'),
    ]);
    expect(
        await Array.fromAsync(
            new Bun.Glob('**/*.tsbuildinfo').scan({ cwd: sandbox.path, dot: true, followSymlinks: false }),
        ),
    ).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'jsconfig.json'),
        '{"compilerOptions":{"incremental":false,"types":[]},"include":["src"]}\n',
    );
    const ordinary = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(ordinary.report.checks[0]?.status).toBe('failed');
    expect(ordinary.report.checks[0]?.command).not.toContain('--tsBuildInfoFile');
    expect(
        await Array.fromAsync(
            new Bun.Glob('**/*.tsbuildinfo').scan({ cwd: sandbox.path, dot: true, followSymlinks: false }),
        ),
    ).toStrictEqual([]);
});
