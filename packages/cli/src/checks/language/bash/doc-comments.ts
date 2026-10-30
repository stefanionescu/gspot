import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { splitWords } from '#cli/checks/general/naming/settings.ts';
import type { ScriptFunction } from '#cli/types/parsers/code/bash.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/language/bash/scripts.ts';

import {
    WORD,
    RULES,
    VAGUE_WORDS,
    DOC_SECTIONS,
    ARGUMENTS_SECTION,
    LEADING_UNDERSCORES,
    SHELLCHECK_TOOL_COMMENT,
} from '#cli/config/checks/language/bash/doc-comments.ts';

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
            rule: RULES.missingComment,
            message: `${scriptFunction.name} has no comment above it; write "# ${scriptFunction.name}: what it does".`,
        };
    const head = `# ${scriptFunction.name}: `;
    if (!first.startsWith(head) || first.length <= head.length)
        return {
            rule: RULES.summaryLine,
            message: `The comment above ${scriptFunction.name} does not open with "# ${scriptFunction.name}: ...".`,
        };
    if (!hasWordsBeyondName(scriptFunction.name, first.slice(head.length)))
        return {
            rule: RULES.vagueSummary,
            message: `The summary of ${scriptFunction.name} says nothing beyond its name.`,
        };
    const positions = DOC_SECTIONS.map((section) => block.indexOf(section)).filter((position) => position >= 0);
    if (positions.some((position, index) => index > 0 && position <= (positions[index - 1] ?? -1)))
        return {
            rule: RULES.sectionOrder,
            message: `Order the doc sections of ${scriptFunction.name} as Globals, Arguments, Outputs, Returns.`,
        };
    return undefined;
}

/**
Reports each function without a summary line, with a vague summary, or with doc sections out of order, and each
public function that reads arguments without an Arguments section.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkBashDocComments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) => {
        return file.functions.flatMap((scriptFunction) => {
            if (scriptFunction.name === MAIN_FUNCTION) return [];
            const block = findCommentBlock(file.lines, scriptFunction.start);
            const isUndocumentedReader =
                scriptFunction.highestRead > 0 &&
                !LEADING_UNDERSCORES.test(scriptFunction.name) &&
                !block.includes(ARGUMENTS_SECTION);
            const found =
                validateDocComment(scriptFunction, block) ??
                (isUndocumentedReader
                    ? {
                          rule: RULES.missingArguments,
                          message: `${scriptFunction.name} is public and reads arguments, but its comment has no "${ARGUMENTS_SECTION}" section that lists them.`,
                      }
                    : undefined);
            return found === undefined
                ? []
                : [
                      {
                          file: file.path,
                          line: scriptFunction.start,
                          rule: found.rule,
                          message: found.message,
                      },
                  ];
        });
    });
}
