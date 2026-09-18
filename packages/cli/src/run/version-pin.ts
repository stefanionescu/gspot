// .gspot/version against the running binary; the exit-2 refusal with its two remedies.
import { join } from 'node:path';
import * as messages from '#cli/policy/messages.ts';
import { VERSION_FILE_LINE } from '#config/markers.ts';
import packageManifest from '#package' with { type: 'json' };
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

/** The version of this build: the one source is packages/cli/package.json (D-84). */
export const { version: GSPOT_VERSION } = packageManifest;

/** Thrown when the repository pins another version than the running binary. */
export class VersionPinError extends Error {
    /**
     * Names both versions and the two ways forward.
     * @param pinned the version the repository pins
     * @param running the version of this binary
     */
    constructor(pinned: string, running: string) {
        super(messages.versionMismatch(pinned, running));
        this.name = 'VersionPinError';
    }
}

/**
 * The pinned version, or undefined when the repository has none.
 * @param root the repository root
 * @returns the version in .gspot/version
 */
export function pinnedVersion(root: string): string | undefined {
    const path = join(root, '.gspot', 'version');
    if (!existsSync(path)) return undefined;
    const line = readFileSync(path, 'utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 * @param root the repository root
 * @param version the version to pin
 */
export function writePin(root: string, version = GSPOT_VERSION): void {
    mkdirSync(join(root, '.gspot'), { recursive: true });
    writeFileSync(
        join(root, '.gspot', 'version'),
        VERSION_FILE_LINE.replaceAll('{{version}}', () => version),
    );
}

/**
 * Throws when the repository pins another version than the running binary.
 * @param root the repository root
 */
export function assertPinMatches(root: string): void {
    const pinned = pinnedVersion(root);
    if (pinned !== undefined && pinned !== GSPOT_VERSION) throw new VersionPinError(pinned, GSPOT_VERSION);
}
