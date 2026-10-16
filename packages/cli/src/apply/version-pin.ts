import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { selectRunner } from '#cli/generation/hooks.ts';
import { VERSION_PIN_FILE } from '#cli/config/system/locations.ts';
import packageManifest from '../../package.json' with { type: 'json' };

/**
 * The pinned version, or undefined when the repository has none.
 *
 * @param repositoryRoot the folder containing the managed version file.
 *
 * @returns the version in .gspot/version.
 */
export function readVersionPin(repositoryRoot: string): string | undefined {
    using files = openFiles(repositoryRoot);
    const current = files.read(VERSION_PIN_FILE);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Throws when the repository pins a different gspot version.
 *
 * @param repositoryRoot the folder whose pin and start command determine upgrade guidance.
 */
export async function assertVersionPin(repositoryRoot: string): Promise<void> {
    const pinned = readVersionPin(repositoryRoot);
    if (pinned !== undefined && pinned !== packageManifest.version) {
        const runner = await selectRunner(repositoryRoot);
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
