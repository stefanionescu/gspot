import { sourceRevision } from '../revision';
import packageManifest from '@gspot/cli/package.json' with { type: 'json' };

export type ReferencePage = {
    data: { title: string; description: string; editUrl: string };
    body: string;
};

/** Preserve definition attribution and build provenance without serializing metadata into Markdown. */
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

export function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

export function section(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

export function table(header: string[], rows: string[][]): string {
    return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

export function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}
