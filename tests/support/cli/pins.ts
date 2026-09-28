// Tool pins for inspection tests: a binary found on a path and a library found in the private installation.
import type { ToolPin } from '#cli/types/configurations.ts';

/**
 * A library pin installed through npm.
 * @param name the package name
 * @param version the pinned version
 * @returns the pin
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A library pin installed through npm. 3 files make 9 calls; one owner keeps that behavior in one place.
export function libraryPin(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, windows: true, installers: { npm: { name, version } } };
}

/**
 * A binary pin, installed through npm when a package name is given.
 * @param name the executable name
 * @param version the pinned version
 * @param npm the npm package that ships it
 * @returns the pin
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A binary pin, installed through npm when a package name is given. 3 files make 18 calls; one owner keeps that behavior in one place.
export function commandPin(name: string, version: string, npm?: string): ToolPin {
    return {
        name,
        kind: 'binary',
        version,
        windows: true,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}
