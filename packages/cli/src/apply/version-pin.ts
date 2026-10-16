import { GspotError } from '#cli/errors.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { startRunner } from '#cli/generation/hooks.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { VERSION_PIN_FILE } from '#cli/config/system/locations.ts';
import packageManifest from '../../package.json' with { type: 'json' };

/**
 * The pinned version, or undefined when the repository has none.
 *
 * @param root the repository root.
 *
 * @returns the version in .gspot/version.
 */
export function readVersionPin(root: string): string | undefined {
    using files = openSafeFolder(root);
    const current = files.read(VERSION_PIN_FILE);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 *
 * @param log the command's locked ownership log.
 */
export function writeVersionPin(log: Writer): void {
    const plan = planReplacement(log, {
        path: VERSION_PIN_FILE,
        next: { bytes: Buffer.from(`${packageManifest.version}\n`), mode: OWNER_WRITABLE_FILE },
        canReplace: true,
    });
    if (plan.status === 'preserved')
        throw new Error(`${VERSION_PIN_FILE} was edited by hand. Delete it, then run gspot apply.`);
    writePlans(log, [plan]);
}

/**
 * Throws when the repository pins a different gspot version.
 *
 * @param root the repository root.
 */
export async function assertVersionPin(root: string): Promise<void> {
    const pinned = readVersionPin(root);
    if (pinned !== undefined && pinned !== packageManifest.version) {
        const runner = await startRunner(root);
        const command =
            runner.name === 'mise'
                ? runner.pin.replace('<version>', pinned)
                : `${runner.pin} ${packageManifest.name}@${pinned}`;
        throw new GspotError(
            'pin',
            [
                `This repository pins gspot ${pinned}, and you are running gspot ${packageManifest.version}.`,
                `Install the pinned version: ${command}`,
                'To upgrade the repository pin to this version: gspot apply',
            ].join('\n'),
        );
    }
}
