import executables from 'which';
import { spyOn, type Mock } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import { join, dirname, basename } from 'node:path';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import type { spawnProcess } from '#cli/system/processes.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { EXECUTABLE_MODE } from '#tests/config/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

/**
 * Replace one child command and run the others normally.
 *
 * @param name the executable to replace.
 * @param result function that returns the fake run.
 * @returns a spy whose disposal restores how commands run.
 */
export function fakeCommand(name: string, result: typeof spawnProcess): Mock<typeof spawnProcess> {
    const runProcess = processes.spawnProcess;
    return spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        command[0] === name ? result(command, options) : runProcess(command, options),
    );
}

/**
 * Record each npm command that gspot starts, other than npm --version, and run it as usual.
 *
 * @returns a spy whose installations list the recorded commands, and whose disposal restores command execution.
 */
export function recordNpmCommands(): Mock<typeof spawnProcess> & { installations: string[][] } {
    const runProcess = processes.spawnProcess;
    const installations: string[][] = [];
    const spy = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'npm' && command[1] !== '--version') installations.push([...command]);
        return runProcess(command, options);
    });
    return Object.assign(spy, { installations });
}

/**
 * Fake the lookup and version output of these tools.
 *
 * @param tools the tools whose pinned versions the fakes print.
 * @returns the disposable mocks.
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
 * Write a child script and its launchers.
 *
 * @param sandboxRoot folder that gets the script and launchers.
 * @param name the executable path without a Windows suffix.
 * @param script the Bun program, written unchanged.
 * @returns the folder to put on `PATH`.
 */
export async function writeScriptCommand(sandboxRoot: string, name: string, script: string): Promise<string> {
    const target = join(sandboxRoot, name);
    const folder = dirname(target);
    const filename = basename(target);
    await mkdir(folder, { recursive: true });
    await writeFile(`${target}.js`, script);
    await writeFile(target, `#!/bin/sh\nexec ${quoteArgument(process.execPath)} "\${0%/*}/${filename}.js" "$@"\n`);
    await writeFile(`${target}.cmd`, `@echo off\r\n"${process.execPath}" "%~dp0${filename}.js" %*\r\n`);
    await chmod(target, EXECUTABLE_MODE);
    return folder;
}

/** Write the package.json and a version program for the pinned npm tool. */
export async function fakeNpmTool(root: string, tool: string): Promise<Tool> {
    const declaration = getTool(readConfigurations().values(), tool);
    const installer = declaration.installers['npm'];
    if (installer === undefined) throw new Error(`The tool ${tool} has no npm installer.`);
    if (declaration.version === undefined) throw new Error('The npm package fake requires a pinned tool version.');
    await fakeNpmPackage(root, {
        name: installer.name,
        version: declaration.version,
        bin: tool,
        script: `console.log(${JSON.stringify(declaration.version)}); process.exitCode = ${String(declaration.version_exit_code ?? 0)};`,
    });
    return declaration;
}

/** Write an installed npm package and the program that the tool package exposes. */
export async function fakeNpmPackage(
    root: string,
    npmPackage: { name: string; version: string; script: string; bin?: string },
): Promise<void> {
    const { name, version, script, bin = name } = npmPackage;
    const path = join(root, GSPOT_PATHS.nodeModules, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version }));
    await writeScriptCommand(root, `${GSPOT_PATHS.nodeModules}/.bin/${bin}`, script);
}

/**
 * Make executable lookup return one path, or the path a function picks for each name.
 *
 * @param path the path, or a function of the name; when the function gives undefined, the real lookup runs.
 * @returns the mock.
 */
export function fakeExecutableLookup(
    path: string | null | ((name: string) => string | null | undefined),
): Mock<typeof executables.sync> {
    const locate = executables.sync;
    return spyOn(executables, 'sync').mockImplementation(((
        name: string,
        options?: executables.Options,
        // eslint-disable-next-line sonarjs/function-return-type -- which.sync returns one path, all paths, or null.
    ): string | string[] | null => {
        const found = typeof path === 'function' ? path(name) : path;
        if (found === undefined) return locate(name, options);
        if (options?.all === true) return found === null ? [] : [found];
        return found;
    }) as typeof executables.sync);
}
