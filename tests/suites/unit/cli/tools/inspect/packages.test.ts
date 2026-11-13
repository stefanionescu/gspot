import { mkdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import * as processes from '#cli/system/processes.ts';
import { findMissingDependencies, inspectTool } from '#cli/tools/inspect.ts';
import { SYSTEM_PLUGIN_REPORTS } from '#tests/config/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildToolSearch } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('a system library is read from the requested project, not from the tool project', async () => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/@vitest/coverage-v8/package.json`]:
            '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
        'app/package.json': '{}',
    });

    const tool = getTool(readConfigurations().values(), '@vitest/coverage-v8');
    const context = buildToolSearch(sandbox.path, { cwd: join(sandbox.path, 'app') });
    expect(await inspectTool(context, tool)).toMatchObject({ name: tool.name, state: 'missing' });
    await using project = await testdir();
    const selected = buildToolSearch(project.path, { cwd: join(project.path, 'app') });
    await createFileTree(project.path, {
        'app/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
    });
    expect(await inspectTool(selected, tool)).toMatchObject({
        name: tool.name,
        state: 'system',
        found: '4.1.11',
        path: join(project.path, 'app/node_modules/@vitest/coverage-v8/package.json'),
    });
});

test.each([...SYSTEM_PLUGIN_REPORTS])('a system plugin query classifies the $name report', async (report) => {
    await using sandbox = await testdir();
    const tool = getTool(readConfigurations().values(), 'pytest-cov');
    using _which = fakeExecutableLookup('/native/pytest');
    using versionRun = spyOn(processes, 'runProcess').mockResolvedValue(
        buildProcessResult({ code: report.code, stdout: report.stdout }),
    );
    const inspected = await inspectTool(buildToolSearch(sandbox.path, { cwd: join(sandbox.path, 'app') }), tool);
    expect(inspected).toStrictEqual({
        name: 'pytest-cov',
        path: '/native/pytest',
        help: tool.install_help!,
        want: undefined,
        ...report.inspection,
        ...(report.noted !== undefined && { note: expect.stringContaining(report.noted) as string }),
    });
    expect(versionRun).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ cwd: join(sandbox.path, 'app') }),
    );
});

test('a library linked inside the tool project is accepted and one linked outside is refused', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/.store/globals/package.json`]: '{"name":"globals","version":"17.12.0"}',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"globals","version":"17.12.0"}' });
    const link = join(sandbox.path, `${GSPOT_PATHS.nodeModules}/globals`);
    await symlink('.store/globals', link);
    const context = buildToolSearch(sandbox.path);
    const tool = {
        name: 'globals',
        kind: 'package' as const,
        version: '17.12.0',
        installers: { npm: { name: 'globals', version: '17.12.0' } },
    };
    expect(await inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '17.12.0' });
    await unlink(link);
    await symlink(outside.path, link);
    expect(await captureRejection(inspectTool(context, tool))).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
    });
});

test('a tool project library with a non-string version is refused until it is fixed', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, `${GSPOT_PATHS.nodeModules}/teller/package.json`);
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/teller/package.json`]: '{"name":"teller","version":false}',
    });
    const context = buildToolSearch(sandbox.path);
    const tool = {
        name: 'teller',
        kind: 'package' as const,
        version: '5.0.1',
        installers: { npm: { name: 'teller', version: '5.0.1' } },
    };
    expect(await captureRejection(inspectTool(context, tool))).toMatchObject({
        name: 'GspotError',
        code: 'parse',
        message: expect.stringContaining(`${GSPOT_PATHS.nodeModules}/teller/package.json: version`) as string,
    });
    await writeFile(path, '{"name":"teller","version":"5.0.1"}');
    expect(await inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
});

test('a check that needs the dependencies of its scope is missing until its folder or one around it holds node_modules, and a scope of only gspot packages needs none', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module","dependencies":{"zod":"4.0.0"}}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'source.ts': 'export const value = 1;\n',
        'app/package.json': '{"private":true,"dependencies":{"zod":"4.0.0"}}',
        'tools/package.json': '{"private":true,"devDependencies":{"@gspothq/cli":"0.0.0-test"}}',
    });
    const session = await openSession(sandbox.path);
    const planned = session.configuredChecks.find(({ check }) => check.id === 'typescript/tsc')!;
    const planIn = (path: string) => ({ check: planned.check, scope: { ...planned.scope, path } });
    expect(findMissingDependencies(session, planned)).toStrictEqual({
        status: 'missing',
        note: 'Install the project dependencies first: node_modules is missing in the repository root.',
    });
    expect(findMissingDependencies(session, planIn('app'))).toMatchObject({ status: 'missing' });
    expect(findMissingDependencies(session, planIn('tools'))).toBeUndefined();
    await mkdir(join(sandbox.path, 'node_modules'));
    expect(findMissingDependencies(session, planned)).toBeUndefined();
    expect(findMissingDependencies(session, planIn('app'))).toBeUndefined();
});
