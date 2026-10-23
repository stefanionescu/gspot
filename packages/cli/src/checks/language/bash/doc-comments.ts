import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { ScriptFunction } from '#cli/types/parsers/code/bash.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/language/bash/script-layout.ts';

import {
    WORD,
    VAGUE_WORDS,
    BASH_DOC_SECTIONS,
    LEADING_UNDERSCORES,
    SHELLCHECK_TOOL_COMMENT,
} from '#cli/config/checks/language/bash/doc-comments.ts';

function findCommentBlock(lines: string[], start: number): string[] {
    const block: string[] = [];
    let index = start - 1;
    while (index > 0) {
        index -= 1;
        const trimmed = (lines[index] ?? '').trim();
        if (!trimmed.startsWith('#')) break;
        if (!SHELLCHECK_TOOL_COMMENT.test(trimmed)) block.unshift(trimmed);
    }
    return block;
}

function isMeaningful(name: string, summary: string): boolean {
    const nameWords = new Set(name.replace(LEADING_UNDERSCORES, '').split('_'));
    const words = summary
        .matchAll(WORD)
        .map((match) => match[0].toLowerCase())
        .filter((word) => !VAGUE_WORDS.has(word))
        .toArray();
    return words.some((word) => !nameWords.has(word));
}

function validateDocComment(
    scriptFunction: ScriptFunction,
    block: string[],
): Required<Pick<Finding, 'rule' | 'message'>> | undefined {
    const first = block[0];
    if (first === undefined)
        return {
            rule: 'missing-comment',
            message: `${scriptFunction.name} has no comment above it; write "# ${scriptFunction.name}: what it does".`,
        };
    const head = `# ${scriptFunction.name}: `;
    if (!first.startsWith(head) || first.length <= head.length)
        return {
            rule: 'summary-line',
            message: `The comment above ${scriptFunction.name} does not open with "# ${scriptFunction.name}: ...".`,
        };
    if (!isMeaningful(scriptFunction.name, first.slice(head.length)))
        return {
            rule: 'vague-summary',
            message: `The summary of ${scriptFunction.name} says nothing beyond its name.`,
        };
    const positions = BASH_DOC_SECTIONS.map((section) => block.indexOf(section)).filter((position) => position >= 0);
    if (!positions.every((position, index) => index === 0 || position > (positions[index - 1] ?? -1)))
        return {
            rule: 'section-order',
            message: `Order the doc sections of ${scriptFunction.name} as Globals, Arguments, Outputs, Returns.`,
        };
    return undefined;
}

/**
 * Reports each function without a summary line, with a vague summary, or with doc sections out of order.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts to read.
 * @returns the findings.
 */
export async function checkBashDocComments(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) => {
        return file.functions.flatMap((scriptFunction) => {
            if (scriptFunction.name === MAIN_FUNCTION) return [];
            const found = validateDocComment(scriptFunction, findCommentBlock(file.lines, scriptFunction.start));
            return found === undefined
                ? []
                : [buildFinding(planned, { file: file.path, line: scriptFunction.start }, found.rule, found.message)];
        });
    });
}
