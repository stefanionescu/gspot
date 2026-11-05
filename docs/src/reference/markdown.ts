import { posix } from 'node:path';

import type { TableRow } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { type Options, toMarkdown } from 'mdast-util-to-markdown';

import { REFERENCE_FOLDERS, REFERENCE_PATH, SECTION_HEADING, TABLE_HEADING_LEVEL } from '#docs/config/reference.ts';
import type { ReferencePage } from '#docs/types/pages.ts';

const OPTION_FLAG = /(?<![\w-])--(?:[a-z][a-z-]*)?(?![\w-])/gu;
const LITERAL_CONSTRUCTS = ['htmlFlow', 'htmlText', 'autolink', 'attention', 'characterReference'];
const MARKDOWN_OPTIONS: Options = { bullet: '-', fences: true, extensions: [gfmTableToMarkdown()] };

function buildTableRow(cells: readonly string[]): TableRow {
    return {
        type: 'tableRow',
        children: cells.map((cell) => {
            const [block] = fromMarkdown(formatText(cell.replaceAll('\n', ' '))).children;
            if (block !== undefined && block.type !== 'paragraph')
                throw new Error(`A table cell holds a ${block.type}: ${cell}`);
            return { type: 'tableCell', children: block?.children ?? [] };
        }),
    };
}

function formatHeadingHtml(title: string, level: number, anchor: string): string {
    const [block] = fromMarkdown(formatText(title)).children;
    if (block?.type !== 'paragraph') throw new Error(`A heading needs text: ${title}`);
    const content = block.children.map((node) => {
        if (node.type !== 'text' && node.type !== 'inlineCode')
            throw new Error(`A heading with an anchor holds only text and code: ${title}`);
        const text = node.value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        return node.type === 'text' ? text : `<code>${text}</code>`;
    });
    return `<h${String(level)} id="${anchor}">${content.join('')}</h${String(level)}>`;
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
Write text from the CLI, a manifest, or this site as Markdown that shows it as written. The text keeps its code spans,
code blocks, links, and lists, while HTML, emphasis, entities, and angle-bracket links stay literal text. A bare `--`
or an option such as `--hook` becomes code, so the renderer keeps its hyphens.

@param text prose, CLI help, or a manifest description that may contain Markdown code
*/
export function formatText(text: string): string {
    const tree = fromMarkdown(text, { extensions: [{ disable: { null: LITERAL_CONSTRUCTS } }] });
    findAndReplace(tree, [OPTION_FLAG, (flag: string) => ({ type: 'inlineCode', value: flag }) as const]);
    return toMarkdown(tree, MARKDOWN_OPTIONS).trimEnd();
}

/**
Format a section under a heading, or nothing for empty text.

@param title the heading, in Markdown
@param body the Markdown text
@param level the heading level
@param anchor the explicit HTML heading ID
*/
export function formatSection(title: string, body: string, level = TABLE_HEADING_LEVEL, anchor?: string): string {
    if (body === '') return '';
    const heading =
        anchor === undefined ? `${'#'.repeat(level)} ${formatText(title)}` : formatHeadingHtml(title, level, anchor);
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
    const table = { type: 'table', children: [header, ...rows].map((cells) => buildTableRow(cells)) } as const;
    return toMarkdown({ type: 'root', children: [table] }, MARKDOWN_OPTIONS).trimEnd();
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
