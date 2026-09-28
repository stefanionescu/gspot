import type { Code } from 'mdast';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { guideSections } from '#cli/agents/sections.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { RuleText, RuleExample } from '#cli/types/agents.ts';

function exampleBlock(file: string, node: Code, sections: { start: number; end: number }[]): RuleExample {
    if (node.position === undefined) throw new Error('A parsed example has no source position.');
    const { line, offset } = node.position.start;
    if (offset === undefined) throw new Error('A parsed example has no source offset.');
    return {
        file,
        line,
        language: node.lang ?? '',
        body: `${node.value}\n`,
        level: sections.some((section) => offset >= section.start && offset < section.end) ? 'all' : 'recommended',
    };
}

/**
 * Extract fenced examples explicitly marked good. Preserve their source and selected level.
 * @param file the authored guide.
 * @returns examples with their original fence positions and unmodified code.
 */
export function ruleExamples(file: RuleText): RuleExample[] {
    const sections = guideSections(file.text).filter((section) => section.all);
    const examples: RuleExample[] = [];
    visit(fromMarkdown(file.text), 'code', (node, index, parent) => {
        if (index === undefined || parent === undefined) return;
        const label = parent.children[index - 1];
        if (label?.type !== 'paragraph' && label?.type !== 'heading') return;
        if (!/^Good\b/u.test(toString(label))) return;
        examples.push(exampleBlock(file.path, node, sections));
    });
    return examples;
}

/**
 * Discover Good examples across the shipped guide assets for native verification.
 * @returns examples retaining their guide-relative paths and selected levels.
 */
export function allRuleExamples(): RuleExample[] {
    const prefix = 'packages/cli/guides/';
    const paths = listAssets(prefix).filter((path) => path.endsWith('.md'));
    return paths.flatMap((path) => ruleExamples({ path: path.slice(prefix.length), text: readAsset(path) }));
}
