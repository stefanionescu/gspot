// Whether a pinned tool ships for the machine the tests run on, read from its manifest pin.
import { toolPin } from '#cli/tools/inspect.ts';
import { missingBuild } from '#cli/tools/platforms.ts';
import { PLATFORM_NAMES } from '#cli/constants/execution/execution.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it
 * @returns whether a native test may run it here
 */
export function toolShipsHere(name: string): boolean {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const pin = toolPin(configurationManifests().values(), name);
    return missingBuild(pin, platform, process.arch) === undefined;
}
