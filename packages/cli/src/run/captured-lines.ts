// Reads a configuration text line by line, so a pattern never scans across lines.
const SPACES = /\s+/gu;

/**
 * What one pattern captures on every line, without repeats. A line is trimmed and its runs of spaces become one.
 * @param text the configuration text
 * @param pattern a pattern with a group named found
 * @returns the captured values in order, leaving out one that holds a variable
 */
export function capturedLines(text: string, pattern: RegExp): string[] {
    const found = text
        .split('\n')
        .map((line) => pattern.exec(line.trim().replaceAll(SPACES, ' '))?.groups?.['found'] ?? '')
        .filter((item) => item !== '' && !item.includes('$'));
    return [...new Set(found)];
}
