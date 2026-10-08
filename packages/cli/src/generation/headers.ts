import { extensionOf } from '#cli/platform/paths.ts';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import type { JsonFormat } from '#cli/types/generation/formatting.ts';
import { GENERATED_JSON_KEY } from '#cli/config/parsers/generated-header.ts';

import {
    HTML_EXTENSIONS,
    JSON_EXTENSIONS,
    GENERATED_HEADER_LINES,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/headers.ts';

function commented(lines: string[], mark: string): string {
    const marked = lines.map((line) => `${mark} ${line}`).join('\n');
    return `${marked}\n`;
}

/**
 * The header lines for a version.
 * @param version the gspot version
 * @returns the header lines
 */
function headerLines(version: string): string[] {
    return GENERATED_HEADER_LINES.map((line) => line.replaceAll('{{version}}', () => version));
}

/**
 * The generated notice as comments beginning with `#`.
 * @param version the gspot version
 * @returns the comment block ending in a newline
 */
export function hashCommentHeader(version: string): string {
    return commented(headerLines(version), '#');
}

/**
 * The header as a comment for a target path, or '' for JSON, which carries it as a key.
 * @param path the target path
 * @param version the gspot version
 * @returns the comment block ending in a newline, or ''
 */
export function headerFor(path: string, version: string): string {
    const extension = extensionOf(path);
    if (JSON_EXTENSIONS.has(extension)) return '';
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return commented(headerLines(version), '//');
    if (HTML_EXTENSIONS.has(extension)) {
        const indented = headerLines(version)
            .map((line) => `  ${line}`)
            .join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (extension === '.sql') return commented(headerLines(version), '--');
    return hashCommentHeader(version);
}

/**
 * Puts the header into emitted JSON as the first key, formatted the way the repository's Prettier settings format it.
 * @param emitted the emitted JSON text
 * @param version the gspot version
 * @param format the print width and indent width
 * @returns the JSON text with the header key first
 */
export function addJsonHeader(emitted: string, version: string, format: JsonFormat): string {
    const parsed = parseJsonRecord(emitted);
    const ordered: Record<string, unknown> = { [GENERATED_JSON_KEY]: headerLines(version).join(' ') };
    for (const [key, value] of Object.entries(parsed)) if (key !== GENERATED_JSON_KEY) ordered[key] = value;
    return jsonText(ordered, format);
}
