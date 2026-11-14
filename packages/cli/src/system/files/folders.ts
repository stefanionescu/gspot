import { join } from 'node:path';
import picomatch from 'picomatch';
import { globSync } from 'tinyglobby';
import { GspotError } from '#cli/system/errors.ts';
import { statSync, lstatSync, readdirSync } from 'node:fs';
import { DRIVE_LETTER, GLOB_EXCLUDE, PARENT_SEGMENT } from '#cli/config/system.ts';

function hasSymlinkPrefix(folder: string, pattern: string): boolean {
    const { base } = picomatch.scan(pattern);
    const segments = base.split('/').filter((segment) => segment !== '' && segment !== '.');
    return segments.some(
        (_, index) =>
            lstatSync(join(folder, ...segments.slice(0, index + 1)), { throwIfNoEntry: false })?.isSymbolicLink() ===
            true,
    );
}

function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith(GLOB_EXCLUDE) ? pattern.slice(1) : pattern;
    if (bare.startsWith('/') || DRIVE_LETTER.test(bare) || PARENT_SEGMENT.test(bare))
        throw new GspotError('filesystem', `A path pattern cannot leave its folder: ${pattern}`);
}

export function listMatchingPaths(folder: string, patterns: string[]): string[] {
    for (const pattern of patterns) assertInsideFolder(pattern);
    const positive = patterns.filter(
        (pattern) => !pattern.startsWith(GLOB_EXCLUDE) && !hasSymlinkPrefix(folder, pattern),
    );
    const excluded = patterns.filter((pattern) => pattern.startsWith(GLOB_EXCLUDE)).map((pattern) => pattern.slice(1));
    return globSync(positive, {
        cwd: folder,
        dot: true,
        ignore: excluded,
        followSymbolicLinks: false,
        expandDirectories: false,
    });
}

export function measureFolder(path: string): number {
    const listed = readdirSync(path, { recursive: true, withFileTypes: true });
    const files = listed.filter((file) => file.isFile());
    return files.reduce((total, file) => total + statSync(join(file.parentPath, file.name)).size, 0);
}
