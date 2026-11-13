import { existsSync } from 'node:fs';
import { readFile, symlink, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { formatUnavailableNote, inspectTool } from '#cli/tools/programs/inspect.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeExecutableLookup, fakeNpmPackage, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';

test('tool inspection finds the project compiler, and the repository compiler from a copy', async () => {
    await using sandbox = await testdir({
        'work/package.json': '{"private":true}',
        'snapshot/.gspot/package.json': '{}',
    });

    const work = join(sandbox.path, 'work');
    const snapshot = join(sandbox.path, 'snapshot');
    await linkTypescript(join(work, GSPOT_PATHS.nodeModules));
    await linkTypescript(join(work, 'node_modules'));
    const compiler = getTool(readConfigurations().values(), 'tsc');
    const projectPath = join(work, 'node_modules/typescript/package.json');
    const project = parseJsonFile(projectPath, await readFile(projectPath, 'utf8'), packageJsonSchema);
    expect(await inspectTool(buildToolSearch(work), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
    expect(await inspectTool(buildToolSearch(snapshot, { toolsRoot: work }), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
});

test('a mise-pinned program in the repository node_modules or .venv is missing and does not run', async () => {
    await using sandbox = await testdir();
    const tool = getTool(readConfigurations().values(), 'gitleaks');
    const version = ['--line', tool.version!];
    await writeProgramCommand(
        sandbox.path,
        'node_modules/.bin/gitleaks',
        'fakes/tool',
        '--write',
        'npm-ran=',
        ...version,
    );
    const venv = buildVenvExecutablePath('.venv', 'gitleaks');
    await writeProgramCommand(sandbox.path, venv, 'fakes/tool', '--write', 'venv-ran=', ...version);
    using _which = fakeExecutableLookup(null);
    const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(inspection.state).toBe('missing');
    expect(existsSync(join(sandbox.path, 'npm-ran'))).toBe(false);
    expect(existsSync(join(sandbox.path, 'venv-ran'))).toBe(false);
});

test('a program on PATH wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'active/tsc', 'fakes/tool', '--line', '0.0.0-test');
    await writeProgramCommand(sandbox.path, 'mise/shims/tsc', 'fakes/tool', '--line', '1.0.0');
    const active = join(sandbox.path, 'active', isWindows ? 'tsc.cmd' : 'tsc');
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = fakeExecutableLookup(active);
    const inspection = await inspectTool(buildToolSearch(sandbox.path), getTool(readConfigurations().values(), 'tsc'));
    expect(inspection.state).toBe('system');
    expect(inspection.path).toBe(active);
});

test('a pinned program whose only executable is a mise shim that mise cannot resolve gives the mise error', async () => {
    await using sandbox = await testdir({ 'work/.keep': '' });
    const root = sandbox.path;
    const failure = ['--stderr', 'mise ERROR Config files are not trusted.', '--exit', '1'];
    await writeProgramCommand(root, 'mise/shims/vale', 'fakes/tool', ...failure);
    await writeProgramCommand(root, 'bin/mise', 'fakes/tool', ...failure);
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(root, 'mise') });
    using _which = fakeExecutableLookup((name) =>
        join(root, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`),
    );
    const inspection = await inspectTool(buildToolSearch(join(root, 'work')), buildProgramPin('vale', '0.0.0-test'));
    expect(inspection).toStrictEqual({
        name: 'vale',
        state: 'missing',
        want: '0.0.0-test',
        help: expect.any(String) as string,
        note: expect.stringContaining('mise ERROR Config files are not trusted.') as string,
    });
});

test('a tool project program linked outside the repository is refused before it runs', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const binary = join(root, `${GSPOT_PATHS.nodeModules}/.bin/teller`);
    await createFileTree(root, { [`${GSPOT_PATHS.nodeModules}/.bin/.keep`]: '' });
    await writeProgramCommand(root, `${GSPOT_PATHS.nodeModules}/teller/run.sh`, 'fakes/tool', '--line', '1.2.3');
    const ranMarker = join(sandbox.path, 'outside/ran');
    await writeProgramCommand(
        sandbox.path,
        'outside/teller',
        'fakes/tool',
        '--write',
        `${ranMarker}=`,
        '--line',
        '1.2.3',
    );
    await symlink('../../../../outside/teller', binary);
    const rejection = await captureRejection(inspectTool(buildToolSearch(root), buildProgramPin('teller', '1.2.3')));
    expect(rejection).toMatchObject({ name: 'GspotError', code: 'filesystem' });
    expect(existsSync(ranMarker)).toBe(false);
    await unlink(binary);
    await symlink('../teller/run.sh', binary);
    expect(await inspectTool(buildToolSearch(root), buildProgramPin('teller', '1.2.3'))).toMatchObject({ state: 'ok' });
});

test('a missing npm tool does not fall back to the program in the repository node_modules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': JSON.stringify({ name: 'teller', version: '5.0.1' }),
    });
    await writeProgramCommand(
        sandbox.path,
        'node_modules/.bin/teller',
        'fakes/tool',
        '--write',
        'fallback-ran=',
        '--line',
        '5.0.1',
    );
    const tool = buildProgramPin('teller', '5.0.1', 'teller');
    const missing = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(missing.state).toBe('missing');
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', toolArguments: ['--line', '5.0.1'] });
    expect(await inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('a Python tool uses the tool project environment, not the repository .venv', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(
        sandbox.path,
        buildVenvExecutablePath('.venv', 'teller'),
        'fakes/tool',
        '--write',
        'fallback-ran=',
        '--line',
        '1.2.3',
    );
    const tool = buildProgramPin('teller', '1.2.3');
    tool.installers.pypi = { name: 'teller', version: '1.2.3' };
    expect(await inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({ state: 'missing' });
    await writeProgramCommand(
        sandbox.path,
        buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'teller'),
        'fakes/tool',
        '--line',
        '1.2.3',
    );
    expect(await inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('a missing managed program names mise being absent from PATH instead of claiming the tool is uninstalled', async () => {
    await using sandbox = await testdir();
    using _lookup = fakeExecutableLookup(null);
    const tool = buildProgramPin('scanner', '0.0.0-test');
    const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(inspection.state).toBe('missing');
    const note = formatUnavailableNote(tool, inspection);
    expect(note).toStartWith('mise is not on PATH.');
    expect(note).not.toContain('is not installed');
});

test('a project tool names the install command of its package manager, or the missing install', async () => {
    const tool = getTool(readConfigurations().values(), 'vitest');
    using _which = fakeExecutableLookup(null);
    await using sandbox = await testdir({
        'pnpm-lock.yaml': '',
        'package.json': '{"packageManager":"pnpm@10.0.0"}',
        'app/package.json': '{"devDependencies":{"vitest":"4.0.0"}}',
    });
    const root = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(root.help).toBe('Run pnpm add --save-dev --save-exact vitest.');
    const inProject = await inspectTool(buildToolSearch(sandbox.path, { cwd: join(sandbox.path, 'app') }), tool);
    expect(inProject.help).toBe('Install the project dependencies first: node_modules is missing in app.');
});

test('a mise-pinned program keeps the refusal of the mise lookup when PATH holds only an older one', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'active/vale', 'fakes/tool', '--line', '0.0.1');
    using _which = fakeExecutableLookup(join(sandbox.path, 'active', isWindows ? 'vale.cmd' : 'vale'));
    const tool: Tool = {
        name: 'vale',
        kind: 'program',
        version: '3.0.0',
        installers: { mise: { name: 'vale', version: '3.0.0', checksums: {} } },
    };
    const refusal = 'gspot may not read the mise tool project.';
    const inspection = await inspectTool(buildToolSearch(sandbox.path, { miseFailure: refusal }), tool);
    expect(inspection.state).toBe('missing');
    expect(formatUnavailableNote(tool, inspection)).toBe(refusal);
});
