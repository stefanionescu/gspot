import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/find.ts';
import { unlink, symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildLibraryPin } from '#tests/setup/pins.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { SYSTEM_PLUGIN_REPORTS, PACKAGE_METADATA_FAILURES } from '#tests/config/tools.ts';

test('a library is found only in the tool project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });
    expect(
        inspectTool(
            {
                root: sandbox.path,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            buildLibraryPin('globals', '17.12.0'),
        ).state,
    ).toBe('ok');
    expect(
        inspectTool(
            {
                root: sandbox.path,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            buildLibraryPin('eslint-plugin-n', '18.3.0'),
        ).state,
    ).toBe('missing');
});

test('a library that is absent is missing, and one off its pin is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
    });
    const absent = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildLibraryPin('eslint-plugin-regexp', '3.3.0'),
    );
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const newer = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildLibraryPin('typescript', '5.9.3'),
    );
    expect(newer.state).toBe('newer');
    expect(newer.found).toBe('6.0.0');
});

test('a system library is read from the chosen project, not from the tool project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
        'app/package.json': '{}',
    });
    const tool = toolDeclaration(configurationManifests().values(), '@vitest/coverage-v8');
    const context = {
        root: sandbox.path,
        cwd: join(sandbox.path, 'app'),
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        inspections: new Map(),
    };
    expect(inspectTool(context, tool)).toMatchObject({ name: tool.name, state: 'missing' });
    await using project = await testdir();
    const selected = {
        root: project.path,
        cwd: join(project.path, 'app'),
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        inspections: new Map(),
    };
    await createFileTree(project.path, {
        'app/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
    });
    expect(inspectTool(selected, tool)).toMatchObject({
        name: tool.name,
        state: 'system',
        found: '4.1.11',
        path: join(project.path, 'app/node_modules/@vitest/coverage-v8/package.json'),
    });
    expect(
        inspectTool(
            {
                root: sandbox.path,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            tool,
        ).state,
    ).toBe('missing');
    await createFileTree(project.path, { 'app/node_modules/@vitest/coverage-v8/package.json': '{invalid' });
    expect(() =>
        inspectTool(
            {
                ...selected,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            tool,
        ),
    ).toThrow('package.json is not valid JSON. Fix the file, then run gspot apply.');
});

test.each([...SYSTEM_PLUGIN_REPORTS])('a system plugin query classifies the $name report as $state', async (report) => {
    await using sandbox = await testdir();
    const tool = {
        ...toolDeclaration(configurationManifests().values(), 'pytest-cov'),
        ...('pattern' in report ? { version_pattern: report.pattern } : {}),
    };
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? ['/native/pytest'] : '/native/pytest') as typeof executables.sync);
    using versionRun = spyOn(processes, 'spawnProcessBlocking').mockReturnValue({
        code: report.code,
        stdout: report.stdout,
        stderr: '',
        missing: report.missing,
        duration: 1,
    });
    const inspected = inspectTool(
        {
            root: sandbox.path,
            cwd: join(sandbox.path, 'app'),
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(inspected.state).toBe(report.state);
    expect(versionRun).toHaveBeenCalledWith(
        ['/native/pytest', '--version', '--version'],
        expect.objectContaining({ cwd: join(sandbox.path, 'app') }),
    );
    if ('found' in report) expect(inspected.found).toBe(report.found);
    if ('note' in report) expect(inspected.note).toContain(report.note);
});

test('a library linked inside the tool project is accepted and one linked outside is refused', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.store/globals/package.json': '{"name":"globals","version":"17.12.0"}',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"globals","version":"17.12.0"}' });
    const link = join(sandbox.path, '.gspot/node_modules/globals');
    await symlink('.store/globals', link);
    const context = {
        root: sandbox.path,
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        inspections: new Map(),
    };
    const tool = buildLibraryPin('globals', '17.12.0');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '17.12.0' });
    await unlink(link);
    await symlink(outside.path, link);
    context.inspections.clear();
    expect(() => inspectTool(context, tool)).toThrow('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"globals","version":"17.12.0"}');
});

test('library reads are kept per session and see a new install in the next session', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([]),
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = buildLibraryPin('example', '1.0.0');
    expect(inspectTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(inspectTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(inspectTool(next, buildLibraryPin('example', '2.0.0')).state).toBe('outdated');
});

test.each([...PACKAGE_METADATA_FAILURES])(
    'a tool project library with a non-string $field is refused until it is fixed',
    async ({ manifest }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, '.gspot/node_modules/teller/package.json');
        const original = JSON.stringify(manifest);
        await createFileTree(sandbox.path, { '.gspot/node_modules/teller/package.json': original });
        const context = {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        };
        const tool = buildLibraryPin('teller', '5.0.1');
        expect(() => inspectTool(context, tool)).toThrow(
            `${path} is not valid JSON. Fix the file, then run gspot apply.`,
        );
        expect(await Bun.file(path).text()).toBe(original);
        await Bun.write(path, '{"name":"teller","version":"5.0.1"}');
        expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    },
);
