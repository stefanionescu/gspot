// .gspot/version against the running binary; the exit-2 refusal with its two remedies.
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { VERSION_FILE } from '#cli/config/platform/locations.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';

/**
 * The pinned version, or undefined when the repository has none.
 * @param root the repository root
 * @returns the version in .gspot/version
 */
export function readVersionPin(root: string): string | undefined {
    using files = openRoot(root);
    const current = files.read(VERSION_FILE);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 * @param log the command's locked ownership context
 */
export function writeVersionPin(log: Log): void {
    const status = applyPlan(
        log,
        proposeReplacement(log, {
            path: VERSION_FILE,
            next: { bytes: Buffer.from(`${RUNNING_VERSION}\n`), mode: OWNER_WRITABLE_FILE },
            kind: 'pin',
            canReplace: true,
        }),
    );
    if (status === 'preserved') throw new Error(`${VERSION_FILE} was edited by hand. Delete it, then run gspot apply.`);
}

/**
 * Throws when the repository pins another version than the running binary.
 * @param root the repository root
 */
export function assertVersionPin(root: string): void {
    const pinned = readVersionPin(root);
    if (pinned !== undefined && pinned !== RUNNING_VERSION)
        throw new GspotError(
            'pin',
            [
                `This repository pins gspot ${pinned} and this binary is ${RUNNING_VERSION}.`,
                "Two ways forward: install the pinned version (mise install, or your package manager's install),",
                `or move the pin to this version: gspot apply`,
            ].join('\n'),
        );
}
