// Formats the ownership notice for generated files.

import { extractExtension } from '#cli/system/paths.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';

import {
    HTML_EXTENSIONS,
    JSON_EXTENSIONS,
    GENERATED_EDIT_LINE,
    GENERATED_HEADER_TEXT,
    DASH_COMMENT_EXTENSIONS,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/header.ts';

function formatCommentBlock(lines: string[], mark: string): string {
    const marked = lines.map((line) => (line === '' ? mark : `${mark} ${line}`)).join('\n');
    return `${marked}\n`;
}

/**
 * Format the generated-file notice for a file outside .gspot.
 *
 * @param path the generated file.
 * @param notes lines to add after the notice.
 * @returns the comment block with a final newline, or '' for JSON.
 */
function formatHeader(path: string, notes: string[] = []): string {
    if (isInGspotFolder(path)) return '';
    const extension = extractExtension(path);
    const lines = [GENERATED_HEADER_TEXT, GENERATED_EDIT_LINE, ...(notes.length === 0 ? [] : ['', ...notes])];
    if (JSON_EXTENSIONS.has(extension)) return '';
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock(lines, '//');
    if (HTML_EXTENSIONS.has(extension)) {
        const indented = lines.map((line) => `  ${line}`).join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (DASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock(lines, '--');
    return formatCommentBlock(lines, '#');
}

export { formatHeader };
