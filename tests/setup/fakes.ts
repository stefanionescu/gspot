import { spyOn, type Mock } from 'bun:test';
import { quoteArgument } from '#cli/system/text.ts';
import * as processes from '#cli/system/processes.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { EXECUTABLE_MODE } from '#tests/data/test-setup.ts';
import type { spawnProcess } from '#cli/system/processes.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { join, dirname, basename, delimiter } from 'node:path';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { GSPOT_NODE_MODULES_PATH } from '#cli/config/gspot-paths.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

/**
 * Replace one child command and run the others normally.
 *
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
 *
 * @param tools declarations whose pinned versions the fakes print.
 * @returns the disposable mocks.
 */
export function fakePinnedExecutables(tools: Tool[]): DisposableStack {
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
    const path = join(root, GSPOT_NODE_MODULES_PATH, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version }));
    await fakeTool(root, `${GSPOT_NODE_MODULES_PATH}/.bin/${bin}`, script);
}

/**
 * Pause the selected Git operation and forward every other call to Git.
 *
 * @param folder the launcher and call counter folder.
 * @param options the operation, marker path, and call number to pause.
 * @param options.operation the Git operation to pause.
 * @param options.marker the path that records the paused process.
 * @param options.pauseOnCall the call number to pause.
 * @returns an environment that finds the pausing launcher first.
 */
export async function fakePausingGit(
    folder: string,
    options: { operation: 'diff' | 'clone' | 'cat-file'; marker: string; pauseOnCall: number },
): Promise<Record<string, string>> {
    const executable = Bun.which('git');
    if (executable === null) throw new Error('The pausing Git fake requires Git on PATH.');
    const script = `
const args = process.argv.slice(2);
if (args[0] === ${JSON.stringify(options.operation)}) {
    const counter = Bun.file(${JSON.stringify(join(folder, 'calls.txt'))});
    const count = (await counter.exists() ? Number(await counter.text()) : 0) + 1;
    await Bun.write(counter, String(count));
    if (count === ${String(options.pauseOnCall)}) {
        const checkout = args[0] === 'clone' ? args.at(-1) : args[0] === 'cat-file' ? process.cwd() : undefined;
        const marker = ${JSON.stringify(options.marker)};
        await Bun.write(marker + ".tmp", JSON.stringify({pid: process.pid, checkout}));
        await (await import("node:fs/promises")).rename(marker + ".tmp", marker);
        await Bun.sleep(60_000);
    }
}

const child = Bun.spawn([${JSON.stringify(executable)}, ...args], {stdin:'inherit', stdout:'inherit', stderr:'inherit'});
process.exit(await child.exited);
`;
    await fakeTool(folder, 'git', script);
    const environment = buildSpawnEnvironment();
    return { ...environment, PATH: `${folder}${delimiter}${environment['PATH'] ?? ''}` };
}
