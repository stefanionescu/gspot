import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

import type { CodeFence, SourceComment } from '#cli/types/parsers.ts';

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
