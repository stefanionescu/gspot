import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildToolSearch } from '#tests/setup/cli/tools.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { SYSTEM_PLUGIN_REPORTS, PACKAGE_METADATA_FAILURES } from '#tests/config/tools/inspect.ts';

test('a library is found only in the tool project', async () => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/globals/package.json`]: '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });

    expect(inspectTool(buildToolSearch(sandbox.path), buildLibraryPin('globals', '17.12.0')).state).toBe('ok');
    expect(inspectTool(buildToolSearch(sandbox.path), buildLibraryPin('eslint-plugin-n', '18.3.0')).state).toBe(
        'missing',
    );
});

test('a library that is absent is missing, and one off its pin is reported', async () => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/typescript/package.json`]: '{"name":"typescript","version":"6.0.0"}',
    });

    const absent = inspectTool(buildToolSearch(sandbox.path), buildLibraryPin('eslint-plugin-regexp', '3.3.0'));
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const laterVersion = inspectTool(buildToolSearch(sandbox.path), buildLibraryPin('typescript', '5.9.3'));
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
    expect(inspectTool(context, tool)).toMatchObject({ name: tool.name, state: 'missing' });
    await using project = await testdir();
    const selected = buildToolSearch(project.path, { cwd: join(project.path, 'app') });
    await createFileTree(project.path, {
        'app/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
    });
    expect(inspectTool(selected, tool)).toMatchObject({
        name: tool.name,
        state: 'system',
        found: '4.1.11',
        path: join(project.path, 'app/node_modules/@vitest/coverage-v8/package.json'),
    });
    expect(inspectTool(buildToolSearch(sandbox.path), tool).state).toBe('missing');
    await createFileTree(project.path, { 'app/node_modules/@vitest/coverage-v8/package.json': '{invalid' });
    expect(() => inspectTool(buildToolSearch(project.path, { cwd: join(project.path, 'app') }), tool)).toThrow(
        'package.json:1:2 is not valid JSON:',
    );
});

test.each([...SYSTEM_PLUGIN_REPORTS])('a system plugin query classifies the $name report', async (report) => {
    await using sandbox = await testdir();
    const tool = {
        ...getTool(readConfigurations().values(), 'pytest-cov'),
        ...('pattern' in report && { version_pattern: report.pattern }),
    };
    using _which = fakeExecutableLookup('/native/pytest');
    using versionRun = spyOn(processes, 'spawnProcessBlocking').mockReturnValue(
        buildProcessResult({ code: report.code, stdout: report.stdout, missing: report.missing }),
    );
    const inspected = inspectTool(buildToolSearch(sandbox.path, { cwd: join(sandbox.path, 'app') }), tool);
    expect(inspected).toStrictEqual({
        name: 'pytest-cov',
        path: '/native/pytest',
        help: tool.install_help!,
        ...report.inspection,
    });
    expect(versionRun).toHaveBeenCalledWith(
        ['/native/pytest', '--version', '--version'],
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
    const tool = buildLibraryPin('globals', '17.12.0');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '17.12.0' });
    await unlink(link);
    await symlink(outside.path, link);
    context.inspections.clear();
    expect(() => inspectTool(context, tool)).toThrow(
        new Error(
            `${GSPOT_PATHS.nodeModules}/globals/package.json links to a file outside the repository. Replace the link with the file.`,
        ),
    );
});

test('library reads are kept per session and see a new install in the next session', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });

    const session = await openSession(sandbox.path);
    const pin = buildLibraryPin('example', '1.0.0');
    expect(inspectTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/example/package.json`]: '{"name":"example","version":"1.0.0"}',
    });
    expect(inspectTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(inspectTool(next, buildLibraryPin('example', '2.0.0')).state).toBe('outdated');
});

test.each([...PACKAGE_METADATA_FAILURES])(
    'a tool project library with a non-string $field is refused until it is fixed',
    async ({ field, packageJson }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, `${GSPOT_PATHS.nodeModules}/teller/package.json`);
        const previous = JSON.stringify(packageJson);
        await createFileTree(sandbox.path, { [`${GSPOT_PATHS.nodeModules}/teller/package.json`]: previous });
        const context = buildToolSearch(sandbox.path);
        const tool = buildLibraryPin('teller', '5.0.1');
        expect(() => inspectTool(context, tool)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path}: ${field}: Invalid input: expected string, received boolean. Fix the field.`,
            }),
        );
        await writeFile(path, '{"name":"teller","version":"5.0.1"}');
        expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    },
);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 8 calls in this file share it.
function buildLibraryPin(name: string, version: string): Tool {
    return { name, kind: 'library', version, installers: { npm: { name, version } } };
}
