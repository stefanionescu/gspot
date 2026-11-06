import semver from 'semver';

export function validateRuntimeVersion(versions: { node: string }, engines: { node: string }): string | undefined {
    if (semver.satisfies(versions.node, engines.node, { includePrerelease: true })) return undefined;
    const minimum = semver.minVersion(engines.node)?.version ?? engines.node;
    return `gspot needs Node.js ${minimum} or newer (found ${versions.node}). If your terminal has a newer Node.js, this Git client gives hooks another PATH. Start it from a terminal, or add that folder to its PATH.`;
}
