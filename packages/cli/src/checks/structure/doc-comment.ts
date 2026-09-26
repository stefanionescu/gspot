import type { ScriptFunction, StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';
import { DOC_SECTIONS, ENTRY_FUNCTIONS, VAGUE_SUMMARY_WORDS } from '#cli/checks/structure/patterns.ts';

const SHELLCHECK_COMMENT = /^#\s*shellcheck\b/u;
const WORD = /[A-Za-z0-9]+/gu;

function blockAbove(lines: string[], start: number): string[] {
    const block: string[] = [];
    let index = start - 2;
    while (index >= 0) {
        const trimmed = (lines[index] ?? '').trim();
        if (!trimmed.startsWith('#')) break;
        if (!SHELLCHECK_COMMENT.test(trimmed)) block.unshift(trimmed);
        index -= 1;
    }
    return block;
}

function summaryOf(line: string, name: string, style: string): string | undefined {
    const separator = style === 'dash' ? ' - ' : ': ';
    const head = `# ${name}${separator}`;
    return line.startsWith(head) && line.length > head.length ? line.slice(head.length) : undefined;
}

function isMeaningful(name: string, summary: string): boolean {
    const nameWords = new Set(name.replace(/^_+/u, '').split('_'));
    const words = summary
        .matchAll(WORD)
        .map((match) => match[0].toLowerCase())
        .filter((word) => !VAGUE_SUMMARY_WORDS.includes(word))
        .toArray();
    return words.some((word) => !nameWords.has(word));
}

function areSectionsInOrder(block: string[]): boolean {
    const positions = DOC_SECTIONS.map((section) => block.indexOf(section)).filter((position) => position >= 0);
    return positions.every((position, index) => index === 0 || position > (positions[index - 1] ?? -1));
}

function problem(entry: ScriptFunction, block: string[], style: string): { rule: string; message: string } | undefined {
    const first = block[0];
    if (first === undefined)
        return {
            rule: 'missing',
            message: `${entry.name} has no comment above it; write "# ${entry.name}${style === 'dash' ? ' - ' : ': '}what it does".`,
        };
    const summary = summaryOf(first, entry.name, style);
    if (summary === undefined)
        return {
            rule: 'summary-line',
            message: `The comment above ${entry.name} does not open with "# ${entry.name}${style === 'dash' ? ' - ' : ': '}...".`,
        };
    if (!isMeaningful(entry.name, summary))
        return { rule: 'vague-summary', message: `The summary of ${entry.name} says nothing beyond its name.` };
    if (!areSectionsInOrder(block))
        return {
            rule: 'section-order',
            message: `The doc sections of ${entry.name} go Globals, Arguments, Outputs, Returns.`,
        };
    return undefined;
}

/**
 * One finding per function without a summary line, with a vague summary, or with doc sections out of order.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const docComment: Analysis = async (context, scripts) => {
    const style = context.bashText('doc_style', 'colon');
    const index = await scripts();
    return index.files.flatMap((file) => {
        return file.functions.flatMap((entry) => {
            if (ENTRY_FUNCTIONS.includes(entry.name)) return [];
            const found = problem(entry, blockAbove(file.lines, entry.start), style);
            return found === undefined ? [] : [context.report(file.path, entry.start, found.rule, found.message)];
        });
    });
};
