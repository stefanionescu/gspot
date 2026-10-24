import { posix } from 'node:path';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { extractExtension } from '#cli/system/paths.ts';

import {
    JSON_EXTENSIONS,
    GENERATED_EDIT_LINE,
    SLASH_COMMENT_FILES,
    GENERATED_HEADER_TEXT,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/header.ts';

/**
Format the header of a generated file outside .gspot.

@param path the generated file.
@param notes lines to add after the header text.
@returns the comment block with a final newline, or '' inside .gspot and for JSON that takes no comments.
*/
export function formatHeader(path: string, notes: string[] = []): string {
    if (path.startsWith(`${DOT_GSPOT}/`)) return '';
    const extension = extractExtension(path);
    const isSlashComment = SLASH_COMMENT_EXTENSIONS.has(extension) || SLASH_COMMENT_FILES.has(posix.basename(path));
    if (JSON_EXTENSIONS.has(extension) && !isSlashComment) return '';
    const lines = [GENERATED_HEADER_TEXT, GENERATED_EDIT_LINE, ...(notes.length === 0 ? [] : ['', ...notes])];
    const mark = isSlashComment ? '//' : '#';
    return lines.map((line) => (line === '' ? mark : `${mark} ${line}`)).join('\n') + '\n';
}
