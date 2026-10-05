import { findingAt } from '#cli/execution/finding.ts';
import type { ScriptFunction } from '#cli/types/parsers/bash.ts';
import type { Engine, Finding } from '#cli/types/execution/runtime.ts';
import { entryFunctions, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { WORD, VAGUE_WORDS, BASH_DOC_SECTIONS, SHELLCHECK_DIRECTIVE } from '#cli/config/checks/language/bash.ts';

function blockAbove(lines: string[], start: number): string[] {
    const block: string[] = [];
    let index = start - 1;
    while (index > 0) {
        index -= 1;
        const trimmed = (lines[index] ?? '').trim();
        if (!trimmed.startsWith('#')) break;
        if (!SHELLCHECK_DIRECTIVE.test(trimmed)) block.unshift(trimmed);
    }
    return block;
}

function isMeaningful(name: string, summary: string): boolean {
    const nameWords = new Set(name.replace(/^_+/u, '').split('_'));
    const words = summary
        .matchAll(WORD)
        .map((match) => match[0].toLowerCase())
        .filter((word) => !VAGUE_WORDS.includes(word))
        .toArray();
    return words.some((word) => !nameWords.has(word));
}

function docProblem(
    entry: ScriptFunction,
    block: string[],
    separator: string,
): Required<Pick<Finding, 'rule' | 'message'>> | undefined {
    const first = block[0];
    if (first === undefined)
        return {
            rule: 'missing-comment',
            message: `${entry.name} has no comment above it; write "# ${entry.name}${separator}what it does".`,
        };
    const head = `# ${entry.name}${separator}`;
    if (!first.startsWith(head) || first.length <= head.length)
        return {
            rule: 'summary-line',
            message: `The comment above ${entry.name} does not open with "# ${entry.name}${separator}...".`,
        };
    if (!isMeaningful(entry.name, first.slice(head.length)))
        return { rule: 'vague-summary', message: `The summary of ${entry.name} says nothing beyond its name.` };
    const positions = BASH_DOC_SECTIONS.map((section) => block.indexOf(section)).filter((position) => position >= 0);
    if (!positions.every((position, index) => index === 0 || position > (positions[index - 1] ?? -1)))
        return {
            rule: 'section-order',
            message: `The doc sections of ${entry.name} go Globals, Arguments, Outputs, Returns.`,
        };
    return undefined;
}

/**
 * One finding per function without a summary line, with a vague summary, or with doc sections out of order.
 * @param input the check context
 * @returns the findings
 */
export const docComments: Engine = async (input) => {
    const style = input.view.settings['bash.doc_style'];
    const separator = style === 'dash' ? ' - ' : ': ';
    const entries = entryFunctions(input);
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        return file.functions.flatMap((entry) => {
            if (entries.has(entry.name)) return [];
            const found = docProblem(entry, blockAbove(file.lines, entry.start), separator);
            return found === undefined
                ? []
                : [findingAt(input, { file: file.path, line: entry.start }, found.rule, found.message)];
        });
    });
};
