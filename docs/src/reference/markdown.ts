import type { ReferencePage } from '../types/reference.ts';

import {
    REFERENCE_PATH,
    MARKDOWN_ESCAPES,
    REFERENCE_FOLDERS,
    FLAGS_OUTSIDE_CODE,
    HTML_BRACKET_ENTITIES,
} from '../config/reference.ts';

// Lists names the way a sentence does, with a serial comma before the last one.
const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

/**
 * Build a reference page with escaped markup and no edit link.
 *
 * @param title the visible heading
 * @param description the one-line summary
 * @param body the Markdown text
 * @returns the page data and its escaped Markdown
 */
export function buildReferencePage(title: string, description: string, body: string): ReferencePage {
    // A flag outside code goes into a code span, so Markdown does not turn its two hyphens into a dash.
    const escaped = body
        .replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)
        .replaceAll(FLAGS_OUTSIDE_CODE, (text) => (text.startsWith('`') ? text : `\`${text}\``));
    return { data: { title, description, editUrl: false }, body: `\n${escaped}` };
}

/**
 * Format a level-two section, or nothing for empty text.
 *
 * @param title the heading
 * @param body the Markdown text
 * @returns the heading and its text, or an empty string
 */
export function formatSection(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

/**
 * Format a Markdown table.
 *
 * @param header the column titles
 * @param rows the cells of each line, in Markdown; the table escapes them
 * @returns the table, with a separator line under the header, or nothing without rows
 */
export function formatTable(header: string[], rows: string[][]): string {
    if (rows.length === 0) return '';
    // A cell keeps a pipe as text and holds one line.
    const cells = rows.map((row) => row.map((cell) => cell.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ')));
    return [header, header.map(() => '---'), ...cells].map((line) => `| ${line.join(' | ')} |`).join('\n');
}

/**
 * Join names the way a sentence lists them.
 *
 * @param names the names, already formatted
 * @returns the names as one phrase, such as a, b, and c
 */
export function formatList(names: string[]): string {
    return LIST_FORMAT.format(names);
}

/**
 * Build the canonical route of a reference index or named page.
 *
 * @param folder the reference section.
 * @param name the page name, or empty for the index.
 * @returns the absolute site path.
 */
export function formatReferencePath(folder: keyof typeof REFERENCE_FOLDERS, name: string): string {
    return `${REFERENCE_PATH}${REFERENCE_FOLDERS[folder]}/${name === '' ? '' : name + '/'}`;
}
