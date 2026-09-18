// .gspot/version against the running binary; the exit-2 refusal with its two remedies.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { VERSION_FILE_LINE } from '#config/markers.ts';
import * as messages from '#cli/policy/messages.ts';

export const GSPOT_VERSION = '0.1.0';

export class VersionPinError extends Error {
    constructor(pinned: string, running: string) {
        super(messages.versionMismatch(pinned, running));
        this.name = 'VersionPinError';
    }
}

/** The pinned version, or undefined when the repository has none. */
export function pinnedVersion(root: string): string | undefined {
    const path = join(root, '.gspot', 'version');
    if (!existsSync(path)) return undefined;
    const line = readFileSync(path, 'utf8').trim();
    return line === '' ? undefined : line;
}

/** Writes the pin. */
export function writePin(root: string, version = GSPOT_VERSION): void {
    mkdirSync(join(root, '.gspot'), { recursive: true });
    writeFileSync(join(root, '.gspot', 'version'), VERSION_FILE_LINE.replace('{{version}}', version));
}

/** Throws when the repository pins another version than the running binary. */
export function assertPinMatches(root: string): void {
    const pinned = pinnedVersion(root);
    if (pinned !== undefined && pinned !== GSPOT_VERSION) throw new VersionPinError(pinned, GSPOT_VERSION);
}
