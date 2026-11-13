import { posix } from 'node:path';

import {
    GENERATED_HEADER_TEXT,
    JSON_EXTENSIONS,
    SLASH_COMMENT_EXTENSIONS,
    SLASH_COMMENT_FILES,
} from '#cli/config/generation/files.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { extractExtension } from '#cli/system/paths.ts';

export function formatHeader(path: string, notes: string[] = []): string {
    if (isGspotPath(path)) return '';
    const extension = extractExtension(path);
    const isSlashComment = SLASH_COMMENT_EXTENSIONS.has(extension) || SLASH_COMMENT_FILES.has(posix.basename(path));
    if (!isSlashComment && JSON_EXTENSIONS.has(extension)) return '';
    const lines = [GENERATED_HEADER_TEXT, ...notes];
    const mark = isSlashComment ? '//' : '#';
    const comments = lines.map((line) => (line === '' ? mark : `${mark} ${line}`));
    return `${comments.join('\n')}\n`;
}
