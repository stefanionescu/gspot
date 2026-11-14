import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { getTool } from '#cli/manifests/tools.ts';
import { testdir, createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import * as processes from '#cli/system/processes/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildToolSearch } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { inspectTool } from '#cli/tools/programs/inspect.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { SYSTEM_PLUGIN_REPORTS } from '#tests/config/tools.ts';
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
