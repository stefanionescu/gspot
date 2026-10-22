import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { selectStartRunner } from '#cli/repository/npm/package-manager.ts';

/**
 * Read the pinned gspot version.
 *
 * @param repositoryRoot the folder that holds .gspot/version.
 *
 * @returns the version, or undefined when the repository has no pin.
 */
export function readVersionPin(repositoryRoot: string): string | undefined {
    using files = openFiles(repositoryRoot);
    const current = files.read(GSPOT_PATHS.versionPin);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Throw when the repository pins a different gspot version.
 *
 * @param repositoryRoot the folder with the pin and the start command.
 */
export async function assertVersionPin(repositoryRoot: string): Promise<void> {
    const pinned = readVersionPin(repositoryRoot);
    if (pinned !== undefined && pinned !== cliPackage.version) {
        const runner = await selectStartRunner(repositoryRoot);
        const command = runner.installCommand.replace('<version>', pinned);
        throw new GspotError(
            'pin',
            [
                `This repository pins gspot ${pinned}, and you are running gspot ${cliPackage.version}.`,
                `Install the pinned version: ${command}`,
                'To upgrade the repository pin to this version: gspot apply',
            ].join('\n'),
        );
    }
}
