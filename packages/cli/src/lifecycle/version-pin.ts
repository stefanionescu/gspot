import * as messages from '#cli/policy/messages.ts';
import packageManifest from '#package' with { type: 'json' };
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
// .gspot/version against the running binary; the exit-2 refusal with its two remedies.
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

const { version: GSPOT_VERSION } = packageManifest;

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
    const current = openConfinedRoot(root).read('.gspot/version');
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 * @param root the repository root
 * @param version the version to pin
 */
export function writePin(root: string, version = GSPOT_VERSION): void {
    withLifecycleOwner(root, (owner) => {
        const status = owner.replace(
            '.gspot/version',
            { bytes: Buffer.from(`${version}\n`), mode: 0o644 },
            'pin',
            true,
        );
        if (status === 'preserved')
            throw new Error('The version pin was edited; preserve or restore it before applying.');
    });
}

/**
 * Throws when the repository pins another version than the running binary.
 * @param root the repository root
 */
export function assertPinMatches(root: string): void {
    const pinned = pinnedVersion(root);
    if (pinned !== undefined && pinned !== GSPOT_VERSION) throw new VersionPinError(pinned, GSPOT_VERSION);
}
