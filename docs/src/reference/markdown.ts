import { posix } from 'node:path';

import { findAndReplace } from 'mdast-util-find-and-replace';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { type Options, toMarkdown } from 'mdast-util-to-markdown';

import { REFERENCE_FOLDERS, REFERENCE_PATH, SECTION_HEADING, TABLE_HEADING_LEVEL } from '#docs/config/reference.ts';
import type { ReferencePage } from '#docs/types/pages.ts';

const OPTION_FLAG = /(?<![\w-])--(?:[a-z][a-z-]*)?(?![\w-])/gu;
const LITERAL_CONSTRUCTS = ['htmlFlow', 'htmlText', 'autolink', 'attention', 'characterReference'];
const MARKDOWN_OPTIONS: Options = { bullet: '-', fences: true, extensions: [gfmTableToMarkdown()] };

function buildTableRow(cells: readonly string[]) {
    return {
        type: 'tableRow' as const,
        children: cells.map((cell) => {
            const [block] = fromMarkdown(formatText(cell.replaceAll('\n', ' '))).children;
            if (block !== undefined && block.type !== 'paragraph')
                throw new Error(`A table cell holds a ${block.type}: ${cell}`);
            return { type: 'tableCell' as const, children: block?.children ?? [] };
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

export function buildReferencePage(title: string, description: string | undefined, body: string): ReferencePage {
    const frontmatter: ReferencePage['data'] = {
        title,
        editUrl: false,
        ...(description !== undefined && { description }),
    };
    if (!SECTION_HEADING.test(body)) frontmatter.tableOfContents = false;
    return { data: frontmatter, body: `\n${body}` };
}

/**
Write text from the CLI, a manifest, or this site as Markdown that shows it as written. The text keeps its code spans,
code blocks, links, and lists, while HTML, emphasis, entities, and angle-bracket links stay literal text. A bare `--`
or an option such as `--hook` becomes code, so the renderer keeps its hyphens.
*/
export function formatText(text: string): string {
    const tree = fromMarkdown(text, { extensions: [{ disable: { null: LITERAL_CONSTRUCTS } }] });
    findAndReplace(tree, [OPTION_FLAG, (flag: string) => ({ type: 'inlineCode', value: flag }) as const]);
    return toMarkdown(tree, MARKDOWN_OPTIONS).trimEnd();
}

export function formatSection(title: string, body: string, level = TABLE_HEADING_LEVEL, anchor?: string): string {
    if (body === '') return '';
    const heading =
        anchor === undefined ? `${'#'.repeat(level)} ${formatText(title)}` : formatHeadingHtml(title, level, anchor);
    return `\n${heading}\n\n${body}\n`;
}

export function formatTable(header: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
    if (rows.length === 0) return '';
    const table = { type: 'table', children: [header, ...rows].map((cells) => buildTableRow(cells)) } as const;
    return toMarkdown({ type: 'root', children: [table] }, MARKDOWN_OPTIONS).trimEnd();
}

export function formatConfigurationLink(name: string, check?: string): string {
    const path = `${REFERENCE_PATH}${REFERENCE_FOLDERS.configurations}/${name}/`;
    const anchor = check === undefined ? '' : `#${posix.basename(check)}`;
    return `[\`${check ?? name}\`](${path}${anchor})`;
}
