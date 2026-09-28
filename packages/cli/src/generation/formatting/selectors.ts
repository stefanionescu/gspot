// Moving Prettier overrides from the folder they were written in to a configuration generated elsewhere.
import { GLOB_GROUPING, LEADING_GLOBSTARS } from '#cli/constants/generation.ts';
import type { ExcludedBasename, FormatSelectorGroup, NativeOverride, FormatOverride } from '#cli/types/generation.ts';

// A selector list as written: one string or several.
function asList(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

// A negation keeps its mark in front of the moved selector.
function rebasePattern(pattern: string, mapPattern: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${mapPattern(pattern.slice(1))}` : mapPattern(pattern);
}

// Path exclusions move with their source; basename exclusions stay inside that source folder.
function exclusionsOf<Options>(group: FormatSelectorGroup<Options>, basenames: ExcludedBasename[]): string[] {
    if (group.hasSlash) return group.excluded.map((pattern) => rebasePattern(pattern, group.fromGeneratedFile));
    return basenames
        .filter(({ basename }) => !basename.includes('/'))
        .map(({ isNegated, basename }) => {
            const moved = group.fromGeneratedFile(`**/${basename}`);
            return isNegated ? `!${moved}` : moved;
        });
}

// Below a folder, a negated selector becomes the folder less that selector, so it reaches no file outside.
function folderOverrides<Options>(
    group: FormatSelectorGroup<Options>,
    mapPattern: (selector: string) => string,
    exclusions: string[],
): FormatOverride<Options>[] {
    const included = group.patterns.filter((pattern) => !pattern.startsWith('!'));
    const complements = group.patterns
        .filter((pattern) => pattern.startsWith('!'))
        .map((pattern) => ({
            files: [group.fromGeneratedFile('**/*')],
            excludeFiles: [mapPattern(pattern.slice(1)), ...exclusions],
            options: group.options,
        }));
    const own =
        included.length === 0
            ? []
            : [
                  {
                      files: included.map((selector) => mapPattern(selector)),
                      excludeFiles: exclusions,
                      options: group.options,
                  },
              ];
    return [...own, ...complements];
}

// The overrides one group of selectors moves to: none when a negated exclusion already excludes every file.
function rebaseGroup<Options>(group: FormatSelectorGroup<Options>): FormatOverride<Options>[] {
    const { patterns, excluded, options, hasSlash, sourceDirectory, fromGeneratedFile } = group;
    if (!hasSlash && sourceDirectory === '') return [{ files: patterns, excludeFiles: excluded, options }];
    const basenames: ExcludedBasename[] = excluded.map((pattern) => {
        const isNegated = pattern.startsWith('!');
        const body = isNegated ? pattern.slice(1) : pattern;
        return { isNegated, basename: body.replace(LEADING_GLOBSTARS, '') };
    });
    if (!hasSlash) {
        if (basenames.some(({ basename }) => basename.includes('/') && GLOB_GROUPING.test(basename)))
            throw new Error(
                'Prettier cannot relocate this basename exclusion without changing its meaning. Keep the original configuration active.',
            );
        // A negated exclusion that no basename matches excludes every file of the group.
        if (basenames.some(({ isNegated, basename }) => isNegated && basename.includes('/'))) return [];
    }
    const exclusions = exclusionsOf(group, basenames);
    const mapPattern = (selector: string): string => fromGeneratedFile(hasSlash ? selector : `**/${selector}`);
    if (sourceDirectory === '')
        return [
            { files: patterns.map((pattern) => rebasePattern(pattern, mapPattern)), excludeFiles: exclusions, options },
        ];
    return folderOverrides(group, mapPattern, exclusions);
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
 * Relocate native selectors while retaining the separate Prettier basename and relative-path matching.
 * @param entries the authored overrides.
 * @param sourceDirectory the folder the authored file lived in, relative to the root.
 * @param outputPrefix the path from the generated file's folder back to the root.
 * @returns the overrides with their selectors moved.
 */
export function rebaseOverrides<Options>(
    entries: NativeOverride<Options>[],
    sourceDirectory: string,
    outputPrefix: string,
): FormatOverride<Options>[] {
    const fromGeneratedFile = (pattern: string): string =>
        [outputPrefix, literalGlob(sourceDirectory), pattern].filter((part) => part !== '' && part !== '.').join('/');
    return entries.flatMap((entry) => {
        const files = asList(entry.files);
        const excluded = asList(entry.excludeFiles);
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            return rebaseGroup({
                patterns,
                excluded,
                options: entry.options,
                hasSlash,
                sourceDirectory,
                fromGeneratedFile,
            });
        });
    });
}
