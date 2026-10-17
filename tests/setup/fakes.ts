import { spyOn, type Mock } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import { join, dirname, basename } from 'node:path';
import * as processes from '#cli/system/processes.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { EXECUTABLE_MODE } from '#tests/data/test-setup.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { spawnProcess } from '#cli/system/processes.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { NPM_TOOL_FOLDER } from '#tests/data/tools/installation.ts';

/**
 * Replace one child command and run the others normally.
 * @param name the executable to replace.
 * @param result function that returns the fake run.
 * @returns a spy whose disposal restores command execution.
 */
export function fakeCommand(name: string, result: typeof spawnProcess): Mock<typeof spawnProcess> {
    const runProcess = processes.spawnProcess;
    return spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        command[0] === name ? result(command, options) : runProcess(command, options),
    );
}

/**
 * Fake the lookup and version output of these tools.
 * @param tools declarations whose pinned versions the fakes print.
 * @returns the disposable mocks.
 */
export function fakePinnedExecutables(tools: ToolDeclaration[]): DisposableStack {
    const resources = new DisposableStack();
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        useExecutable((name) => {
            if (name === 'mise') return null;
            return tools.some((tool) => tool.name === name) ? join(process.cwd(), 'test-tools', name) : undefined;
        }),
    );
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The process API requires an executable as the first command item.
            const executable = command[0]!;
            const pin = tools.find((tool) => listExecutableNames(tool.name).includes(basename(executable)));
            if (pin === undefined) return runBlocking(command, options);
            const version = pin.version ?? pin.min_version;
            if (version === undefined) throw new Error(`The test has no declared version for ${executable}.`);
            return { code: 0, stdout: version, stderr: '', missing: false, duration: 1 };
        }),
    );
    return resources;
}

/**
 * Write a child script and its launchers.
 * @param sandboxRoot folder that gets the script and launchers.
 * @param name the executable path without a Windows suffix.
 * @param script the Bun program, written unchanged.
 * @returns the folder to put on `PATH`.
 */
export async function fakeTool(sandboxRoot: string, name: string, script: string): Promise<string> {
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
export async function fakeNpmTool(root: string, tool: string): Promise<ToolDeclaration> {
    const declaration = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), tool);
    const installer = declaration.installers['npm'];
    if (installer === undefined) throw new Error(`The tool ${tool} has no npm installer.`);
    const installed = join(root, NPM_TOOL_FOLDER, installer.name);
    await mkdir(installed, { recursive: true });
    await writeFile(
        join(installed, 'package.json'),
        JSON.stringify({ name: installer.name, version: declaration.version }),
    );
    await fakeTool(
        root,
        `${NPM_TOOL_FOLDER}/.bin/${tool}`,
        `console.log(${JSON.stringify(declaration.version)}); process.exitCode = ${String(declaration.version_exit_code ?? 0)};`,
    );
    return declaration;
}
/** Write an installed npm package and the program that the tool package exposes. */
export async function fakeNpmPackage(
    root: string,
    folder: string,
    name: string,
    version: string,
    script: string,
): Promise<void> {
    const path = join(root, folder, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version }));
    await fakeTool(root, `${folder}/.bin/${name}`, script);
}
