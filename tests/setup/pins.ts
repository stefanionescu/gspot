// Replaces executable lookup and version reads with the declared tool pins.
import executables from 'which';
import { spyOn } from 'bun:test';
import { sep, join, basename } from 'node:path';
import * as processes from '#cli/system/processes.ts';
import { NPM_TOOL_FOLDER } from '#tests/config/tools.ts';
import { processResult } from '#tests/setup/processes.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';

/**
 * Replace executable lookup and version processes while a test owns command output.
 * @param tools the actual declared tools whose versions the test accepts.
 * @returns the disposable mocks.
 */
export function mockPinnedExecutables(tools: ToolDeclaration[]): DisposableStack {
    const resources = new DisposableStack();
    const locate = executables.sync;
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        spyOn(executables, 'sync').mockImplementation(((
            name: string,
            options?: executables.Options,
            // eslint-disable-next-line sonarjs/function-return-type -- which.sync returns one path, all paths, or null.
        ): string | string[] | null => {
            if (name === 'mise') return null;
            if (!tools.some((tool) => tool.name === name)) return locate(name, options);
            const path = join(process.cwd(), 'test-tools', name);
            return options?.all === true ? [path] : path;
        }) as typeof executables.sync),
    );
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The process API requires an executable as the first command item.
            const executable = command[0]!;
            const pin = tools.find((tool) => tool.name === basename(executable));
            if (pin === undefined) return runBlocking(command, options);
            const version = pin.version ?? pin.min_version;
            if (version === undefined) throw new Error(`The test has no declared version for ${executable}.`);
            return { code: 0, stdout: version, stderr: '', missing: false, duration: 1 };
        }),
    );
    return resources;
}

/**
 * A library pin installed through npm.
 * @param name the package name.
 * @param version the pinned version.
 * @returns the pin.
 */

export function buildLibraryPin(name: string, version: string): ToolDeclaration {
    return { name, kind: 'library', version, installers: { npm: { name, version } } };
}

/**
 * A program pin with an optional npm package installation.
 * @param name the executable name.
 * @param version the pinned version.
 * @param npm the npm package that ships it.
 * @returns the pin.
 */

export function buildProgramPin(name: string, version: string, npm?: string): ToolDeclaration {
    return {
        name,
        kind: 'program',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

/**
 * Model the installed npm executable's native version probe.
 * @param root the sandbox with the installed package.
 * @param command the executable and arguments.
 * @param tool the package and its native version declaration.
 * @returns the native version response only for this installed executable probe.
 */
export function installedVersionResponse(
    root: string,
    command: readonly string[],
    tool: ToolDeclaration,
): SpawnResult | undefined {
    const installer = tool.installers['npm'];
    if (
        installer === undefined ||
        tool.version === undefined ||
        command[1] !== '--version' ||
        command[0]?.startsWith(join(root, NPM_TOOL_FOLDER, installer.name) + sep) !== true
    )
        return undefined;
    return processResult({ stdout: tool.version });
}
