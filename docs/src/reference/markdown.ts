import type { ReferencePage } from '../types/reference.ts';
import { MARKDOWN_ESCAPES, HTML_BRACKET_ENTITIES } from '../config/reference.ts';

/**
 * Build a reference page with escaped markup and no edit link.
 * @param title the visible heading
 * @param description the one-line summary
 * @param body the Markdown text
 * @returns the page data and its escaped Markdown
 */
export function buildReferencePage(title: string, description: string, body: string): ReferencePage {
    return {
        data: { title, description, editUrl: false },
        body: `\n${body.replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)}`,
    };
}
/**
 * Format a level-two section, or nothing for empty text.
 * @param title the heading
 * @param body the Markdown text
 * @returns the heading and its text, or an empty string
 */
export function formatSection(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

/**
 * Format a Markdown table.
 * @param header the column titles
 * @param rows the cells, as one list per table line
 * @returns the table, with a separator line under the header
 */
export function formatTable(header: string[], rows: string[][]): string {
    return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

/**
 * Escape pipes and flatten line breaks so the content fits in one table cell.
 * @param text the cell content
 * @returns the escaped text
 */
export function escapeCell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

/**
 * Format name and meaning pairs as a definition list that fits a narrow screen.
 * @param rows each name and its meaning
 * @returns the HTML list, with Markdown inside each item
 */
export function formatDefinitions(rows: [string, string][]): string {
    return (
        '<dl>\n\n' +
        rows.map(([name, meaning]) => `<dt>\n\n${name}\n\n</dt>\n<dd>\n\n${meaning}\n\n</dd>`).join('\n\n') +
        '\n\n</dl>'
    );
}
