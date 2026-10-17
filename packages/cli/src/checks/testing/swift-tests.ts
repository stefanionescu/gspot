import type { Node } from 'web-tree-sitter';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { locateNode, buildFinding } from '#cli/checks/finding.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { COMMENT_LINE, XCTEST_PREFIX, SKIP_REASON_ARGUMENT, SWIFT_STRING_LITERAL } from '#cli/config/checks/testing.ts';

function hasReason(value: Node | undefined): boolean {
    if (value === undefined || value.text === 'nil') return false;
    if (!value.type.endsWith('string_literal')) return true;
    const literal = SWIFT_STRING_LITERAL.exec(value.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[3] ?? '').replaceAll(whitespace, ' ').trim() !== '';
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

function listUnexplainedSkips(root: Node, lines: string[]): Node[] {
    const calls = root.descendantsOfType('call_expression').filter((call) => {
        const name = call.firstNamedChild?.text.replace(XCTEST_PREFIX, '') ?? '';
        const position = SKIP_REASON_ARGUMENT.get(name);
        if (position === undefined) return false;
        return !hasReason(findSkipReason(call, position));
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
 * Reports each skipped test without a reason, and each unavailable declaration without an explanation.
 * @param input the scope Swift test files.
 * @returns the findings.
 */
export async function checkSwiftSkipReasons(input: CheckInput): Promise<Finding[]> {
    const files = input.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of listUnexplainedSkips(source.rootNode, source.text.split('\n')))
            findings.push(
                buildFinding(
                    input,
                    locateNode(source.path, node),
                    'disabled',
                    'Explain why this test is disabled in its reason argument or availability annotation.',
                ),
            );
    });
    return findings;
}
