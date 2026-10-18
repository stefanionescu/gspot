import { GspotError } from '#cli/system/errors.ts';
import { selectRunner } from '#cli/generation/hooks.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import packageManifest from '#cli-package' with { type: 'json' };

/**
 * Throw when the repository pins a different gspot version.
 *
 * @param repositoryRoot the folder with the pin and the start command.
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
