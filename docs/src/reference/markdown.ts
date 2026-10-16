import type { ReferencePage } from '../types/reference.ts';
import { MARKDOWN_ESCAPES, HTML_BRACKET_ENTITIES } from '../config/reference.ts';

/**
 * Build a reference page with literal markup in metadata and no editor link.
 * @param title the visible heading stored in the collection metadata.
 * @param description the one-line description
 * @param body the Markdown body
 * @returns collection data with escaped body markup and the editor link disabled.
 */
export function buildReferencePage(title: string, description: string, body: string): ReferencePage {
    return {
        data: { title, description, editUrl: false },
        body: `\n${body.replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)}`,
    };
}
/**
 * A level-two section, or nothing for an empty body.
 * @param title the heading
 * @param body the Markdown body
 * @returns a second-level heading followed by its content, or an empty string.
 */
export function formatSection(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

/**
 * A Markdown table.
 * @param header the column titles
 * @param rows the cells of each row
 * @returns pipe-separated rows with a separator after the column headings.
 */
export function formatTable(header: string[], rows: string[][]): string {
    return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

/**
 * Text safe inside a table cell: pipes escaped and line breaks flattened.
 * @param text content that must stay within one rendered table column.
 * @returns the escaped text
 */
export function escapeCell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

/**
 * Name-and-meaning rows that fit a narrow screen.
 * @param rows each name and its meaning
 * @returns a Markdown-aware definition list
 */
export function formatDefinitions(rows: [string, string][]): string {
    return (
        '<dl>\n\n' +
        rows.map(([name, meaning]) => `<dt>\n\n${name}\n\n</dt>\n<dd>\n\n${meaning}\n\n</dd>`).join('\n\n') +
        '\n\n</dl>'
    );
}
