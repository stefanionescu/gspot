import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import { findingAt } from '#cli/checks/result.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { readSource } from '#cli/repository/sources.ts';
import { BANNED_HEADINGS } from '#cli/config/checks/docs.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';

/**
 * One finding per heading that matches the banned list or [tools.docs] banned_headings.
 * @param input the engine input
 * @returns the findings
 */
export function docsHeadings(input: EngineInput): Finding[] {
    const extra = (input.view.tool('docs')['banned_headings'] as string[] | undefined) ?? [];
    const banned = new Set([...BANNED_HEADINGS, ...extra.map((heading) => heading.toLowerCase())]);
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source' || !file.path.endsWith('.md')) continue;
        const tree = fromMarkdown(readSource(input.root, file.path, input.reads).toString('utf8'));
        visit(tree, 'heading', (heading) => {
            const text = toString(heading).trim().toLowerCase();
            if (banned.has(text))
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: heading.position?.start.line ?? 1 },
                        'banned-heading',
                        `The heading "${text}" promises an inventory; explain the thing instead.`,
                    ),
                );
        });
    }
    return findings;
}
