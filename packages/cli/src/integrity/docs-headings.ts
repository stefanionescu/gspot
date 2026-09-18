// A Markdown heading from the banned list: an inventory where an explanation belongs.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { BANNED_HEADINGS } from '#config/docs.ts';

const HEADING = /^#{1,6} (?<text>.*)$/u;

function headingText(line: string): string | undefined {
    const text = HEADING.exec(line)?.groups?.['text'];
    if (text === undefined) return undefined;
    let trimmed = text.trimEnd();
    while (trimmed.endsWith('#')) trimmed = trimmed.slice(0, -1);
    return trimmed.trim().toLowerCase();
}

/**
 * One finding per heading that matches the banned list or [tools.docs] banned_headings.
 * @param input the engine input
 * @returns the findings
 */
export function docsHeadings(input: EngineInput): Promise<Finding[]> {
    const extra = (input.view.tool('docs')['banned_headings'] as string[] | undefined) ?? [];
    const banned = new Set([...BANNED_HEADINGS, ...extra.map((heading) => heading.toLowerCase())]);
    const findings = input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.md'))
        .flatMap((file) =>
            readFileSync(join(input.root, file.path), 'utf8')
                .split('\n')
                .flatMap((line, index) => {
                    const text = headingText(line);
                    if (text === undefined || !banned.has(text)) return [];
                    return [
                        {
                            check: input.spec.id,
                            file: file.path,
                            line: index + 1,
                            rule: 'banned-heading',
                            message: `The heading "${text}" promises an inventory; explain the thing instead.`,
                            fixable: false,
                        },
                    ];
                }),
        );
    return Promise.resolve(findings);
}
