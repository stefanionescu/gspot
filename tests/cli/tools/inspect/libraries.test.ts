import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { cp, realpath } from 'node:fs/promises';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { HOST_PLUGIN_REPORTS } from '#tests/config/cli/tools/inspect.ts';

test('library inspection reads native package metadata without executing an authored ESLint configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript']),
        'main.js': 'export const value = 1;\n',
        'eslint.config.mjs': 'throw new Error("Authored ESLint configuration executed during version inspection.");\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await cp(
        await realpath(join(sandbox.path, 'node_modules/eslint-config-prettier')),
        join(sandbox.path, '.gspot/node_modules/eslint-config-prettier'),
        { recursive: true },
    );
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'eslint-config-prettier');
    expect(pin.kind).toBe('library');
    expect(inspectTool(session, pin)).toMatchObject({
        name: 'eslint-config-prettier',
        state: 'ok',
        found: pin.version,
        path: join(sandbox.path, '.gspot/node_modules/eslint-config-prettier/package.json'),
    });
    expect(await Bun.file(join(sandbox.path, 'eslint.config.mjs')).text()).toBe(
        'throw new Error("Authored ESLint configuration executed during version inspection.");\n',
    );
});

test('host library inspection uses the selected project and ignores a managed-only provider', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
        'app/package.json': '{}',
    });
    const tool = toolPin(configurationManifests().values(), '@vitest/coverage-v8');
    const context = { root: sandbox.path, cwd: join(sandbox.path, 'app'), inspections: new Map() };
    expect(inspectTool(context, tool)).toMatchObject({ name: tool.name, state: 'missing' });
    await using project = await testdir();
    const selected = { root: project.path, cwd: join(project.path, 'app'), inspections: new Map() };
    await createFileTree(project.path, {
        'app/node_modules/@vitest/coverage-v8/package.json': '{"name":"@vitest/coverage-v8","version":"4.1.11"}',
    });
    expect(inspectTool({ ...selected, inspections: new Map() }, tool)).toMatchObject({
        name: tool.name,
        state: 'host',
        found: '4.1.11',
        path: join(project.path, 'app/node_modules/@vitest/coverage-v8/package.json'),
    });
    expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool).state).toBe('missing');
    await createFileTree(project.path, { 'app/node_modules/@vitest/coverage-v8/package.json': '{invalid' });
    expect(() => inspectTool({ ...selected, inspections: new Map() }, tool)).toThrow();
});

test.each([...HOST_PLUGIN_REPORTS])('a host plugin query classifies the $name report as $state', async (report) => {
    await using sandbox = await testdir();
    const tool = {
        ...toolPin(configurationManifests().values(), 'pytest-cov'),
        ...('pattern' in report ? { version_pattern: report.pattern } : {}),
    };
    using _which = spyOn(executables, 'sync').mockReturnValue('/native/pytest');
    using _version = spyOn(processes, 'runBlocking').mockReturnValue({
        code: report.code,
        stdout: report.stdout,
        stderr: '',
        missing: report.missing,
        duration: 1,
    });
    const inspected = inspectTool({ root: sandbox.path, cwd: join(sandbox.path, 'app'), inspections: new Map() }, tool);
    expect(inspected.state).toBe(report.state);
    expect(_version).toHaveBeenCalledWith(
        ['/native/pytest', '--version', '--version'],
        expect.objectContaining({ cwd: join(sandbox.path, 'app') }),
    );
    if ('found' in report) expect(inspected.found).toBe(report.found);
    if ('note' in report) expect(inspected.note).toContain(report.note);
});

test('an empty host library query is an error without executing a guessed program', async () => {
    await using sandbox = await testdir();
    const tool = { ...toolPin(configurationManifests().values(), 'pytest-cov'), version_command: [] };
    using _version = spyOn(processes, 'runBlocking');
    expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
        name: 'pytest-cov',
        state: 'error',
        note: 'pytest-cov has no host version command.',
    });
    expect(_version).not.toHaveBeenCalled();
});
