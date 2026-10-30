import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/executables/run.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { inspectTool } from '#cli/executables/inspect.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { unlink, symlink, readFile } from 'node:fs/promises';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { listExecutablePaths } from '#cli/executables/locate.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/projects.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { fakeNpmPackage, writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

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
    expect(inspectTool(buildToolSearch(work), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
    expect(inspectTool(buildToolSearch(snapshot, { toolsRoot: work }), compiler)).toMatchObject({
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
    const read = inspectTool(buildToolSearch(sandbox.path), tool);
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const result = await runTool([read.path!], {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
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
    const inspection = inspectTool(buildToolSearch(sandbox.path), tool);
    expect(inspection.state).toBe('missing');
    expect(inspection.path).toBeUndefined();
    expect(await isOnDisk(join(sandbox.path, 'npm-ran'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'venv-ran'))).toBe(false);
});

test('a program on PATH wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'active/tsc', 'fakes/tool', '--line', '0.0.0-test');
    await writeProgramCommand(sandbox.path, 'mise/shims/tsc', 'fakes/tool', '--line', '1.0.0');
    const active = join(sandbox.path, 'active', isWindows ? 'tsc.cmd' : 'tsc');
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = fakeExecutableLookup(active);
    const inspection = inspectTool(buildToolSearch(sandbox.path), getTool(readConfigurations().values(), 'tsc'));
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
    const paths = listExecutablePaths(join(root, 'work'), 'tsc', {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        folders: [join(root, 'work')],
    });
    return { executable, paths };
}

test('mise finds the program of the repository, and it runs from a copy', async () => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });
    const { executable, paths } = await fakeMiseTsc(sandbox.path, 0);
    expect(paths).toStrictEqual([executable]);
    const result = await runTool([executable], {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        cwd: join(sandbox.path, 'copy'),
    });
    expect({ code: result.code, stdout: result.stdout }).toStrictEqual({ code: 0, stdout: '0.0.0-test\n' });
});

test('mise finds no program when its lookup exits 1', async () => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });
    const { paths } = await fakeMiseTsc(sandbox.path, 1);
    expect(paths).toStrictEqual([]);
});

test('a pinned program whose only executable is a mise shim that mise cannot resolve is missing', async () => {
    await using sandbox = await testdir({ 'work/.keep': '' });
    const root = sandbox.path;
    const failure = ['--stderr', 'mise ERROR Config files are not trusted.\n', '--exit', '1'];
    await writeProgramCommand(root, 'mise/shims/vale', 'fakes/tool', ...failure);
    await writeProgramCommand(root, 'bin/mise', 'fakes/tool', ...failure);
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(root, 'mise') });
    using _which = fakeExecutableLookup((name) =>
        join(root, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`),
    );
    const inspection = inspectTool(buildToolSearch(join(root, 'work')), buildProgramPin('vale', '0.0.0-test'));
    expect(inspection).toStrictEqual({
        name: 'vale',
        state: 'missing',
        want: '0.0.0-test',
        help: 'Run gspot install.',
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
    expect(() => inspectTool(buildToolSearch(root), buildProgramPin('teller', '1.2.3'))).toThrow(
        new Error(
            `${GSPOT_PATHS.nodeModules}/.bin/teller links to a file outside the repository. Replace the link with the file.`,
        ),
    );
    expect(await isOnDisk(ranMarker)).toBe(false);
    await unlink(binary);
    await symlink('../teller/run.sh', binary);
    expect(inspectTool(buildToolSearch(root), buildProgramPin('teller', '1.2.3')).state).toBe('ok');
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
    const missing = inspectTool(buildToolSearch(sandbox.path), tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', toolArguments: ['--line', '5.0.1'] });
    expect(inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
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
    expect(inspectTool(buildToolSearch(sandbox.path), tool).state).toBe('missing');
    await writeProgramCommand(
        sandbox.path,
        buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'teller'),
        'fakes/tool',
        '--line',
        '1.2.3',
    );
    expect(inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
