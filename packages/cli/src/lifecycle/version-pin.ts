// .gspot/version against the running binary; the exit-2 refusal with its two remedies.
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';

const { version: RUNNING_VERSION } = packageManifest;

/**
 * The pinned version, or undefined when the repository has none.
 * @param root the repository root
 * @returns the version in .gspot/version
 */
export function getPin(root: string): string | undefined {
    const current = openRoot(root).read('.gspot/version');
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 * @param root the repository root
 * @param version the version to pin
 */
export function setPin(root: string, version = RUNNING_VERSION): void {
    asOwner(root, (owner) => {
        const status = owner.replace(
            '.gspot/version',
            { bytes: Buffer.from(`${version}\n`), mode: OWNER_WRITABLE_FILE },
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
    const pinned = getPin(root);
    if (pinned !== undefined && pinned !== RUNNING_VERSION)
        throw new GspotError('pin', messages.versionMismatch(pinned, RUNNING_VERSION));
}
