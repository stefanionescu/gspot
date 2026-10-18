import { openFiles } from '#cli/system/files/open.ts';
import { VERSION_PIN_FILE } from '#cli/config/system/locations.ts';

/**
 * Read the pinned gspot version.
 *
 * @param repositoryRoot the folder that holds .gspot/version.
 *
 * @returns the version, or undefined when the repository has no pin.
 */
export function readVersionPin(repositoryRoot: string): string | undefined {
    using files = openFiles(repositoryRoot);
    const current = files.read(VERSION_PIN_FILE);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}
