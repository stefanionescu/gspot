import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { getTool } from '#cli/tools/pins.ts';
import { testdir, createFileTree } from 'testdirs';
import type { Tool } from '#cli/types/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { unlink, symlink, readFile } from 'node:fs/promises';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { lookUpTool, inspectTool, formatUnavailableNote } from '#cli/tools/inspect.ts';
import { fakeCommands, fakeNpmPackage, writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

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

test('version reads and runs use the other tools of the tool folder', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, `${GSPOT_PATHS.nodeModules}/.bin/teller`, 'processes/command', 'companion');
    await writeProgramCommand(
        sandbox.path,
        `${GSPOT_PATHS.nodeModules}/.bin/companion`,
        'fakes/tool',
        '--line',
        '3.8.1',
    );
    await writeProgramCommand(sandbox.path, 'unrelated/companion', 'fakes/tool', '--line', '9.0.0');
    const env = { PATH: join(sandbox.path, 'unrelated') };
    const tool = buildProgramPin('teller', '3.8.1');
    const read = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const result = await runTool([read.path!], {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: sandbox.path,
        env,
    });
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('3.8.1');
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
    expect(inspection.path).toBeUndefined();
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

async function fakeMiseTsc(root: string, status: number) {
    const executable = join(root, 'mise/installs/tsc/0.0.0-test', isWindows ? 'tsc.cmd' : 'tsc');
    await writeProgramCommand(
        root,
        'mise/shims/tsc',
        'fakes/tool',
        '--stderr',
        'The shim must not run in a source copy.\n',
        '--exit',
        '1',
    );
    await writeProgramCommand(root, 'mise/installs/tsc/0.0.0-test/tsc', 'fakes/tool', '--line', '0.0.0-test');
    await writeProgramCommand(
        root,
        'bin/mise',
        'fakes/tool',
        '--require-cwd',
        join(root, 'work'),
        '--line',
        executable,
        '--exit',
        String(status),
    );
    using fakes = new DisposableStack();
    fakes.use(overrideEnvironment({ MISE_DATA_DIR: join(root, 'mise') }));
    fakes.use(
        fakeExecutableLookup((name) =>
            join(root, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`),
        ),
    );
    const { paths } = await listExecutablePaths(join(root, 'work'), 'tsc', {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        folders: [join(root, 'work')],
    });
    return { executable, paths };
}

test('mise finds the program of the repository, and it runs from a copy', async () => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });
    const { executable, paths } = await fakeMiseTsc(sandbox.path, 0);
    expect(paths).toStrictEqual([executable]);
    const result = await runTool([executable], {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: join(sandbox.path, 'copy'),
    });
    expect({ code: result.code, stdout: result.stdout }).toStrictEqual({ code: 0, stdout: '0.0.0-test\n' });
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
    expect(missing.path).toBeUndefined();
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
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
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
    expect(formatUnavailableNote(tool, inspection)).toBe(
        'mise is not on PATH. Install mise (https://mise.jdx.dev/getting-started.html), or install scanner 0.0.0-test yourself.',
    );
});

test('a lookup keeps its inspection in the tool cache, and a system tool looks again in another folder', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using _which = fakeExecutableLookup((name) => (name === 'mise' ? null : process.execPath));
    using commands = fakeCommands(process.execPath, () => Promise.resolve(buildProcessResult({ stdout: '2.0.0\n' })));
    const tool: Tool = { name: 'teller', kind: 'program', system: true, min_version: '1.0.0', installers: {} };
    await lookUpTool(session, tool, sandbox.path);
    await lookUpTool(session, tool, sandbox.path);
    expect(commands).toHaveBeenCalledTimes(1);
    await lookUpTool(session, tool, join(sandbox.path, 'app'));
    expect(commands).toHaveBeenCalledTimes(2);
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
