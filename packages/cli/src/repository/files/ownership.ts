import { isInside } from '#cli/system/paths.ts';
import type { Files } from '#cli/types/system.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/repository/files.ts';

export function isGspotPath(path: string): boolean {
    return path.startsWith(`${GSPOT_FOLDER}/`);
}

export function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

export function isGspotOwned(
    path: string,
    files: Files,
    generatedPatterns: string[],
    ownablePaths: ReadonlySet<string>,
): boolean {
    if (!isInside(path)) return false;
    if (isGspotPath(path)) return true;
    if (!ownablePaths.has(path)) return false;
    const file = files.readKeepingLinks(path);
    return (
        (file !== undefined && file.isSymlink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) ||
        generatedPatterns.some((pattern) => buildPathMatcher([pattern])(path))
    );
}
