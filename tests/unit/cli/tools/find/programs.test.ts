import executables from 'which';
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { buildProgramPin } from '#tests/setup/pins.ts';
import { locateCandidates } from '#cli/tools/locate.ts';
import { installCompiler } from '#tests/setup/install.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { chmod, mkdir, unlink, symlink, readFile } from 'node:fs/promises';

test("inspectTool finds the project compiler, and the original repository's compiler from a scratch copy", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'work/package.json': '{"private":true}',
        'snapshot/.gspot/package.json': '{}',
    });
    const work = join(sandbox.path, 'work');
    const snapshot = join(sandbox.path, 'snapshot');
    await installCompiler(work, join(work, '.gspot/node_modules'));
    await installCompiler(work);
    const compiler = toolDeclaration(configurationManifests().values(), 'tsc');
    const projectPath = join(work, 'node_modules/typescript/package.json');
    const project = packageJsonSchema.parse(parseJsonFile(projectPath, await readFile(projectPath, 'utf8')));
    expect(
        inspectTool(
            {
                root: work,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            compiler,
        ),
    ).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
    expect(
        inspectTool(
            {
                root: snapshot,
                installedRoot: work,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            compiler,
        ),
    ).toMatchObject({
        state: 'system',
        found: project.version,
        path: join(work, 'node_modules/.bin', isWindows ? 'tsc.exe' : 'tsc'),
    });
});

test('version reads and runs use the companion programs of the chosen tool folder', async () => {
    using _git = useEnvironment({ GIT_EDITOR: 'true' });
    await using sandbox = await testdir();
    const program =
        "const child = Bun.spawnSync(['companion'], {stdout:'pipe', stderr:'pipe'}); process.stdout.write(child.stdout); process.exitCode = child.exitCode;\n";
    await fakeTool(sandbox.path, 'node_modules/.bin/teller', program);
    await fakeTool(sandbox.path, 'node_modules/.bin/companion', "console.log('3.8.1');\n");
    await fakeTool(sandbox.path, 'unrelated/companion', "console.log('9.0.0');\n");
    const env = { PATH: join(sandbox.path, 'unrelated') };
    const tool = { ...buildProgramPin('teller', '3.8.1'), env };
    const read = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const executed = await runTool([read.path!], {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: sandbox.path,
        env,
    });
    expect(executed.code).toBe(0);
    expect(executed.stdout.trim()).toBe('3.8.1');
    expect(await Bun.file(join(sandbox.path, 'node_modules/.bin/teller.js')).text()).toBe(program);
});

test('a program on PATH wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await fakeTool(sandbox.path, 'active/tsc', "console.log('5.9.3');\n");
    await fakeTool(sandbox.path, 'mise/shims/tsc', "console.log('1.0.0');\n");
    const active = join(sandbox.path, 'active', isWindows ? 'tsc.cmd' : 'tsc');
    using _environment = useEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [active] : active) as typeof executables.sync);
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        toolDeclaration(configurationManifests().values(), 'tsc'),
    );
    expect(inspection.state).toBe('system');
    expect(inspection.path).toBe(active);
});

test.each([0, 1])('mise finds the program in the original repository with exit code %s', async (status) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'work/.keep': '', 'copy/.keep': '' });
    const executable = join(sandbox.path, 'mise/installs/tsc/5.9.3', isWindows ? 'tsc.cmd' : 'tsc');
    await fakeTool(sandbox.path, 'mise/shims/tsc', "throw new Error('The shim must not run in a source copy.');\n");
    await fakeTool(sandbox.path, 'mise/installs/tsc/5.9.3/tsc', "console.log('5.9.3');\n");
    await fakeTool(
        sandbox.path,
        'bin/mise',
        `if (process.cwd() !== ${JSON.stringify(join(sandbox.path, 'work'))}) process.exit(9); console.log(${JSON.stringify(executable)}); process.exitCode = ${String(status)};\n`,
    );
    using _environment = useEnvironment({ MISE_DATA_DIR: join(sandbox.path, 'mise') });
    using _which = spyOn(executables, 'sync').mockImplementation(((name: string, options?: executables.Options) => {
        const path = join(sandbox.path, name === 'mise' ? 'bin' : 'mise/shims', `${name}${isWindows ? '.cmd' : ''}`);
        return options?.all === true ? [path] : path;
    }) as typeof executables.sync);
    const candidates = locateCandidates(join(sandbox.path, 'copy'), 'tsc', {
        search: 'mise',
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        searchFolders: [join(sandbox.path, 'copy')],
        installedRoot: join(sandbox.path, 'work'),
    });
    expect(candidates).toStrictEqual(status === 0 ? [executable] : []);
    if (status === 0) {
        const result = await runTool([candidates[0]!], {
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            cwd: join(sandbox.path, 'copy'),
        });
        expect(result.code).toBe(0);
        expect(result.stdout.trim()).toBe('5.9.3');
    }
});

test('a tool project program linked outside the repository is refused before it runs', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(directory.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(directory.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    await chmod(join(directory.path, 'outside/teller'), EXECUTABLE_FILE);
    await chmod(join(root, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await symlink('../../../../outside/teller', binary);
    expect(() =>
        inspectTool(
            {
                root: root,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            buildProgramPin('teller', '1.2.3'),
        ),
    ).toThrow('Source link leaves the repository');
    expect(await pathExists(join(directory.path, 'outside/executed'))).toBe(false);
    await unlink(binary);
    await symlink('../teller/run.sh', binary);
    expect(
        inspectTool(
            {
                root: root,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            buildProgramPin('teller', '1.2.3'),
        ).state,
    ).toBe('ok');
});

test('a missing npm tool does not fall back to the program in the repository node_modules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\ntouch fallback-ran\necho 5.0.1\n',
    });
    await chmod(join(sandbox.path, 'node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, 'node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const tool = buildProgramPin('teller', '5.0.1', 'teller');
    const missing = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    expect(
        inspectTool(
            {
                root: sandbox.path,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            tool,
        ),
    ).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('a system tsc is found in node_modules and the tool project tsc is ignored', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/tsc': '#!/bin/sh\nexit 7\n',
        'node_modules/.bin/tsc': '#!/bin/sh\necho 5.9.3\n',
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/tsc'), EXECUTABLE_FILE);
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        toolDeclaration(configurationManifests().values(), 'tsc'),
    );
    expect(inspection).toMatchObject({
        state: 'system',
        path: join(sandbox.path, 'node_modules/.bin/tsc'),
        found: '5.9.3',
    });
});

test('a Python tool uses the tool project environment, not the repository .venv', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath('.venv', 'teller')]:
            `#!${process.execPath}\nawait Bun.write('fallback-ran', '');\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, buildVenvExecutablePath('.venv', 'teller')), EXECUTABLE_FILE);
    const tool = buildProgramPin('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
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
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath('.gspot/.venv', 'teller')]: `#!${process.execPath}\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, buildVenvExecutablePath('.gspot/.venv', 'teller')), EXECUTABLE_FILE);
    expect(
        inspectTool(
            {
                root: sandbox.path,
                timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                inspections: new Map(),
            },
            tool,
        ),
    ).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
