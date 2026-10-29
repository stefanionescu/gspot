import { gt } from 'semver';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { selectStartRunner } from '#cli/repository/npm/package-manager.ts';
import { UPGRADE_PIN_MESSAGE } from '#cli/config/repository/version-pin.ts';

/**
Read the pinned gspot version.

@param root the folder that holds .gspot/version.
@returns undefined when the repository has no pin.
*/
export function readVersionPin(root: string): string | undefined {
    using files = openFiles(root);
    const onDisk = files.read(GSPOT_PATHS.versionPin);
    if (onDisk === undefined) return undefined;
    const line = onDisk.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
Throw when the repository pins a different gspot version.

@param root the folder with the pin and the start command.
*/
export function assertVersionPin(root: string): void {
    const versionPin = readVersionPin(root);
    if (versionPin === undefined || versionPin === cliPackage.version) return;
    const runner = selectStartRunner(root);
    const command = runner.installCommand.replace('<version>', () => versionPin);
    if (gt(versionPin, cliPackage.version))
        throw new GspotError(
            'pin',
            `This repository pins gspot ${versionPin}, newer than this gspot ${cliPackage.version}.\nInstall the pinned version: ${command}`,
        );
    throw new GspotError(
        'pin',
        [
            `This repository pins gspot ${versionPin}, and you are running gspot ${cliPackage.version}.`,
            `Install the pinned version: ${command}`,
            UPGRADE_PIN_MESSAGE,
        ].join('\n'),
    );
}
