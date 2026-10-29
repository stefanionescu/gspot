import type { ReferencePage } from '#docs/types/reference.ts';

import {
    MARKDOWN_ESCAPES,
    FLAGS_OUTSIDE_CODE,
    TABLE_HEADING_LEVEL,
    HTML_BRACKET_ENTITIES,
} from '#docs/config/reference.ts';

/**
Build a reference page with escaped markup and no edit link.

@param title the visible heading
@param description the one-line summary
@param body the Markdown text
*/
export function buildReferencePage(title: string, description: string, body: string): ReferencePage {
    const escaped = body
        .replaceAll(MARKDOWN_ESCAPES, (text) => HTML_BRACKET_ENTITIES[text] ?? text)
        .replaceAll(FLAGS_OUTSIDE_CODE, (text) => (text.startsWith('`') ? text : `\`${text}\``));
    return { data: { title, description, editUrl: false }, body: `\n${escaped}` };
}

/**
Format a section under a heading, or nothing for empty text.

@param title the heading
@param body the Markdown text
@param level the heading level
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, formatCheckSection passes the complexity limit.
export function formatSection(title: string, body: string, level = TABLE_HEADING_LEVEL): string {
    return body === '' ? '' : `\n${'#'.repeat(level)} ${title}\n\n${body}\n`;
}

/**
Format a Markdown table.

@param header the column titles
@param rows the cells of each line, in Markdown; the table escapes them
@returns the table, or nothing without rows
*/
export function formatTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
    if (rows.length === 0) return '';
    const cells = rows.map((row) => row.map((cell) => cell.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ')));
    return [header, header.map(() => '---'), ...cells].map((line) => `| ${line.join(' | ')} |`).join('\n');
}
