import semver from 'semver';
import { RUNTIME_NAMES } from '#cli/config/system/runtime.ts';

/**
Compare the running Node.js, or Bun when it runs gspot, with the minimum versions in the engines field of the
package.

@param versions the versions of the running process.
@param versions.node the Node.js version, which Bun also reports.
@param versions.bun the Bun version, when Bun runs gspot.
@param engines the version range of each runtime.
@returns the refusal, or undefined when the runtime meets the minimum.
*/
export function validateRuntimeVersion(
    versions: { node: string; bun?: string | undefined },
    engines: Record<keyof typeof RUNTIME_NAMES, string>,
): string | undefined {
    const runtime = versions.bun === undefined ? 'node' : 'bun';
    const found = versions.bun ?? versions.node;
    const range = engines[runtime];
    if (semver.satisfies(found, range)) return undefined;
    const minimum = semver.minVersion(range)?.version ?? range;
    return `gspot needs ${RUNTIME_NAMES[runtime]} ${minimum} or newer (found ${found}).`;
}

/**
Check whether the command asks for JSON output, before Commander reads the arguments. The words after the `--`
separator belong to the command, not to gspot.

@param commandArguments the arguments after the program name.
@returns whether `--json` comes before the separator.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function isJsonRequested(commandArguments: readonly string[]): boolean {
    const end = commandArguments.indexOf('--');
    return (end === -1 ? commandArguments : commandArguments.slice(0, end)).includes('--json');
}
