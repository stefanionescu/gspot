import semver from 'semver';
import cliPackage from '#cli-package' with { type: 'json' };

/**
Take the lowest Node.js version that the engines range of gspot allows. The range ships with gspot, so a range that
allows no version is a broken package.
*/
function getMinimumNodeVersion(): string {
    const minimum = semver.minVersion(cliPackage.engines.node);
    if (minimum === null) throw new Error(`The engines range ${cliPackage.engines.node} allows no Node.js version.`);
    return minimum.version;
}

export const MINIMUM_NODE_VERSION = getMinimumNodeVersion();

export function validateRuntimeVersion(versions: { node: string }): string | undefined {
    if (semver.satisfies(versions.node, cliPackage.engines.node, { includePrerelease: true })) return undefined;
    return `gspot needs Node.js ${MINIMUM_NODE_VERSION} or newer (found ${versions.node}). If your terminal has a newer Node.js, this Git client gives hooks another PATH. Start it from a terminal, or add that folder to its PATH.`;
}
