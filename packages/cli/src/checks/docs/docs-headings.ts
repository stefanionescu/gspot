import { join } from 'node:path';
import { readFileSync } from 'node:fs';
// A Markdown heading from the banned list: an inventory where an explanation belongs.
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { BANNED_HEADINGS } from '#cli/checks/docs/docs-definitions.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';

/**
 * One finding per heading that matches the banned list or [tools.docs] banned_headings.
 * @param input the engine input
 * @returns the findings
 */
export function docsHeadings(input: EngineInput): Promise<Finding[]> {
    const extra = (input.view.tool('docs')['banned_headings'] as string[] | undefined) ?? [];
    const banned = new Set([...BANNED_HEADINGS, ...extra.map((heading) => heading.toLowerCase())]);
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.nature !== 'source' || !file.path.endsWith('.md')) continue;
        const tree = fromMarkdown(readFileSync(join(input.root, file.path), 'utf8'));
        visit(tree, 'heading', (heading) => {
            const text = toString(heading).trim().toLowerCase();
            if (banned.has(text))
                findings.push({
                    check: input.spec.name,
                    file: file.path,
                    line: heading.position?.start.line ?? 1,
                    rule: 'banned-heading',
                    message: `The heading "${text}" promises an inventory; explain the thing instead.`,
                    fixable: false,
                });
        });
    }
    return Promise.resolve(findings);
}
