import { visit } from 'unist-util-visit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { CodeFence } from '#cli/types/parsers/formats/markdown.ts';

/**
List code blocks with their language, attributes, and source lines.

@param text the Markdown source.
@returns the blocks in source order, including blocks without a language tag.
*/
export function listCodeFences(text: string): CodeFence[] {
    const fences: CodeFence[] = [];
    visit(fromMarkdown(text), 'code', (node) => {
        if (node.position === undefined) return;
        fences.push({
            language: node.lang ?? '',
            meta: node.meta ?? '',
            body: node.value,
            startLine: node.position.start.line,
            endLine: node.position.end.line,
        });
    });
    return fences;
}
