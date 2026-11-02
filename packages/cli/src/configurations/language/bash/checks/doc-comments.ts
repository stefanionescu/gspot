import { splitWords } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import type { ScriptFunction } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';

import {
    WORD,
    VAGUE_WORDS,
    DOC_SECTIONS,
    MAIN_FUNCTION,
    DOC_COMMENT_RULES,
    ARGUMENTS_SECTION,
    LEADING_UNDERSCORES,
    SHELLCHECK_TOOL_COMMENT,
} from '#cli/config/configurations/bash.ts';

function findCommentBlock(lines: string[], start: number): string[] {
    const block: string[] = [];
    let index = start - 1;
    while (index > 0) {
        index -= 1;
        const trimmed = (lines[index] ?? '').trim();
        if (!trimmed.startsWith('#') || (index === 0 && trimmed.startsWith('#!'))) break;
        if (!SHELLCHECK_TOOL_COMMENT.test(trimmed)) block.unshift(trimmed);
    }
    return block;
}

function hasWordsBeyondName(name: string, summary: string): boolean {
    const nameWords = new Set(splitWords(name));
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
): Required<Pick<CheckFinding, 'rule' | 'message'>> | undefined {
    const first = block[0];
    if (first === undefined)
        return {
            rule: DOC_COMMENT_RULES.missingComment,
            message: `${scriptFunction.name} has no comment above it; write "# ${scriptFunction.name}: what it does".`,
        };
    const head = `# ${scriptFunction.name}: `;
    if (!first.startsWith(head) || first.length <= head.length)
        return {
            rule: DOC_COMMENT_RULES.summaryLine,
            message: `The comment above ${scriptFunction.name} does not open with "# ${scriptFunction.name}: ...".`,
        };
    if (!hasWordsBeyondName(scriptFunction.name, first.slice(head.length)))
        return {
            rule: DOC_COMMENT_RULES.vagueSummary,
            message: `The summary of ${scriptFunction.name} says nothing beyond its name.`,
        };
    const positions = DOC_SECTIONS.map((section) => block.indexOf(section)).filter((position) => position >= 0);
    if (positions.some((position, index) => index > 0 && position <= (positions[index - 1] ?? -1)))
        return {
            rule: DOC_COMMENT_RULES.sectionOrder,
            message: `Order the doc sections of ${scriptFunction.name} as Globals, Arguments, Outputs, Returns.`,
        };
    return undefined;
}

function findDocCommentFinding(
    scriptFunction: ScriptFunction,
    lines: string[],
): Pick<CheckFinding, 'rule' | 'message'> | undefined {
    const block = findCommentBlock(lines, scriptFunction.start);
    const isUndocumentedReader =
        scriptFunction.highestRead > 0 &&
        !LEADING_UNDERSCORES.test(scriptFunction.name) &&
        !block.includes(ARGUMENTS_SECTION);
    return (
        validateDocComment(scriptFunction, block) ??
        (isUndocumentedReader
            ? {
                  rule: DOC_COMMENT_RULES.missingArguments,
                  message: `${scriptFunction.name} is public and reads arguments, but its comment has no "${ARGUMENTS_SECTION}" section that lists them.`,
              }
            : undefined)
    );
}

/**
Reports each function without a summary line, with a vague summary, or with doc sections out of order, and each
public function that reads arguments without an Arguments section.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkBashDocComments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.functions.flatMap((scriptFunction) => {
            if (scriptFunction.name === MAIN_FUNCTION) return [];
            const found = findDocCommentFinding(scriptFunction, file.lines);
            return found === undefined ? [] : [{ file: file.path, line: scriptFunction.start, ...found }];
        }),
    );
}
