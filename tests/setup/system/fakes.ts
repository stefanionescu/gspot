import executables from 'which';
import { tmpdir } from 'node:os';
import { getTool } from '#cli/tools/pins.ts';
import * as locate from '#cli/tools/locate.ts';
import { mock, spyOn, type Mock } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import { type Tool } from '#cli/types/manifests.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { ProgramName } from '#tests/types/setup.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join, parse, dirname, basename } from 'node:path';
import { GIT_PROGRAM } from '#cli/config/repository/git.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { spawnProcess } from '#cli/system/processes.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { UNPINNED_NPM_MESSAGE } from '#tests/config/setup/programs.ts';

/**
Replace the child command found by this path or program name, or without a name every child command but Git. Run the
others normally, and record only the replaced commands. Without a replacement, the replaced commands run normally too.
*/
export function fakeCommands(name?: string, spawn?: typeof spawnProcess): Mock<typeof spawnProcess> {
    const unfaked = processes.spawnProcess;
    const spy = spyOn(processes, 'spawnProcess');
    const runProcess = spy.getMockImplementation() ?? unfaked;
    const fake = mock(spawn ?? runProcess);
    spy.mockImplementation((command, options) => {
        const program = command[0] ?? '';
        const replaced =
            name === undefined
                ? program !== GIT_PROGRAM
                : [program, basename(program), parse(program).name].includes(name);
        return replaced ? fake(command, options) : runProcess(command, options);
    });
    return Object.assign(fake, {
        [Symbol.dispose]: () => {
            spy.mockRestore();
        },
    });
}

/**
Fake the lookup and version output of these tools, as programs that mise installed.
*/
export function fakeToolExecutables(tools: Tool[]): DisposableStack {
    const resources = new DisposableStack();
    const folder = join(tmpdir(), 'test-tools');
    resources.use(
        fakeExecutableLookup((name) => {
            if (name === 'mise') return null;
            return tools.some((tool) => tool.name === name) ? join(folder, name) : undefined;
        }),
    );
    resources.use(spyOn(locate, 'readToolBinPaths').mockResolvedValue({ folders: [folder] }));
    const unfaked = processes.spawnProcess;
    const spy = spyOn(processes, 'spawnProcess');
    const run = spy.getMockImplementation() ?? unfaked;
    spy.mockImplementation(async (command, options) => {
        const executable = command[0]!;
        const pin = tools.find((tool) => listExecutableNames(tool.name).includes(basename(executable)));
        const versionCommand = pin?.version_command ?? ['--version'];
        if (pin === undefined || command.slice(1).join(' ') !== versionCommand.join(' '))
            return await run(command, options);
        const version = pin.version ?? pin.min_version;
        if (version === undefined) throw new Error(`The test has no declared version for ${executable}.`);
        return buildProcessResult({ stdout: version });
    });
    resources.use(spy);
    return resources;
}

/**
Write a Unix and a Windows command that runs one of the test programs with fixed arguments before the ones it gets.
Name it without the Windows suffix, and return the folder to put on `PATH`.
*/
export async function writeProgramCommand(
    folder: string,
    path: string,
    program: ProgramName,
    ...programArguments: string[]
): Promise<string> {
    const target = join(folder, path);
    const command = buildProgramCommand(program, ...programArguments);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `#!/bin/sh\nexec ${command.map((word) => quoteArgument(word)).join(' ')} "$@"\n`);
    const windowsCommand = command.map((word) => '"' + word.replaceAll('"', '""').replaceAll('%', '%%') + '"');
    await writeFile(`${target}.cmd`, `@echo off\r\n${windowsCommand.join(' ')} %*\r\n`);
    await chmod(target, EXECUTABLE_FILE);
    return dirname(target);
}

/**
Write the package.json and a version program for the pinned npm tool.
*/
export async function fakeNpmTool(root: string, tool: string): Promise<Tool> {
    const declaration = getTool(readConfigurations().values(), tool);
    const installer = declaration.installers['npm'];
    if (installer === undefined) throw new Error(`The tool ${tool} has no npm installer.`);
    if (declaration.version === undefined) throw new Error(UNPINNED_NPM_MESSAGE);
    await fakeNpmPackage(root, {
        name: installer.name,
        version: declaration.version,
        bin: tool,
        toolArguments: ['--line', declaration.version],
    });
    return declaration;
}

/**
List the dist-info file that gives a Python tool its version in the tool environment.
*/
export function buildPythonToolFiles(tool: string): Record<string, string> {
    const declaration = getTool(readConfigurations().values(), tool);
    const name = declaration.installers['pypi']?.name;
    if (name === undefined) throw new Error(`The tool ${tool} has no PyPI installer.`);
    const folder = `${name}-${String(declaration.version)}.dist-info`;
    return { [`${GSPOT_PATHS.pythonEnvironment}/lib/python3/site-packages/${folder}/METADATA`]: '' };
}

/**
Write an installed npm package and the program that the tool package exposes.
*/
export async function fakeNpmPackage(
    root: string,
    npmPackage: { name: string; version: string; toolArguments: string[]; bin?: string },
): Promise<void> {
    const { name, version, toolArguments, bin = name } = npmPackage;
    const path = join(root, GSPOT_PATHS.nodeModules, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version }));
    await writeProgramCommand(root, `${GSPOT_PATHS.nodeModules}/.bin/${bin}`, 'fakes/tool', ...toolArguments);
}

/**
Make executable lookup return one path, or the path a function picks for each name. Git keeps its real lookup.

@param path the path, or a function of the name; when the function gives undefined, the real lookup runs.
*/
export function fakeExecutableLookup(
    path: string | null | ((name: string) => string | null | undefined),
): Mock<typeof executables.sync> {
    const locate = executables.sync;
    /**
    Stand in for which.sync.

    @returns one path, all paths, or null, as which.sync does.
    */
    const lookUp = (name: string, options?: executables.Options): string | string[] | null => {
        const found = typeof path === 'function' ? path(name) : path;
        if (found === undefined || name === GIT_PROGRAM) return locate(name, options);
        if (options?.all === true) return found === null ? [] : [found];
        return found;
    };
    return spyOn(executables, 'sync').mockImplementation(lookUp as typeof executables.sync);
}

/**
Mark each stream as a terminal or not, and restore the streams when the scope ends.
*/
export function fakeTerminals(
    terminals: readonly (readonly [NodeJS.ReadStream | NodeJS.WriteStream, boolean])[],
): Disposable {
    using resources = new DisposableStack();
    for (const [stream, isTTY] of terminals) {
        const descriptor = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (descriptor === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', descriptor);
        });
        Object.defineProperty(stream, 'isTTY', { value: isTTY, configurable: true });
    }
    return resources.move();
}
