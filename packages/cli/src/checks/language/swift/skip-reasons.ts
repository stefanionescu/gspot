import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';

import {
    COMMENT_LINE,
    XCTEST_PREFIX,
    REASON_GROUP_INDEX,
    DISABLED_TEST_RULE,
    SKIP_REASON_ARGUMENT,
    SWIFT_STRING_LITERAL,
    DISABLED_TEST_MESSAGE,
} from '#cli/config/checks/language/swift/skip-reasons.ts';

function hasReason(reason: Node | undefined): boolean {
    if (reason === undefined || reason.text === 'nil') return false;
    if (!reason.type.endsWith('string_literal')) return true;
    const literal = SWIFT_STRING_LITERAL.exec(reason.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[REASON_GROUP_INDEX] ?? '').replaceAll(whitespace, ' ').trim() !== '';
}

function findSkipReason(call: Node, position: number): Node | undefined {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    const positional =
        argumentsNode?.namedChildren.filter(
            (node) => node.type === 'value_argument' && node.childForFieldName('name') === null,
        ) ?? [];
    return positional[position]?.childForFieldName('value') ?? undefined;
}

function listUnexplainedSkips(syntaxRoot: Node, lines: string[]): Node[] {
    const calls = syntaxRoot.descendantsOfType('call_expression').filter((call) => {
        const name = call.firstNamedChild?.text.replace(XCTEST_PREFIX, '') ?? '';
        const position = SKIP_REASON_ARGUMENT.get(name);
        return position !== undefined && !hasReason(findSkipReason(call, position));
    });
    const attributes = syntaxRoot.descendantsOfType('attribute').filter((attribute) => {
        if (
            attribute.firstNamedChild?.text !== 'available' ||
            !attribute.namedChildren.some((node) => node.type === 'simple_identifier' && node.text === 'unavailable')
        )
            return false;
        const reasonArgument =
            attribute.namedChildren.find((node) => node.text === 'message')?.nextNamedSibling ?? undefined;
        return !hasReason(reasonArgument) && !COMMENT_LINE.test(lines[attribute.startPosition.row - 1] ?? '');
    });
    return [...calls, ...attributes];
}

/**
Reports each skipped test without a reason, and each unavailable declaration without an explanation.

@param session the repository and its tools.
@param planned the scope Swift test files.
*/
export async function checkSwiftSkipReasons(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const skipped = listUnexplainedSkips(source.rootNode, source.text.split('\n'));
        for (const node of skipped)
            findings.push({
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                rule: DISABLED_TEST_RULE,
                message: DISABLED_TEST_MESSAGE,
            });
    });
    return findings;
}
