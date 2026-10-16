// Formats the ownership notice for generated files.

import { extractExtension } from '#cli/system/paths.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';

import {
    HTML_EXTENSIONS,
    JSON_EXTENSIONS,
    GENERATED_HEADER_TEXT,
    DASH_COMMENT_EXTENSIONS,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/header.ts';

function formatCommentBlock(lines: string[], mark: string): string {
    const marked = lines.map((line) => `${mark} ${line}`).join('\n');
    return `${marked}\n`;
}

/**
 * The generated notice as comments beginning with `#`.
 * @returns the comment block ending in a newline.
 */
export function hashCommentHeader(): string {
    return formatCommentBlock([GENERATED_HEADER_TEXT], '#');
}

/**
 * The generated notice outside .gspot, or an empty string for JSON.
 *
 * @param path the target path.
 *
 * @returns the comment block ending in a newline, or ''.
 */
export function formatHeader(path: string): string {
    if (isInGspotFolder(path)) return '';
    const extension = extractExtension(path);
    if (JSON_EXTENSIONS.has(extension)) return '';
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock([GENERATED_HEADER_TEXT], '//');
    if (HTML_EXTENSIONS.has(extension)) {
        const indented = [GENERATED_HEADER_TEXT].map((line) => `  ${line}`).join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (DASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock([GENERATED_HEADER_TEXT], '--');
    return hashCommentHeader();
}
