import { visit } from 'unist-util-visit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { CodeFence, ProseLine, SourceComment } from '#cli/types/parsers.ts';

export function listCodeFences(text: string): CodeFence[] {
    const fences: CodeFence[] = [];
    visit(fromMarkdown(text), 'code', (node) => {
        if (node.position === undefined) return;
        fences.push({
            language: node.lang ?? '',
            attributes: node.meta ?? '',
            body: node.value,
            startLine: node.position.start.line,
            endLine: node.position.end.line,
        });
    });
    return fences;
}

export function listMarkdownTexts(text: string): Array<Pick<SourceComment, 'line' | 'text'>> {
    const texts: Array<Pick<SourceComment, 'line' | 'text'>> = [];
    visit(fromMarkdown(text), 'text', (node) => {
        if (node.position !== undefined) texts.push({ line: node.position.start.line, text: node.value });
    });
    return texts;
}

/**
List the lines of a Markdown text that hold prose: text, inline code, link definitions, and the fences that
`isCommandFence` accepts.
*/
export function extractProseLines(
    text: string,
    isCommandFence: (language: string | null | undefined, attributes: string | null | undefined) => boolean,
): ProseLine[] {
    const lines: ProseLine[] = [];
    const addLines = (
        value: string,
        position: { start: { line: number } } | undefined,
        { isFenced }: { isFenced: boolean },
    ): void => {
        const first = (position?.start.line ?? 1) + (isFenced ? 1 : 0);
        for (const [index, line] of value.split('\n').entries())
            lines.push({ number: first + index, text: line, command: isFenced });
    };
    visit(fromMarkdown(text), (node) => {
        if (node.type === 'code' && isCommandFence(node.lang, node.meta))
            addLines(node.value, node.position, { isFenced: true });
        else if (node.type === 'definition') addLines(node.url, node.position, { isFenced: false });
        else if (node.type === 'text' || node.type === 'inlineCode')
            addLines(node.value, node.position, { isFenced: false });
    });
    return lines;
}
