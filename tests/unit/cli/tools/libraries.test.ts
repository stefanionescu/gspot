import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { unlink, symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import * as processes from '#cli/system/processes.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { buildProcessResult, buildInspectionContext } from '#tests/setup/builders.ts';
import { SYSTEM_PLUGIN_REPORTS, PACKAGE_METADATA_FAILURES } from '#tests/data/install/installation.ts';

test('a library is found only in the tool project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });
    expect(
        inspectTool(buildInspectionContext(sandbox.path), {
            name: 'globals',
            kind: 'library' as const,
            version: '17.12.0',
            installers: { npm: { name: 'globals', version: '17.12.0' } },
        }).state,
    ).toBe('ok');
    expect(
        inspectTool(buildInspectionContext(sandbox.path), {
            name: 'eslint-plugin-n',
            kind: 'library' as const,
            version: '18.3.0',
            installers: { npm: { name: 'eslint-plugin-n', version: '18.3.0' } },
        }).state,
    ).toBe('missing');
});

test('a library that is absent is missing, and one off its pin is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
    });
    const absent = inspectTool(buildInspectionContext(sandbox.path), {
        name: 'eslint-plugin-regexp',
        kind: 'library' as const,
        version: '3.3.0',
        installers: { npm: { name: 'eslint-plugin-regexp', version: '3.3.0' } },
    });
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const laterVersion = inspectTool(buildInspectionContext(sandbox.path), {
        name: 'typescript',
        kind: 'library' as const,
        version: '5.9.3',
        installers: { npm: { name: 'typescript', version: '5.9.3' } },
    });
    expect(laterVersion.state).toBe('newer');
    expect(laterVersion.found).toBe('6.0.0');
});

test('a system library is read from the chosen project, not from the tool project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
        'app/package.json': '{}',
    });
    const tool = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), '@vitest/coverage-v8');
    const context = buildInspectionContext(sandbox.path, { cwd: join(sandbox.path, 'app') });
    expect(inspectTool(context, tool)).toMatchObject({ name: tool.name, state: 'missing' });
    await using project = await testdir();
    const selected = buildInspectionContext(project.path, { cwd: join(project.path, 'app') });
    await createFileTree(project.path, {
        'app/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
    });
    expect(inspectTool(selected, tool)).toMatchObject({
        name: tool.name,
        state: 'system',
        found: '4.1.11',
        path: join(project.path, 'app/node_modules/@vitest/coverage-v8/package.json'),
    });
    expect(inspectTool(buildInspectionContext(sandbox.path), tool).state).toBe('missing');
    await createFileTree(project.path, { 'app/node_modules/@vitest/coverage-v8/package.json': '{invalid' });
    expect(() => inspectTool(buildInspectionContext(project.path, { cwd: join(project.path, 'app') }), tool)).toThrow(
        'package.json is not valid JSON. Fix the file.',
    );
});

test.each([...SYSTEM_PLUGIN_REPORTS])('a system plugin query classifies the $name report as $state', async (report) => {
    await using sandbox = await testdir();
    const tool = {
        ...getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), 'pytest-cov'),
        ...('pattern' in report ? { version_pattern: report.pattern } : {}),
    };
    using _which = useExecutable('/native/pytest');
    using versionRun = spyOn(processes, 'spawnProcessBlocking').mockReturnValue(
        buildProcessResult({ code: report.code, stdout: report.stdout, missing: report.missing }),
    );
    const inspected = inspectTool(buildInspectionContext(sandbox.path, { cwd: join(sandbox.path, 'app') }), tool);
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
    const context = buildInspectionContext(sandbox.path);
    const tool = {
        name: 'globals',
        kind: 'library' as const,
        version: '17.12.0',
        installers: { npm: { name: 'globals', version: '17.12.0' } },
    };
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
        'gspot.toml': buildSettingsText([]),
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = {
        name: 'example',
        kind: 'library' as const,
        version: '1.0.0',
        installers: { npm: { name: 'example', version: '1.0.0' } },
    };
    expect(inspectTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(inspectTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(
        inspectTool(next, {
            name: 'example',
            kind: 'library' as const,
            version: '2.0.0',
            installers: { npm: { name: 'example', version: '2.0.0' } },
        }).state,
    ).toBe('outdated');
});

test.each([...PACKAGE_METADATA_FAILURES])(
    'a tool project library with a non-string $field is refused until it is fixed',
    async ({ field, manifest }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, '.gspot/node_modules/teller/package.json');
        const original = JSON.stringify(manifest);
        await createFileTree(sandbox.path, { '.gspot/node_modules/teller/package.json': original });
        const context = buildInspectionContext(sandbox.path);
        const tool = {
            name: 'teller',
            kind: 'library' as const,
            version: '5.0.1',
            installers: { npm: { name: 'teller', version: '5.0.1' } },
        };
        expect(() => inspectTool(context, tool)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path}: ${field}: Invalid input: expected string, received boolean. Fix the field.`,
            }),
        );
        expect(await Bun.file(path).text()).toBe(original);
        await Bun.write(path, '{"name":"teller","version":"5.0.1"}');
        expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    },
);
