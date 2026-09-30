// Tool pins for inspection tests: a binary found on a path and a library found in the private installation.
import type { ToolPin } from '#cli/types/kits.ts';

/**
 * A library pin installed through npm.
 * @param name the package name
 * @param version the pinned version
 * @returns the pin
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inspection tests build a library pin that npm installs this one way.
export function libraryPin(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, installers: { npm: { name, version } } };
}

/**
 * A binary pin, installed through npm when a package name is given.
 * @param name the executable name
 * @param version the pinned version
 * @param npm the npm package that ships it
 * @returns the pin
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inspection tests build a binary pin, with an optional npm package, this one way.
export function commandPin(name: string, version: string, npm?: string): ToolPin {
    return {
        name,
        kind: 'binary',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}
