// Whether a pinned tool ships for the machine the tests run on, read from its manifest pin.
import { toolPin } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { missingBuild } from '#cli/tools/platforms.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/execution.ts';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it
 * @returns whether a native test may run it here
 */
export function toolShipsHere(name: string): boolean {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const pin = toolPin(kitManifests().values(), name);
    return missingBuild(pin, platform, process.arch) === undefined;
}
