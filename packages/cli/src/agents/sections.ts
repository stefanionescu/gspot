import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Policy } from '#cli/types/policy/policy.ts';

/**
 * Locate heading sections and their level markers without treating fenced headings as structure.
 * @param text the authored Markdown guide.
 * @returns source ranges and level markers for each heading.
 */
export function guideSections(text: string): { start: number; end: number; all: boolean }[] {
    const nodes = fromMarkdown(text).children;
    const headings = nodes.flatMap((node, index) => {
        if (node.type !== 'heading') return [];
        const start = node.position?.start.offset;
        if (start === undefined) throw new Error('A parsed guide heading has no source position.');
        const marker = nodes[index + 1];
        return [
            { start, depth: node.depth, all: marker?.type === 'html' && marker.value.trim() === '<!-- level: all -->' },
        ];
    });
    return headings.map((heading, index) => ({
        ...heading,
        end: headings.slice(index + 1).find((next) => next.depth <= heading.depth)?.start ?? text.length,
    }));
}

/**
 * Omits marked Markdown sections, including their subsections, at the recommended level.
 * @param text the authored guide with Markdown level markers.
 * @param level the selected enforcement level.
 * @returns the original bytes outside excluded sections.
 */
export function selectedSections(text: string, level: Policy['level']): string {
    if (level === 'all') return text;
    let through = 0;
    const output: string[] = [];
    for (const section of guideSections(text).filter((entry) => entry.all)) {
        if (section.start < through) continue;
        output.push(text.slice(through, section.start));
        through = section.end;
    }
    output.push(text.slice(through));
    return output.join('');
}
