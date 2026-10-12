import type { ReferencePage } from '../types/reference.ts';
import { MARKDOWN_ESCAPES, HTML_BRACKET_ENTITIES } from '../config/reference.ts';

/**
 * Build a reference page with literal markup in metadata and no editor link.
 * @param title the page title
 * @param description the one-line description
 * @param body the Markdown body
 * @returns the page
 */
export function referencePage(title: string, description: string, body: string): ReferencePage {
    return {
        data: { title, description, editUrl: false },
        body: `\n${body.replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)}`,
    };
}
/**
 * A level-two section, or nothing for an empty body.
 * @param title the heading
 * @param body the Markdown body
 * @returns the section
 */
export function section(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

/**
 * A Markdown table.
 * @param header the column titles
 * @param rows the cells of each row
 * @returns the table
 */
export function table(header: string[], rows: string[][]): string {
    return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

/**
 * Text safe inside a table cell: pipes escaped and line breaks flattened.
 * @param text the cell text
 * @returns the escaped text
 */
export function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}
