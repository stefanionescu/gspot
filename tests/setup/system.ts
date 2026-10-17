// Reports the system and its tool builds, and fakes the system for tests.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadCache } from '#cli/system/files/cache.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { rmSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { findMissingBuild, getToolDeclaration } from '#cli/configurations/tools.ts';

/** Whether the tests run on Windows. */
export const isWindows = process.platform === 'win32';

export const isLinux = process.platform === 'linux';

/** Whether the tests run on macOS. */
export const isMacos = process.platform === 'darwin';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name tool as its manifest pins it.
 * @returns whether a tool test may run it here.
 */
export function hasToolBuild(name: string): boolean {
    const operatingSystem = getOperatingSystem();
    const pin = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), name);
    return findMissingBuild(pin, operatingSystem, process.arch) === undefined;
}

/**
 * Make process.platform report another system until disposal.
 * @param name system to report.
 * @returns a resource that restores the real value.
 */
export function simulateOperatingSystem(name: NodeJS.Platform): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Node defines process.platform on the process object.
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: name });
    return {
        [Symbol.dispose]() {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}
/** Check whether this system treats differently cased path names as the same file. */
export function isCaseFolding(): boolean {
    const root = mkdtempSync(join(tmpdir(), 'gspot-case-'));
    try {
        writeFileSync(join(root, 'case-probe'), 'Probe.');
        return existsSync(join(root, 'CASE-PROBE'));
    } finally {
        rmSync(root, { recursive: true });
    }
}
