import executables from 'which';
import { spyOn, type Mock } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import { join, dirname, basename } from 'node:path';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { type Tool } from '#cli/types/configurations.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import type { ProgramName } from '#tests/types/programs.ts';
import { EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import { type spawnProcess } from '#cli/system/processes.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { UNPINNED_NPM_MESSAGE } from '#tests/config/setup/system/fakes.ts';

/**
Replace one child command, found by its path or program name, and run the others normally.
*/
export function fakeCommand(name: string, spawn: typeof spawnProcess): Mock<typeof spawnProcess> {
    const runProcess = processes.spawnProcess;
    return spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        [command[0], basename(command[0] ?? '')].includes(name)
            ? spawn(command, options)
            : runProcess(command, options),
    );
}

/**
Record each npm command that gspot starts, other than npm --version, and run it as usual.
*/
export function recordNpmCommands(): Mock<typeof spawnProcess> & { commands: string[][] } {
    const runProcess = processes.spawnProcess;
    const commands: string[][] = [];
    const spy = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'npm' && command[1] !== '--version') commands.push([...command]);
        return runProcess(command, options);
    });
    return Object.assign(spy, { commands });
}

/**
Fake the lookup and version output of these tools.
*/
export function fakeToolExecutables(tools: Tool[]): DisposableStack {
    const resources = new DisposableStack();
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        fakeExecutableLookup((name) => {
            if (name === 'mise') return null;
            return tools.some((tool) => tool.name === name) ? join(process.cwd(), 'test-tools', name) : undefined;
        }),
    );
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
            const executable = command[0]!;
            const pin = tools.find((tool) => listExecutableNames(tool.name).includes(basename(executable)));
            if (pin === undefined) return runBlocking(command, options);
            const version = pin.version ?? pin.min_version;
            if (version === undefined) throw new Error(`The test has no declared version for ${executable}.`);
            return buildProcessResult({ stdout: version });
        }),
    );
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
        toolArguments: ['--line', declaration.version, '--exit', String(declaration.version_exit_code ?? 0)],
    });
    return declaration;
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
Make executable lookup return one path, or the path a function picks for each name.

@param path the path, or a function of the name; when the function gives undefined, the real lookup runs.
*/
export function fakeExecutableLookup(
    path: string | null | ((name: string) => string | null | undefined),
): Mock<typeof executables.sync> {
    const locate = executables.sync;
    return spyOn(executables, 'sync').mockImplementation(((
        name: string,
        options?: executables.Options,
        // eslint-disable-next-line sonarjs/function-return-type -- reason: which.sync returns one path, all paths, or null.
    ): string | string[] | null => {
        const found = typeof path === 'function' ? path(name) : path;
        if (found === undefined) return locate(name, options);
        if (options?.all === true) return found === null ? [] : [found];
        return found;
    }) as typeof executables.sync);
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
