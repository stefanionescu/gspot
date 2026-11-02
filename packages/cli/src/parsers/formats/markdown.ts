import { visit } from 'unist-util-visit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { CodeFence, SourceComment } from '#cli/types/parsers.ts';

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
            attributes: node.meta ?? '',
            body: node.value,
            startLine: node.position.start.line,
            endLine: node.position.end.line,
        });
    });
    return fences;
}

/**
List the prose of a Markdown file, without code, link targets, or front matter.

@param text the Markdown source.
@returns each text node with the line where it starts.
*/
export function listMarkdownTexts(text: string): Pick<SourceComment, 'line' | 'text'>[] {
    const texts: Pick<SourceComment, 'line' | 'text'>[] = [];
    visit(fromMarkdown(text), 'text', (node) => {
        if (node.position !== undefined) texts.push({ line: node.position.start.line, text: node.value });
    });
    return texts;
}
