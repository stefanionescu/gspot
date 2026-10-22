// Formats the header of generated files.

import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { extractExtension } from '#cli/system/paths.ts';

import {
    JSON_EXTENSIONS,
    GENERATED_EDIT_LINE,
    GENERATED_HEADER_TEXT,
    DASH_COMMENT_EXTENSIONS,
    HTML_COMMENT_EXTENSIONS,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/header.ts';

function formatCommentBlock(lines: string[], mark: string): string {
    const marked = lines.map((line) => (line === '' ? mark : `${mark} ${line}`)).join('\n');
    return `${marked}\n`;
}

/**
 * Format the header of a generated file outside .gspot.
 *
 * @param path the generated file.
 * @param notes lines to add after the header text.
 * @returns the comment block with a final newline, or '' inside .gspot and for JSON.
 */
export function formatHeader(path: string, notes: string[] = []): string {
    if (path.startsWith(`${DOT_GSPOT}/`)) return '';
    const extension = extractExtension(path);
    if (JSON_EXTENSIONS.has(extension)) return '';
    const lines = [GENERATED_HEADER_TEXT, GENERATED_EDIT_LINE, ...(notes.length === 0 ? [] : ['', ...notes])];
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock(lines, '//');
    if (HTML_COMMENT_EXTENSIONS.has(extension)) {
        const indented = lines.map((line) => `  ${line}`).join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (DASH_COMMENT_EXTENSIONS.has(extension)) return formatCommentBlock(lines, '--');
    return formatCommentBlock(lines, '#');
}
