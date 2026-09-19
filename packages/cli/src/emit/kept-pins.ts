// Merging tool pins into a package.json: a version the repository already holds stays when it is the newer one.
import semver from 'semver';

// A version that names a place (a folder, a link, a workspace, a git source) was put there on purpose, and stays.
const PLACED = /^(?:file:|link:|workspace:|git\+|github:|https?:)/u;

function isNewer(held: string | undefined, pinned: string): boolean {
    if (held !== undefined && PLACED.test(held)) return true;
    const mine = semver.valid(held);
    const theirs = semver.valid(pinned);
    return mine !== null && theirs !== null && semver.gt(mine, theirs);
}

/**
 * The devDependencies after gspot adds its pins. A pin never lowers an exact version the repository holds.
 * @param held the devDependencies of the repository
 * @param pins the versions gspot pins
 * @returns the merged table
 */
export function mergedPins(
    held: Record<string, string> | undefined,
    pins: Record<string, string>,
): Record<string, string> {
    const kept = Object.entries(pins).map(([name, version]): [string, string] => {
        const mine = held?.[name];
        return [name, mine !== undefined && isNewer(mine, version) ? mine : version];
    });
    return { ...held, ...Object.fromEntries(kept) };
}

/**
 * Whether the repository already satisfies every pin: the same version, or a newer exact one.
 * @param held the devDependencies of the repository
 * @param pins the versions gspot pins
 * @returns true when nothing needs writing
 */
export function hasEveryPin(held: Record<string, string> | undefined, pins: Record<string, string>): boolean {
    return Object.entries(pins).every(([name, version]) => held?.[name] === version || isNewer(held?.[name], version));
}
