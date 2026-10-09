// Tool pins for inspection tests: a binary found on a path and a library found in the tool project.

import executables from 'which';
import { spyOn } from 'bun:test';
import { join, basename } from 'node:path';
import * as processes from '#cli/platform/public.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';

/**
 * Replace executable lookup and version processes while a test owns native command output.
 * @param tools the actual declared tools whose versions the test accepts
 * @returns the disposable mocks
 */
export function mockPinnedExecutables(tools: ToolPin[]): DisposableStack {
    const resources = new DisposableStack();
    const locate = executables.sync;
    const runBlocking = processes.runBlocking;
    resources.use(
        spyOn(executables, 'sync').mockImplementation(((name: string, options?: executables.Options) => {
            if (name === 'mise') return null;
            return tools.some((tool) => tool.name === name)
                ? join(process.cwd(), 'test-tools', name)
                : locate(name, options);
        }) as typeof executables.sync),
    );
    resources.use(
        spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
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
 * @param name the package name
 * @param version the pinned version
 * @returns the pin
 */

export function buildLibraryPin(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, installers: { npm: { name, version } } };
}

/**
 * A binary pin, installed through npm when a package name is given.
 * @param name the executable name
 * @param version the pinned version
 * @param npm the npm package that ships it
 * @returns the pin
 */

export function buildBinaryPin(name: string, version: string, npm?: string): ToolPin {
    return {
        name,
        kind: 'binary',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

/**
 * Start a tool inspection with a cache owned by its test.
 * @param root the repository whose tools the test inspects
 * @returns the tool search and its empty inspection cache
 */
export function inspectionContext(root: string): ToolSearch {
    return { root, inspections: new Map() };
}
