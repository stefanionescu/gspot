import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { chmod, unlink, symlink, readFile } from 'node:fs/promises';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { fakeNpmPackage, writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

test('tool inspection finds the project compiler, and the original repository compiler from a copy', async () => {
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
    expect(inspectTool(buildToolSearch(snapshot, { installedRoot: work }), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
});

test('version reads and runs use the other tools of the chosen tool folder', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'node_modules/.bin/teller', 'processes/command', 'companion');
    await writeProgramCommand(sandbox.path, 'node_modules/.bin/companion', 'fakes/tool', '--line', '3.8.1');
    await writeProgramCommand(sandbox.path, 'unrelated/companion', 'fakes/tool', '--line', '9.0.0');
    const env = { PATH: join(sandbox.path, 'unrelated') };
    const tool = buildProgramPin('teller', '3.8.1');
    const read = inspectTool(buildToolSearch(sandbox.path), tool);
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const executed = await runTool([read.path!], {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        cwd: sandbox.path,
        env,
    });
    expect(executed.code).toBe(0);
    expect(executed.stdout.trim()).toBe('3.8.1');
});

test('a program on PATH wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'active/tsc', 'fakes/tool', '--line', '5.9.3');
    await writeProgramCommand(sandbox.path, 'mise/shims/tsc', 'fakes/tool', '--line', '1.0.0');
    const active = join(sandbox.path, 'active', isWindows ? 'tsc.cmd' : 'tsc');
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = fakeExecutableLookup(active);
    const inspection = inspectTool(buildToolSearch(sandbox.path), getTool(readConfigurations().values(), 'tsc'));
    expect(inspection.state).toBe('system');
    expect(inspection.path).toBe(active);
});

async function installMiseTsc(root: string, status: number) {
    const executable = join(root, 'mise/installs/tsc/5.9.3', isWindows ? 'tsc.cmd' : 'tsc');
    await writeProgramCommand(
        root,
        'mise/shims/tsc',
        'fakes/tool',
        '--stderr',
        'The shim must not run in a source copy.\n',
        '--exit',
        '1',
    );
    await writeProgramCommand(root, 'mise/installs/tsc/5.9.3/tsc', 'fakes/tool', '--line', '5.9.3');
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
    const fakes = new DisposableStack();
    fakes.use(overrideEnvironment({ MISE_DATA_DIR: join(root, 'mise') }));
    fakes.use(
        fakeExecutableLookup((name) =>
            join(root, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`),
        ),
    );
    const paths = listExecutablePaths(join(root, 'work'), 'tsc', {
        search: 'mise',
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        searchFolders: [join(root, 'work')],
    });
    fakes.dispose();
    return { executable, paths };
}

test('mise finds the program of the original repository, and it runs from a copy', async () => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });
    const { executable, paths } = await installMiseTsc(sandbox.path, 0);
    expect(paths).toStrictEqual([executable]);
    const result = await runTool([executable], {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        cwd: join(sandbox.path, 'copy'),
    });
    expect({ code: result.code, stdout: result.stdout }).toStrictEqual({ code: 0, stdout: '5.9.3\n' });
});

test('mise finds no program when its lookup exits 1', async () => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });
    const { paths } = await installMiseTsc(sandbox.path, 1);
    expect(paths).toStrictEqual([]);
});

test('a tool project program linked outside the repository is refused before it runs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(sandbox.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(sandbox.path, 'project');
    const binary = join(root, `${GSPOT_PATHS.nodeModules}/.bin/teller`);
    await chmod(join(sandbox.path, 'outside/teller'), EXECUTABLE_FILE);
    await chmod(join(root, `${GSPOT_PATHS.nodeModules}/teller/run.sh`), EXECUTABLE_FILE);
    await symlink('../../../../outside/teller', binary);
    expect(() => inspectTool(buildToolSearch(root), buildProgramPin('teller', '1.2.3'))).toThrow(
        new Error(
            `${GSPOT_PATHS.nodeModules}/.bin/teller links to a file outside the repository. Replace the link with the file.`,
        ),
    );
    expect(await isOnDisk(join(sandbox.path, 'outside/executed'))).toBe(false);
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
    await using sandbox = await testdir({
        [buildVenvExecutablePath('.venv', 'teller')]:
            `#!${process.execPath}\nawait Bun.write('fallback-ran', '');\nconsole.log('1.2.3');\n`,
    });

    await chmod(join(sandbox.path, buildVenvExecutablePath('.venv', 'teller')), EXECUTABLE_FILE);
    const tool = buildProgramPin('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
    expect(inspectTool(buildToolSearch(sandbox.path), tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'teller')]:
            `#!${process.execPath}\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'teller')), EXECUTABLE_FILE);
    expect(inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
