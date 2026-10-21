import semver from 'semver';
import { RUNTIME_NAMES } from '#cli/config/system/runtime.ts';

/**
 * Compare the running Node.js, or Bun when it runs gspot, with the engines floor of the package.
 *
 * @param versions the versions of the running process.
 * @param versions.node the Node.js version, which Bun also reports.
 * @param versions.bun the Bun version, when Bun runs gspot.
 * @param engines the version range of each runtime.
 * @returns the refusal, or undefined when the runtime meets the floor.
 */
export function validateRuntimeVersion(
    versions: { node: string; bun?: string | undefined },
    engines: Record<keyof typeof RUNTIME_NAMES, string>,
): string | undefined {
    const runtime = versions.bun === undefined ? 'node' : 'bun';
    const found = versions.bun ?? versions.node;
    const range = engines[runtime];
    if (semver.satisfies(found, range)) return undefined;
    const floor = semver.minVersion(range)?.version ?? range;
    return `gspot needs ${RUNTIME_NAMES[runtime]} ${floor} or newer (found ${found}).`;
}
