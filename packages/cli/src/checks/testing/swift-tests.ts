import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { COMMENT_LINE, XCTEST_PREFIX, SKIP_REASON_ARGUMENT, SWIFT_STRING_LITERAL } from '#cli/config/checks/testing.ts';

function hasReason(value: Node | undefined): boolean {
    if (value === undefined || value.text === 'nil') return false;
    if (!value.type.endsWith('string_literal')) return true;
    const literal = SWIFT_STRING_LITERAL.exec(value.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[3] ?? '').replaceAll(whitespace, ' ').trim() !== '';
}

function skipReason(call: Node, position: number): Node | undefined {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    const positional =
        argumentsNode?.namedChildren.filter(
            (node) => node.type === 'value_argument' && node.childForFieldName('name') === null,
        ) ?? [];
    return positional[position]?.childForFieldName('value') ?? undefined;
}

function disabledNodes(root: Node, lines: string[]): Node[] {
    const calls = root.descendantsOfType('call_expression').filter((call) => {
        const name = call.firstNamedChild?.text.replace(XCTEST_PREFIX, '') ?? '';
        const position = SKIP_REASON_ARGUMENT.get(name);
        if (position === undefined) return false;
        return !hasReason(skipReason(call, position));
    });
    const attributes = root.descendantsOfType('attribute').filter((attribute) => {
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
 * One finding for each skipped test without a reason argument or unavailable declaration without an explanation.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftTestsSkipReasons(input: CheckInput): Promise<Finding[]> {
    const files = input.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of disabledNodes(source.rootNode, source.text.split('\n')))
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: node.startPosition.row + 1 },
                    'disabled',
                    'Explain why this test is disabled in its reason argument or availability annotation.',
                ),
            );
    });
    return findings;
}
