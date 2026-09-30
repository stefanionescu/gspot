import { sourceRevision } from '../revision.ts';
import type { ReferencePage } from '../../types/reference.ts';
import packageManifest from '@gspothq/cli/package.json' with { type: 'json' };

/**
 * Preserve definition attribution and build provenance without serializing metadata into Markdown.
 * @param title the page title
 * @param description the one-line description
 * @param body the Markdown body
 * @param owner the source file the page is generated from
 * @returns the page with its edit link
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every reference page links its source definition at the build revision; this spells that link once.
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
 * A level-two section, or nothing when the body is empty.
 * @param title the heading
 * @param body the Markdown body
 * @returns the section
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every reference page drops an empty section and spells a heading this one way.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every reference table escapes pipes and line breaks in its cells by this one rule.
export function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}
