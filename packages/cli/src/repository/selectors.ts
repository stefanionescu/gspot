// Builds filename and path matchers for repository selection.
import { posix } from 'node:path';
import picomatch from 'picomatch';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/hooks.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { GLOB_EXCLUDE, TRAILING_SLASH, FOLDER_CONTENTS, GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

/**
 * Compile shared path selectors for the CLI and generated tool files.
 * @param patterns the selectors, a leading ! for an exclusion.
 * @returns the inclusions and exclusions, directories expanded.
 */
function pathExpressions(patterns: string[]): PathExpressions {
    const expanded = includeFolderContents(patterns);
    return {
        includes: expanded
            .filter((pattern) => !pattern.startsWith(GLOB_EXCLUDE))
            .map((pattern) => picomatch.makeRe(pattern, { dot: true }).source),
        excludes: expanded
            .filter((pattern) => pattern.startsWith(GLOB_EXCLUDE))
            .map((pattern) => picomatch.makeRe(pattern.slice(1), { dot: true }).source),
    };
}

/**
 * A picomatch matcher over root-relative posix paths, cached by pattern list.
 * @param patterns the globs, a leading `!` excludes.
 * @returns the matcher.
 */
export function pathMatcher(patterns: string[]): (path: string) => boolean {
    const key = JSON.stringify(patterns);
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const expressions = pathExpressions(patterns);
    const includes = expressions.includes.map((source) => new RegExp(source, 's'));
    const excludes = expressions.excludes.map((source) => new RegExp(source, 's'));
    const isMatch = (path: string): boolean =>
        includes.some((pattern) => pattern.test(path)) && !excludes.some((pattern) => pattern.test(path));
    matcherCache.set(key, isMatch);
    return isMatch;
}

/**
 * Expand literal directory selectors while retaining their inclusion or exclusion polarity.
 * @param patterns the selectors, a leading ! for an exclusion.
 * @returns the selectors, each literal path followed by everything under it.
 */
export function includeFolderContents(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith(GLOB_EXCLUDE) ? pattern.slice(1) : pattern;
        return picomatch.scan(bare).isGlob
            ? [pattern]
            : [pattern, `${pattern.replace(TRAILING_SLASH, '')}${FOLDER_CONTENTS}`];
    });
}

/**
 * Whether a repository path belongs to a gspot tool project.
 * @param path the repository-relative path.
 * @returns whether a .gspot folder contains the file.
 */
export function isInGspotFolder(path: string): boolean {
    return path.split('/').some((part) => part.toLowerCase() === DOT_GSPOT);
}

/**
 * Whether a repository path belongs to tool projects or installed npm dependencies.
 * @param path the repository-relative path.
 * @returns whether project discovery must leave out the path.
 */
export function isToolingPath(path: string): boolean {
    return isInGspotFolder(path) || path.split('/').some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part));
}

/**
 * Matches literal filenames and glob selectors against both the filename and repository path.
 * @param names the literal filenames and glob selectors.
 * @returns the same filename matcher for detection and ownership.
 */
export function filenameMatcher(names: string[]): (path: string) => boolean {
    const literals = new Set(names.filter((name) => !picomatch.scan(name).isGlob));
    const globs = pathMatcher(names.filter((name) => picomatch.scan(name).isGlob));
    return (path) => {
        const base = posix.basename(path);
        return literals.has(base) || literals.has(path) || globs(base) || globs(path);
    };
}

/**
 * Escape a repository path so glob selectors match that literal path.
 * @param path the literal repository path.
 * @returns a glob with every special character escaped.
 */
export function literalGlob(path: string): string {
    return path.replaceAll(GLOB_SPECIAL_CHARACTERS, String.raw`\$&`);
}

/**
 * True when an npm manifest holds only declared npm tools or recognized Git hook managers.
 * @param projectManifest the parsed project manifest.
 * @param npmNames declared npm installer packages.
 * @returns whether it holds tooling only.
 */
export function isToolsOnlyPackage(projectManifest: DependencyFile, npmNames: ReadonlySet<string>): boolean {
    if (projectManifest.kind !== 'package.json') return false;
    const names = Object.keys(projectManifest.installed);
    if (names.length === 0) return false;
    return names.every((name) => npmNames.has(name) || new Set<string | undefined>(HOOK_PACKAGES).has(name));
}
