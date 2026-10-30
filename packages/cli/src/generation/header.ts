import { posix } from 'node:path';
import { extractExtension } from '#cli/system/paths.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

import {
    JSON_EXTENSIONS,
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
    if (path.startsWith(`${GSPOT_FOLDER}/`)) return '';
    const extension = extractExtension(path);
    const isSlashComment = SLASH_COMMENT_EXTENSIONS.has(extension) || SLASH_COMMENT_FILES.has(posix.basename(path));
    if (JSON_EXTENSIONS.has(extension) && !isSlashComment) return '';
    const lines = [GENERATED_HEADER_TEXT, ...notes];
    const mark = isSlashComment ? '//' : '#';
    return lines.map((line) => (line === '' ? mark : `${mark} ${line}`)).join('\n') + '\n';
}
