// Reads locked packages and their download locations.
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { Lockfile } from '#cli/types/parsers/lockfiles.ts';

/**
 * Read the declared consumers of one repository lockfile.
 * @param filename the file basename.
 * @returns its metadata, or undefined for an unsupported filename.
 */
export function lockfileEntry(filename: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === filename);
}
