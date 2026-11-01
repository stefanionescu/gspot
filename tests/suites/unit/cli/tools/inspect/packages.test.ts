import { join } from 'node:path';
import { getTool } from '#cli/tools/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildToolSearch } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SYSTEM_PLUGIN_REPORTS, PACKAGE_METADATA_FAILURES } from '#tests/config/tools/versions.ts';

test('a library is found only in the tool project', async () => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/globals/package.json`]: '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });

    expect(
        await inspectTool(buildToolSearch(sandbox.path), {
            name: 'globals',
            kind: 'package' as const,
            version: '17.12.0',
            installers: { npm: { name: 'globals', version: '17.12.0' } },
        }),
    ).toMatchObject({ state: 'ok' });
    expect(
        await inspectTool(buildToolSearch(sandbox.path), {
            name: 'eslint-plugin-n',
            kind: 'package' as const,
            version: '18.3.0',
            installers: { npm: { name: 'eslint-plugin-n', version: '18.3.0' } },
        }),
    ).toMatchObject({ state: 'missing' });
});

test('an absent library is missing, and one above its pin is newer', async () => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/typescript/package.json`]: '{"name":"typescript","version":"6.0.0"}',
    });

    const absent = await inspectTool(buildToolSearch(sandbox.path), {
        name: 'eslint-plugin-regexp',
        kind: 'package' as const,
        version: '3.3.0',
        installers: { npm: { name: 'eslint-plugin-regexp', version: '3.3.0' } },
    });
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const laterVersion = await inspectTool(buildToolSearch(sandbox.path), {
        name: 'typescript',
        kind: 'package' as const,
        version: '0.0.0-test',
        installers: { npm: { name: 'typescript', version: '0.0.0-test' } },
    });
    expect(laterVersion.state).toBe('newer');
    expect(laterVersion.found).toBe('6.0.0');
});

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
    expect(await inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({ state: 'missing' });
    await createFileTree(project.path, { 'app/node_modules/@vitest/coverage-v8/package.json': '{invalid' });
    const search = buildToolSearch(project.path, { cwd: join(project.path, 'app') });
    const failure = await captureRejection(inspectTool(search, tool));
    expect(failure.message).toContain('package.json:1:2 is not valid JSON:');
});

test.each([...SYSTEM_PLUGIN_REPORTS])('a system plugin query classifies the $name report', async (report) => {
    await using sandbox = await testdir();
    const tool = getTool(readConfigurations().values(), 'pytest-cov');
    using _which = fakeExecutableLookup('/native/pytest');
    using versionRun = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({ code: report.code, stdout: report.stdout, missing: report.missing }),
    );
    const inspected = await inspectTool(buildToolSearch(sandbox.path, { cwd: join(sandbox.path, 'app') }), tool);
    expect(inspected).toStrictEqual({
        name: 'pytest-cov',
        path: '/native/pytest',
        help: tool.install_help!,
        want: undefined,
        ...report.inspection,
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
        message: `${GSPOT_PATHS.nodeModules}/globals/package.json links to a file outside the repository. Replace the link with the file.`,
    });
});

test('library reads are kept per session and see a new install in the next session', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });

    const session = await openSession(sandbox.path);
    const pin = {
        name: 'example',
        kind: 'package' as const,
        version: '1.0.0',
        installers: { npm: { name: 'example', version: '1.0.0' } },
    };
    expect(await inspectTool(session, pin)).toMatchObject({ state: 'missing' });
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/example/package.json`]: '{"name":"example","version":"1.0.0"}',
    });
    const next = await openSession(sandbox.path);
    expect(await inspectTool(next, pin)).toMatchObject({ state: 'ok' });
    expect(
        await inspectTool(next, {
            name: 'example',
            kind: 'package' as const,
            version: '2.0.0',
            installers: { npm: { name: 'example', version: '2.0.0' } },
        }),
    ).toMatchObject({ state: 'outdated' });
});

test.each([...PACKAGE_METADATA_FAILURES])(
    'a tool project library with a non-string $field is refused until it is fixed',
    async ({ field, packageJson }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, `${GSPOT_PATHS.nodeModules}/teller/package.json`);
        const previous = JSON.stringify(packageJson);
        await createFileTree(sandbox.path, { [`${GSPOT_PATHS.nodeModules}/teller/package.json`]: previous });
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
            message: `${GSPOT_PATHS.nodeModules}/teller/package.json: ${field}: Invalid input: expected string, received boolean. Fix the field.`,
        });
        await writeFile(path, '{"name":"teller","version":"5.0.1"}');
        expect(await inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    },
);
