import { sourceRevision } from '../revision.ts';
import type { ReferencePage } from '../../types/reference.ts';
import packageManifest from '@gspot/cli/package.json' with { type: 'json' };

/**
 * Preserve definition attribution and build provenance without serializing metadata into Markdown.
 * @param title the page title
 * @param description the one-line description
 * @param body the Markdown body
 * @param owner the source file the page is generated from
 * @returns the page with its edit link
 */
export function referencePage(
    title: string,
    description: string,
    body: string,
    owner = 'packages/cli/src/policy/schema.ts',
): ReferencePage {
    const source = `https://github.com/stefanionescu/gspot/blob/${sourceRevision}/${owner}`;
    return {
        data: { title, description, editUrl: source },
        body: `\ngspot ${packageManifest.version} · [Source definition](${source})\n\n${body}`,
    };
}

/**
 * A Markdown bullet list.
 * @param items one line per bullet
 * @returns the list
 */
export function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

/**
 * A level-two section, or nothing when the body is empty.
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
