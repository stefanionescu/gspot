import { posix } from 'node:path';

import {
    CARRYOVER_ROW_START,
    COMMENT_PATTERN,
    IGNORE_FILES,
    IGNORE_REASON_START,
} from '#cli/config/generation/setup.ts';
import { LEADING_SLASH, LINE_BREAK, TRAILING_SLASH } from '#cli/config/system.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { CarryoverInput, CarryoverSection } from '#cli/types/generation.ts';

function convertIgnoreFile(path: string, text: string, tracked: string[]): { paths: string[]; dropped: string[] } {
    const folder = posix.dirname(path) === '.' ? '' : posix.dirname(path);
    const patterns = text
        .split(LINE_BREAK)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !COMMENT_PATTERN.test(line));
    const kept = patterns.filter((pattern) => !pattern.startsWith('!'));
    const paths = kept.flatMap((pattern) => convertIgnorePattern(pattern, folder, tracked) ?? []);
    return { paths: [...new Set(paths)], dropped: patterns.filter((pattern) => pattern.startsWith('!')) };
}

export function convertIgnorePattern(pattern: string, folder: string, tracked: string[]): string | undefined {
    const inFolder = tracked.filter((path) => folder === '' || path.startsWith(`${folder}/`));
    const base = pattern.replace(LEADING_SLASH, '').replace(TRAILING_SLASH, '');
    const isAnchored = pattern.slice(0, -1).includes('/');
    const glob = joinScope(folder, isAnchored ? base : `**/${base}`);
    return [glob, `${glob}/**`].find((selector) => {
        const isMatched = buildPathMatcher([selector]);
        return inFolder.some((path) => isMatched(path));
    });
}

export function readIgnoreFiles({ repository, tools }: CarryoverInput): CarryoverSection {
    const tracked = repository.files.filter(({ path }) => !isGspotPath(path)).map(({ path }) => path);
    const owned = IGNORE_FILES.filter(({ tool }) => tools.has(tool)).flatMap(({ file, tool, check }) =>
        tracked
            .filter((path) => posix.basename(path) === file)
            .map((path) => ({ path, tool, check, text: findText(repository.root, path) ?? '' })),
    );
    const converted = owned.map((each) => ({ ...each, ...convertIgnoreFile(each.path, each.text, tracked) }));
    return {
        tools: {},
        ignore: converted
            .filter(({ paths }) => paths.length > 0)
            .map(({ path, paths, check }) => ({ check, paths, reason: `${IGNORE_REASON_START} ${path}.` })),
        rows: converted.map(({ path, tool, paths, dropped }) => ({
            ...CARRYOVER_ROW_START,
            path,
            tool,
            carried: paths,
            dropped,
        })),
    };
}
