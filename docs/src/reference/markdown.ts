import { posix } from 'node:path';
import type { ReferencePage } from '#docs/types/pages.ts';

import {
    REFERENCE_PATH,
    SECTION_HEADING,
    REFERENCE_FOLDERS,
    REFERENCE_FENCE_END,
    TABLE_HEADING_LEVEL,
    REFERENCE_CODE_FENCE,
    REFERENCE_INLINE_TOKENS,
    REFERENCE_TEXT_ENTITIES,
    REFERENCE_CODE_ENTITIES,
    REFERENCE_CODE_CHARACTERS,
} from '#docs/config/reference.ts';

function listCodeFences(text: string): Array<readonly [number, number]> {
    const ranges: Array<readonly [number, number]> = [];
    let fence: RegExpExecArray | undefined;
    for (const marker of text.matchAll(REFERENCE_CODE_FENCE)) {
        if (fence === undefined) {
            fence = marker;
            continue;
        }
        const line = marker[0].trim();
        if (!line.startsWith(fence[1] as string) || !REFERENCE_FENCE_END.test(line)) continue;
        ranges.push([fence.index, marker.index + marker[0].length]);
        fence = undefined;
    }
    if (fence !== undefined) ranges.push([fence.index, text.length]);
    return ranges;
}

function findCodeEnd(text: string, delimiter: string | undefined, start: number): number {
    if (delimiter === undefined) return -1;
    let end = text.indexOf(delimiter, start);
    while (end !== -1 && (text[end - 1] === '`' || text[end + delimiter.length] === '`')) {
        end = text.indexOf(delimiter, end + delimiter.length);
    }
    return end;
}

function formatInlineCode(text: string): string {
    const singleLine = text.replaceAll('\n', ' ');
    const content =
        singleLine.startsWith(' ') && singleLine.endsWith(' ') && singleLine.trim() !== ''
            ? singleLine.slice(1, -1)
            : singleLine;
    return `<code>${content.replaceAll(REFERENCE_CODE_CHARACTERS, (character) => REFERENCE_CODE_ENTITIES[character] as string)}</code>`;
}

function formatInlineText(text: string): string {
    let result = '';
    let cursor = 0;
    for (const token of text.matchAll(REFERENCE_INLINE_TOKENS)) {
        if (token.index < cursor) continue;
        result += text.slice(cursor, token.index);
        cursor = token.index + token[0].length;
        const { delimiter, flag } = token.groups as Record<string, string | undefined>;
        const end = findCodeEnd(text, delimiter, cursor);
        if (end !== -1) {
            result += formatInlineCode(text.slice(cursor, end));
            cursor = end + token[0].length;
            continue;
        }
        const literal = REFERENCE_TEXT_ENTITIES[token[0]] ?? token[0];
        result += flag === undefined ? literal : formatInlineCode(token[0]);
    }
    return result + text.slice(cursor);
}

/**
Build a reference page with no edit link or empty table of contents.

@param title the visible heading
@param description the one-line summary
@param body the Markdown text
*/
export function buildReferencePage(title: string, description: string, body: string): ReferencePage {
    const frontmatter: ReferencePage['data'] = { title, description, editUrl: false };
    if (!SECTION_HEADING.test(body)) frontmatter.tableOfContents = false;
    return { data: frontmatter, body: `\n${body}` };
}

/**
Escape outside text while keeping Markdown fences and rendering inline code safely, including pipes in table cells.

@param text prose, CLI help, or a manifest description that may contain Markdown code
*/
export function formatText(text: string): string {
    let cursor = 0;
    const segments = listCodeFences(text).flatMap(([start, end]) => {
        const prose = formatInlineText(text.slice(cursor, start));
        cursor = end;
        return [prose, text.slice(start, end)];
    });
    return segments.join('') + formatInlineText(text.slice(cursor));
}

/**
Format a section under a heading, or nothing for empty text.

@param title the heading
@param body the Markdown text
@param level the heading level
@param anchor the explicit HTML heading ID; with it, the title holds HTML
*/
export function formatSection(title: string, body: string, level = TABLE_HEADING_LEVEL, anchor?: string): string {
    if (body === '') return '';
    const heading =
        anchor === undefined
            ? `${'#'.repeat(level)} ${title}`
            : `<h${String(level)} id="${anchor}">${title}</h${String(level)}>`;
    return `\n${heading}\n\n${body}\n`;
}

/**
Format a Markdown table.

@param header the column titles
@param rows the cells of each line, in Markdown; the table escapes them
@returns the table, or nothing without rows
*/
export function formatTable(header: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
    if (rows.length === 0) return '';
    const cells = rows.map((row) => row.map((cell) => formatText(cell).replaceAll('\n', ' ')));
    return [header, header.map(() => '---'), ...cells].map((line) => `| ${line.join(' | ')} |`).join('\n');
}

/**
Link a configuration or one of its checks to the generated reference.

@param name the selected configuration whose page the link opens
@param check the full check ID, when linking to a check
*/
export function formatConfigurationLink(name: string, check?: string): string {
    const path = `${REFERENCE_PATH}${REFERENCE_FOLDERS.configurations}/${name}/`;
    const anchor = check === undefined ? '' : `#${posix.basename(check)}`;
    return `[\`${check ?? name}\`](${path}${anchor})`;
}
