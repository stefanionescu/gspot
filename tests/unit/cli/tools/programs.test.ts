import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { installCompiler } from '#tests/setup/install.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { fakeTool, fakeNpmPackage } from '#tests/setup/fakes.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { chmod, unlink, symlink, readFile } from 'node:fs/promises';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramPin, buildInspectionContext } from '#tests/setup/builders.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/dependencies/package-json.ts';

test("inspectTool finds the project compiler, and the original repository's compiler from a scratch copy", async () => {
    await using sandbox = await testdir({
        'work/package.json': '{"private":true}',
        'snapshot/.gspot/package.json': '{}',
    });

    const work = join(sandbox.path, 'work');
    const snapshot = join(sandbox.path, 'snapshot');
    await installCompiler(work, join(work, '.gspot/node_modules'));
    await installCompiler(work);
    const compiler = getTool(readConfigurations().values(), 'tsc');
    const projectPath = join(work, 'node_modules/typescript/package.json');
    const project = parseJsonFile(projectPath, await readFile(projectPath, 'utf8'), packageJsonSchema);
    expect(inspectTool(buildInspectionContext(work), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
    expect(inspectTool(buildInspectionContext(snapshot, { installedRoot: work }), compiler)).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
});

test('version reads and runs use the companion programs of the chosen tool folder', async () => {
    await using sandbox = await testdir();
    const program =
        "const child = Bun.spawnSync(['companion'], {stdout:'pipe', stderr:'pipe'}); process.stdout.write(child.stdout); process.exitCode = child.exitCode;\n";
    await fakeTool(sandbox.path, 'node_modules/.bin/teller', program);
    await fakeTool(sandbox.path, 'node_modules/.bin/companion', "console.log('3.8.1');\n");
    await fakeTool(sandbox.path, 'unrelated/companion', "console.log('9.0.0');\n");
    const env = { PATH: join(sandbox.path, 'unrelated') };
    const tool = buildProgramPin('teller', '3.8.1');
    const read = inspectTool(buildInspectionContext(sandbox.path), tool);
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const executed = await runTool([read.path!], {
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        cwd: sandbox.path,
        env,
    });
    expect(executed.code).toBe(0);
    expect(executed.stdout.trim()).toBe('3.8.1');
});

test('a program on PATH wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await fakeTool(sandbox.path, 'active/tsc', "console.log('5.9.3');\n");
    await fakeTool(sandbox.path, 'mise/shims/tsc', "console.log('1.0.0');\n");
    const active = join(sandbox.path, 'active', isWindows ? 'tsc.cmd' : 'tsc');
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = useExecutable(active);
    const inspection = inspectTool(buildInspectionContext(sandbox.path), getTool(readConfigurations().values(), 'tsc'));
    expect(inspection.state).toBe('system');
    expect(inspection.path).toBe(active);
});

test.each([0, 1])('mise finds the program in the original repository with exit code %s', async (status) => {
    await using sandbox = await testdir({ 'work/.keep': '', 'copy/.keep': '' });

    const executable = join(sandbox.path, 'mise/installs/tsc/5.9.3', isWindows ? 'tsc.cmd' : 'tsc');
    await fakeTool(sandbox.path, 'mise/shims/tsc', "throw new Error('The shim must not run in a source copy.');\n");
    await fakeTool(sandbox.path, 'mise/installs/tsc/5.9.3/tsc', "console.log('5.9.3');\n");
    await fakeTool(
        sandbox.path,
        'bin/mise',
        `if (process.cwd() !== ${JSON.stringify(join(sandbox.path, 'work'))}) process.exit(9); console.log(${JSON.stringify(executable)}); process.exitCode = ${String(status)};\n`,
    );
    using _environment = overrideEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = useExecutable((name) =>
        join(sandbox.path, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`),
    );
    const candidates = listExecutablePaths(join(sandbox.path, 'work'), 'tsc', {
        search: 'mise',
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        searchFolders: [join(sandbox.path, 'work')],
    });
    expect(candidates).toStrictEqual(status === 0 ? [executable] : []);
    if (status === 0) {
        const result = await runTool([candidates[0]!], {
            timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
            cwd: join(sandbox.path, 'copy'),
        });
        expect(result.code).toBe(0);
        expect(result.stdout.trim()).toBe('5.9.3');
    }
});

test('a tool project program linked outside the repository is refused before it runs', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(folder.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(folder.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    await chmod(join(folder.path, 'outside/teller'), EXECUTABLE_FILE);
    await chmod(join(root, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await symlink('../../../../outside/teller', binary);
    expect(() => inspectTool(buildInspectionContext(root), buildProgramPin('teller', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
    expect(await isOnDisk(join(folder.path, 'outside/executed'))).toBe(false);
    await unlink(binary);
    await symlink('../teller/run.sh', binary);
    expect(inspectTool(buildInspectionContext(root), buildProgramPin('teller', '1.2.3')).state).toBe('ok');
});

test('a missing npm tool does not fall back to the program in the repository node_modules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': JSON.stringify({ name: 'teller', version: '5.0.1' }),
    });
    await fakeTool(
        sandbox.path,
        'node_modules/.bin/teller',
        "await Bun.write('fallback-ran', ''); console.log('5.0.1');\n",
    );
    const tool = buildProgramPin('teller', '5.0.1', 'teller');
    const missing = inspectTool(buildInspectionContext(sandbox.path), tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', script: "console.log('5.0.1');\n" });
    expect(inspectTool(buildInspectionContext(sandbox.path), tool)).toMatchObject({
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
    expect(inspectTool(buildInspectionContext(sandbox.path), tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath('.gspot/.venv', 'teller')]: `#!${process.execPath}\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, buildVenvExecutablePath('.gspot/.venv', 'teller')), EXECUTABLE_FILE);
    expect(inspectTool(buildInspectionContext(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(await isOnDisk(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
