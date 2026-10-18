import type { ReferencePage } from '../types/reference.ts';
import { MARKDOWN_ESCAPES, FLAGS_OUTSIDE_CODE, HTML_BRACKET_ENTITIES } from '../config/reference.ts';

// Lists names the way a sentence does, with a serial comma before the last one.
const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

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
        // A flag outside code goes into a code span, so Markdown does not turn its two hyphens into a dash.
        body: `\n${body
            .replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)
            .replaceAll(FLAGS_OUTSIDE_CODE, (text) => (text.startsWith('`') ? text : '`' + text + '`'))}`,
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
 * @returns the table, with a separator line under the header, or nothing without rows
 */
export function formatTable(header: string[], rows: string[][]): string {
    if (rows.length === 0) return '';
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
 * @param rows each name, its meaning, and the anchor of the name if it has one
 * @returns the HTML list, with Markdown inside each item
 */
export function formatDefinitions(rows: [name: string, meaning: string, id?: string][]): string {
    return (
        '<dl>\n\n' +
        rows
            .map(([name, meaning, id]) => {
                const term = id === undefined ? '<dt>' : `<dt id="${id}">`;
                return `${term}\n\n${name}\n\n</dt>\n<dd>\n\n${meaning}\n\n</dd>`;
            })
            .join('\n\n') +
        '\n\n</dl>'
    );
}

/**
 * Join names the way a sentence lists them.
 * @param names the names, already formatted
 * @returns the names as one phrase, such as a, b, and c
 */
export function formatList(names: string[]): string {
    return LIST_FORMAT.format(names);
}
