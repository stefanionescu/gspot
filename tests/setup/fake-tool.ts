// Writes cross-platform test programs and pinned npm tool executables.
import { quoteArgument } from '#cli/text.ts';
import { join, dirname, basename } from 'node:path';
import { EXECUTABLE_MODE } from '#tests/config/files.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * Write a child script and its launchers.
 * @param root the sandbox root.
 * @param name the executable path without a Windows suffix.
 * @param script the Bun program, retained verbatim.
 * @returns the directory for executable lookup.
 */
export async function fakeTool(root: string, name: string, script: string): Promise<string> {
    const target = join(root, name);
    const folder = dirname(target);
    const filename = basename(target);
    await mkdir(folder, { recursive: true });
    await writeFile(`${target}.js`, script);
    await writeFile(target, `#!/bin/sh\nexec ${quoteArgument(process.execPath)} "\${0%/*}/${filename}.js" "$@"\n`);
    await writeFile(`${target}.cmd`, `@echo off\r\n"${process.execPath}" "%~dp0${filename}.js" %*\r\n`);
    await chmod(target, EXECUTABLE_MODE);
    return folder;
}

/** Write the selected npm tool's pinned package metadata and version executable. */
export async function fakeNpmTool(root: string, tool: string): Promise<ToolDeclaration> {
    const declaration = toolDeclaration(configurationManifests().values(), tool);
    const installer = declaration.installers['npm'];
    if (installer === undefined) throw new Error(`The tool ${tool} has no npm installer.`);
    const installed = join(root, '.gspot/node_modules', installer.name);
    await mkdir(installed, { recursive: true });
    await writeFile(
        join(installed, 'package.json'),
        JSON.stringify({ name: installer.name, version: declaration.version }),
    );
    await fakeTool(
        root,
        `.gspot/node_modules/.bin/${tool}`,
        `console.log(${JSON.stringify(declaration.version)}); process.exitCode = ${String(declaration.version_exit_code ?? 0)};`,
    );
    return declaration;
}
