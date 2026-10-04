import { JSON_HEADER, HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/parsers/generated-header.ts';

/**
 * Detect the generated gspot marker in the opening comment lines or the first JSON key.
 * @param text a file's opening text
 * @returns whether the text carries the generated marker
 */
export function hasHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line)) || JSON_HEADER.test(text);
}
