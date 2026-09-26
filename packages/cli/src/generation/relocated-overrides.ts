// Moving Prettier overrides from the folder they were written in to a configuration generated elsewhere.

type Basename = { isNegated: boolean; basename: string };
type Group<Options> = {
    patterns: string[];
    excluded: string[];
    options: Options;
    hasSlash: boolean;
    base: string;
    fromConfig: (pattern: string) => string;
};

const LEADING_GLOBSTARS = /^(?:\*\*\/)+/u;
const GLOB_GROUPING = /[{}()]/u;

// A selector list as written: one string or several.
function asList(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

// A negation keeps its mark in front of the moved selector.
function relocated(pattern: string, place: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${place(pattern.slice(1))}` : place(pattern);
}

// Prettier matches every exclusion of a basename group against the basename, where a slash never occurs.
function basenamesOf(excluded: string[]): Basename[] {
    return excluded.map((pattern) => {
        const isNegated = pattern.startsWith('!');
        const body = isNegated ? pattern.slice(1) : pattern;
        return { isNegated, basename: body.replace(LEADING_GLOBSTARS, '') };
    });
}

// Refuses a basename exclusion whose grouping would change meaning once a folder is put in front of it.
function assertRelocatable(basenames: Basename[]): void {
    if (basenames.some(({ basename }) => basename.includes('/') && GLOB_GROUPING.test(basename)))
        throw new Error(
            'Prettier cannot relocate this basename exclusion without changing its meaning. Keep the original configuration active.',
        );
}

// The exclusions of a group after the move: path exclusions relocated, basename exclusions anchored under the base.
function exclusionsOf<Options>(group: Group<Options>, basenames: Basename[]): string[] {
    if (group.hasSlash) return group.excluded.map((pattern) => relocated(pattern, group.fromConfig));
    return basenames
        .filter(({ basename }) => !basename.includes('/'))
        .map(({ isNegated, basename }) => {
            const moved = group.fromConfig(`**/${basename}`);
            return isNegated ? `!${moved}` : moved;
        });
}

// Below a folder, a negated selector becomes the folder less that selector, so it reaches no file outside.
function folderOverrides<Options>(
    group: Group<Options>,
    place: (selector: string) => string,
    exclusions: string[],
): NativeOverride<Options>[] {
    const included = group.patterns.filter((pattern) => !pattern.startsWith('!'));
    const complements = group.patterns
        .filter((pattern) => pattern.startsWith('!'))
        .map((pattern) => ({
            files: [group.fromConfig('**/*')],
            excludeFiles: [place(pattern.slice(1)), ...exclusions],
            options: group.options,
        }));
    const own =
        included.length === 0
            ? []
            : [
                  {
                      files: included.map((selector) => place(selector)),
                      excludeFiles: exclusions,
                      options: group.options,
                  },
              ];
    return [...own, ...complements];
}

// The overrides one group of selectors moves to: none when a negated exclusion already excludes every file.
function relocatedGroup<Options>(group: Group<Options>): NativeOverride<Options>[] {
    const { patterns, excluded, options, hasSlash, base, fromConfig } = group;
    if (!hasSlash && base === '') return [{ files: patterns, excludeFiles: excluded, options }];
    const basenames = basenamesOf(excluded);
    if (!hasSlash) {
        assertRelocatable(basenames);
        // A negated exclusion that no basename matches excludes every file of the group.
        if (basenames.some(({ isNegated, basename }) => isNegated && basename.includes('/'))) return [];
    }
    const exclusions = exclusionsOf(group, basenames);
    const place = (selector: string): string => fromConfig(hasSlash ? selector : `**/${selector}`);
    if (base === '')
        return [{ files: patterns.map((pattern) => relocated(pattern, place)), excludeFiles: exclusions, options }];
    return folderOverrides(group, place, exclusions);
}

/**
 * A path as a glob that matches only itself.
 * @param path the literal path
 * @returns the path with every glob character escaped
 */
export function literalGlob(path: string): string {
    return path.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
}

/**
 * Relocate native selectors while retaining Prettier's separate basename and relative-path matching.
 * @param entries the authored overrides
 * @param base the folder the authored file lived in, relative to the root
 * @param prefix the path from the generated file's folder back to the root
 * @returns the overrides with their selectors moved
 */
export function relocatedOverrides<Options>(
    entries: NativeOverride<Options>[],
    base: string,
    prefix: string,
): NativeOverride<Options>[] {
    const fromConfig = (pattern: string): string =>
        [prefix, literalGlob(base), pattern].filter((part) => part !== '' && part !== '.').join('/');
    return entries.flatMap((entry) => {
        const files = asList(entry.files);
        const excluded = asList(entry.excludeFiles);
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            return relocatedGroup({ patterns, excluded, options: entry.options, hasSlash, base, fromConfig });
        });
    });
}

/**
 * The lists of an override as lists, whether they were written as one string or several.
 * @param entry the override
 * @returns the override with list-valued files and exclusions
 */
export function listedOverride<Options>(entry: NativeOverride<Options>): {
    files: string[];
    excludeFiles: string[];
    options: Options;
} {
    return { files: asList(entry.files), excludeFiles: asList(entry.excludeFiles), options: entry.options };
}

export type NativeOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};
